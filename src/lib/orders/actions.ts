'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { cityOf, hasCoordinates, tonnesToKg, type FieldReader } from '@/lib/orders/stopFields';
import type { StopRole } from '@/types/db';

export type PublishState = { error: string | null; ref: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string): string =>
  String(form.get(key) ?? '').trim();

/** Евро из формы в центы: деньги в системе целые (см. lib/config.ts). */
function toCents(value: string): number | null {
  const normalised = value.replace(/\s/g, '').replace(',', '.');
  const euros = Number.parseFloat(normalised);
  return Number.isFinite(euros) && euros > 0 ? Math.round(euros * 100) : null;
}

type StopInput = {
  role: StopRole;
  place_kind?: string;
  place_name?: string;
  company_name?: string;
  address: string;
  city: string;
  country?: string;
  contact_name?: string;
  contact_phone?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  external_ref?: string;
  /** Прицеп с грузом или пустой — только на заборе и на отцепке. */
  trailer_loaded?: boolean;
  note?: string;
  cargo_weight_kg?: string;
  consignee?: string;
  seal_required?: boolean;
  lat?: string;
  lon?: string;
  geocode_score?: string;
  leg_distance_m?: string;
  leg_duration_s?: string;
};

/**
 * Пломба приходит списком из трёх значений, а не флажком: у повторяемых
 * точек снятый флажок не отправляется вовсе и сбил бы позиции в массиве.
 * Пустая строка означает «про пломбу не сказали» — это не «не нужна».
 */
function toSeal(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/**
 * Одна точка маршрута из полей формы.
 *
 * Поля собираются все подряд, без оглядки на роль: что из них вообще
 * применимо, решают ограничения базы (миграция stop_details) — здесь
 * повторять ту же матрицу значило бы завести второй источник правды.
 * Форма неприменимые поля просто не показывает и присылает пустыми.
 */
function readStop(read: FieldReader, role: StopRole): StopInput {
  return {
    role,
    place_kind: read('place_kind'),
    place_name: read('place_name'),
    company_name: read('company'),
    address: read('address'),
    city: cityOf(read),
    country: read('address_country'),
    contact_name: read('contact'),
    contact_phone: read('phone').replace(/[\s-]/g, ''),
    scheduled_date: read('date'),
    scheduled_time: read('time'),
    external_ref: read('ref'),
    note: read('note'),
    /* Тонны формы в килограммы базы: вес хранится целым, как и деньги. */
    cargo_weight_kg: tonnesToKg(read('weight'))?.toString(),
    consignee: read('consignee'),
    seal_required: toSeal(read('seal')),
    /*
     * Координаты приходят скрытыми полями рядом с адресом: их проставляет
     * поле подсказки в момент выбора. Набранный руками адрес координат не
     * имеет — и это правильно, потому что геокодер несуществующий адрес не
     * отвергает, а подбирает похожий в другом городе.
     */
    lat: read('address_lat'),
    lon: read('address_lon'),
    geocode_score: read('address_score'),
  };
}

/**
 * Собирает точки маршрута из полей формы.
 *
 * Доп.точек может быть сколько угодно, поэтому их поля приходят массивами
 * с одинаковыми именами — форма добавляет и убирает блоки, а порядок
 * сохраняется порядком элементов в FormData. Форма обязана присылать
 * каждое поле для каждой доп.точки, в том числе пустым: пропуск сдвинул
 * бы все последующие точки на одну позицию.
 */
function collectStops(formData: FormData): StopInput[] {
  const stops: StopInput[] = [];

  const single =
    (prefix: string): FieldReader =>
    (field) =>
      str(formData, `${prefix}_${field}`);

  stops.push({
    ...readStop(single('pickup'), 'PICKUP'),
    trailer_loaded: str(formData, 'pickup_trailer_loaded') === 'true',
  });

  /*
   * Действия рейса — выгрузки и загрузки, сколько угодно и в любом
   * порядке. Порядок в массиве и есть порядок рейса: перецеп это
   * «забрали прицеп → сколько-то действий → отцепили».
   */
  const extraRoles = formData.getAll('extra_role').map(String);
  const columns = new Map<string, string[]>();
  const atIndex =
    (index: number): FieldReader =>
    (field) => {
      const key = `extra_${field}`;
      if (!columns.has(key)) columns.set(key, formData.getAll(key).map(String));
      return columns.get(key)![index]?.trim() ?? '';
    };

  extraRoles.forEach((role, index) => {
    stops.push(readStop(atIndex(index), role === 'EXTRA_UNLOAD' ? 'EXTRA_UNLOAD' : 'EXTRA_LOAD'));
  });

  if (formData.get('has_return') === 'on') {
    stops.push({
      ...readStop(single('ret'), 'TRAILER_RETURN'),
      trailer_loaded: str(formData, 'ret_trailer_loaded') === 'true',
    });
  }

  /*
   * Плечи маршрута раскладываются по точкам: плечо N — это путь ДО точки
   * N от предыдущей, поэтому у первой точки его нет. Роутер возвращает их
   * ровно столько, сколько промежутков между точками.
   */
  const legs = parseLegs(formData.get('route_legs'));
  if (legs.length === stops.length - 1) {
    legs.forEach((leg, index) => {
      const stop = stops[index + 1];
      stop.leg_distance_m = String(leg.distanceM);
      stop.leg_duration_s = String(leg.durationS);
    });
  }

  return stops;
}

type Leg = { distanceM: number; durationS: number };

/** Плечи приходят строкой JSON из скрытого поля формы. */
function parseLegs(value: FormDataEntryValue | null): Leg[] {
  if (typeof value !== 'string' || value.length === 0) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (leg): leg is Leg =>
        typeof leg === 'object' &&
        leg !== null &&
        typeof (leg as Leg).distanceM === 'number' &&
        typeof (leg as Leg).durationS === 'number',
    );
  } catch {
    return [];
  }
}

