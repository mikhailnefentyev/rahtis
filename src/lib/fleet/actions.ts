'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { DocumentKind, EuroClass } from '@/types/db';

const BUCKET = 'company-docs';

/** Совпадает с allowed_mime_types бакета — Storage откажет в любом случае. */
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const text = (form: FormData, key: string): string | null => {
  const value = String(form.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
};

async function requireCarrier() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company) {
    throw new Error('forbidden');
  }
  return viewer;
}

/* ── Документы компании ─────────────────────────────────────────── */

export type UploadState = { error: string | null };

/**
 * Загрузка лицензии или страховки.
 *
 * Файл идёт через сервер, а не напрямую в Storage. При прямой загрузке
 * обрыв между записью файла и записью строки оставил бы файл, о котором
 * база не знает; здесь при неудачной вставке загруженный объект удаляется.
 *
 * Оба шага выполняются клиентом пользователя, поэтому политики Storage и
 * RLS проверяются по-настоящему — секретный ключ тут не участвует.
 */
export async function uploadDocumentAction(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await requireCarrier();
  const company = viewer.company!;

  const kind = String(formData.get('kind') ?? '') as DocumentKind;
  if (kind !== 'CARRIER_LICENSE' && kind !== 'INSURANCE') {
    return { error: t.documents.uploadFailed };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: t.validation.required };
  }
  if (file.size > MAX_BYTES) return { error: t.documents.tooLarge };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: t.documents.wrongType };

  const validUntil = text(formData, 'valid_until');
  if (kind === 'INSURANCE' && !validUntil) {
    return { error: t.documents.validUntilRequired };
  }

  /*
   * Первый сегмент пути — идентификатор компании: по нему политики Storage
   * решают, своя это папка или чужая. Имя файла обезличивается префиксом,
   * чтобы две загрузки с одинаковым именем не перезаписали друг друга.
   */
  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${company.id}/${kind}/${crypto.randomUUID()}-${safeName}`;

  const supabase = await createClient();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: t.documents.uploadFailed };
  }

  const { error: insertError } = await supabase.from('company_documents').insert({
    company_id: company.id,
    kind,
    storage_path: path,
    file_name: file.name.slice(-120),
    mime_type: file.type,
    size_bytes: file.size,
    valid_until: validUntil,
    uploaded_by: viewer.userId,
  });

  if (insertError) {
    /* Запись не удалась — файл без неё бесполезен, убираем. */
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: t.documents.uploadFailed };
  }

  revalidatePath(`/${locale}`, 'layout');
  return { error: null };
}

/**
 * Подписанная ссылка на просмотр документа.
 *
 * Выписывается клиентом пользователя: политики Storage проверяются ещё раз
 * в момент выдачи, поэтому чужой документ подписать не получится. Ссылка
 * короткая — пока она жива, она действует в обход политик.
 */
export async function documentUrlAction(storagePath: string): Promise<string | null> {
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return null;

  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 300);

  return data?.signedUrl ?? null;
}

/* ── Карточки авто ──────────────────────────────────────────────── */

export type VehicleState = { error: string | null; done: boolean };

function readVehicleForm(formData: FormData) {
  return {
    plate: String(formData.get('plate') ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ''),
    driver_name: String(formData.get('driver_name') ?? '').trim(),
    languages: formData.getAll('languages').map(String),
    whatsapp: String(formData.get('whatsapp') ?? '').replace(/[\s-]/g, ''),
    axles: Number(formData.get('axles') ?? 0),
    adr: formData.get('adr') === '1',
    /*
     * Длины контейнеров приходят набором флажков с одним именем.
     * Массив, а не «максимальная длина»: раздвижное шасси берёт двадцатку
     * и сороковку, но не тридцатку, а платформа под 45 футов не всегда
     * имеет замки под 20 — одно число здесь врёт в обе стороны.
     */
    container_feet: formData
      .getAll('container_feet')
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0),
    make: String(formData.get('make') ?? '').trim(),
    euro_class: String(formData.get('euro_class') ?? '') as EuroClass,
    base_city: String(formData.get('base_city') ?? '').trim(),
  };
}

export async function saveVehicleAction(
  _previous: VehicleState,
  formData: FormData,
): Promise<VehicleState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await requireCarrier();
  const company = viewer.company!;

  const values = readVehicleForm(formData);
  if (values.languages.length === 0) {
    return { error: t.validation.required, done: false };
  }

  const supabase = await createClient();
  const id = text(formData, 'id');

  const { error } = id
    ? await supabase.from('vehicles').update(values).eq('id', id)
    : await supabase.from('vehicles').insert({ ...values, company_id: company.id });

  if (error) {
    /* 23505 — номер уже занят допущенной машиной другой компании. */
    return {
      error: error.code === '23505' ? t.error.generic : (error.message ?? t.error.generic),
      done: false,
    };
  }

  revalidatePath(`/${locale}/carrier/fleet`);
  return { error: null, done: true };
}

export async function submitVehicleAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  await supabase.rpc('submit_vehicle', { p_vehicle_id: String(formData.get('id') ?? '') });

  revalidatePath(`/${locale}/carrier/fleet`);
}

export async function deleteDraftVehicleAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  /* Политика пропустит удаление только черновика — проверка не дублируется. */
  await supabase.from('vehicles').delete().eq('id', String(formData.get('id') ?? ''));

  revalidatePath(`/${locale}/carrier/fleet`);
}

/* ── Решение оператора ──────────────────────────────────────────── */

export async function decideVehicleAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') throw new Error('forbidden');

  const supabase = await createClient();
  await supabase.rpc('decide_vehicle', {
    p_vehicle_id: String(formData.get('id') ?? ''),
    p_decision: String(formData.get('decision') ?? '') as 'APPROVED' | 'REJECTED',
    p_note: text(formData, 'reason') ?? undefined,
  });

  revalidatePath(`/${locale}/admin`);
}
