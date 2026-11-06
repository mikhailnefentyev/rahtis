/**
 * Договорённость «на руки» в отчёте: строки базы → вход agreed.ts,
 * периоды профилей, доля месяцев, дни и раскладка расходов по дням.
 *
 * Без импортов (кроме типов): тесты гоняются голым `node --test`.
 */

import type { Agreement, AgreedDayInput, AgreedModel, DayBasis } from './agreed';

export const AGREED_MODELS: readonly AgreedModel[] = ['DAY_NET', 'MONTHLY_NET', 'PER_TRIP'];

export const isAgreedModel = (model: string | null | undefined): model is AgreedModel =>
  model === 'DAY_NET' || model === 'MONTHLY_NET' || model === 'PER_TRIP';

const BASES = new Set(['ROUTE', 'WORK', 'ABROAD']);
const COUNTRY = /^[A-Z]{2}$/;

/** Ставки по странам из jsonb: только { CC: целое ≥ 0 }, остальное отбрасывается. */
export function countryRates(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, cents] of Object.entries(value as Record<string, unknown>)) {
    const code = key.toUpperCase();
    if (COUNTRY.test(code) && typeof cents === 'number' && Number.isInteger(cents) && cents >= 0) out[code] = cents;
  }
  return Object.keys(out).length ? out : null;
}

/** Строка driver_pay_profiles (или профиль из driver_earnings) → договорённость; не та модель — null. */
export function agreementOf(row: {
  model: string;
  currency?: string | null;
  agreed_day_cents?: number | null;
  agreed_day_basis?: string | null;
  agreed_home_day_cents?: number | null;
  agreed_country_day_cents?: unknown;
  agreed_monthly_cents?: number | null;
  agreed_trip_cents?: number | null;
}, fallbackCurrency: string): Agreement | null {
  if (!isAgreedModel(row.model)) return null;
  return {
    model: row.model,
    currency: row.currency || fallbackCurrency,
    dayCents: row.agreed_day_cents ?? null,
    dayBasis: row.agreed_day_basis && BASES.has(row.agreed_day_basis) ? (row.agreed_day_basis as DayBasis) : 'ROUTE',
    homeDayCents: row.agreed_home_day_cents ?? null,
    countryDayCents: countryRates(row.agreed_country_day_cents),
    monthlyCents: row.agreed_monthly_cents ?? null,
    tripCents: row.agreed_trip_cents ?? null,
  };
}

/**
 * Отрезки периода [from, to] по профилям: профиль действует с validFrom
 * до дня перед следующим. Профили до начала периода обрезаются по from,
 * отрезки вне периода отбрасываются. index — номер профиля во входе.
 */
export function profileSegments(
  profiles: Array<{ validFrom: string }>,
  from: string,
  to: string,
): Array<{ index: number; from: string; to: string }> {
  const order = profiles.map((p, index) => ({ index, validFrom: p.validFrom })).sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const out: Array<{ index: number; from: string; to: string }> = [];
  order.forEach((p, i) => {
    const next = order[i + 1];
    const start = p.validFrom > from ? p.validFrom : from;
    const end = next ? minDate(shiftDay(next.validFrom, -1), to) : to;
    if (start <= end) out.push({ index: p.index, from: start, to: end });
  });
  return out;
}

const minDate = (a: string, b: string) => (a < b ? a : b);

function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Доля месяцев в периоде: по каждому месяцу — дней периода ÷ дней месяца. Март целиком — 1. */
export function monthsIn(from: string, to: string): number {
  if (to < from) return 0;
  let total = 0;
  let cursor = from;
  while (cursor <= to) {
    const [y, m] = cursor.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = `${cursor.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}`;
    const end = minDate(monthEnd, to);
    const days = Number(end.slice(8, 10)) - Number(cursor.slice(8, 10)) + 1;
    total += days / daysInMonth;
    cursor = shiftDay(monthEnd, 1);
  }
  return Math.round(total * 10_000) / 10_000;
}

const AWAY_NIGHTS = new Set(['CAB', 'HOTEL', 'FREE']);

/**
 * Дни для agreed.ts: worked — была смена; away — ночь не дома (кабина,
 * отель, жильё дали) или страна дня за границей; trips — закрытые рейсы.
 */
export function agreedDayInputs(input: {
  days: Array<{ date: string; workMinutes: number; trips: number }>;
  country: (date: string) => string | null;
  night: (date: string) => string | null;
  home: string;
}): AgreedDayInput[] {
  const home = input.home.toUpperCase();
  return input.days.map((d) => {
    const country = input.country(d.date)?.toUpperCase() ?? null;
    const night = input.night(d.date);
    return {
      date: d.date,
      country,
      worked: d.workMinutes > 0,
      away: Boolean((night && AWAY_NIGHTS.has(night)) || (country && country !== home)),
      trips: d.trips,
    };
  });
}

/** Дни с ночью не дома — их добавляют к дням со сменами, чтобы оплатить «все дни в рейсе». */
export const isAwayNight = (night: string | null | undefined): boolean => Boolean(night && AWAY_NIGHTS.has(night));

/**
 * Сумма по дням пропорционально весам, без потери цента: остаток — дню с
 * наибольшим весом. Все веса 0 — поровну. Нет дней — пусто.
 */
export function spreadCents(total: number, weights: Array<{ date: string; weight: number }>): Record<string, number> {
  const out: Record<string, number> = {};
  if (weights.length === 0) return out;
  const sum = weights.reduce((s, w) => s + Math.max(0, w.weight), 0);
  let given = 0;
  let top = weights[0];
  for (const w of weights) {
    const share = sum > 0 ? Math.max(0, w.weight) / sum : 1 / weights.length;
    const cents = Math.floor(total * share);
    out[w.date] = (out[w.date] ?? 0) + cents;
    given += cents;
    if (w.weight > top.weight) top = w;
  }
  out[top.date] += total - given;
  return out;
}
