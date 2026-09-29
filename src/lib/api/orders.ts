import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { metersBetween } from '@/lib/orders/position';
import { decodeCursor, encodeCursor } from './cursor';
import { ApiError, type ApiContext } from './handler';

/**
 * Заказы заказчика для API.
 *
 * Читается служебным ключом, поэтому граница — явный фильтр по компании
 * ключа в каждом запросе, а набор полей — тот же, что читает кабинет
 * заказчика (shipper/orders). Данные о машине и водителе идут через
 * offers_for_shipper от имени выпустившего ключ: там живут правила
 * анонимности, и второй копии им не нужно.
 *
 * Точки местоположения водителя — прибытие, снимки, отметка «пройдена» —
 * отдаются с расстоянием до адреса точки: решение пользователя 29.09.2026,
 * PRIVACY 2.4. Смены (место начала и конца) сюда не относятся — они
 * заказчику не видны.
 */

const ORDER_COLUMNS =
  'id,ref,shipper_ref,order_type,haul_kind,container_feet,ldm,trailer,trailer_plate,distance_km,rate_cents,comment,status,dispatch_mode,created_at,published_at,deadline_at,closed_at,updated_at';

const STOP_COLUMNS =
  'order_id,sequence,role,place_name,company_name,address,city,country,lat,lon,scheduled_date,scheduled_time,eta_at,arrived_at,completed_at,trailer_loaded,cargo_weight_kg,consignee,contact_name,contact_phone,external_ref,seal_required,note,damage_note,arrived_lat,arrived_lon,completed_lat,completed_lon,completed_accuracy_m,eta_source,eta_updated_at';

