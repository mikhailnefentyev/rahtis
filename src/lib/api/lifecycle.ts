import 'server-only';

import { randomUUID } from 'node:crypto';
import { ALLOWED_TYPES, BUCKET, KINDS, MAX_BYTES, mailClaimEvent } from '@/lib/claims/mail';
import { recordIncident } from '@/lib/incidents/record';
import { dispatchPublishedOrder, notifyDirectOrder, wasPublished } from '@/lib/orders/dispatch';
import { metresToKm, routeFingerprint, routingConfigured } from '@/lib/routing';
import { truckProfile } from '@/lib/routing/profiles';
import { tomtom } from '@/lib/routing/tomtom';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';
import { claimIdOf, getClaim } from './claims';
import { geocode, ROLES } from './create';
import { ApiError, type ApiContext } from './handler';
import { isObj, locationOf, oneOf, text } from './input';
import { findOrder, getOrder } from './orders';
import { translateRule } from './rules';

/**
 * Действия заказчика с заказом через API — всё, что умеет кабинет:
 * выбрать отклик, назначить знакомую машину, вернуть заказ на стол,
 * править маршрут в пути, пересчитать ставку, оценить рейс, подать
 * претензию, написать в неё и приложить файл.
 *
 * Каждое действие — та же функция базы, что вызывает кабинет, через
 * api_order_action от имени выпустившего ключ. Письма и пересчёт
 * маршрута — те же, что после кабинета.
 */

type Action =
  | 'choose_offer'
  | 'cancel_order'
  | 'direct_assign_order'
  | 'amend_stop'
  | 'add_stop'
  | 'remove_stop'
  | 'store_route'
  | 'reprice_order'
  | 'rate_order'
  | 'file_claim'
  | 'comment_claim'
  | 'attach_to_claim';

/* Прямое назначение отвечает своими кодами — как их читает кабинет (matching.ts). */
const DIRECT_CODES: Record<string, [code: 'forbidden' | 'conflict' | 'unprocessable', message: string]> = {
  '42501': ['forbidden', 'This vehicle is not among your known vehicles.'],
  '55004': ['conflict', 'The vehicle is not available for trips right now.'],
  '55001': ['unprocessable', 'The vehicle does not fit this order.'],
  '55002': ['unprocessable', 'The vehicle does not fit this order.'],
  '55003': ['unprocessable', 'The vehicle does not fit this order.'],
  '55000': ['conflict', 'The order already has offers or is not on the desk; choose an offer instead.'],
};

async function explain(action: Action, error: { code?: string; message?: string }): Promise<ApiError> {
  const code = error.code ?? '';
  const msg = error.message ?? '';

  if (code === '55009') return new ApiError('forbidden', 'The current terms must be accepted in the RAHTIS cabinet first.');
  if (action === 'direct_assign_order' && DIRECT_CODES[code]) {
    const [c, m] = DIRECT_CODES[code];
    return new ApiError(c, m);
  }
  if (code === 'P0002') return new ApiError('not_found', 'Not found.');
  if (code === '22P02') return new ApiError('bad_request', 'An identifier or value has the wrong format.');

  const rule = translateRule(msg);
  if (rule) {
    const kind = code === '42501' ? 'forbidden' : code.startsWith('55') ? 'conflict' : 'unprocessable';
    return new ApiError(kind, rule.message, [{ field: rule.field, issue: rule.message }]);
  }

  /* Отказ без перевода — в инциденты, чтобы перевод добавили в rules.ts. */
  await recordIncident({ source: 'route', error, path: `/api/v1 ${action}`, severity: 'WARN' });
  if (code === '42501') return new ApiError('forbidden', 'This action is not allowed for this order.');
  if (code.startsWith('55')) return new ApiError('conflict', 'This action is not possible in the current state.');
  if (code === '22023' || code === '23514') return new ApiError('unprocessable', 'The request was rejected by a business rule.');
  return new ApiError('internal', 'The action could not be completed.');
}

