'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth/viewer';
import { siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { claimEmail, claimMirrorEmail } from '@/lib/email/templates/claim';
import { createFormat } from '@/lib/format';
import { emailLocaleOf } from '@/lib/email/text';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ClaimEventKind, ClaimKind, ClaimStatus, PartyRole } from '@/types/db';

/**
 * Действия по claims.
 *
 * Всё, что меняет спор, делают функции базы под сессией пользователя:
 * кто сторона, что можно в каком статусе, — решено там один раз, и
 * RLS с политиками Storage проверяются по-настоящему. Служебный ключ
 * здесь только читает адреса для писем: у стороны нет права видеть
 * почту другой стороны, а письмо ей отправить надо.
 *
 * Уведомление в кабинете пишет триггер базы на каждое событие ленты.
 * Письмо идёт следом, отсюда, и может не дойти, ничего не сломав.
 */

export type ClaimState = { error: string | null; done?: boolean };

const BUCKET = 'claim-docs';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const KINDS = [
  'CARGO_DAMAGE',
  'SHORTAGE',
  'DOWNTIME',
  'DEVIATION',
  'OTHER',
] as const satisfies readonly ClaimKind[];
const STATUSES = [
  'OPEN',
  'IN_REVIEW',
  'RESOLVED',
  'REJECTED',
] as const satisfies readonly ClaimStatus[];

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

/** Корень раздела claims для роли. */
function section(role: PartyRole): string {
  return role === 'ADMIN'
    ? '/admin/claims'
    : role === 'CARRIER'
      ? '/carrier/claims'
      : '/shipper/claims';
}

function revalidateClaims(locale: string, claimId?: string) {
  for (const root of ['/shipper/claims', '/carrier/claims', '/admin/claims']) {
    revalidatePath(`/${locale}${root}`);
    if (claimId) revalidatePath(`/${locale}${root}/${claimId}`);
  }
}

/**
 * Код отказа базы — в понятную фразу.
 *
 * Отказы здесь про права и порядок: не ваша сторона, claim закрыт,
 * решение без описания. Текст Postgres человеку ничего не скажет.
 */
async function explain(locale: Locale, code: string | undefined): Promise<string> {
  const t = await getDictionary(locale);
  if (code === '42501' || code === 'P0002') return t.error.forbidden;
  if (code === '55000') return t.claims.notAllowed;
  if (code === '22023') return t.claims.resolutionHint;
  return t.claims.failed;
}

async function ready(locale: Locale) {
  const viewer = await getViewer();
  if (viewer.status !== 'ready')
    return {
      viewer: null,
      error: (await getDictionary(locale)).error.forbidden,
    };
  return { viewer, error: null };
}

/** Файл из формы, если он есть и годится. Строка — текст ошибки. */
async function readFile(formData: FormData, locale: Locale): Promise<File | null | string> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return null;

  const t = await getDictionary(locale);
  if (file.size > MAX_BYTES) return t.documents.tooLarge;
  if (!ALLOWED_TYPES.includes(file.type)) return t.documents.wrongType;
  return file;
}

/**
 * Файл в Storage, затем строка и событие ленты.
 *
 * Клиентом пользователя: политика бакета пускает только сторону claim.
 * Не записалась строка — файл убирается, иначе в бакете остался бы
 * объект, о котором база не знает.
 */
async function attach(
  supabase: Awaited<ReturnType<typeof createClient>>,
  claimId: string,
  file: File,
  note: string | null,
): Promise<string | null> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${claimId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) return uploadError.message;

  const { error } = await supabase.rpc('attach_to_claim', {
    p_claim_id: claimId,
    p_storage_path: path,
    p_file_name: file.name,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_note: note ?? undefined,
  });

  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return error.code ?? error.message;
  }

  return null;
}

/* ── Письма ────────────────────────────────────────────────────── */

const MIRROR_FACT = 'Välitetty';

/**
 * Письма о событии claim.
 *
 * Спор идёт через оператора (миграция claims_mirror):
 *
 *   подача     — второй стороне зеркало от имени Aivomaa Oy с полным
 *                текстом и вложениями, ответ приходит оператору; оператору —
 *                уведомление, куда ушло зеркало;
 *   сообщение  — подавшего получает оператор, с текстом; оператора —
 *                подавший; вторую сторону переписка в кабинете не касается,
 *                с ней оператор говорит почтой;
 *   статус     — обеим сторонам, кроме той, что его поставила.
 *
 * Reply-To у всех писем — ящик оператора: на что бы ни ответил человек,
 * ответ попадёт тому, кто ведёт спор, а не на noreply.
 */
