'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { explainAdmin, withAdminError } from '@/lib/admin/errors';
import { requireRole } from '@/lib/auth/guard';
import { getViewer } from '@/lib/auth/viewer';
import { operationsLocalToIso, todayInHelsinki } from '@/lib/dates';
import { flashError } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { checkCompanyRegistry } from '@/lib/registry';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { addMonths, isVerificationItem, THREE_MONTH_ITEMS, type VerificationItem } from './items';

const BUCKET = 'verification-docs';
const MAX_BYTES = 10 * 1024 * 1024;
/* Совпадает с allowed_mime_types бакета; расширение — для пути, который проверяет база. */
const EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Перепроверка в PRH не чаще раза в десять минут: открытый API общий, а снимок за минуту не меняется. */
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateAll(locale: Locale) {
  revalidatePath(`/${locale}/carrier/verification`);
  revalidatePath(`/${locale}/admin/company`, 'layout');
}

/* ── Документы ─────────────────────────────────────────────────── */

export type VerificationUploadState = { error: string | null; done: number };

/**
 * Справка или отчёт Luotettava Kumppani.
 *
 * Как и лицензия (src/lib/fleet/actions.ts), файл идёт через сервер
 * клиентом пользователя: политики Storage и RLS проверяются по-настоящему,
 * а при неудачной вставке строки загруженный файл убирается.
 */
