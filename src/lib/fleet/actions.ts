'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { DocumentKind, EuroClass, VehicleClass } from '@/types/db';

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

  /*
   * Документ компании открывает стол заказов: меняется готовность, а её
   * читают кабинет перевозчика и очередь допусков у оператора.
   */
  revalidatePath(`/${locale}/carrier`, 'layout');
  revalidatePath(`/${locale}/admin`);
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

/** Число из поля формы: пусто и мусор равны «не указано». */
function num(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? '').replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readVehicleForm(formData: FormData) {
  const vehicleClass = String(formData.get('vehicle_class') ?? 'TRACTOR') as VehicleClass;
  const express = vehicleClass !== 'TRACTOR';

  return {
    plate: String(formData.get('plate') ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ''),
    /*
     * Оси у фургона и грузовика не спрашиваются: правило «две оси — 25
     * тонн» написано про седельный тягач и к кузову неприменимо. Колонка
     * при этом NOT NULL, поэтому туда идёт двойка — не как утверждение о
     * машине, а как значение, которым никто не пользуется:
     * app.vehicle_capacity_kg читает у неё payload_kg.
     */
    axles: express ? 2 : Number(formData.get('axles') ?? 0),
    adr: formData.get('adr') === '1',
    vehicle_class: vehicleClass,
    /*
     * Лишнее обнуляется здесь, а не оставляется формой: ограничение
     * vehicles_express_capacity не пропустит тягача с метрами кузова, и
     * человек увидел бы отказ прав на карточке, заполненной правильно.
     */
    payload_kg: express ? num(formData, 'payload_kg') : null,
    ldm: express ? num(formData, 'ldm') : null,
    tail_lift: express && formData.get('tail_lift') === '1',
    side_loading: express && formData.get('side_loading') === '1',
    reefer: express && formData.get('reefer') === '1',
    reefer_inspection_until:
      express && formData.get('reefer') === '1' ? text(formData, 'reefer_inspection_until') : null,
    /*
     * Длины контейнеров приходят набором флажков с одним именем.
     * Массив, а не «максимальная длина»: раздвижное шасси берёт двадцатку
     * и сороковку, но не тридцатку, а платформа под 45 футов не всегда
     * имеет замки под 20 — одно число здесь врёт в обе стороны.
     */
    container_feet: express
      ? []
      : formData
          .getAll('container_feet')
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0),
    make: String(formData.get('make') ?? '').trim(),
    euro_class: String(formData.get('euro_class') ?? '') as EuroClass,
    base_city: String(formData.get('base_city') ?? '').trim(),
    /*
     * Координата базы приходит скрытыми полями подсказки — теми же, что
     * у адреса точки маршрута. Набранный руками город координат не имеет,
     * и это не ошибка: карточка сохранится, просто машина не попадёт на
     * карту транспорта, пока базу не выберут из списка.
     */
    base_lat: num(formData, 'base_city_lat') ?? null,
    base_lon: num(formData, 'base_city_lon') ?? null,
    base_country: text(formData, 'base_city_country'),
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

  /*
   * Грузоподъёмность и метры — не украшение карточки: по ним подбирается
   * машина под заказ. Без них ограничение базы откажет кодом, из которого
   * человеку ничего не ясно, поэтому спрашиваем здесь.
   */
  if (values.vehicle_class !== 'TRACTOR' && (!values.payload_kg || !values.ldm)) {
    return { error: t.validation.required, done: false };
  }

  if (values.reefer && !values.reefer_inspection_until) {
    return { error: t.validation.required, done: false };
  }

  const supabase = await createClient();
  const id = text(formData, 'id');

  const { data, error } = id
    ? await supabase.from('vehicles').update(values).eq('id', id).select('id').single()
    : await supabase
        .from('vehicles')
        .insert({ ...values, company_id: company.id })
        .select('id')
        .single();

  if (error || !data) {
    /* 23505 — номер уже занят допущенной машиной другой компании. */
    return {
      error: error?.code === '23505' ? t.error.generic : (error?.message ?? t.error.generic),
      done: false,
    };
  }

  /*
   * Водитель — отдельная привязка, а не поле карточки: у неё своя
   * история, и пишет её только функция базы. Вызывается, лишь когда
   * выбор изменился, — иначе каждое сохранение карточки рвало бы
   * интервал привязки на два одинаковых.
   */
  const driverId = text(formData, 'driver_id');
  if (driverId !== text(formData, 'current_driver_id')) {
    const { error: assignError } = await supabase.rpc('assign_vehicle_driver', {
      p_vehicle_id: data.id,
      p_driver_id: driverId as string,
    });
    if (assignError) return { error: t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier/fleet`);
  revalidatePath(`/${locale}/carrier/drivers`);
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
