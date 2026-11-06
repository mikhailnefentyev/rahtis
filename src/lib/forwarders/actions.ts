'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { explainAdmin, withAdminError } from '@/lib/admin/errors';
import { requireRole } from '@/lib/auth/guard';
import { getViewer } from '@/lib/auth/viewer';
import { todayInHelsinki } from '@/lib/dates';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { emailLocaleOf } from '@/lib/email/text';
import { isCurrency } from '@/lib/money/currency';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isShipperDocKind } from '@/lib/shipper-docs/model';
import { isForwarderTerms, parseAmountCents } from './policy';
import { notifyForwarder } from './reminders';

const BUCKET = 'company-docs';
/* Как у документов перевозчика (src/lib/fleet/actions.ts): совпадает с бакетом. */
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const text = (form: FormData, key: string, max: number): string | null => {
  const value = String(form.get(key) ?? '').trim().replace(/\s+/g, ' ');
  return value.length > 0 ? value.slice(0, max) : null;
};

function revalidateForwarder(locale: Locale) {
  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/shipper`, 'layout');
  revalidatePath(`/${locale}/admin`, 'layout');
}

/* ── Документы экспедитора ─────────────────────────────────────── */

export type ForwarderUploadState = { error: string | null; done: number };

/**
 * Полис экспедитора или польская лицензия посредника.
 *
 * Путь тот же, что у лицензии перевозчика: файл через сервер клиентом
 * пользователя (политики Storage и RLS проверяются по-настоящему), при
 * неудачной вставке строки файл убирается. Решение оператора компания
 * себе не выпишет — поля решения сбрасывает триггер базы.
 */
export async function uploadForwarderDocumentAction(
  previous: ForwarderUploadState,
  formData: FormData,
): Promise<ForwarderUploadState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const fw = t.forwarder;
  const viewer = await requireRole(locale, 'SHIPPER');
  const company = viewer.company!;
  const fail = (error: string): ForwarderUploadState => ({ error, done: previous.done });

  const kind = String(formData.get('kind') ?? '');
  if (kind !== 'FORWARDER_INSURANCE' && kind !== 'FORWARDER_LICENSE') return fail(fw.errorFailed);
  /* Лицензия посредника нужна только польской компании. */
  if (kind === 'FORWARDER_LICENSE' && company.country !== 'PL') return fail(fw.errorFailed);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail(t.validation.required);
  if (file.size > MAX_BYTES) return fail(t.documents.tooLarge);
  if (!ALLOWED_TYPES.includes(file.type)) return fail(t.documents.wrongType);

  const validUntil = String(formData.get('valid_until') ?? '').trim() || null;
  if (validUntil && !ISO_DATE.test(validUntil)) return fail(fw.errorFields);
  if (validUntil && validUntil < todayInHelsinki()) return fail(fw.errorPast);

  let fields: Record<string, unknown> = {};
  if (kind === 'FORWARDER_INSURANCE') {
    const insurer = text(formData, 'insurer', 200);
    const policyNumber = text(formData, 'policy_number', 100);
    const limitEvent = parseAmountCents(String(formData.get('limit_event') ?? ''));
    const limitYear = parseAmountCents(String(formData.get('limit_year') ?? ''));
    const currency = String(formData.get('limit_currency') ?? 'EUR').toUpperCase();
    const terms = String(formData.get('terms') ?? '');

    if (!validUntil || !insurer || !policyNumber || !isCurrency(currency)) return fail(fw.errorFields);
    if (!limitEvent || !limitYear || limitYear < limitEvent) return fail(fw.errorLimits);

    fields = {
      insurer,
      policy_number: policyNumber,
      limit_event_cents: limitEvent,
      limit_year_cents: limitYear,
      limit_currency: currency,
      cmr_covered: formData.get('cmr_covered') === '1',
      territory: text(formData, 'territory', 300),
      terms: isForwarderTerms(terms) ? terms : null,
    };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${company.id}/${kind}/${crypto.randomUUID()}-${safeName}`;
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail(t.documents.uploadFailed);

  const { error: insertError } = await supabase.from('company_documents').insert({
    company_id: company.id,
    kind,
    storage_path: path,
    file_name: file.name.slice(-120),
    mime_type: file.type,
    size_bytes: file.size,
    valid_until: validUntil,
    uploaded_by: viewer.userId,
    ...fields,
  });

  if (insertError) {
    console.error('Документ экспедитора не сохранён:', insertError.message);
    /* У компании нет DELETE в бакете — убирает служебный ключ, ровно этот путь. */
    await createAdminClient().storage.from(BUCKET).remove([path]);
    return fail(fw.errorFailed);
  }

  revalidateForwarder(locale);
  return { error: null, done: previous.done + 1 };
}