export async function uploadVerificationAction(
  previous: VerificationUploadState,
  formData: FormData,
): Promise<VerificationUploadState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  const fail = (error: string): VerificationUploadState => ({ error, done: previous.done });

  const source = formData.get('source') === 'VASTUU' ? 'VASTUU' : 'ITEM';
  const items = [...new Set(formData.getAll('items').map(String))].filter(isVerificationItem) as VerificationItem[];
  if (items.length === 0) return fail(t.verification.pickItems);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail(t.validation.required);
  if (file.size > MAX_BYTES) return fail(t.documents.tooLarge);
  const extension = EXTENSION[file.type];
  if (!extension) return fail(t.verification.wrongType);

  const today = todayInHelsinki();
  const issuedOn = String(formData.get('issued_on') ?? '').trim();
  if (!ISO_DATE.test(issuedOn) || issuedOn < '2000-01-01') return fail(t.verification.badDates);
  if (issuedOn > today) return fail(t.verification.issuedInFuture);

  /*
   * Трёхмесячные справки — дата выдачи + 3 месяца, без правки. Свой срок
   * (TES, työterveyshuolto, страховка) — из формы, по умолчанию те же
   * три месяца. Отчёт, в котором есть хоть один трёхмесячный пункт,
   * живёт три месяца целиком.
   */
  const threeMonths = addMonths(issuedOn, 3);
  const fixed = items.some((i) => THREE_MONTH_ITEMS.includes(i));
  const own = String(formData.get('valid_until') ?? '').trim();
  const validUntil = fixed || !own ? threeMonths : own;
  if (!ISO_DATE.test(validUntil) || validUntil < issuedOn || validUntil > addMonths(issuedOn, 60)) {
    return fail(t.verification.badDates);
  }
  if (validUntil < today) return fail(t.verification.tooOld);

  const path = `${company.id}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail(t.documents.uploadFailed);

  const { error: insertError } = await supabase.from('verification_documents').insert({
    company_id: company.id,
    items,
    source,
    storage_path: path,
    file_name: file.name.slice(-120),
    mime_type: file.type,
    size_bytes: file.size,
    issued_on: issuedOn,
    valid_until: validUntil,
    uploaded_by: viewer.userId,
  });

  if (insertError) {
    console.error('Справка tilaajavastuu не сохранена:', insertError.message);
    await createAdminClient().storage.from(BUCKET).remove([path]);
    return fail(t.documents.uploadFailed);
  }

  revalidateAll(locale);
  return { error: null, done: previous.done + 1 };
}

/**
 * Удалить свою справку. Строку удаляет клиент пользователя (RLS: только
 * своя компания), файл — служебный ключ, и только тот путь, который
 * вернула удалённая строка: база проверяет, что он в папке компании.
 */
export async function deleteVerificationAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const t = await getDictionary(locale);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('verification_documents')
    .delete()
    .eq('id', String(formData.get('id') ?? ''))
    .select('storage_path');

  if (error) {
    await flashError(t.documents.uploadFailed);
  } else if (data && data.length > 0) {
    await createAdminClient()
      .storage.from(BUCKET)
      .remove(data.map((d) => d.storage_path));
  }

  revalidateAll(locale);
}

/* ── PRH ───────────────────────────────────────────────────────── */

export type RefreshState = { error: string | null };

/**
 * Перепроверка в реестре самим перевозчиком: снимок PRH стареет за три
 * месяца, как и бумажная выписка. Та же сверка, что при заявке и в
 * админке (src/lib/registry), снимок перезаписывается служебным ключом —
 * колоночного гранта на registry_check у пользователя нет.
 */
export async function refreshRegistryAction(_previous: RefreshState, formData: FormData): Promise<RefreshState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('companies')
    .select('name, business_id, country, vat_number, registry_check')
    .eq('id', company.id)
    .single();
  if (!row) return { error: t.verification.refreshFailed };

  const last = (row.registry_check as { checkedAt?: string } | null)?.checkedAt;
  if (last && Date.now() - Date.parse(last) < REFRESH_COOLDOWN_MS) {
    return { error: t.verification.refreshTooSoon };
  }

  const registry = await checkCompanyRegistry({
    country: row.country,
    businessId: row.business_id,
    vatNumber: row.vat_number,
    name: row.name,
  });

  /* Реестр не ответил — старый снимок лучше пустого. */
  if (registry.verdict === 'ERROR') return { error: t.verification.refreshFailed };

  await admin.from('companies').update({ registry_check: registry }).eq('id', company.id);
  revalidateAll(locale);
  return { error: null };
}

/* ── Ссылки ────────────────────────────────────────────────────── */

export type ShareState = { error: string | null; done: number };

export async function createShareAction(previous: ShareState, formData: FormData): Promise<ShareState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const label = String(formData.get('label') ?? '').trim().slice(0, 120) || null;
  const expires = String(formData.get('expires_on') ?? '').trim();
  let expiresAt: string | null = null;
  if (expires) {
    if (!ISO_DATE.test(expires) || expires < todayInHelsinki()) {
      return { error: t.verification.badDates, done: previous.done };
    }
    /* Ссылка действует до конца выбранного дня по Хельсинки. */
    expiresAt = operationsLocalToIso(`${expires}T23:59`);
  }

  const supabase = await createClient();
  const { error } = await supabase.from('verification_shares').insert({
    company_id: company.id,
    token: randomBytes(32).toString('hex'),
    label,
    expires_at: expiresAt,
    created_by: viewer.userId,
  });

  if (error) {
    console.error('Ссылка на пакет не создана:', error.message);
    return { error: t.verification.shareFailed, done: previous.done };
  }

  revalidatePath(`/${locale}/carrier/verification`);
  return { error: null, done: previous.done + 1 };
}

export async function revokeShareAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');

  const supabase = await createClient();
  const { error } = await supabase
    .from('verification_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', String(formData.get('id') ?? ''));

  if (error) {
    const t = await getDictionary(locale);
    await flashError(t.verification.shareFailed);
  }
  revalidatePath(`/${locale}/carrier/verification`);
}

/* ── Оператор ──────────────────────────────────────────────────── */

async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') throw new Error('forbidden');
  return viewer;
}

export async function grantVerificationAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();
  const companyId = String(formData.get('company_id') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);

  const supabase = await createClient();
  const { error } = await supabase.rpc('grant_verification', { p_company_id: companyId, p_note: note || undefined });

  revalidatePath(`/${locale}/admin/company/${companyId}`);
  if (error) {
    console.error('Значок не выдан:', error.message);
    redirect(withAdminError(`/${locale}/admin/company/${companyId}`, explainAdmin(error)));
  }
}

export async function revokeVerificationAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();
  const companyId = String(formData.get('company_id') ?? '');
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000);

  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_verification', { p_company_id: companyId, p_note: note || undefined });

  revalidatePath(`/${locale}/admin/company/${companyId}`);
  if (error) {
    console.error('Значок не снят:', error.message);
    redirect(withAdminError(`/${locale}/admin/company/${companyId}`, explainAdmin(error)));
  }
}
