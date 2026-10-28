'use server';

import { isSemiFeature } from '@/lib/orders/haul';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { flashFailure } from '@/lib/forms/flash';
import type { BodyType, DocumentKind, EuroClass, TrailerKind, VehicleClass } from '@/types/db';

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

/*
 * Не исключение, а увод — как на страницах кабинета. Сессия в открытой
 * вкладке может смениться: истекла, вошли под другой ролью, в этом же
 * браузере открыли приглашение водителя. Исключение здесь показывало
 * перевозчику «страница не загрузилась» (сбой 2.10.2026).
 */
async function requireCarrier(locale: Locale) {
  return requireRole(locale, 'CARRIER');
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

  const viewer = await requireCarrier(locale);
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

const BODY_TYPES: readonly BodyType[] = ['TIPPER', 'CASSETTE', 'FLATBED', 'CONTAINER', 'CURTAIN', 'BOX', 'TANK', 'OTHER'];
const TRAILER_KINDS: readonly TrailerKind[] = ['SEMI', 'FULL', 'CENTER_AXLE'];

const bodyType = (formData: FormData): BodyType | null => {
  const raw = String(formData.get('body_type') ?? '');
  return (BODY_TYPES as readonly string[]).includes(raw) ? (raw as BodyType) : null;
};

/** Целые килограммы или null: пусто, мусор и ноль равны «не указано». */
const kg = (formData: FormData, key: string): number | null => {
  const value = num(formData, key);
  return value === null ? null : Math.round(value);
};

/** Метры с двумя знаками («8,2» и «8.2»); пусто или вне 1–25 м — null, ограничение базы не сработает на опечатке. */
const metres = (formData: FormData, key: string): number | null => {
  const value = num(formData, key);
  return value === null || value < 1 || value > 25 ? null : Math.round(value * 100) / 100;
};

/** Кубометры кузова с одним знаком; вне 1–99 м³ — null. */
const volume = (formData: FormData): number | null => {
  const value = num(formData, 'body_volume_m3');
  return value === null || value < 1 || value > 99 ? null : Math.round(value * 10) / 10;
};

/* У машины половина до сцепки не длиннее 15 м (ограничение базы). */
const vehicleMetres = (formData: FormData): number | null => {
  const value = metres(formData, 'coupling_distance_m');
  return value !== null && value <= 15 ? value : null;
};

function readVehicleForm(formData: FormData) {
  const vehicleClass = String(formData.get('vehicle_class') ?? 'TRACTOR') as VehicleClass;
  const express = vehicleClass === 'VAN' || vehicleClass === 'TRUCK';
  /*
   * Грузовику (nuppi) оси теперь нужны: от них зависит разрешённая масса
   * самосвала и кассетной сцепки (src/lib/fleet/mass.ts). У фургона — по-прежнему
   * двойка-заглушка. Смена осей у допущенной машины возвращает её на проверку
   * (триггер базы), поэтому поле берётся только когда его прислали.
   */
  const truckAxles = vehicleClass === 'TRUCK' || vehicleClass === 'TIPPER' ? Number(formData.get('axles') ?? 0) : 0;
  const tipper = vehicleClass === 'TIPPER';

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
    axles: tipper
      ? truckAxles
      : vehicleClass === 'TRUCK' && truckAxles >= 2 && truckAxles <= 5
        ? truckAxles
        : express
          ? 2
          : Number(formData.get('axles') ?? 0),
    /* Самосвал — только самосвальный или кассетный кузов, грузовик — только кузова для грузоперевозок (ограничения базы). */
    body_type:
      vehicleClass === 'TRACTOR'
        ? null
        : tipper
          ? ((['TIPPER', 'CASSETTE'] as const).find((b) => b === bodyType(formData)) ?? 'TIPPER')
          : bodyType(formData) === 'TIPPER' || bodyType(formData) === 'CASSETTE'
            ? null
            : bodyType(formData),
    gross_max_kg: kg(formData, 'gross_max_kg'),
    tare_kg: kg(formData, 'tare_kg'),
    /* Фургону расстояние до сцепки не нужно: прицепов у него нет. */
    coupling_distance_m: vehicleClass === 'VAN' ? null : vehicleMetres(formData),
    /* Объём кузова — только у самосвала: у грузоперевозок погрузочные метры. */
    body_volume_m3: tipper ? volume(formData) : null,
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
    container_feet: vehicleClass !== 'TRACTOR'
      ? []
      : formData
          .getAll('container_feet')
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0),
    make: String(formData.get('make') ?? '').trim(),
    euro_class: String(formData.get('euro_class') ?? '') as EuroClass,
    /*
     * База — город, а не адрес площадки. Подсказка может предложить
     * порт («Hangon satama — Korsmaninkatu 6, 10900 Hanko»), и тогда в
     * базу ложился весь адрес: карта транспорта показывала Ханко двумя
     * строками (8.10.2026). Город из выбранной подсказки важнее текста.
     */
    base_city: text(formData, 'base_city_city') ?? String(formData.get('base_city') ?? '').trim(),
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

  const viewer = await requireCarrier(locale);
  const company = viewer.company!;

  const values = readVehicleForm(formData);

  /*
   * Грузоподъёмность и метры — не украшение карточки: по ним подбирается
   * машина под заказ. Без них ограничение базы откажет кодом, из которого
   * человеку ничего не ясно, поэтому спрашиваем здесь.
   */
  if (values.vehicle_class === 'TIPPER' && !(values.axles >= 3 && values.axles <= 5)) {
    return { error: t.validation.required, done: false };
  }
  if ((values.vehicle_class === 'VAN' || values.vehicle_class === 'TRUCK') && (!values.payload_kg || !values.ldm)) {
    return { error: t.validation.required, done: false };
  }

  if (values.reefer && !values.reefer_inspection_until) {
    return { error: t.validation.required, done: false };
  }

  const supabase = await createClient();
  const id = text(formData, 'id');

  /*
   * Тот же номер второй раз в своём парке. База держит уникальность только
   * среди допущенных машин, поэтому черновик-дубль сохранялся молча, а
   * отказ получал уже оператор при допуске (прогон 12.10.2026).
   */
  const { data: fleet } = await supabase
    .from('vehicles')
    .select('id, plate')
    .eq('company_id', company.id)
    .neq('access', 'REJECTED');
  /* «TST-101» и «TST101» — один номер: сравниваем без дефисов и пробелов. */
  const bare = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g, '');
  if ((fleet ?? []).some((v) => v.id !== id && bare(v.plate) === bare(values.plate))) {
    return { error: t.fleet.plateInOwnFleet, done: false };
  }

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
      /* Текст ошибки базы — по-русски; на экран идёт только перевод. */
      error: error?.code === '23505' ? t.fleet.plateTaken : t.error.generic,
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
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_vehicle', { p_vehicle_id: String(formData.get('id') ?? '') });
  /* 55000 здесь почти всегда одно: у компании нет действующих лицензии и страховки. */
  if (error) await flashFailure(locale, error, { '55000': (await getDictionary(locale)).fleet.whyClosedNoDocs });

  revalidatePath(`/${locale}/carrier/fleet`);
}

