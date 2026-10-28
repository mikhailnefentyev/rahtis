import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchWialonUnits, normalizePlate, WialonError, WIALON_DEFAULT_HOST, type WialonUnit } from './wialon';

/**
 * Обновление точек одного подключения: ключ из Vault, запрос в Wialon,
 * перезапись последней точки машин, автопривязка по номеру.
 *
 * Служебный клиент: ключ читается только им. Компания подключения
 * проверяется вызывающим (страница и действия — под сессией перевозчика).
 */

/* Не чаще раза в минуту на подключение: Wialon ограничивает частоту. */
export const GPS_REFRESH_MS = 60_000;

export type SyncResult = { ok: true; units: number } | { ok: false; kind: WialonError['kind'] };

export async function syncGpsConnection(connectionId: string, companyId: string): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: conn } = await admin
    .from('gps_connections')
    .select('id, company_id, api_host')
    .eq('id', connectionId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!conn) return { ok: false, kind: 'INPUT' };

  const { data: token } = await admin.rpc('gps_connection_token', { p_id: conn.id });
  if (!token) return { ok: false, kind: 'KEY' };

  const hosts = [...new Set([conn.api_host, WIALON_DEFAULT_HOST])];
  try {
    const result = await fetchWialonUnits(token, hosts);
    await storeUnits(conn.id, companyId, result.units);
    await admin
      .from('gps_connections')
      .update({
        status: 'ACTIVE',
        api_host: result.host,
        account_name: result.account,
        last_sync_at: new Date().toISOString(),
        last_error: null,
        unit_count: result.units.length,
      })
      .eq('id', conn.id);
    return { ok: true, units: result.units.length };
  } catch (e) {
    const kind = e instanceof WialonError ? e.kind : 'UNREACHABLE';
    await admin
      .from('gps_connections')
      .update({ status: 'ERROR', last_sync_at: new Date().toISOString(), last_error: kind })
      .eq('id', conn.id);
    return { ok: false, kind };
  }
}

async function storeUnits(connectionId: string, companyId: string, units: WialonUnit[]): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (units.length > 0) {
    await admin.from('gps_units').upsert(
      units.map((u) => ({
        connection_id: connectionId,
        company_id: companyId,
        external_id: u.externalId,
        name: u.name,
        plate: u.plate,
        lat: u.lat,
        lon: u.lon,
        speed_kmh: u.speedKmh,
        course: u.course,
        position_at: u.positionAt,
        updated_at: now,
      })),
      { onConflict: 'connection_id,external_id' },
    );
  }

  /* Машины, удалённые в Wialon или закрытые для ключа, — убираем. */
  const ids = units.map((u) => u.externalId);
  const stale = admin.from('gps_units').delete().eq('connection_id', connectionId);
  await (ids.length ? stale.not('external_id', 'in', `(${ids.map((id) => `"${id}"`).join(',')})`) : stale);

  /* Автопривязка: номер из профиля Wialon или из названия машины. */
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
}