/** Границы маршрута приходят строкой JSON: [minLon, minLat, maxLon, maxLat]. */
function parseBounds(value: FormDataEntryValue | null): number[] | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length === 4 && parsed.every((n) => typeof n === 'number')
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Публикация заказа.
 *
 * Заказ и его точки пишутся одним вызовом create_order: они лежат в разных
 * таблицах, а половина маршрута без второй половины — состояние, которого
 * быть не должно.
 */
export async function publishOrderAction(
  _previous: PublishState,
  formData: FormData,
): Promise<PublishState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER' || !viewer.company) {
    return { error: t.error.forbidden, ref: null };
  }
  if (viewer.company.status !== 'ACTIVE') {
    return { error: t.orderForm.needActive, ref: null };
  }

  const rateCents = toCents(str(formData, 'rate'));
  const distance = Number.parseInt(str(formData, 'distance_km').replace(/\D/g, ''), 10);

  if (!rateCents || !Number.isFinite(distance) || distance <= 0) {
    return { error: t.validation.positiveNumber, ref: null };
  }

  const stops = collectStops(formData);

  /*
   * Заказ без координат не публикуется.
   *
   * Раньше набранный руками адрес просто не давал посчитать маршрут:
   * километраж заказчик вписывал сам, и заказ уезжал с числом, взятым
   * из головы. Починить это потом нельзя — distance_km после публикации
   * неизменен намеренно, потому что от него посчитана ставка, о которой
   * договорились с перевозчиком. Правка адреса на идущем рейсе меняет
   * линию на карте, но не деньги: об этом прямо написано в панели правок
   * (amend.rateUnchanged).
   *
   * Значит единственное место, где эту ошибку ещё можно не сделать, —
   * здесь. Проверка стоит на сервере, а не только в форме: форма гасит
   * кнопку, но действие вызывается по сети, и запрет обязан жить там,
   * где пишутся данные.
   */
  if (stops.some((stop) => !hasCoordinates(stop))) {
    return { error: t.routing.addressRequired, ref: null };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_order', {
    p_order: {
      order_type: str(formData, 'order_type'),
      /*
       * Что тянут — вторая ось рядом с типом рейса. База сама обнулит
       * длину у полуприцепа, поэтому переключение типа в форме не может
       * оставить в заказе размер от прошлого выбора.
       */
      haul_kind: str(formData, 'haul_kind') === 'CONTAINER' ? 'CONTAINER' : 'TRAILER',
      container_feet: str(formData, 'container_feet'),
      shipper_ref: str(formData, 'shipper_ref'),
      trailer: str(formData, 'trailer'),
      trailer_plate: str(formData, 'trailer_plate').toUpperCase(),
      distance_km: String(distance),
      rate_cents: String(rateCents),
      comment: str(formData, 'comment'),
      /*
       * Источник пробега и кэш маршрута. distance_km остаётся тем, что
       * в поле: расчёт его предлагает, а не присваивает, и заказчик,
       * поправивший километраж руками, остаётся источником правды.
       */
      distance_source: str(formData, 'distance_source') === 'AUTO' ? 'AUTO' : 'MANUAL',
      distance_auto_km: str(formData, 'distance_auto_km'),
      route_geometry: str(formData, 'route_geometry'),
      route_bounds: parseBounds(formData.get('route_bounds')),
      route_fingerprint: str(formData, 'route_fingerprint'),
    },
    p_stops: stops,
    p_publish: true,
  });

  if (error || !data) {
    /* 55000 — компания не активна; остальное показываем общим текстом. */
    return {
      error: error?.code === '55000' ? t.orderForm.needActive : t.orderForm.failed,
      ref: null,
    };
  }

  revalidatePath(`/${locale}/shipper`, 'layout');
  return { error: null, ref: data.ref };
}