async function act(ctx: ApiContext, action: Action, args: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('api_order_action', {
    p_key_id: ctx.keyId,
    p_action: action,
    p_args: JSON.parse(JSON.stringify(args)) as Json,
  });
  if (error) throw await explain(action, error);
  return (data as Record<string, unknown> | null) ?? null;
}

async function stopIdOf(orderId: string, sequence: string): Promise<string> {
  const n = Number(sequence);
  if (!Number.isInteger(n) || n < 0) throw new ApiError('not_found', 'Stop not found.');
  const admin = createAdminClient();
  const { data, error } = await admin.from('order_stops').select('id').eq('order_id', orderId).eq('sequence', n).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('not_found', 'Stop not found.');
  return data.id;
}

/* ── Отклики и назначение ────────────────────────────────────────── */

export async function chooseOffer(ctx: ApiContext, ref: string, offerId: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('api_order_offers', { p_key_id: ctx.keyId, p_order_ids: [order.id] });
  if (error) throw error;
  if (!(data ?? []).some((o) => o.offer_id === offerId)) throw new ApiError('not_found', 'Offer not found for this order.');

  await act(ctx, 'choose_offer', { offer_id: offerId });
  return getOrder(ctx, order.ref);
}

export async function knownVehicles(ctx: ApiContext) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('api_known_vehicles', { p_key_id: ctx.keyId });
  if (error) throw error;
  return {
    data: (data ?? []).map((v) => ({
      id: v.vehicle_id,
      plate: v.plate,
      make: v.make,
      vehicle_class: v.vehicle_class,
      euro_class: v.euro_class,
      axles: v.axles,
      payload_kg: v.payload_kg,
      ldm: v.ldm,
      container_feet: v.container_feet,
      driver_name: v.driver_name,
      carrier_name: v.carrier_name,
      direct_billing: v.direct_billing,
      carrier_rating: v.rating,
      trips_with_you: v.trips,
      last_trip_at: v.last_trip_at,
      available: v.available,
      busy: v.busy,
    })),
  };
}

export async function assignVehicle(ctx: ApiContext, ref: string, body: unknown) {
  const order = await findOrder(ctx, ref);
  const vehicleId = isObj(body) ? text(body.vehicle_id, 36) : undefined;
  if (!vehicleId) throw new ApiError('bad_request', 'vehicle_id is required.', [{ field: 'vehicle_id', issue: 'required; see GET /vehicles' }]);

  await act(ctx, 'direct_assign_order', { order_id: order.id, vehicle_id: vehicleId });
  /* Письма водителю и перевозчику — как после кабинета; их сбой назначение не отменяет. */
  await notifyDirectOrder(order.id);
  return getOrder(ctx, order.ref);
}

export async function unassign(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const published = await wasPublished(order.id);
  const result = await act(ctx, 'cancel_order', { order_id: order.id });
  /* После прямого назначения это первый выход на стол — перевозчикам письмо, как о новой публикации. */
  if (!published && result?.status === 'OPEN') await dispatchPublishedOrder(order.id);
  return getOrder(ctx, order.ref);
}

/* ── Маршрут в пути ──────────────────────────────────────────────── */

/**
 * Поля точки из тела запроса в патч для amend_stop/add_stop: только то,
 * что прислано; null — очистить поле. Значения — строками, как их шлёт
 * форма кабинета: функции базы разбирают именно так.
 */
