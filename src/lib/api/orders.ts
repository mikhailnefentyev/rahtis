import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
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
 * Координаты отметки водителя (где он стоял, когда нажал «пройдена») в
 * первой версии не отдаются: это место нахождения человека, и выносить
 * его в чужую систему — отдельное решение.
 */

const ORDER_COLUMNS =
  'id,ref,shipper_ref,order_type,haul_kind,container_feet,ldm,trailer,trailer_plate,distance_km,rate_cents,comment,status,dispatch_mode,created_at,published_at,deadline_at,closed_at,updated_at';

const STOP_COLUMNS =
  'order_id,sequence,role,place_name,company_name,address,city,country,lat,lon,scheduled_date,scheduled_time,eta_at,arrived_at,completed_at,trailer_loaded,cargo_weight_kg,consignee,contact_name,contact_phone,external_ref,seal_required,note,damage_note';

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
};

const STATUSES = ['DRAFT', 'OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

function money(cents: number) {
  return { amount: (cents / 100).toFixed(2), currency: 'EUR', vat_included: false };
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

async function findOrder(ctx: ApiContext, ref: string): Promise<OrderRow> {
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

  const [{ data: stops, error: stopsError }, { data: vehicles, error: vehiclesError }] = await Promise.all([
    admin.from('order_stops').select(STOP_COLUMNS).eq('order_id', order.id).order('sequence'),
    admin.rpc('api_order_vehicles', { p_key_id: ctx.keyId, p_order_ids: [order.id] }),
  ]);
  if (stopsError) throw stopsError;
  if (vehiclesError) throw vehiclesError;

  const v = vehicles?.[0];
  const stopRows = (stops ?? []) as unknown as StopRow[];

  return {
    ...orderOut(order),
    stops: stopRows.map(stopOut),
    progress: {
      stops_total: stopRows.length,
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
  };
}

export async function orderEvents(ctx: ApiContext, ref: string) {
  const order = await findOrder(ctx, ref);
  const admin = createAdminClient();

  const [{ data: events, error: eventsError }, { data: stops, error: stopsError }] = await Promise.all([
    admin.from('order_events').select('from_status,to_status,created_at').eq('order_id', order.id).order('created_at'),
    admin.from('order_stops').select('sequence,role,city,arrived_at,completed_at').eq('order_id', order.id),
  ]);
  if (eventsError) throw eventsError;
  if (stopsError) throw stopsError;

  const out: { at: string; type: string; [key: string]: unknown }[] = [];
  for (const e of events ?? []) {
    out.push({ at: e.created_at, type: 'status', from: e.from_status, to: e.to_status });
  }
  for (const s of stops ?? []) {
    if (s.arrived_at) out.push({ at: s.arrived_at, type: 'stop_arrived', sequence: s.sequence, role: s.role, city: s.city });
    if (s.completed_at) out.push({ at: s.completed_at, type: 'stop_completed', sequence: s.sequence, role: s.role, city: s.city });
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
    .select('id,kind,phase,subject,angle,file_name,mime_type,size_bytes,storage_path,created_at,captured_at,signer_name,stop:order_stops(sequence)')
    .eq('order_id', order.id)
    .order('created_at');
  if (error) throw error;

  const rows = docs ?? [];
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
      phase: d.phase,
      subject: d.subject,
      angle: d.angle,
      stop_sequence: (d.stop as { sequence: number } | null)?.sequence ?? null,
      file_name: d.file_name,
      mime_type: d.mime_type,
      size_bytes: d.size_bytes,
      signer_name: d.signer_name,
      created_at: d.created_at,
      captured_at: d.captured_at,
      url: urls.get(d.storage_path) ?? null,
      url_expires_at: expires,
    })),
  };
}