async function mailClaimEvent(
  claimId: string,
  event: ClaimEventKind,
  actor: PartyRole,
  message?: string | null,
) {
  try {
    const admin = createAdminClient();

    const { data: claim } = await admin
      .from('claims')
      .select(
        'id, ref, kind, status, filed_by_role, description, amount_cents, stop_id, resolution, order_id, filed_by_company_id, against_company_id',
      )
      .eq('id', claimId)
      .single();

    if (!claim) return;

    const [{ data: order }, { data: companies }, { data: stops }, { data: files }] =
      await Promise.all([
        admin
          .from('orders')
          .select('ref, shipper_company_id, closed_at, assigned_vehicle_id')
          .eq('id', claim.order_id)
          .single(),
        admin
          .from('companies')
          .select('id, name, language, contact_email, billing_email, frozen_at')
          .in('id', [claim.filed_by_company_id, claim.against_company_id]),
        admin
          .from('order_stops')
          .select('id, sequence, city, place_name')
          .eq('order_id', claim.order_id)
          .order('sequence'),
        admin
          .from('claim_attachments')
          .select('storage_path, file_name')
          .eq('claim_id', claimId)
          .order('created_at'),
      ]);

    if (!order) return;

    const base = siteUrl();
    const operator = operatorInbox();
    const filedBy = claim.filed_by_role === 'CARRIER' ? 'CARRIER' : 'SHIPPER';
    const roleOf = (companyId: string): PartyRole =>
      companyId === order.shipper_company_id ? 'SHIPPER' : 'CARRIER';

    /* Контактный адрес, а не бухгалтерский: спор ведёт диспетчер. */
    const reachable = (companyId: string) => {
      const company = (companies ?? []).find((c) => c.id === companyId);
      if (!company || company.frozen_at) return null;
      const to = company.contact_email ?? company.billing_email;
      return to ? { to, locale: emailLocaleOf(company.language) } : null;
    };

    const toParty = async (companyId: string) => {
      const target = reachable(companyId);
      if (!target) return;
      await sendEmail(
        claimEmail({
          event,
          to: target.to,
          companyId,
          locale: target.locale,
          claimRef: claim.ref,
          orderRef: order.ref,
          kind: claim.kind,
          status: claim.status,
          filedBy,
          resolution: claim.resolution,
          link: `${base}/${target.locale}${section(roleOf(companyId))}/${claim.id}`,
          operatorEmail: operator,
        }),
      );
    };

    const toOperator = (extraRows?: Array<[string, string]>) =>
      sendEmail(
        claimEmail({
          event,
          to: operator,
          companyId: null,
          locale: 'fi',
          claimRef: claim.ref,
          orderRef: order.ref,
          kind: claim.kind,
          status: claim.status,
          filedBy,
          resolution: claim.resolution,
          link: `${base}/fi/admin/claims/${claim.id}`,
          operatorEmail: operator,
          forOperator: true,
          extraRows,
          message,
        }),
      );

    if (event === 'CREATED') {
      const target = reachable(claim.against_company_id);
      let forwarded: string | null = null;

      if (target) {
        const f = createFormat((await getDictionary(target.locale)).meta.intl);
        const vehicle = order.assigned_vehicle_id
          ? ((
              await admin
                .from('vehicles')
                .select('plate')
                .eq('id', order.assigned_vehicle_id)
                .single()
            ).data?.plate ?? null)
          : null;
        const place = (stops ?? []).find((s) => s.id === claim.stop_id);
        const route = (stops ?? [])
          .map((s) => s.city || s.place_name)
          .filter(Boolean)
          .join(' – ');

        const result = await sendEmail(
          claimMirrorEmail({
            to: target.to,
            companyId: claim.against_company_id,
            locale: target.locale,
            claimRef: claim.ref,
            orderRef: order.ref,
            filedBy,
            kind: claim.kind,
            description: claim.description,
            route: route || null,
            closedAt: order.closed_at ? f.dateTime(order.closed_at) : null,
            vehicle,
            place: place ? `${place.sequence + 1}. ${place.place_name || place.city}` : null,
            amount: claim.amount_cents != null ? f.eur(claim.amount_cents) : null,
            attachments: (files ?? []).map((file) => ({
              bucket: BUCKET,
              path: file.storage_path,
              filename: file.file_name,
            })),
            link: `${base}/${target.locale}${section(roleOf(claim.against_company_id))}/${claim.id}`,
            operatorEmail: operator,
          }),
        );

        /*
         * Отметка о зеркале — когда письмо легло в журнал: по ней видно,
         * когда вторая сторона узнала о претензии. Сбой провайдера виден
         * оператору в журнале писем и в письме ему ниже.
         */
        if (result.outboxId !== null) {
          forwarded =
            result.sent || result.error === undefined
              ? target.to
              : `${target.to} (${result.error})`;
          await admin
            .from('claims')
            .update({ mirrored_at: new Date().toISOString(), mirrored_to: target.to })
            .eq('id', claimId);
        }
      }

      await toOperator([[MIRROR_FACT, forwarded ?? '—']]);
      return;
    }

    if (event === 'COMMENT' || event === 'ATTACHMENT') {
      if (actor === 'ADMIN') await toParty(claim.filed_by_company_id);
      else await toOperator();
      return;
    }

    /* STATUS */
    for (const companyId of [claim.filed_by_company_id, claim.against_company_id]) {
      if (actor !== 'ADMIN' && roleOf(companyId) === actor) continue;
      await toParty(companyId);
    }
    if (actor !== 'ADMIN') await toOperator();
  } catch (cause) {
    /* Письмо — дубль уведомления в кабинете; его сбой не отменяет действие. */
    console.error('claim: письмо не отправлено:', cause instanceof Error ? cause.message : cause);
  }
}