export async function deleteDraftVehicleAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);

  const supabase = await createClient();
  /* Политика пропустит удаление только черновика — проверка не дублируется. */
  const { error } = await supabase.from('vehicles').delete().eq('id', String(formData.get('id') ?? ''));
  await flashFailure(locale, error);

  revalidatePath(`/${locale}/carrier/fleet`);
}

/* ── Решение оператора ──────────────────────────────────────────── */

export type DecideVehicleState = { error: string | null };

/*
 * Отказ базы оператор обязан увидеть. Раньше действие молчало: кнопка
 * «Допущена» у машины с номером, уже допущенным у другой компании, не
 * делала ничего, и карточка оставалась в очереди без объяснений
 * (прогон 12.10.2026).
 */
export async function decideVehicleAction(
  _previous: DecideVehicleState,
  formData: FormData,
): Promise<DecideVehicleState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') return { error: t.error.forbidden };

  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_vehicle', {
    p_vehicle_id: String(formData.get('id') ?? ''),
    p_decision: String(formData.get('decision') ?? '') as 'APPROVED' | 'REJECTED',
    p_note: text(formData, 'reason') ?? undefined,
  });

  if (error) {
    /* 23505 — номер уже у допущенной машины другой компании. */
    return { error: error.code === '23505' ? t.moderation.vehiclePlateTaken : t.error.generic };
  }

  revalidatePath(`/${locale}/admin`);
  return { error: null };
}

/* ── Прицепы ─────────────────────────────────────────────────────── */

export type TrailerState = { error: string | null; done: boolean };

/**
 * Прицеп или полуприцеп: оси, кузов, масса по техпаспорту, тара и отметка
 * «сдвоенные колёса». Допуска оператора у прицепа нет — на стол выходит машина.
 */
export async function saveTrailerAction(_previous: TrailerState, formData: FormData): Promise<TrailerState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier(locale);
  const company = viewer.company!;

  const kind = String(formData.get('kind') ?? '');
  const axles = Number(formData.get('axles') ?? 0);
  const plate = String(formData.get('plate') ?? '').trim().toUpperCase().replace(/s+/g, '');
  if (!(TRAILER_KINDS as readonly string[]).includes(kind) || !(axles >= 1 && axles <= 6) || !/^[A-ZÅÄÖ0-9-]{2,12}$/.test(plate)) {
    return { error: t.validation.required, done: false };
  }

  const values = {
    plate,
    kind: kind as TrailerKind,
    axles,
    body_type: bodyType(formData),
    gross_max_kg: kg(formData, 'gross_max_kg'),
    tare_kg: kg(formData, 'tare_kg'),
    twin_wheels: formData.get('twin_wheels') === '1',
    length_m: metres(formData, 'length_m'),
    /* Метры и пометки фуры — только у полуприцепа; у остальных прицепов пусто. */
    ldm: kind === 'SEMI' ? (num(formData, 'ldm') !== null && num(formData, 'ldm')! <= 20 ? Math.round(num(formData, 'ldm')! * 10) / 10 : 13.6) : null,
    semi_features: kind === 'SEMI' ? formData.getAll('semi_features').map(String).filter(isSemiFeature) : [],
    body_volume_m3: volume(formData),
    coupling_distance_m: metres(formData, 'coupling_distance_m'),
  };

  const supabase = await createClient();
  const id = text(formData, 'id');
  const { error } = id
    ? await supabase.from('trailers').update(values).eq('id', id)
    : await supabase.from('trailers').insert({ ...values, company_id: company.id });

  if (error) {
    return { error: error.code === '23505' ? t.mass.plateTaken : error.code === '23514' ? t.validation.required : t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier/fleet`);
  return { error: null, done: true };
}

export async function deleteTrailerAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);
  const supabase = await createClient();
  const { error } = await supabase.from('trailers').delete().eq('id', String(formData.get('id') ?? ''));
  if (error) await flashFailure(locale, error);
  revalidatePath(`/${locale}/carrier/fleet`);
}
