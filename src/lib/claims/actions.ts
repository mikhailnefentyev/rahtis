'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { ClaimKind, ClaimStatus } from '@/types/db';
import { ALLOWED_TYPES, BUCKET, KINDS, MAX_BYTES, STATUSES, mailClaimEvent, section } from './mail';

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

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
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
