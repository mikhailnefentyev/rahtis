'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { todayInHelsinki } from '@/lib/dates';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isShipperDocKind, needsIssuedOn } from './model';

const BUCKET = 'company-docs';
/* Как у документов перевозчика и полиса экспедитора: совпадает с бакетом. */
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

function date(formData: FormData, key: string): string | null | false {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) return null;
  return ISO_DATE.test(value) ? value : false;
}

export type ShipperDocUploadState = { error: string | null; done: number };

/**
 * Выписка из реестра, налоговая справка, подтверждение НДС или документ
 * о праве подписи (6.11.2026). Необязательно; проверяет оператор.
 *
 * Путь тот же, что у полиса экспедитора: файл клиентом пользователя
 * (политики Storage и RLS проверяются по-настоящему), при неудачной
 * вставке строки файл убирается. Решение оператора сбрасывает триггер
 * базы, вид «только у заказчика» проверяет тоже база.
 */
export async function uploadShipperDocumentAction(
  previous: ShipperDocUploadState,
  formData: FormData,
): Promise<ShipperDocUploadState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const sd = t.shipperDocs;
  const viewer = await requireRole(locale, 'SHIPPER');
  const company = viewer.company!;
  const fail = (error: string): ShipperDocUploadState => ({ error, done: previous.done });

  const kind = String(formData.get('kind') ?? '');
  if (!isShipperDocKind(kind)) return fail(t.forwarder.errorFailed);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail(t.validation.required);
  if (file.size > MAX_BYTES) return fail(t.documents.tooLarge);
  if (!ALLOWED_TYPES.includes(file.type)) return fail(t.documents.wrongType);

  const issuedOn = date(formData, 'issued_on');
  const validUntil = date(formData, 'valid_until');
  if (issuedOn === false || validUntil === false) return fail(t.forwarder.errorFailed);
  if (!issuedOn && needsIssuedOn(kind)) return fail(sd.errorIssuedOn);
  if (issuedOn && issuedOn > todayInHelsinki()) return fail(sd.errorFuture);
  if (issuedOn && validUntil && validUntil < issuedOn) return fail(sd.errorUntil);

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
    issued_on: issuedOn,
    valid_until: validUntil,
    uploaded_by: viewer.userId,
  });

  if (insertError) {
    console.error('Документ заказчика не сохранён:', insertError.message);
    /* У компании нет DELETE в бакете — убирает служебный ключ, ровно этот путь. */
    await createAdminClient().storage.from(BUCKET).remove([path]);
    return fail(t.forwarder.errorFailed);
  }

  revalidatePath(`/${locale}/account`);
  revalidatePath(`/${locale}/admin`, 'layout');
  return { error: null, done: previous.done + 1 };
}
