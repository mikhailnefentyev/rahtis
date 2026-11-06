import 'server-only';

import type { ChangeRequest, FleetOption, OrderChangesData, OrderPricing } from '@/components/domain/OrderChanges';
import { createClient } from '@/lib/supabase/server';

/**
 * Для карточек заказа (обе стороны): режим цены и пробег по маршруту,
 * открытые сообщения водителя. Права — функция базы и RLS. До миграции
 * (нет функции или таблицы) — пусто, карточка рисуется как раньше.
 */
export async function loadOrderChanges(orderIds: readonly string[]): Promise<Record<string, OrderChangesData>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  const result: Record<string, OrderChangesData> = {};
  if (ids.length === 0) return result;
  for (const id of ids) result[id] = { requests: [] };

  const supabase = await createClient();
  const [{ data: pricing }, { data: requests }] = await Promise.all([
    supabase.rpc('order_pricing_info', { p_order_ids: ids }),
    supabase
      .from('order_change_requests')
      .select('id, order_id, stop_id, message, address, lat, created_at')
      .in('order_id', ids)
      .is('resolved_at', null)
      .order('created_at'),
  ]);

  for (const p of pricing ?? []) {
    const entry: OrderPricing = {
      mode: p.pricing_mode === 'PER_KM' ? 'PER_KM' : 'FIXED',
      perKmCents: p.rate_per_km_cents,
      distanceKm: p.distance_km,
      autoKm: p.distance_auto_km,
      rateCents: p.rate_cents,
      currency: p.currency,
    };
    result[p.order_id].pricing = entry;
  }
  for (const r of requests ?? []) {
    const request: ChangeRequest = {
      id: r.id,
      stopId: r.stop_id,
      message: r.message,
      address: r.address,
      hasPoint: r.lat !== null,
      createdAt: r.created_at,
    };
    result[r.order_id]?.requests.push(request);
  }
  return result;
}

/** Одобренные машины и действующие водители перевозчика — для смены на рейсе. */
export async function loadFleetOptions(companyId: string): Promise<{ vehicles: FleetOption[]; drivers: FleetOption[] }> {
  const supabase = await createClient();
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    supabase.from('vehicles').select('id, plate').eq('company_id', companyId).not('approved_at', 'is', null).order('plate'),
    supabase.from('drivers').select('id, full_name').eq('company_id', companyId).eq('status', 'ACTIVE').order('full_name'),
  ]);
  return {
    vehicles: (vehicles ?? []).map((v) => ({ id: v.id, label: v.plate })),
    drivers: (drivers ?? []).map((d) => ({ id: d.id, label: d.full_name })),
  };
}

/**
 * Заказы стола с ценой за км: id → ставка в центах. Служебным ключом —
 * страница уже отобрала видимые перевозчику заказы (desk_orders), а
 * колонки режима цены desk_orders не отдаёт. Перевозчику важно знать:
 * при правке маршрута цена пересчитается.
 */
export async function perKmByOrder(orderIds: readonly string[]): Promise<Record<string, number>> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (ids.length === 0) return {};
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { data } = await createAdminClient()
      .from('orders')
      .select('id, rate_per_km_cents')
      .in('id', ids)
      .eq('pricing_mode', 'PER_KM');
    return Object.fromEntries((data ?? []).filter((o) => o.rate_per_km_cents).map((o) => [o.id, o.rate_per_km_cents as number]));
  } catch {
    return {};
  }
}