type OrderRow = {
  id: string;
  ref: string;
  shipper_ref: string | null;
  order_type: string;
  haul_kind: string;
  container_feet: number | null;
  ldm: number | null;
  trailer: string | null;
  trailer_plate: string | null;
  distance_km: number;
  rate_cents: number;
  comment: string | null;
  status: string;
  dispatch_mode: string | null;
  created_at: string;
  published_at: string | null;
  deadline_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

type StopRow = {
  order_id: string;
  sequence: number;
  role: string;
  place_name: string | null;
  company_name: string | null;
  address: string;
  city: string;
  country: string | null;
  lat: number | null;
  lon: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  eta_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  trailer_loaded: boolean | null;
  cargo_weight_kg: number | null;
  consignee: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  external_ref: string | null;
  seal_required: boolean | null;
  note: string | null;
  damage_note: string | null;
  arrived_lat: number | null;
  arrived_lon: number | null;
  completed_lat: number | null;
  completed_lon: number | null;
  completed_accuracy_m: number | null;
  eta_source: string | null;
  eta_updated_at: string | null;
};

const STATUSES = ['DRAFT', 'OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

function money(cents: number) {
  return { amount: (cents / 100).toFixed(2), currency: 'EUR', vat_included: false };
}

/**
 * Точка местоположения водителя у остановки: координаты и расстояние до
 * адреса точки — по нему видно, «был ли там». Погрешность есть только у
 * отметки «пройдена».
 */
function positionAt(
  stop: { lat: number | null; lon: number | null },
  lat: number | null,
  lon: number | null,
  accuracyM: number | null = null,
) {
  if (lat === null || lon === null) return null;
  return {
    lat,
    lon,
    accuracy_m: accuracyM,
    distance_m: stop.lat !== null && stop.lon !== null ? metersBetween({ lat: stop.lat, lon: stop.lon }, { lat, lon }) : null,
  };
}

function stopOut(s: StopRow) {
  return {
    sequence: s.sequence,
    role: s.role,
    place_name: s.place_name,
    company_name: s.company_name,
    address: s.address,
    city: s.city,
    country: s.country,
    location: s.lat !== null && s.lon !== null ? { lat: s.lat, lon: s.lon } : null,
    scheduled_date: s.scheduled_date,
    scheduled_time: s.scheduled_time ? s.scheduled_time.slice(0, 5) : null,
    eta_at: s.eta_at,
    arrived_at: s.arrived_at,
    completed_at: s.completed_at,
    trailer_loaded: s.trailer_loaded,
    cargo_weight_kg: s.cargo_weight_kg,
    consignee: s.consignee,
    contact: s.contact_name || s.contact_phone ? { name: s.contact_name, phone: s.contact_phone } : null,
    external_ref: s.external_ref,
    seal_required: s.seal_required,
    note: s.note,
    damage_note: s.damage_note,
    eta: s.eta_at ? { at: s.eta_at, source: s.eta_source, updated_at: s.eta_updated_at } : null,
    arrival: s.arrived_at ? { at: s.arrived_at, position: positionAt(s, s.arrived_lat, s.arrived_lon) } : null,
    completion: s.completed_at
      ? { at: s.completed_at, position: positionAt(s, s.completed_lat, s.completed_lon, s.completed_accuracy_m) }
      : null,
  };
}

function orderOut(o: OrderRow) {
  return {
    ref: o.ref,
    shipper_ref: o.shipper_ref,
    status: o.status,
    order_type: o.order_type,
    haul_kind: o.haul_kind,
    container_feet: o.container_feet,
    ldm: o.ldm,
    trailer: o.trailer,
    trailer_plate: o.trailer_plate,
    distance_km: o.distance_km,
    rate: money(o.rate_cents),
    comment: o.comment,
    dispatch: o.dispatch_mode,
    created_at: o.created_at,
    published_at: o.published_at,
    deadline_at: o.deadline_at,
    closed_at: o.closed_at,
    updated_at: o.updated_at,
  };
}

export async function listOrders(ctx: ApiContext, url: URL) {
  const admin = createAdminClient();

  const limitRaw = Number(url.searchParams.get('limit') ?? 50);
  const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100 ? limitRaw : null;
  if (limit === null) throw new ApiError('bad_request', 'limit must be an integer 1–100.');

  let query = admin
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('shipper_company_id', ctx.companyId)
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1);

  const status = url.searchParams.get('status');
  if (status) {
    const wanted = status.split(',').map((s) => s.trim().toUpperCase());
    if (!wanted.every((s) => (STATUSES as readonly string[]).includes(s))) {
      throw new ApiError('bad_request', `status must be a comma-separated list of: ${STATUSES.join(', ')}.`);
    }
    query = query.in('status', wanted as (typeof STATUSES)[number][]);
  }

  const since = url.searchParams.get('updated_since');
  if (since) {
    if (Number.isNaN(Date.parse(since))) throw new ApiError('bad_request', 'updated_since must be an ISO 8601 timestamp.');
    query = query.gt('updated_at', new Date(since).toISOString());
  }

  const cursor = url.searchParams.get('cursor');
  if (cursor) {
    const c = decodeCursor(cursor);
    if (!c) throw new ApiError('bad_request', 'Invalid cursor.');
    query = query.or(`updated_at.gt.${c.at},and(updated_at.eq.${c.at},id.gt.${c.id})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as OrderRow[];
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const next = rows.length > limit ? encodeCursor(last.updated_at, last.id) : null;

  /* Откуда и куда — первая и последняя точка, для списка этого хватает. */
  const ends = new Map<string, { from: string | null; to: string | null }>();
  if (page.length) {
    const { data: stops, error: stopsError } = await admin
      .from('order_stops')
      .select('order_id,sequence,city')
      .in(
        'order_id',
        page.map((o) => o.id),
      )
      .order('sequence');
    if (stopsError) throw stopsError;
    for (const s of stops ?? []) {
      const e = ends.get(s.order_id) ?? { from: null, to: null };
      if (e.from === null) e.from = s.city;
      e.to = s.city;
      ends.set(s.order_id, e);
    }
  }

  return {
    data: page.map((o) => ({ ...orderOut(o), route: ends.get(o.id) ?? { from: null, to: null } })),
    next_cursor: next,
  };
}

export async function findOrder(ctx: ApiContext, ref: string): Promise<OrderRow> {
  if (!/^[A-Z]{2}-\d{4}-\d{3,6}$/.test(ref)) throw new ApiError('not_found', 'Order not found.');
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('shipper_company_id', ctx.companyId)
    .eq('ref', ref)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('not_found', 'Order not found.');
  return data as unknown as OrderRow;
}

export async function getOrder(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();

  const [
    { data: stops, error: stopsError },
    { data: vehicles, error: vehiclesError },
    { data: rating, error: ratingError },
  ] = await Promise.all([
    admin.from('order_stops').select(STOP_COLUMNS).eq('order_id', order.id).order('sequence'),
    admin.rpc('api_order_vehicles', { p_key_id: ctx.keyId, p_order_ids: [order.id] }),
    admin
      .from('order_ratings')
      .select('score,comment,created_at,updated_at')
      .eq('order_id', order.id)
      .eq('shipper_company_id', ctx.companyId)
      .maybeSingle(),
  ]);
  if (stopsError) throw stopsError;
  if (vehiclesError) throw vehiclesError;
  if (ratingError) throw ratingError;

  const v = vehicles?.[0];
  const stopRows = (stops ?? []) as unknown as StopRow[];

  return {
    ...orderOut(order),
    stops: stopRows.map(stopOut),
    progress: {
      stops_total: stopRows.length,
      stops_arrived: stopRows.filter((s) => s.arrived_at).length,
      stops_completed: stopRows.filter((s) => s.completed_at).length,
    },
    vehicle: v
      ? {
          plate: v.plate,
          make: v.make,
          euro_class: v.euro_class,
          axles: v.axles,
          driver_name: v.driver_name,
          driver_languages: v.languages,
          carrier_rating: v.rating,
        }
      : null,
    rating: rating ? { score: rating.score, comment: rating.comment, rated_at: rating.updated_at ?? rating.created_at } : null,
  };
}

/** Документ глазами API: что это, где и когда снято, ссылка на файл. */
type DocumentRow = {
  id: string;
  kind: string;
  phase: string | null;
  subject: string | null;
  angle: string | null;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
  captured_at: string | null;
  captured_lat: number | null;
  captured_lon: number | null;
  signer_name: string | null;
  stop: { sequence: number; lat: number | null; lon: number | null } | null;
};

const DOCUMENT_COLUMNS =
  'id,kind,phase,subject,angle,file_name,mime_type,size_bytes,storage_path,created_at,captured_at,captured_lat,captured_lon,signer_name,stop:order_stops(sequence,lat,lon)';

const sequenceOf = (stop: unknown) => (stop as { sequence: number } | null)?.sequence ?? null;

export async function orderEvents(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();

  const [events, stops, docs, amendments] = await Promise.all([
    admin.from('order_events').select('from_status,to_status,created_at').eq('order_id', order.id).order('created_at').order('id'),
    admin.from('order_stops').select('sequence,role,city,arrived_at,completed_at').eq('order_id', order.id),
    admin.from('order_documents').select('id,kind,created_at,stop:order_stops(sequence)').eq('order_id', order.id),
    admin.from('order_amendments').select('id,kind,stop_label,created_at,stop:order_stops(sequence)').eq('order_id', order.id),
  ]);
  if (events.error) throw events.error;
  if (stops.error) throw stops.error;
  if (docs.error) throw docs.error;
  if (amendments.error) throw amendments.error;

  const out: { at: string; type: string; [key: string]: unknown }[] = [];
  for (const e of events.data ?? []) {
    out.push({ at: e.created_at, type: 'status', from: e.from_status, to: e.to_status });
  }
  for (const s of stops.data ?? []) {
    if (s.arrived_at) out.push({ at: s.arrived_at, type: 'stop_arrived', sequence: s.sequence, role: s.role, city: s.city });
    if (s.completed_at) out.push({ at: s.completed_at, type: 'stop_completed', sequence: s.sequence, role: s.role, city: s.city });
  }
  for (const d of docs.data ?? []) {
    out.push({ at: d.created_at, type: 'document', document_id: d.id, kind: d.kind, sequence: sequenceOf(d.stop) });
  }
  for (const a of amendments.data ?? []) {
    out.push({
      at: a.created_at,
      type: 'amendment',
      amendment_id: a.id,
      kind: a.kind,
      sequence: sequenceOf(a.stop),
      stop_label: a.stop_label,
    });
  }
  out.sort((a, b) => a.at.localeCompare(b.at));

  return { ref: order.ref, data: out };
}

const LINK_TTL_S = 300;

export async function orderDocuments(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();

  const { data: docs, error } = await admin
    .from('order_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('order_id', order.id)
    .order('created_at');
  if (error) throw error;

  const rows = (docs ?? []) as unknown as DocumentRow[];
  const signed = rows.length
    ? await admin.storage.from('trip-docs').createSignedUrls(
        rows.map((d) => d.storage_path),
        LINK_TTL_S,
      )
    : { data: [], error: null };
  if (signed.error) throw signed.error;
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const expires = new Date(Date.now() + LINK_TTL_S * 1000).toISOString();

  return {
    ref: order.ref,
    data: rows.map((d) => ({
      id: d.id,
      kind: d.kind,
      damage: d.kind === 'DAMAGE_PHOTO',
      phase: d.phase,
      subject: d.subject,
      angle: d.angle,
      stop_sequence: d.stop?.sequence ?? null,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size_bytes: d.size_bytes,
      signer_name: d.signer_name,
      created_at: d.created_at,
      captured_at: d.captured_at,
      captured_position: positionAt(d.stop ?? { lat: null, lon: null }, d.captured_lat, d.captured_lon),
      url: urls.get(d.storage_path) ?? null,
      url_expires_at: expires,
    })),
  };
}

/**
 * Отклики перевозчиков — те же строки, что в кабинете (offers_for_shipper
 * от имени выпустившего ключ). Имени перевозчика нет: его не показывает и
 * кабинет, когда стороной договора заказчика выступает Aivomaa.
 */
export async function orderOffers(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('api_order_offers', { p_key_id: ctx.keyId, p_order_ids: [order.id] });
  if (error) throw error;

  return {
    ref: order.ref,
    data: [...(data ?? [])]
      .sort((a, b) => a.variant_no - b.variant_no)
      .map((o) => ({
        id: o.offer_id,
        variant_no: o.variant_no,
        chosen: o.is_chosen,
        assigned: o.is_assigned,
        created_at: o.created_at,
        vehicle: {
          plate: o.plate,
          make: o.make,
          euro_class: o.euro_class,
          axles: o.axles,
          base_city: o.base_city,
          driver_name: o.driver_name,
          driver_languages: o.languages,
          carrier_rating: o.rating,
        },
      })),
  };
}

/** Корректировки маршрута в пути: что изменилось, у какой точки и подтверждено ли. */
export async function orderAmendments(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('order_amendments')
    .select('id,kind,stop_role,stop_label,changes,created_at,acknowledged_at,stop:order_stops(sequence)')
    .eq('order_id', order.id)
    .order('created_at');
  if (error) throw error;

  return {
    ref: order.ref,
    data: (data ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      stop_sequence: sequenceOf(a.stop),
      stop_role: a.stop_role,
      stop_label: a.stop_label,
      changes: a.changes,
      created_at: a.created_at,
      acknowledged_at: a.acknowledged_at,
    })),
  };
}