/* ── Роль заказчика ────────────────────────────────────────────── */

export type ShipperRoleState = { error: string | null; saved: boolean };

/** Экспедитор или грузовладелец. Меняет владелец компании, не диспетчер (база проверит ещё раз). */
export async function setShipperRoleAction(_previous: ShipperRoleState, formData: FormData): Promise<ShipperRoleState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (
    viewer.status !== 'ready' ||
    viewer.role !== 'SHIPPER' ||
    !viewer.company ||
    viewer.profile.member_kind === 'DISPATCHER'
  ) {
    return { error: t.forwarder.roleOwnerOnly, saved: false };
  }

  const role = String(formData.get('shipper_role') ?? '');
  if (role !== 'FORWARDER' && role !== 'CARGO_OWNER') return { error: t.forwarder.roleError, saved: false };

  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ shipper_role: role }).eq('id', viewer.company.id);
  if (error) return { error: t.forwarder.roleError, saved: false };

  revalidateForwarder(locale);
  return { error: null, saved: true };
}

/* ── Оператор ──────────────────────────────────────────────────── */

/**
 * Одобрить или отклонить документ экспедитора или заказчика (выписка,
 * налоговые справки, право подписи — 6.11.2026). Компании — уведомление в
 * кабинете и письмо: отказ без причины ничего не объясняет, причину база
 * требует сама.
 */
export async function reviewForwarderDocumentAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') throw new Error('forbidden');

  const documentId = String(formData.get('document_id') ?? '');
  const decision = formData.get('decision') === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);
  /* Куда вернуть: пульт или карточка компании. */
  const back = String(formData.get('back') ?? '');
  const returnTo = back.startsWith(`/${locale}/admin`) ? back : `/${locale}/admin`;

  const supabase = await createClient();
  const { data: doc, error } = await supabase.rpc('review_company_document', {
    p_document_id: documentId,
    p_decision: decision,
    p_note: note || undefined,
  });

  revalidateForwarder(locale);
  if (error || !doc) {
    console.error('Решение по документу экспедитора не записано:', error?.message);
    redirect(withAdminError(returnTo, explainAdmin(error) ?? 'generic'));
  }

  await announceReview(doc.company_id, doc.kind, decision, doc.review_note);
  redirect(returnTo);
}

async function announceReview(companyId: string, kind: string, decision: 'APPROVED' | 'REJECTED', note: string | null) {
  const { data: company } = await createAdminClient()
    .from('companies')
    .select('id, language, contact_email')
    .eq('id', companyId)
    .maybeSingle();
  if (!company) return;

  const t = await getDictionary(emailLocaleOf(company.language));
  const fw = t.forwarder;
  /* Документ заказчика — свой текст: про прямой режим и полис там ни слова. */
  const shipperDoc = isShipperDocKind(kind);
  const what = shipperDoc
    ? t.documents[kind]
    : kind === 'FORWARDER_LICENSE'
      ? fw.licenseTitle
      : fw.insuranceTitle;
  const approvedBody = shipperDoc ? t.shipperDocs.approvedBody : fw.approvedBody;
  const rejectedBody = shipperDoc ? t.shipperDocs.rejectedBody : fw.rejectedBody;

  await notifyForwarder({
    companyId: company.id,
    language: company.language,
    contactEmail: company.contact_email,
    template: 'forwarder.review',
    title: (decision === 'APPROVED' ? fw.approvedTitle : fw.rejectedTitle).replace('{document}', what),
    lead: decision === 'APPROVED' ? approvedBody : rejectedBody.replace('{note}', note ?? '—'),
    button: fw.openAccount,
  });
}
