import 'server-only';

import { matchPlate, type OrderDraft } from '@/lib/orders/importDraft';
import { locateDraft } from '@/lib/orders/importServer';
import { createClient } from '@/lib/supabase/server';
import { tripChanges, type CurrentStop, type TripChanges } from './changes';

/*
 * Поправка к рейсу из письма: всё, что нужно странице сравнения и
 * действию «применить». Права — RLS: черновик своей компании, рейс и
 * точки — те, что компании видны. Действие пересчитывает сравнение
 * заново (форма только выбирает строки), поэтому загрузка одна на обоих.
 */

export type EmailChanges = {
  draftId: string;
  subject: string;
  from: string;
  receivedAt: string;
  order: { id: string; ref: string; status: string; shipperRef: string | null; client: string | null };
  changes: TripChanges;
  /** Машину меняет только перевозчик рейса. */
  canChangeVehicle: boolean;
};

export type EmailChangesResult = { ok: true; value: EmailChanges } | { ok: false; reason: 'notFound' | 'closed' | 'failed' };

export async function loadEmailChanges(
  draftId: string,
  locale: string,
  role: 'SHIPPER' | 'CARRIER',
): Promise<EmailChangesResult> {
  if (!/^[0-9a-f-]{36}$/i.test(draftId)) return { ok: false, reason: 'notFound' };
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('order_email_drafts')
    .select('id, subject, from_address, received_at, status, draft, amends_order_id')
    .eq('id', draftId)
    .maybeSingle();
  if (!row || !row.amends_order_id || !row.draft || typeof row.draft !== 'object') return { ok: false, reason: 'notFound' };
  if (row.status !== 'PARSED') return { ok: false, reason: 'closed' };

  const { data: order } = await supabase
    .from('orders')
    .select('id, ref, status, shipper_ref, shipper_company_id')
    .eq('id', row.amends_order_id)
    .maybeSingle();
  if (!order) return { ok: false, reason: 'notFound' };
  /* Чей рейс — чтобы случайное совпадение номера у другого клиента было видно сразу. */
  const { data: client } = await supabase.from('companies').select('name').eq('id', order.shipper_company_id).maybeSingle();

  const { data: stops, error } = await supabase
    .from('order_stops')
    .select(
      'id, role, sequence, completed_at, address, city, place_name, company_name, contact_name, contact_phone, scheduled_date, scheduled_time, external_ref, cargo_weight_kg, lat, lon',
    )
    .eq('order_id', order.id)
    .order('sequence');
  if (error || !stops) {
    console.error('поправка из письма: точки рейса не прочитаны:', error?.message);
    return { ok: false, reason: 'failed' };
  }

  const carrier = role === 'CARRIER';
  const [fleetRes, assignmentsRes] = carrier
    ? await Promise.all([supabase.rpc('carrier_own_vehicles'), supabase.rpc('my_assignments')])
    : [{ data: [] }, { data: [] }];
  const fleet = (fleetRes.data ?? []).map((v) => ({ id: v.vehicle_id, plate: v.plate }));
  const plate = (assignmentsRes.data ?? []).find((a) => a.id === order.id)?.vehicle_plate ?? null;
  const current = plate ? (fleet.find((v) => v.plate === plate) ?? { id: '', plate }) : null;

  const draft = await locateDraft(row.draft as unknown as OrderDraft, locale);
  const current_stops: CurrentStop[] = stops.map((s) => ({
    id: s.id,
    role: s.role,
    sequence: s.sequence,
    completed: s.completed_at !== null,
    address: s.address,
    city: s.city,
    place_name: s.place_name,
    company_name: s.company_name,
    contact_name: s.contact_name,
    contact_phone: s.contact_phone,
    scheduled_date: s.scheduled_date,
    scheduled_time: s.scheduled_time,
    external_ref: s.external_ref,
    cargo_weight_kg: s.cargo_weight_kg,
    lat: s.lat,
    lon: s.lon,
  }));

  const changes = tripChanges({
    stops: current_stops,
    /* Заказчик машину не выбирает — номер из письма ему не к чему. */
    draft: carrier ? draft : { ...draft, vehiclePlate: '' },
    vehicle: current,
    findVehicle: (p) => matchPlate(p, fleet),
  });

  return {
    ok: true,
    value: {
      draftId: row.id,
      subject: row.subject,
      from: row.from_address,
      receivedAt: row.received_at,
      order: { id: order.id, ref: order.ref, status: order.status, shipperRef: order.shipper_ref, client: client?.name ?? null },
      changes,
      canChangeVehicle: carrier,
    },
  };
}
