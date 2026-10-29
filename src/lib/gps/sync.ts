import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { GpsError } from './http';
import { fetchWithHosts, providerSpec } from './providers';
import { normalizePlate, refuelFromLevels, type GpsRefuel, type GpsUnit } from './types';

/**
 * Обновление одного подключения: ключ из Vault, запрос к провайдеру,
 * перезапись последнего состояния машин, автопривязка по номеру и
 * заправки — в «Топливо».
 *
 * Служебный клиент: ключ читается только им. Компания подключения
 * проверяется вызывающим (страница и действия — под сессией перевозчика).
 */

/* Не чаще раза в минуту на подключение: провайдеры ограничивают частоту. */
export const GPS_REFRESH_MS = 60_000;

export type SyncResult = { ok: true; units: number } | { ok: false; kind: GpsError['kind'] };

export async function syncGpsConnection(connectionId: string, companyId: string): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('gps_connections')
    .select('id, company_id, provider, api_host, account_ref, sync_cursor')
    .eq('id', connectionId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!conn) return { ok: false, kind: 'INPUT' };

  const { data: token } = await admin.rpc('gps_connection_token', { p_id: conn.id });
  if (!token) return { ok: false, kind: 'KEY' };

  const spec = providerSpec(conn.provider);
  const hosts = [...new Set([conn.api_host, spec.defaultHost])];
  try {
    const result = await fetchWithHosts(spec, { token, hosts }, conn.account_ref, conn.sync_cursor);
    /* ABAX сменил refresh token — сохраняем новый, иначе следующее обновление не войдёт. */
    if (result.newToken) await admin.rpc('gps_connection_set_token', { p_id: conn.id, p_token: result.newToken });
    const detected = await storeUnits(conn.id, companyId, result.units);
    await sendRefuels(conn.id, [...(result.refuels ?? []), ...(spec.refuelEvents ? [] : detected)]);
    await admin
      .from('gps_connections')
      .update({
        status: 'ACTIVE',
        api_host: result.host,
        ...(result.account ? { account_name: result.account } : {}),
        ...(result.accountRef ? { account_ref: result.accountRef } : {}),
        ...(result.cursor !== undefined ? { sync_cursor: result.cursor } : {}),
        last_sync_at: new Date().toISOString(),
        last_error: null,
        unit_count: result.units.length,
      })
      .eq('id', conn.id);
    return { ok: true, units: result.units.length };
  } catch (e) {
    const kind = e instanceof GpsError ? e.kind : 'UNREACHABLE';
    await admin
      .from('gps_connections')
      .update({ status: 'ERROR', last_sync_at: new Date().toISOString(), last_error: kind })
      .eq('id', conn.id);
    return { ok: false, kind };
  }
}

/**
 * Перезапись состояния. Возвращает заправки, найденные по скачку уровня
 * топлива — для провайдеров, которые событий заправки сами не отдают.
 */