/* ── Подать ────────────────────────────────────────────────────── */

export async function fileClaimAction(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const { viewer, error: forbidden } = await ready(locale);
  if (!viewer) return { error: forbidden };
  if (viewer.role !== 'SHIPPER' && viewer.role !== 'CARRIER') return { error: t.error.forbidden };

  const kind = String(formData.get('kind') ?? '') as ClaimKind;
  if (!KINDS.includes(kind)) return { error: t.claims.failed };

  const description = String(formData.get('description') ?? '').trim();
  if (description.length < 10) return { error: t.claims.tooShort };

  /* Евро с запятой или точкой — в целые центы. Пусто — суммы нет. */
  const rawAmount = String(formData.get('amount') ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  let amountCents: number | undefined;
  if (rawAmount) {
    const value = Number(rawAmount);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000)
      return { error: t.validation.required };
    amountCents = Math.round(value * 100);
  }

  const file = await readFile(formData, locale);
  if (typeof file === 'string') return { error: file };

  const supabase = await createClient();
  const { data: claim, error } = await supabase.rpc('file_claim', {
    p_order_id: String(formData.get('order_id') ?? ''),
    p_kind: kind,
    p_description: description,
    p_stop_id: String(formData.get('stop_id') ?? '') || undefined,
    p_amount_cents: amountCents,
  });

  if (error || !claim) return { error: await explain(locale, error?.code) };

  /*
   * Вложение при подаче — отдельным событием ленты после CREATED. Не
   * загрузилось — claim всё равно подан: фото можно приложить потом, а
   * потерять из-за него описание было бы хуже.
   */
  if (file) await attach(supabase, claim.id, file, null);

  await mailClaimEvent(claim.id, 'CREATED', viewer.role);

  revalidateClaims(locale, claim.id);
  redirect(`/${locale}${section(viewer.role)}/${claim.id}`);
}

/* ── Комментарий, с файлом или без ─────────────────────────────── */

export async function commentClaimAction(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const { viewer, error: forbidden } = await ready(locale);
  if (!viewer) return { error: forbidden };

  const claimId = String(formData.get('claim_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();

  const file = await readFile(formData, locale);
  if (typeof file === 'string') return { error: file };
  if (!body && !file) return { error: t.validation.required };

  const supabase = await createClient();

  /*
   * С файлом — одно событие ATTACHMENT с текстом как подписью. Два
   * события подряд («написал», «приложил») читались бы как два разных
   * действия, хотя человек нажал одну кнопку.
   */
  if (file) {
    const failure = await attach(supabase, claimId, file, body || null);
    if (failure) {
      return {
        error: failure.length === 5 ? await explain(locale, failure) : t.documents.uploadFailed,
      };
    }
    await mailClaimEvent(claimId, 'ATTACHMENT', viewer.role, body || null);
  } else {
    const { error } = await supabase.rpc('comment_claim', {
      p_claim_id: claimId,
      p_body: body,
    });
    if (error) return { error: await explain(locale, error.code) };
    await mailClaimEvent(claimId, 'COMMENT', viewer.role, body);
  }

  revalidateClaims(locale, claimId);
  return { error: null, done: true };
}

/* ── Статус ────────────────────────────────────────────────────── */

export async function setClaimStatusAction(
  _previous: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const { viewer, error: forbidden } = await ready(locale);
  if (!viewer) return { error: forbidden };

  const status = String(formData.get('status') ?? '') as ClaimStatus;
  if (!STATUSES.includes(status)) return { error: t.claims.failed };

  const claimId = String(formData.get('claim_id') ?? '');
  const note = String(formData.get('note') ?? '').trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_claim_status', {
    p_claim_id: claimId,
    p_status: status,
    p_note: note || undefined,
  });

  if (error) return { error: await explain(locale, error.code) };

  await mailClaimEvent(claimId, 'STATUS', viewer.role);

  revalidateClaims(locale, claimId);
  return { error: null, done: true };
}

/* ── Ссылка на вложение ────────────────────────────────────────── */

/**
 * На пять минут и клиентом пользователя: политика бакета проверяется в
 * момент выдачи, и чужой claim по известному пути не откроется.
 */
export async function claimFileUrlAction(storagePath: string): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);
  return data?.signedUrl ?? null;
}