async function stopPatch(body: Record<string, unknown>, cityNow: string | null) {
  const issues: { field: string; issue: string }[] = [];
  const patch: Record<string, string> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  const str = (k: string, max: number) => {
    if (!has(k)) return;
    patch[k] = body[k] === null ? '' : (text(body[k], max) ?? '');
  };

  str('place_name', 120);
  str('company_name', 120);
  str('external_ref', 100);
  str('note', 1000);
  str('consignee', 200);

  if (has('contact')) {
    const c = isObj(body.contact) ? body.contact : {};
    patch.contact_name = text(c.name, 120) ?? '';
    patch.contact_phone = (text(c.phone, 30) ?? '').replace(/[\s-]/g, '');
  }
  if (has('scheduled_date')) {
    const d = body.scheduled_date === null ? '' : (text(body.scheduled_date, 10) ?? '');
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) issues.push({ field: 'scheduled_date', issue: 'YYYY-MM-DD' });
    patch.scheduled_date = d;
  }
  if (has('scheduled_time')) {
    const t = body.scheduled_time === null ? '' : (text(body.scheduled_time, 5) ?? '');
    if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) issues.push({ field: 'scheduled_time', issue: 'HH:MM' });
    patch.scheduled_time = t;
  }
  if (has('cargo_weight_kg')) {
    const w = body.cargo_weight_kg;
    if (w !== null && !(Number.isInteger(w) && (w as number) > 0)) issues.push({ field: 'cargo_weight_kg', issue: 'positive integer (kg) or null' });
    patch.cargo_weight_kg = w === null ? '' : String(w);
  }
  for (const flag of ['seal_required', 'trailer_loaded'] as const) {
    if (!has(flag)) continue;
    if (body[flag] !== null && typeof body[flag] !== 'boolean') issues.push({ field: flag, issue: 'boolean or null' });
    patch[flag] = body[flag] === null ? '' : String(body[flag]);
  }

  /* Адрес меняется только вместе с точным местом: либо location, либо адрес, который геокодер узнал точно. */
  let moved = false;
  if (has('address') || has('location')) {
    const address = text(body.address, 200);
    const city = text(body.city, 100) ?? cityNow ?? undefined;
    let location = body.location === undefined ? undefined : locationOf(body.location);
    let score: number | undefined;
    if (body.location !== undefined && !location) issues.push({ field: 'location', issue: '{ lat, lon } in degrees' });
    if (has('address') && !address) issues.push({ field: 'address', issue: 'must not be empty' });

    if (address && !location && body.location === undefined) {
      const hit = await geocode(address, city);
      if (!hit?.position) {
        issues.push({ field: 'address', issue: 'address could not be located precisely; send location { lat, lon }' });
      } else {
        location = hit.position;
        score = hit.score;
      }
    }
    if (address) patch.address = address;
    if (has('city') && city) patch.city = city;
    if (location) {
      patch.lat = String(location.lat);
      patch.lon = String(location.lon);
      patch.geocode_score = score === undefined ? '' : String(score);
      moved = true;
    }
  }

  if (issues.length) throw new ApiError('unprocessable', 'Some fields are invalid.', issues);
  return { patch, moved };
}

/** Маршрут по дорогам после переезда точки — как refreshRoute в кабинете. */
async function refreshRoute(ctx: ApiContext, orderId: string) {
  const admin = createAdminClient();
  const { data: stops, error } = await admin.from('order_stops').select('lat,lon,country,role').eq('order_id', orderId).order('sequence');
  if (error) throw error;

  const complete = stops.length >= 2 && stops.every((s) => s.lat !== null && s.lon !== null);
  if (!complete || !routingConfigured()) {
    if (!complete) await act(ctx, 'store_route', { order_id: orderId, route: {} });
    return;
  }

  const points = stops.map((s) => ({ lat: s.lat as number, lon: s.lon as number }));
  const country = stops.find((s) => s.role === 'PICKUP')?.country ?? 'FI';
  try {
    const route = await tomtom.route(points, truckProfile(country));
    await act(ctx, 'store_route', {
      order_id: orderId,
      route: {
        geometry: route.geometry,
        bounds: route.bounds,
        fingerprint: routeFingerprint(points, country),
        km: String(metresToKm(route.distanceM)),
        legs: route.legs,
      },
    });
  } catch (cause) {
    /* Маршрут не посчитался — правка остаётся, как в кабинете; пробег поправит пересчёт. */
    if (cause instanceof ApiError) throw cause;
  }
}

