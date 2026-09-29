import 'server-only';

import { createHash } from 'node:crypto';
import { isValidContainerNumber } from '@/lib/containerNumber';
import { dispatchPublishedOrder } from '@/lib/orders/dispatch';
import { metresToKm, routeFingerprint, routingConfigured } from '@/lib/routing';
import { findPlaces, toSuggestion } from '@/lib/routing/places';
import { truckProfile } from '@/lib/routing/profiles';
import { normalizeQuery } from '@/lib/routing/query';
import { tomtom } from '@/lib/routing/tomtom';
import type { AddressSuggestion, LatLon } from '@/lib/routing/types';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';
import { ApiError, type ApiContext } from './handler';
import { getOrder } from './orders';

/**
 * Создание заказа через API.
 *
 * Правила те же, что у формы: без точных координат каждой точки заказ не
 * публикуется, километраж считает маршрут грузовика по дорогам, а всё
 * остальное проверяет create_order в базе. Разница одна — у API нет
 * человека, который выберет адрес из подсказки. Поэтому точка приходит
 * либо с координатами, либо адресом, который геокодер узнал точно (номер
 * дома и уверенная оценка); иначе — ошибка с просьбой прислать
 * координаты, а не молчаливая догадка в соседнем городе.
 */

const ORDER_TYPES = ['TRAILER_SWAP', 'ROUND_TRIP', 'ONE_WAY'] as const;
const HAUL_KINDS = ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK'] as const;
const ROLES = ['PICKUP', 'DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'TRAILER_RETURN'] as const;
const PLACE_KINDS = ['PORT', 'TERMINAL', 'PARKING', 'ADDRESS'] as const;

/*
 * Нижняя граница оценки — только от совсем случайных совпадений. Главная
 * проверка — сверка улицы, номера дома и города (см. geocode).
 */
const MIN_SCORE = 3;

type Issue = { field: string; issue: string };

type StopIn = Record<string, unknown>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

function oneOf<T extends readonly string[]>(v: unknown, list: T): T[number] | undefined {
  return typeof v === 'string' && (list as readonly string[]).includes(v.toUpperCase()) ? (v.toUpperCase() as T[number]) : undefined;
}

function locationOf(v: unknown): LatLon | undefined {
  if (!isObj(v)) return undefined;
  const lat = Number(v.lat);
  const lon = Number(v.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  if (lat === 0 && lon === 0) return undefined;
  return { lat, lon };
}

/** Адрес → координаты. Своё место (порт, терминал) — первым, как в форме. */
async function geocode(address: string, city: string | undefined): Promise<AddressSuggestion | null> {
  const query = [address, city].filter(Boolean).join(', ');
  const own = findPlaces(query)[0];
  if (own) return toSuggestion(own);

  if (!routingConfigured()) return null;

  /*
   * Точность проверяется сверкой, а не оценкой. Замер 29.09: настоящий
   * «Tikkurilantie 10, Vantaa» пришёл домом (Point Address) с оценкой 5,8
   * — ниже любого разумного порога, — а первым геокодер вообще поставил
   * улицу. Поэтому адрес принимается, только если результат — дом или
   * диапазон домов, начинается той же улицей с тем же номером, что в
   * запросе, и лежит в указанном городе. «Satama» без номера так не
   * пройдёт никогда — для таких мест есть location.
   */
  const norm = (s: string) => s.toLocaleLowerCase('fi').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  const street = norm(address.split(',')[0]);
  if (!/\d/.test(street)) return null;
  const wantedCity = city ? norm(city) : null;

  const found = (await tomtom.suggest(normalizeQuery(query), { limit: 6 })).find(
    (s) =>
      s.precise &&
      s.score >= MIN_SCORE &&
      norm(s.label.includes(' — ') ? s.label.slice(s.label.indexOf(' — ') + 3) : s.label).startsWith(street) &&
      (!wantedCity || norm(s.city ?? '') === wantedCity),
  );
  if (!found) return null;

  return found.position ? found : await tomtom.resolve(found.id);
}

type Prepared = { order: Record<string, unknown>; stops: Record<string, unknown>[] };

async function prepare(body: unknown): Promise<Prepared> {
  if (!isObj(body)) throw new ApiError('bad_request', 'Request body must be a JSON object.');
  const issues: Issue[] = [];

  const orderType = oneOf(body.order_type, ORDER_TYPES);
  if (!orderType) issues.push({ field: 'order_type', issue: `one of ${ORDER_TYPES.join(', ')}` });

  const haulKind = oneOf(body.haul_kind ?? 'TRAILER', HAUL_KINDS);
  if (!haulKind) issues.push({ field: 'haul_kind', issue: `one of ${HAUL_KINDS.join(', ')}` });

  const rateRaw = isObj(body.rate) ? body.rate.amount : undefined;
  const rateEur = typeof rateRaw === 'number' ? rateRaw : Number(String(rateRaw ?? '').replace(',', '.'));
  if (!Number.isFinite(rateEur) || rateEur <= 0) issues.push({ field: 'rate.amount', issue: 'positive number of euros, VAT excluded' });
  if (isObj(body.rate) && body.rate.currency !== undefined && body.rate.currency !== 'EUR') {
    issues.push({ field: 'rate.currency', issue: 'only EUR is supported' });
  }

  const trailerPlate = text(body.trailer_plate, 20)?.toUpperCase();
  if (haulKind === 'CONTAINER' && trailerPlate && !isValidContainerNumber(trailerPlate)) {
    issues.push({ field: 'trailer_plate', issue: 'not a valid ISO 6346 container number' });
  }

  if (!Array.isArray(body.stops) || body.stops.length < 2 || body.stops.length > 20) {
    issues.push({ field: 'stops', issue: 'array of 2–20 stops' });
  }
  if (issues.length) throw new ApiError('bad_request', 'Invalid request.', issues);

  const stopsIn = body.stops as unknown[];
  const stops: Record<string, unknown>[] = [];
  const points: LatLon[] = [];

  for (const [i, raw] of stopsIn.entries()) {
    const f = (name: string) => `stops[${i}].${name}`;
    if (!isObj(raw)) {
      issues.push({ field: `stops[${i}]`, issue: 'object' });
      continue;
    }
    const s = raw as StopIn;
    const role = oneOf(s.role, ROLES);
    if (!role) issues.push({ field: f('role'), issue: `one of ${ROLES.join(', ')}` });

    const address = text(s.address, 200);
    let city = text(s.city, 100);
    let country = text(s.country, 2)?.toUpperCase();
    let location = locationOf(s.location);
    let score: number | undefined;

    if (s.location !== undefined && !location) issues.push({ field: f('location'), issue: '{ lat, lon } in degrees' });
    if (!address) issues.push({ field: f('address'), issue: 'required' });

    if (address && !location && s.location === undefined) {
      const hit = await geocode(address, city);
      if (!hit?.position) {
        issues.push({ field: f('address'), issue: 'address could not be located precisely; send location { lat, lon }' });
      } else {
        location = hit.position;
        score = hit.score;
        city = city ?? hit.city ?? undefined;
        country = country ?? hit.country ?? undefined;
      }
    }
    if (!city) issues.push({ field: f('city'), issue: 'required' });

    const date = text(s.scheduled_date, 10);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) issues.push({ field: f('scheduled_date'), issue: 'YYYY-MM-DD' });
    const time = text(s.scheduled_time, 5);
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) issues.push({ field: f('scheduled_time'), issue: 'HH:MM' });

    const weight = s.cargo_weight_kg;
    if (weight !== undefined && !(Number.isInteger(weight) && (weight as number) > 0)) {
      issues.push({ field: f('cargo_weight_kg'), issue: 'positive integer (kg)' });
    }

    const contact = isObj(s.contact) ? s.contact : {};
    const placeKind = s.place_kind === undefined ? undefined : oneOf(s.place_kind, PLACE_KINDS);
    if (s.place_kind !== undefined && !placeKind) issues.push({ field: f('place_kind'), issue: `one of ${PLACE_KINDS.join(', ')}` });

    if (location) points.push(location);
    stops.push({
      role,
      place_kind: placeKind ?? '',
      place_name: text(s.place_name, 120) ?? '',
      company_name: text(s.company_name, 120) ?? '',
      address: address ?? '',
      city: city ?? '',
      country: country ?? '',
      contact_name: text(contact.name, 120) ?? '',
      contact_phone: (text(contact.phone, 30) ?? '').replace(/[\s-]/g, ''),
      scheduled_date: date ?? '',
      scheduled_time: time ?? '',
      external_ref: text(s.external_ref, 100) ?? '',
      note: text(s.note, 1000) ?? '',
      cargo_weight_kg: weight === undefined ? '' : String(weight),
      consignee: text(s.consignee, 200) ?? '',
      ...(typeof s.trailer_loaded === 'boolean' ? { trailer_loaded: s.trailer_loaded } : {}),
      ...(typeof s.seal_required === 'boolean' ? { seal_required: s.seal_required } : {}),
      lat: location ? String(location.lat) : '',
      lon: location ? String(location.lon) : '',
      geocode_score: score === undefined ? '' : String(score),
    });
  }
  if (issues.length) throw new ApiError('unprocessable', 'Some stops are invalid.', issues);

  /* Маршрут по дорогам для грузовика — как кнопка «Laske» в форме. */
  if (!routingConfigured()) throw new ApiError('internal', 'Routing is temporarily unavailable.');
  const countryCode = String(stops[0].country || 'FI');
  let route;
  try {
    route = await tomtom.route(points, truckProfile(countryCode));
  } catch {
    throw new ApiError('unprocessable', 'No truck route found between the stops. Check the locations.');
  }
  route.legs.forEach((leg, i) => {
    const stop = stops[i + 1];
    if (stop) {
      stop.leg_distance_m = String(leg.distanceM);
      stop.leg_duration_s = String(leg.durationS);
    }
  });
  const km = metresToKm(route.distanceM);

  return {
    order: {
      order_type: orderType,
      haul_kind: haulKind,
      container_feet: body.container_feet === undefined ? '' : String(body.container_feet),
      ldm: body.ldm === undefined ? '' : String(body.ldm),
      shipper_ref: text(body.shipper_ref, 100) ?? '',
      trailer: text(body.trailer, 120) ?? '',
      trailer_plate: trailerPlate ?? '',
      distance_km: String(km),
      rate_cents: String(Math.round(rateEur * 100)),
      comment: text(body.comment, 2000) ?? '',
      distance_source: 'AUTO',
      distance_auto_km: String(km),
      route_geometry: route.geometry,
      route_bounds: route.bounds,
      route_fingerprint: routeFingerprint(points, countryCode),
    },
    stops,
  };
}

