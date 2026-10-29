/**
 * Что адаптер провайдера GPS отдаёт синхронизации — одинаково для всех.
 *
 * Поля, которых провайдер не знает, — null: на странице они просто не
 * показываются. Числа — в метрических единицах: км, км/ч, литры, часы.
 *
 * Без зависимостей: модуль читают тесты (node --test).
 */

export const GPS_PROVIDERS = ['WIALON', 'MAPON', 'NAVIREC', 'RUPTELA', 'NAVIXY', 'SAMSARA'] as const;
export type GpsProvider = (typeof GPS_PROVIDERS)[number];

export type GpsState = 'MOVING' | 'STOPPED' | 'PARKED' | 'OFFLINE';

export type GpsUnit = {
  externalId: string;
  name: string;
  plate: string | null;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  course: number | null;
  positionAt: string | null;
  odometerKm?: number | null;
  engineHours?: number | null;
  ignition?: boolean | null;
  fuelLevelPct?: number | null;
  fuelLevelL?: number | null;
  fuelUsedL?: number | null;
  tankL?: number | null;
  state?: GpsState | null;
  stateSince?: string | null;
  driver?: string | null;
  address?: string | null;
};

/** Заправка, которую увидела система слежения. ref — id события у провайдера: повтор не даёт второй строки. */
export type GpsRefuel = { ref: string; externalId: string; at: string; litres: number; mileageKm?: number | null };

export type GpsFetch = {
  host: string;
  account: string | null;
  accountRef?: string | null;
  units: GpsUnit[];
  refuels?: GpsRefuel[];
  /** Что запомнить к следующему разу (последняя забранная заправка и т. п.). */
  cursor?: string | null;
};

/* ── Общие помощники разбора ──────────────────────────────────── */

export const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
};

export const int = (value: unknown): number | null => {
  const n = num(value);
  return n == null ? null : Math.round(n);
};

export const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value).trim().slice(0, max);
  return s ? s : null;
};

/** Время в ISO: из ISO-строки, секунд или миллисекунд Unix. */
export const iso = (value: unknown): string | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return n > 0 && Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
};

export const coord = (lat: unknown, lon: unknown): { lat: number; lon: number } | null => {
  const a = num(lat);
  const b = num(lon);
  if (a == null || b == null || Math.abs(a) > 90 || Math.abs(b) > 180 || (a === 0 && b === 0)) return null;
  return { lat: a, lon: b };
};

export const pct = (value: unknown): number | null => {
  const n = num(value);
  return n == null || n < 0 || n > 100 ? null : Math.round(n * 10) / 10;
};

export const positive = (value: unknown): number | null => {
  const n = num(value);
  return n == null || n < 0 ? null : n;
};

/** Состояние по скорости, когда провайдер не говорит сам. */
export function stateFromSpeed(speedKmh: number | null, ignition: boolean | null | undefined): GpsState | null {
  if (speedKmh == null) return null;
  if (speedKmh > 3) return 'MOVING';
  return ignition === false ? 'PARKED' : 'STOPPED';
}

/**
 * Заправка по скачку уровня, когда провайдер сам событий не отдаёт:
 * между двумя обновлениями в баке прибавилось не меньше 30 л (или 15 %
 * бака), машина при этом не ехала. Меньшие колебания — шум датчика.
 */
export function refuelFromLevels(
  before: { litres: number | null; pct: number | null; at: string | null },
  after: { litres: number | null; pct: number | null; at: string | null; tankL: number | null; moving: boolean },
): number | null {
  if (after.moving || !after.at || !before.at || after.at <= before.at) return null;
  let delta: number | null = null;
  if (before.litres != null && after.litres != null) delta = after.litres - before.litres;
  else if (before.pct != null && after.pct != null && after.tankL) delta = ((after.pct - before.pct) / 100) * after.tankL;
  if (delta == null) return null;
  const threshold = after.tankL ? Math.max(30, after.tankL * 0.15) : 30;
  return delta >= threshold && delta <= 2000 ? Math.round(delta * 10) / 10 : null;
}

/** Номер для сравнения: без пробелов и дефисов, заглавными. */
export function normalizePlate(value: string | null | undefined): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g, '');
}