export async function amendStop(ctx: ApiContext, ref: string, sequence: string, body: unknown) {
  if (!isObj(body)) throw new ApiError('bad_request', 'Request body must be a JSON object.');
  const order = await findOrder(ctx, ref);
  const stopId = await stopIdOf(order.id, sequence);

  const admin = createAdminClient();
  const { data: stop } = await admin.from('order_stops').select('city').eq('id', stopId).single();
  const { patch, moved } = await stopPatch(body, stop?.city ?? null);
  if (Object.keys(patch).length === 0) throw new ApiError('bad_request', 'Nothing to change.');

  const amendment = await act(ctx, 'amend_stop', { stop_id: stopId, patch });
  if (moved && amendment?.changes) await refreshRoute(ctx, order.id);
  return getOrder(ctx, order.ref);
}

export async function addStop(ctx: ApiContext, ref: string, body: unknown) {
  if (!isObj(body)) throw new ApiError('bad_request', 'Request body must be a JSON object.');
  const order = await findOrder(ctx, ref);

  const role = oneOf(body.role, ROLES);
  if (!role) throw new ApiError('bad_request', 'role is required.', [{ field: 'role', issue: 'EXTRA_LOAD or EXTRA_UNLOAD' }]);
  if (body.before_sequence === undefined) {
    throw new ApiError('bad_request', 'before_sequence is required.', [{ field: 'before_sequence', issue: 'sequence of the stop the new one goes before' }]);
  }
  const beforeId = await stopIdOf(order.id, String(body.before_sequence));
  if (!text(body.address, 200)) throw new ApiError('bad_request', 'address is required.', [{ field: 'address', issue: 'required' }]);
  if (!text(body.city, 100)) throw new ApiError('bad_request', 'city is required.', [{ field: 'city', issue: 'required' }]);

  const { patch, moved } = await stopPatch(body, null);
  if (!moved) throw new ApiError('unprocessable', 'The new stop needs a precise location.', [{ field: 'location', issue: 'send location { lat, lon }' }]);

  await act(ctx, 'add_stop', { before_stop_id: beforeId, stop: { role, ...patch } });
  await refreshRoute(ctx, order.id);
  return getOrder(ctx, order.ref);
}

export async function removeStop(ctx: ApiContext, ref: string, sequence: string) {
  const order = await findOrder(ctx, ref);
  const stopId = await stopIdOf(order.id, sequence);
  await act(ctx, 'remove_stop', { stop_id: stopId });
  await refreshRoute(ctx, order.id);
  return getOrder(ctx, order.ref);
}

/**
 * Новая ставка — и пробег: по умолчанию тот, что насчитал маршрут после
 * правок (distance_auto_km), как подсказка «было / стало» в кабинете.
 */
export async function reprice(ctx: ApiContext, ref: string, body: unknown) {
  if (!isObj(body)) throw new ApiError('bad_request', 'Request body must be a JSON object.');
  const order = await findOrder(ctx, ref);

  const raw = isObj(body.rate) ? body.rate.amount : undefined;
  const euros = typeof raw === 'number' ? raw : Number.NaN;
  if (!Number.isFinite(euros) || euros <= 0) {
    throw new ApiError('bad_request', 'rate.amount is required.', [{ field: 'rate.amount', issue: 'positive number of euros, VAT excluded' }]);
  }

  let km = body.distance_km;
  if (km === undefined) {
    const admin = createAdminClient();
    const { data } = await admin.from('orders').select('distance_auto_km,distance_km').eq('id', order.id).single();
    km = data?.distance_auto_km ?? data?.distance_km;
  }
  if (!Number.isInteger(km) || (km as number) <= 0) {
    throw new ApiError('bad_request', 'distance_km must be a positive integer.', [{ field: 'distance_km', issue: 'positive integer (km)' }]);
  }

  await act(ctx, 'reprice_order', { order_id: order.id, distance_km: km, rate_cents: Math.round(euros * 100) });
  return getOrder(ctx, order.ref);
}

export async function rate(ctx: ApiContext, ref: string, body: unknown) {
  if (!isObj(body)) throw new ApiError('bad_request', 'Request body must be a JSON object.');
  const order = await findOrder(ctx, ref);
  const score = body.score;
  if (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5) {
    throw new ApiError('bad_request', 'score must be an integer from 1 to 5.', [{ field: 'score', issue: 'integer 1–5' }]);
  }
  await act(ctx, 'rate_order', { order_id: order.id, score, comment: text(body.comment, 1000) ?? '' });
  return getOrder(ctx, order.ref);
}