/** Отказ базы словами для программы: код и понятная причина. */
function explain(error: { code?: string; message?: string }): ApiError {
  const msg = error.message ?? '';
  if (error.code === '55009') return new ApiError('forbidden', 'The current terms must be accepted in the RAHTIS cabinet first.');
  if (error.code === '42501') return new ApiError('forbidden', 'This key cannot create orders.');
  if (error.code === '55000') return new ApiError('forbidden', 'The company account must be active with billing details filled in.');
  if (error.code === '23514') {
    /* Нарушено правило точки: например, вес груза у выгрузки. Имя правила — программисту. */
    const rule = msg.match(/check constraint "([^"]+)"/)?.[1];
    return new ApiError(
      'unprocessable',
      `A field is not allowed for this order or stop${rule ? ` (rule: ${rule})` : ''}.`,
      rule ? [{ field: 'stops', issue: rule }] : undefined,
    );
  }
  if (error.code === '22023') return new ApiError('unprocessable', msg || 'The order was rejected.');
  return new ApiError('internal', 'The order could not be created.');
}

export async function createOrder(ctx: ApiContext, body: unknown) {
  const prepared = await prepare(body);
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('api_create_order', {
    p_key_id: ctx.keyId,
    /* JSON.parse(JSON.stringify(…)) — то же тело, но уже гарантированно Json. */
    p_order: JSON.parse(JSON.stringify(prepared.order)) as Json,
    p_stops: JSON.parse(JSON.stringify(prepared.stops)) as Json,
  });
  if (error || !data?.[0]) throw explain(error ?? {});

  /* Письма перевозчикам — как после формы; их ошибки заказ не отменяют. */
  await dispatchPublishedOrder(data[0].id);

  return getOrder(ctx, data[0].ref);
}

export async function withdrawOrder(ctx: ApiContext, ref: string, body: unknown) {
  const reason = isObj(body) ? text(body.reason, 500) : undefined;
  const admin = createAdminClient();
  const { error } = await admin.rpc('api_withdraw_order', { p_key_id: ctx.keyId, p_ref: ref, p_reason: reason ?? '' });
  if (error) {
    if (error.code === 'P0002') throw new ApiError('not_found', 'Order not found.');
    if (error.code === '55000') throw new ApiError('conflict', error.message.includes('Выполненный') ? 'A completed order cannot be withdrawn.' : 'The order is already withdrawn.');
    if (error.code === '42501') throw new ApiError('forbidden', 'This key cannot withdraw orders.');
    throw new ApiError('internal', 'The order could not be withdrawn.');
  }
  return getOrder(ctx, ref);
}

/** Хэш тела для сверки повторов с одним Idempotency-Key. */
export function bodyHash(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}
