import 'server-only';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { routingConfigured, truckProfile } from '@/lib/routing';
import { tomtom } from '@/lib/routing/tomtom';
import { syncGpsConnection } from '@/lib/gps/sync';
import { isFresh, straightLineSeconds, type Point } from './geo';

/**
 * Оценка прибытия для страницы отслеживания.
 *
 * Порядок источников:
 *  1. Последняя точка GPS назначенной машины (если трекер подключён и
 *     точке не больше 20 минут) → маршрут TomTom с пробками до следующей
 *     точки. Без ключа роутера или при его сбое — прямая × 1,3 с
 *     пометкой «arvio».
 *  2. Оценка точки из базы (order_stops.eta_at: ROUTE, TRAFFIC, CARRIER).
 *     Ручная оценка перевозчика, поставленная позже точки GPS, важнее.
 *  3. Плановое время — это уже решает страница.
 *
 * Координаты машины наружу не уходят: клиент видит только время. Так
 * записано в описании GPS (условия, 29.10.2026): заказчики позиций не
 * видят.
 */

export type GpsEta = {
  kind: 'GPS';
  at: string;
  /** Время точки GPS — «обновлено N мин назад». */
  updatedAt: string;
  /** true — прямая × коэффициент, не маршрут по дорогам. */
  rough: boolean;
};

export type StopEta = {
  kind: 'STOP';
  at: string;
  source: 'ROUTE' | 'TRAFFIC' | 'CARRIER';
  updatedAt: string | null;
};

export type TrackEta = GpsEta | StopEta;

type NextStop = {
  lat: number | null;
  lon: number | null;
  country: string | null;
  eta_at: string | null;
  eta_source: 'ROUTE' | 'TRAFFIC' | 'CARRIER' | null;
  eta_updated_at: string | null;
};

/* Маршрут кэшируется по точкам: тот же сигнал GPS не оплачивается дважды. */
const routedSeconds = unstable_cache(
  async (fromLat: number, fromLon: number, toLat: number, toLon: number, country: string): Promise<number> => {
    const result = await tomtom.route(
      [
        { lat: fromLat, lon: fromLon },
        { lat: toLat, lon: toLon },
      ],
      truckProfile(country),
      { traffic: true },
    );
    return result.durationS;
  },
  ['track-eta-route-v1'],
  { revalidate: 600 },
);

async function travelSeconds(from: Point, to: Point, country: string | null): Promise<{ seconds: number; rough: boolean }> {
  if (routingConfigured()) {
    try {
      const r = (n: number) => Math.round(n * 1e4) / 1e4;
      const seconds = await routedSeconds(r(from.lat), r(from.lon), r(to.lat), r(to.lon), (country ?? 'FI').toUpperCase());
      if (Number.isFinite(seconds) && seconds >= 0) return { seconds, rough: false };
    } catch {
      /* Роутер недоступен — грубая оценка ниже. */
    }
  }
  return { seconds: straightLineSeconds(from, to), rough: true };
}

export type VehicleFix = {
  position: Point;
  positionAt: string;
  connectionId: string;
  companyId: string;
};

/** Последняя точка машины перевозчика. Только служебным клиентом, наружу — не координаты. */
export async function vehicleFix(vehicleId: string | null, carrierId: string | null): Promise<VehicleFix | null> {
  if (!vehicleId || !carrierId) return null;
  const { data } = await createAdminClient()
    .from('gps_units')
    .select('lat, lon, position_at, connection_id, company_id')
    .eq('vehicle_id', vehicleId)
    .eq('company_id', carrierId)
    .not('position_at', 'is', null)
    .order('position_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.lat == null || data.lon == null || !data.position_at) return null;
  return {
    position: { lat: data.lat, lon: data.lon },
    positionAt: data.position_at,
    connectionId: data.connection_id,
    companyId: data.company_id,
  };
}

/* Не чаще раза в 5 минут на подключение с публичной страницы. */
const PUBLIC_REFRESH_MS = 5 * 60_000;

/**
 * Обновить позиции подключения, если они устарели — после ответа (after),
 * чтобы клиент не ждал провайдера. Захват атомарный: условное обновление
 * last_sync_at отбирает строку только у одного из одновременных
 * просмотров. ABAX не трогаем: он меняет refresh token на каждом входе,
 * и гонка с кабинетом перевозчика могла бы оборвать подключение.
 */
export async function refreshFix(fix: VehicleFix | null, now: number): Promise<void> {
  if (!fix || now - Date.parse(fix.positionAt) < 3 * 60_000) return;
  const admin = createAdminClient();
  const cutoff = new Date(now - PUBLIC_REFRESH_MS).toISOString();
  const { data: claimed } = await admin
    .from('gps_connections')
    .update({ last_sync_at: new Date(now).toISOString() })
    .eq('id', fix.connectionId)
    .eq('company_id', fix.companyId)
    .eq('status', 'ACTIVE')
    .neq('provider', 'ABAX')
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`)
    .select('id');
  if (!claimed?.length) return;
  await syncGpsConnection(fix.connectionId, fix.companyId);
}

export async function trackEta(next: NextStop, fix: VehicleFix | null, now: number): Promise<TrackEta | null> {
  const stored: StopEta | null =
    next.eta_at && next.eta_source
      ? { kind: 'STOP', at: next.eta_at, source: next.eta_source, updatedAt: next.eta_updated_at }
      : null;

  if (fix && isFresh(fix.positionAt, now) && next.lat != null && next.lon != null) {
    const carrierLater =
      stored?.source === 'CARRIER' && stored.updatedAt && Date.parse(stored.updatedAt) > Date.parse(fix.positionAt);
    if (!carrierLater) {
      const { seconds, rough } = await travelSeconds(fix.position, { lat: next.lat, lon: next.lon }, next.country);
      /* От момента точки, а не от «сейчас»: за минуты с последнего сигнала машина ехала. */
      const at = new Date(Math.max(Date.parse(fix.positionAt) + seconds * 1000, now)).toISOString();
      return { kind: 'GPS', at, updatedAt: fix.positionAt, rough };
    }
  }

  return stored;
}