/* ── Претензии ───────────────────────────────────────────────────── */

export async function fileClaim(ctx: ApiContext, body: unknown) {
  if (!isObj(body)) throw new ApiError('bad_request', 'Request body must be a JSON object.');
  const issues: { field: string; issue: string }[] = [];

  const orderRef = text(body.order_ref, 20)?.toUpperCase();
  if (!orderRef) issues.push({ field: 'order_ref', issue: 'required' });
  const kind = oneOf(body.kind, KINDS);
  if (!kind) issues.push({ field: 'kind', issue: `one of ${KINDS.join(', ')}` });
  const description = text(body.description, 5000);
  if (!description || description.length < 10) issues.push({ field: 'description', issue: 'at least 10 characters' });

  let amountCents: number | undefined;
  if (body.amount !== undefined && body.amount !== null) {
    const a = isObj(body.amount) ? body.amount.amount : undefined;
    if (typeof a !== 'number' || !Number.isFinite(a) || a < 0 || a > 1_000_000) issues.push({ field: 'amount.amount', issue: 'euros, 0–1 000 000' });
    else amountCents = Math.round(a * 100);
  }
  if (issues.length) throw new ApiError('bad_request', 'Invalid request.', issues);

  const order = await findOrder(ctx, orderRef!);
  const stopId = body.stop_sequence === undefined || body.stop_sequence === null ? undefined : await stopIdOf(order.id, String(body.stop_sequence));

  const claim = await act(ctx, 'file_claim', {
    order_id: order.id,
    kind,
    description,
    stop_id: stopId ?? '',
    amount_cents: amountCents === undefined ? '' : amountCents,
  });
  const claimId = String(claim?.id ?? '');
  /* Зеркало второй стороне и письмо оператору — как после кабинета. */
  await mailClaimEvent(claimId, 'CREATED', 'SHIPPER');
  return getClaim(ctx, String(claim?.ref ?? ''));
}

export async function commentClaim(ctx: ApiContext, ref: string, body: unknown) {
  const claimId = await claimIdOf(ctx, ref);
  const message = isObj(body) ? text(body.body, 5000) : undefined;
  if (!message) throw new ApiError('bad_request', 'body is required.', [{ field: 'body', issue: 'non-empty text' }]);
  await act(ctx, 'comment_claim', { claim_id: claimId, body: message });
  await mailClaimEvent(claimId, 'COMMENT', 'SHIPPER', message);
  return getClaim(ctx, ref);
}

/** Файл к претензии: multipart/form-data с полем file и необязательным note. */
export async function attachToClaim(ctx: ApiContext, ref: string, request: Request) {
  const claimId = await claimIdOf(ctx, ref);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError('bad_request', 'Send multipart/form-data with a file field.');
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new ApiError('bad_request', 'file is required.', [{ field: 'file', issue: 'required' }]);
  if (file.size > MAX_BYTES) throw new ApiError('unprocessable', 'The file is larger than 10 MB.', [{ field: 'file', issue: 'max 10 MB' }]);
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ApiError('unprocessable', 'Unsupported file type.', [{ field: 'file', issue: ALLOWED_TYPES.join(', ') }]);
  }
  const note = text(form.get('note'), 5000) ?? '';

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${claimId}/${randomUUID()}-${safeName}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  try {
    await act(ctx, 'attach_to_claim', {
      claim_id: claimId,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      mime_type: file.type,
      size_bytes: file.size,
      note,
    });
  } catch (cause) {
    /* Строка не записалась — файл убирается, иначе в бакете остался бы объект, о котором база не знает. */
    await admin.storage.from(BUCKET).remove([path]);
    throw cause;
  }

  await mailClaimEvent(claimId, 'ATTACHMENT', 'SHIPPER', note || null);
  return getClaim(ctx, ref);
}
