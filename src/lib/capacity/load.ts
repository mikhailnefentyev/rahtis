import 'server-only';

import { cache } from 'react';
import { todayInHelsinki } from '@/lib/dates';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';
import {
  coarsePlace,
  effectiveMode,
  proposalsForVehicle,
  vehicleCapacity,
  worthOffering,
  type Dims,
  type Proposal,
  type PublishMode,
  type TripOrderInput,
} from './compute';

/*
 * Догрузы: рейсы из базы → предложения по машинам (compute.ts) → сверка с
 * уже опубликованным. Одна сборка на кабинет перевозчика (сессия, RLS) и
 * ночной расчёт (служебный ключ).
 */

export type OfferRow = Database['public']['Tables']['capacity_offers']['Row'];

type TripRow = {
  company_id: string;
  company_country: string | null;
  order_id: string;
  ref: string;
  haul_kind: string;
  ldm: number | null;
  vehicle_id: string;
  plate: string;
  vehicle_class: string;
  vehicle_body: string | null;
  vehicle_ldm: number | null;
  vehicle_kg: number | null;
  trailer_id: string | null;
  trailer_body: string | null;
  trailer_ldm: number | null;
  trailer_kg: number | null;
  combo_ldm: number | null;
  combo_kg: number | null;
  stops: {
    sequence: number;
    role: string;
    city: string;
    country: string | null;
    lat: number | null;
    lon: number | null;
    date: string | null;
    time: string | null;
    kg: number | null;
    done: boolean;
  }[];
};

export type FleetProposal = Proposal & {
  key: string;
  companyId: string;
  plate: string;
  vehicleClass: string;
  body: string | null;
  mode: PublishMode;
  /** Живое предложение (DRAFT или PUBLISHED) этого отрезка. */
  offer: OfferRow | null;
  /** Перевозчик уже снимал место этого отрезка — сами не публикуем и не спрашиваем снова. */
  withdrawn: boolean;
};

const LIVE = new Set(['DRAFT', 'PUBLISHED']);
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** Опубликованное минус то, на сколько уменьшился расчёт (новый заказ в машине). */
function shrink(published: number | null, before: number | null, now: number | null, scale: number): number | null {
  if (published === null || now === null) return published;
  if (before === null) return Math.min(published, now);
  if (now >= before) return published;
  return Math.max(Math.round((published - (before - now)) * scale) / scale, 0);
}

function readTrips(raw: Json | null): TripRow[] {
  return Array.isArray(raw) ? (raw as unknown as TripRow[]) : [];
}

/** Рейсы, настройки и предложения → предложения по машинам. */
export function buildProposals(
  trips: TripRow[],
  settings: readonly { company_id: string; vehicle_id: string | null; mode: string }[],
  offers: readonly OfferRow[],
  today: string = todayInHelsinki(),
): FleetProposal[] {
  const byVehicle = new Map<string, TripRow[]>();
  for (const row of trips) {
    const list = byVehicle.get(row.vehicle_id) ?? [];
    list.push(row);
    byVehicle.set(row.vehicle_id, list);
  }

  const out: FleetProposal[] = [];
  for (const [vehicleId, rows] of byVehicle) {
    const head = rows[0];
    /* Прицеп рейса — первый назначенный среди заказов машины. */
    const withTrailer = rows.find((r) => r.trailer_id) ?? head;
    const capacity = vehicleCapacity({
      vehicleClass: head.vehicle_class,
      vehicle: { ldm: num(head.vehicle_ldm), payloadKg: num(head.vehicle_kg) },
      trailer: withTrailer.trailer_id ? { ldm: num(withTrailer.trailer_ldm), payloadKg: num(withTrailer.trailer_kg) } : null,
      combo:
        withTrailer.combo_ldm !== null || withTrailer.combo_kg !== null
          ? { ldm: num(withTrailer.combo_ldm), payloadKg: num(withTrailer.combo_kg) }
          : null,
    });
    const orders: TripOrderInput[] = rows.map((r) => ({
      id: r.order_id,
      ref: r.ref,
      haulKind: r.haul_kind,
      ldm: num(r.ldm),
      stops: (r.stops ?? []).map((s) => ({
        sequence: s.sequence,
        role: s.role,
        city: s.city,
        country: s.country,
        lat: num(s.lat),
        lon: num(s.lon),
        date: s.date,
        time: s.time,
        weightKg: num(s.kg),
        completed: Boolean(s.done),
      })),
    }));
    const companySettings = settings
      .filter((s) => s.company_id === head.company_id)
      .map((s) => ({ vehicleId: s.vehicle_id, mode: s.mode }));
    const mode = effectiveMode(companySettings, vehicleId);

    for (const p of proposalsForVehicle(vehicleId, capacity, orders, today)) {
      const mine = offers.filter((o) => o.vehicle_id === vehicleId && o.order_id && p.orderIds.includes(o.order_id));
      out.push({
        ...p,
        from: coarsePlace(p.from),
        to: coarsePlace(p.to),
        key: `${vehicleId}:${p.anchorOrderId}`,
        companyId: head.company_id,
        plate: head.plate,
        vehicleClass: head.vehicle_class,
        body: withTrailer.trailer_body ?? head.vehicle_body,
        mode,
        offer: mine.find((o) => LIVE.has(o.status)) ?? null,
        withdrawn: mine.some((o) => o.status === 'WITHDRAWN'),
      });
    }
  }
  return out.sort((a, b) => (a.availableFrom === b.availableFrom ? a.plate.localeCompare(b.plate) : a.availableFrom < b.availableFrom ? -1 : 1));
}