async function storeUnits(connectionId: string, companyId: string, units: GpsUnit[]): Promise<GpsRefuel[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: before } = await admin
    .from('gps_units')
    .select('external_id, fuel_level_l, fuel_level_pct, position_at')
    .eq('connection_id', connectionId);
  const prev = new Map((before ?? []).map((b) => [b.external_id, b]));

  const detected: GpsRefuel[] = [];
  for (const u of units) {
    const p = prev.get(u.externalId);
    if (!p) continue;
    const litres = refuelFromLevels(
      { litres: p.fuel_level_l == null ? null : Number(p.fuel_level_l), pct: p.fuel_level_pct == null ? null : Number(p.fuel_level_pct), at: p.position_at },
      { litres: u.fuelLevelL ?? null, pct: u.fuelLevelPct ?? null, at: u.positionAt, tankL: u.tankL ?? null, moving: u.state === 'MOVING' },
    );
    if (litres != null && u.positionAt) {
      detected.push({ ref: `level:${connectionId}:${u.externalId}:${u.positionAt}`, externalId: u.externalId, at: u.positionAt, litres, mileageKm: u.odometerKm ?? null });
    }
  }

  if (units.length > 0) {
    await admin.from('gps_units').upsert(
      units
        .filter((u) => u.externalId)
        .map((u) => ({
          connection_id: connectionId,
          company_id: companyId,
          external_id: u.externalId.slice(0, 64),
          name: u.name.slice(0, 200),
          plate: u.plate,
          lat: u.lat,
          lon: u.lon,
          speed_kmh: u.speedKmh,
          course: u.course,
          position_at: u.positionAt,
          odometer_km: u.odometerKm ?? null,
          engine_hours: u.engineHours ?? null,
          ignition: u.ignition ?? null,
          fuel_level_pct: u.fuelLevelPct ?? null,
          fuel_level_l: u.fuelLevelL ?? null,
          fuel_used_l: u.fuelUsedL ?? null,
          tank_l: u.tankL ?? null,
          state: u.state ?? null,
          state_since: u.stateSince ?? null,
          driver: u.driver ?? null,
          address: u.address ?? null,
          updated_at: now,
        })),
      { onConflict: 'connection_id,external_id' },
    );
  }

  /* Машины, удалённые у провайдера или закрытые для ключа, — убираем. */
  const ids = units.map((u) => u.externalId);
  const stale = admin.from('gps_units').delete().eq('connection_id', connectionId);
  await (ids.length ? stale.not('external_id', 'in', `(${ids.map((id) => `"${id.replace(/"/g, '')}"`).join(',')})`) : stale);

  /* Автопривязка: номер из профиля машины или из её названия. */
  const [{ data: vehicles }, { data: rows }, { data: taken }] = await Promise.all([
    admin.from('vehicles').select('id, plate').eq('company_id', companyId),
    admin.from('gps_units').select('id, name, plate').eq('connection_id', connectionId).is('vehicle_id', null),
    admin.from('gps_units').select('vehicle_id').eq('company_id', companyId).not('vehicle_id', 'is', null),
  ]);
  const used = new Set((taken ?? []).map((r) => r.vehicle_id));
  for (const row of rows ?? []) {
    const plate = normalizePlate(row.plate);
    const name = normalizePlate(row.name);
    const match = (vehicles ?? []).find((v) => {
      const p = normalizePlate(v.plate);
      return p.length >= 4 && !used.has(v.id) && (plate === p || name === p || (p.length >= 5 && name.includes(p)));
    });
    if (match) {
      used.add(match.id);
      await admin.from('gps_units').update({ vehicle_id: match.id }).eq('id', row.id);
    }
  }

  return detected;
}

/**
 * Заправки — в «Топливо» (telematics_fuel_add): только по машинам,
 * привязанным к автопарку. Повтор события по ref строки не даёт; функция
 * сама сводит его с заправкой водителя или отчёта.
 */
async function sendRefuels(connectionId: string, refuels: GpsRefuel[]): Promise<void> {
  if (refuels.length === 0) return;
  const admin = createAdminClient();
  const { data: mapped } = await admin
    .from('gps_units')
    .select('external_id, vehicle_id')
    .eq('connection_id', connectionId)
    .not('vehicle_id', 'is', null);
  const vehicleOf = new Map((mapped ?? []).map((m) => [m.external_id, m.vehicle_id as string]));

  const byVehicle = new Map<string, GpsRefuel[]>();
  for (const r of refuels) {
    const v = vehicleOf.get(r.externalId);
    if (!v) continue;
    byVehicle.set(v, [...(byVehicle.get(v) ?? []), r]);
  }
  for (const [vehicle, events] of byVehicle) {
    await admin.rpc('telematics_fuel_add', {
      p_vehicle: vehicle,
      p_events: events.slice(0, 500).map((e) => ({
        ref: e.ref.slice(0, 120),
        filled_at: e.at,
        quantity: e.litres,
        mileage_km: e.mileageKm ?? null,
      })),
    });
  }
}
