import 'server-only';

import { countryPack } from '@/lib/country';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EftiConsignment, EftiEquipment, EftiParty, EftiPlace } from './types';

/**
 * Заказ RAHTIS → данные о перевозке для eFTI (этап А, 19.11.2026).
 *
 * Берём то, что уже есть в заказе; чего нет — не выдумываем:
 *   · отправитель — компания-заказчик (юридическое имя и адрес);
 *     получатель — грузополучатель последней точки разгрузки, иначе
 *     название компании в этой точке; перевозчик — назначенная компания;
 *   · принятие груза перевозчиком (eFTI39) — фактическое завершение
 *     первой погрузки. До неё набора нет (NOT_LOADED): все даты в eFTI —
 *     фактические, плановое время туда не идёт;
 *   · фактическая доставка (eFTI188) — только у выполненного заказа, по
 *     завершению последней разгрузки;
 *   · страна регистрации машины — страна компании-перевозчика (своей
 *     колонки у машины нет);
 *   · опасный груз — false: модели ADR в заказе ещё нет (этап Б);
 *   · описание груза — комментарий заказа (структурного описания груза,
 *     мест и упаковки ещё нет — этап Б).
 * Почтовый индекс — из адреса по шаблону страны.
 */

const LOADING = new Set(['PICKUP', 'EXTRA_LOAD']);
const UNLOADING = new Set(['DELIVERY', 'EXTRA_UNLOAD']);

type Stop = {
  sequence: number;
  role: string;
  address: string | null;
  city: string | null;
  country: string | null;
  company_name: string | null;
  consignee: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  cargo_weight_kg: number | null;
};

type Company = {
  name: string;
  legal_name: string | null;
  business_id: string | null;
  legal_street: string | null;
  legal_postal_code: string | null;
  legal_city: string | null;
  legal_country: string | null;
  country: string | null;
};

function postcodeOf(address: string | null, country: string): string | null {
  if (!address) return null;
  const match = address.match(countryPack(country).postcode);
  return match ? match[0] : null;
}

function place(stop: Stop, fallbackCountry: string): EftiPlace {
  const country = stop.country ?? fallbackCountry;
  return {
    street: stop.address,
    postcode: postcodeOf(stop.address, country),
    city: stop.city,
    country,
    /* Только фактическое время: XML пишет его как ActualOccurrenceDateTime. */
    at: stop.completed_at,
  };
}

function party(company: Company): EftiParty {
  const country = company.legal_country ?? company.country ?? 'FI';
  return {
    name: company.legal_name || company.name,
    id: company.business_id,
    street: company.legal_street,
    postcode: company.legal_postal_code,
    city: company.legal_city,
    country,
  };
}

export type ConsignmentResult =
  | { ok: true; consignment: EftiConsignment }
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_ASSIGNED' | 'NO_STOPS' | 'NO_VEHICLE' | 'NOT_LOADED' };

/** Данные о перевозке по заказу и его набору eFTI (datasetId). */
export async function loadConsignment(orderId: string, datasetId: string): Promise<ConsignmentResult> {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, ref, status, comment, shipper_company_id, assigned_company_id, assigned_vehicle_id, assigned_trailer_id, trailer_plate, container_feet')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, reason: 'NOT_FOUND' };
  if (!order.assigned_company_id) return { ok: false, reason: 'NOT_ASSIGNED' };
  if (!order.assigned_vehicle_id) return { ok: false, reason: 'NO_VEHICLE' };

  const companyCols = 'name, legal_name, business_id, legal_street, legal_postal_code, legal_city, legal_country, country';
  const [{ data: stops }, { data: shipper }, { data: carrier }, { data: vehicle }, { data: trailer }] = await Promise.all([
    admin
      .from('order_stops')
      .select('sequence, role, address, city, country, company_name, consignee, scheduled_date, scheduled_time, completed_at, cargo_weight_kg')
      .eq('order_id', orderId)
      .order('sequence'),
    admin.from('companies').select(companyCols).eq('id', order.shipper_company_id).maybeSingle(),
    admin.from('companies').select(companyCols).eq('id', order.assigned_company_id).maybeSingle(),
    admin.from('vehicles').select('plate').eq('id', order.assigned_vehicle_id).maybeSingle(),
    order.assigned_trailer_id
      ? admin.from('trailers').select('plate, kind').eq('id', order.assigned_trailer_id).maybeSingle()
      : Promise.resolve({ data: null as { plate: string; kind: string } | null }),
  ]);
  if (!shipper || !carrier) return { ok: false, reason: 'NOT_FOUND' };
  if (!vehicle) return { ok: false, reason: 'NO_VEHICLE' };

  const list = (stops ?? []) as Stop[];
  const loads = list.filter((s) => LOADING.has(s.role));
  const unloads = list.filter((s) => UNLOADING.has(s.role));
  const first = loads[0];
  const last = unloads[unloads.length - 1];
  if (!first || !last) return { ok: false, reason: 'NO_STOPS' };
  if (!first.completed_at) return { ok: false, reason: 'NOT_LOADED' };

  const carrierParty = party(carrier as Company);
  const shipperParty = party(shipper as Company);
  const home = carrierParty.country;
  const loading = place(first, home);
  const unloading = place(last, home);

  const consigneeName = last.consignee?.trim() || last.company_name?.trim() || shipperParty.name;
  const consignee: EftiParty = {
    name: consigneeName,
    id: null,
    street: last.address,
    postcode: unloading.postcode,
    city: last.city,
    country: unloading.country,
  };

  const equipment: EftiEquipment[] = [];
  const trailerPlate = trailer?.plate ?? order.trailer_plate;
  if (trailerPlate) {
    equipment.push({
      id: trailerPlate,
      category: trailer?.kind === 'SEMI' ? 'SEMI_TRAILER' : 'TRAILER',
      country: home,
      sequence: 1,
    });
  }

  const weight = loads.reduce((sum, s) => sum + (s.cargo_weight_kg ?? 0), 0);
  const acceptedAt = first.completed_at;
  const delivered = order.status === 'DONE' && last.completed_at;

  return {
    ok: true,
    consignment: {
      datasetId,
      reference: order.ref,
      carrierAcceptance: { at: acceptedAt, country: loading.country },
      delivery: delivered ? { at: last.completed_at!, country: unloading.country } : null,
      dangerousGoods: false,
      consignor: shipperParty,
      consignee,
      carrier: carrierParty,
      loading,
      unloading,
      vehicle: { plate: vehicle.plate, country: home },
      equipment,
      goods: [
        {
          description: order.comment?.trim() || order.ref,
          grossWeightKg: weight > 0 ? weight : null,
          packages: null,
        },
      ],
    },
  };
}
