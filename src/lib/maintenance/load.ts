import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { compareDue, dueStatus, worstState, type DueState, type DueStatus } from './status';

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MaintenanceItem = Database['public']['Tables']['maintenance_items']['Row'];
export type MaintenanceRecord = Database['public']['Tables']['maintenance_records']['Row'];
export type VehicleDefect = Database['public']['Tables']['vehicle_defects']['Row'] & {
  /** Подписанная ссылка на фото на час — фото лежат в закрытом хранилище. */
  photo_url: string | null;
  driver_name: string | null;
};

export type Downtime = Database['public']['Tables']['vehicle_downtime']['Row'] & {
  /** Действует сегодня (а не запланирован на будущие даты). */
  current: boolean;
  /** Бессрочно (дефект, katsastus, сервис без конца) — снимает с рейсов целиком; с датами — только заказы на эти дни. */
  blocking: boolean;
  /** Рейсы машины или прицепа, уже назначенные на эти дни. */
  orders: { order_id: string; ref: string; first_day: string }[];
};

export type Asset = {
  id: string;
  type: 'VEHICLE' | 'TRAILER';
  plate: string;
  /** Марка машины или вид прицепа — подпись под номером. */
  label: string;
  odometer: number | null;
};

export type ItemWithStatus = MaintenanceItem & { status: DueStatus; asset: Asset };

export type AssetSummary = {
  asset: Asset;
  state: DueState;
  items: number;
  openDefects: number;
  unsafe: boolean;
  /** Машина сейчас вне работы — первая действующая причина. */
  outOfService: Downtime | null;
};

export type FleetMaintenance = {
  today: string;
  assets: Asset[];
  items: ItemWithStatus[];
  defects: VehicleDefect[];
  /** Незакрытые периоды вне работы: действующие и запланированные. */
  downtime: Downtime[];
  summaries: Map<string, AssetSummary>;
};

/**
 * Всё обслуживание компании одним заходом: машины и прицепы с пробегом,
 * пункты плана со статусом на сегодня и дефекты (открытые — все,
 * закрытые — по запросу страницы машины).
 *
 * Чтение — под сессией перевозчика (RLS); фото дефектов подписываются
 * служебным ключом только для строк, которые сессия уже увидела.
 */
export async function loadFleetMaintenance(
  supabase: Supabase,
  input: { companyId: string; today: string; trailerKinds?: Record<string, string>; assetId?: string; withClosed?: boolean },
): Promise<FleetMaintenance> {
  let defectsQuery = supabase
    .from('vehicle_defects')
    .select('*')
    .eq('company_id', input.companyId)
    .order('reported_at', { ascending: false })
    .limit(200);
  if (!input.withClosed) defectsQuery = defectsQuery.eq('status', 'OPEN');
  if (input.assetId) defectsQuery = defectsQuery.or(`vehicle_id.eq.${input.assetId},trailer_id.eq.${input.assetId}`);

  const [{ data: vehicles }, { data: trailers }, { data: items }, { data: odometers }, { data: defects }, { data: drivers }, { data: downtimeRows }] =
    await Promise.all([
      supabase.from('vehicles').select('id, plate, make').eq('company_id', input.companyId).order('plate'),
      supabase.from('trailers').select('id, plate, kind').eq('company_id', input.companyId).order('plate'),
      supabase.from('maintenance_items').select('*').eq('company_id', input.companyId),
      supabase.rpc('fleet_odometers'),
      defectsQuery,
      supabase.from('drivers').select('id, full_name').eq('company_id', input.companyId),
      supabase
        .from('vehicle_downtime')
        .select('*')
        .eq('company_id', input.companyId)
        .is('ended_at', null)
        .order('starts_on'),
    ]);

  const openDowntime = (downtimeRows ?? []).filter((d) => !d.ends_on || d.ends_on >= input.today);
  const { data: affected } = openDowntime.length ? await supabase.rpc('fleet_downtime_orders') : { data: [] };
  const downtime: Downtime[] = openDowntime.map((d) => ({
    ...d,
    current: d.starts_on <= input.today,
    blocking: !d.ends_on,
    orders: (affected ?? [])
      .filter((o) => o.downtime_id === d.id)
      .map((o) => ({ order_id: o.order_id, ref: o.ref, first_day: o.first_day })),
  }));

  const km = new Map((odometers ?? []).map((row) => [row.vehicle_id, row.km ?? null]));
  const assets: Asset[] = [
    ...(vehicles ?? []).map((v) => ({ id: v.id, type: 'VEHICLE' as const, plate: v.plate, label: v.make, odometer: km.get(v.id) ?? null })),
    ...(trailers ?? []).map((tr) => ({
      id: tr.id,
      type: 'TRAILER' as const,
      plate: tr.plate,
      label: input.trailerKinds?.[tr.kind] ?? tr.kind,
      odometer: null,
    })),
  ];
  const byId = new Map(assets.map((a) => [a.id, a]));

  const withStatus: ItemWithStatus[] = [];
  for (const item of items ?? []) {
    const asset = byId.get(item.vehicle_id ?? item.trailer_id ?? '');
    if (!asset) continue;
    withStatus.push({ ...item, asset, status: dueStatus(item, input.today, asset.odometer) });
  }
  withStatus.sort((a, b) => compareDue(a.status, b.status));

  const driverName = new Map((drivers ?? []).map((d) => [d.id, d.full_name]));
  const paths = (defects ?? []).map((d) => d.photo_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await createAdminClient().storage.from('fleet-docs').createSignedUrls(paths, 3600);
    for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  }
  const defectRows: VehicleDefect[] = (defects ?? []).map((d) => ({
    ...d,
    photo_url: d.photo_path ? (signed.get(d.photo_path) ?? null) : null,
    driver_name: d.driver_id ? (driverName.get(d.driver_id) ?? null) : null,
  }));

  const summaries = new Map<string, AssetSummary>();
  for (const asset of assets) {
    const own = withStatus.filter((i) => i.asset.id === asset.id);
    const open = defectRows.filter((d) => d.status === 'OPEN' && (d.vehicle_id ?? d.trailer_id) === asset.id);
    summaries.set(asset.id, {
      asset,
      state: worstState(own.map((i) => i.status.state)),
      items: own.length,
      openDefects: open.length,
      unsafe: open.some((d) => d.severity === 'UNSAFE'),
      outOfService: downtime.find((d) => d.current && (d.vehicle_id ?? d.trailer_id) === asset.id) ?? null,
    });
  }

  return { today: input.today, assets, items: withStatus, defects: defectRows, downtime, summaries };
}