/** Строка для вставки предложения. */
export function offerInsert(p: FleetProposal, free: Dims, auto: boolean): Database['public']['Tables']['capacity_offers']['Insert'] {
  return {
    company_id: p.companyId,
    vehicle_id: p.vehicleId,
    order_id: p.anchorOrderId,
    trip_order_ids: p.orderIds,
    from_city: p.from.city || '—',
    from_country: p.from.country,
    from_lat: p.from.lat,
    from_lon: p.from.lon,
    to_city: p.to.city || '—',
    to_country: p.to.country,
    to_lat: p.to.lat,
    to_lon: p.to.lon,
    available_from: p.availableFrom,
    available_to: p.availableTo,
    free_ldm: free.ldm,
    free_kg: free.kg,
    free_pallets: free.pallets,
    computed_ldm: p.free.ldm,
    computed_kg: p.free.kg,
    body: p.body,
    vehicle_class: p.vehicleClass as Database['public']['Enums']['vehicle_class'],
    status: 'PUBLISHED',
    auto,
  };
}

/**
 * Кабинет перевозчика: свои рейсы под сессией. Нет функции в базе
 * (миграция не применена) — пусто. Один расчёт на запрос: его читают и
 * «Требует действия» в оболочке, и сама страница.
 */
export const loadCarrierCapacity = cache(async (): Promise<{ proposals: FleetProposal[]; ok: boolean }> => {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [trips, settings, offers] = await Promise.all([
    supabase.rpc('capacity_fleet_trips'),
    supabase.from('capacity_publish_settings').select('company_id, vehicle_id, mode'),
    supabase.from('capacity_offers').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
  ]);
  if (trips.error || settings.error || offers.error) return { proposals: [], ok: false };
  return { proposals: buildProposals(readTrips(trips.data), settings.data ?? [], offers.data ?? []), ok: true };
});

/**
 * Ночной расчёт (и после смены режима или принятия запроса):
 *   · истёкшее — EXPIRED (capacity_expire);
 *   · опубликованное, где места стало меньше, — уменьшается, мало — FILLED;
 *     отрезка больше нет (рейс снят) — EXPIRED;
 *   · режим AUTO — новое место публикуется само (уведомление пишет база),
 *     кроме отрезков, где перевозчик место уже снимал.
 * companyIds не задан — все компании с AUTO и с опубликованным.
 */
export async function syncCapacity(companyIds?: string[]): Promise<{ published: number; updated: number; closed: number; errors: string[] }> {
  const admin = createAdminClient();
  const result = { published: 0, updated: 0, closed: 0, errors: [] as string[] };

  const expired = await admin.rpc('capacity_expire');
  if (expired.error) {
    result.errors.push(expired.error.message);
    return result;
  }

  let ids = companyIds;
  if (!ids) {
    const [{ data: autos }, { data: live }] = await Promise.all([
      admin.from('capacity_publish_settings').select('company_id').eq('mode', 'AUTO'),
      admin.from('capacity_offers').select('company_id').eq('status', 'PUBLISHED'),
    ]);
    ids = [...new Set([...(autos ?? []), ...(live ?? [])].map((r) => r.company_id))];
  }
  if (ids.length === 0) return result;

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [trips, settings, offers] = await Promise.all([
      admin.rpc('capacity_fleet_trips_for', { p_company_ids: chunk }),
      admin.from('capacity_publish_settings').select('company_id, vehicle_id, mode').in('company_id', chunk),
      admin.from('capacity_offers').select('*').in('company_id', chunk).gte('created_at', since),
    ]);
    if (trips.error || settings.error || offers.error) {
      result.errors.push((trips.error ?? settings.error ?? offers.error)!.message);
      continue;
    }
    const proposals = buildProposals(readTrips(trips.data), settings.data ?? [], offers.data ?? []);
    const matched = new Set<string>();

    for (const p of proposals) {
      if (p.offer) {
        matched.add(p.offer.id);
        if (p.offer.status !== 'PUBLISHED') continue;
        /* Поправку перевозчика не затираем: вычитаем только то, на сколько расчёт уменьшился с публикации. */
        const ldm = shrink(num(p.offer.free_ldm), num(p.offer.computed_ldm), p.free.ldm, 10);
        const kg = shrink(p.offer.free_kg, p.offer.computed_kg, p.free.kg, 1);
        if (ldm === num(p.offer.free_ldm) && kg === p.offer.free_kg && p.free.ldm === num(p.offer.computed_ldm) && p.free.kg === p.offer.computed_kg) continue;
        const filled = !worthOffering({ ldm, kg, pallets: null });
        const { error } = await admin
          .from('capacity_offers')
          .update({ free_ldm: ldm, free_kg: kg, computed_ldm: p.free.ldm, computed_kg: p.free.kg, ...(filled ? { status: 'FILLED' } : {}) })
          .eq('id', p.offer.id);
        if (error) result.errors.push(error.message);
        else if (filled) result.closed += 1;
        else result.updated += 1;
        continue;
      }
      if (p.mode !== 'AUTO' || !p.offerable || p.withdrawn) continue;
      const { error } = await admin.from('capacity_offers').insert(offerInsert(p, p.free, true));
      if (error) result.errors.push(error.message);
      else result.published += 1;
    }

    /* Опубликованное без отрезка: рейс снят или ушёл с машины. */
    const orphans = (offers.data ?? []).filter((o) => o.status === 'PUBLISHED' && !matched.has(o.id));
    if (orphans.length) {
      const { error } = await admin.from('capacity_offers').update({ status: 'EXPIRED' }).in('id', orphans.map((o) => o.id));
      if (error) result.errors.push(error.message);
      else result.closed += orphans.length;
    }
  }
  return result;
}
