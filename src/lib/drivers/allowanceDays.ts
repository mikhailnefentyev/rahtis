/**
 * Вход калькулятора суточных из смен и правок дня — без базы, чтобы
 * проверялось тестом (node --test, только type-импорты).
 *
 * День — местная дата начала смены, как у driverPay. Страна дня —
 * правка перевозчика (driver_day_facts), иначе последняя страна точек
 * рейсов этого дня (driver_day_countries).
 */

import type { AllowanceDayInput, NightType } from '@/lib/pay/allowances';

export type DayFact = {
  country: string | null;
  night: string | null;
  meals: string | null;
};

export type DayShift = { start: string; end: string | null };

export type DayCountrySource = 'manual' | 'auto' | null;

const NIGHTS = new Set(['HOME', 'CAB', 'HOTEL', 'FREE']);

export const asNight = (value: string | null | undefined): NightType | null =>
  value && NIGHTS.has(value) ? (value as NightType) : null;

/** Нормализация «B L D» → «BLD» в порядке ограничения базы (^B?L?D?$). */
export function normalizeMeals(value: string | null | undefined): string | null {
  const m = (value ?? '').toUpperCase();
  const out = (m.includes('B') ? 'B' : '') + (m.includes('L') ? 'L' : '') + (m.includes('D') ? 'D' : '');
  return out || null;
}

/**
 * Строки калькулятора для рабочих дней.
 *   spanMinutes — от начала первой смены дня до конца последней, с перерывами
 *     (открытая смена — до now);
 *   страна — правка, иначе последняя страна рейсов дня, иначе null.
 */
export function allowanceDayInputs(input: {
  dates: string[];
  shifts: DayShift[];
  /** Местная дата начала смены. */
  dayOf: (iso: string) => string;
  facts: Map<string, DayFact>;
  /** Последняя страна дня по точкам рейсов. */
  auto: Map<string, string | null>;
  now: number;
}): Array<AllowanceDayInput & { source: DayCountrySource }> {
  const span = new Map<string, { start: number; end: number }>();
  for (const s of input.shifts) {
    const date = input.dayOf(s.start);
    const start = Date.parse(s.start);
    const end = s.end ? Date.parse(s.end) : input.now;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    const cur = span.get(date);
    span.set(date, cur ? { start: Math.min(cur.start, start), end: Math.max(cur.end, end) } : { start, end });
  }

  return [...new Set(input.dates)].sort().map((date) => {
    const fact = input.facts.get(date);
    const auto = input.auto.get(date) ?? null;
    const manual = fact?.country ? fact.country.toUpperCase() : null;
    const s = span.get(date);
    return {
      date,
      country: manual ?? (auto ? auto.toUpperCase() : null),
      source: manual ? 'manual' : auto ? 'auto' : null,
      spanMinutes: s ? Math.round((s.end - s.start) / 60_000) : 0,
      night: asNight(fact?.night),
      meals: normalizeMeals(fact?.meals),
    };
  });
}

/**
 * Дни по наборам суточных: набор дня — у профиля оплаты, действующего в
 * этот день (последний valid_from ≤ дня). Дни без набора не попадают.
 */
export function groupDaysBySet(
  dates: string[],
  profiles: Array<{ validFrom: string; setId: string | null }>,
): Map<string, string[]> {
  const sorted = [...profiles].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const out = new Map<string, string[]>();
  for (const date of [...dates].sort()) {
    let setId: string | null = null;
    for (const p of sorted) if (p.validFrom <= date) setId = p.setId;
    if (!setId) continue;
    const list = out.get(setId) ?? [];
    list.push(date);
    out.set(setId, list);
  }
  return out;
}

/** Месяцы YYYY-MM, целиком лежащие в периоде [from, to]. */
export function fullMonths(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  for (;;) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month > to.slice(0, 7)) break;
    const first = `${month}-01`;
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    if (first >= from && last <= to) out.push(month);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/* Соседи страны — сразу после неё в списке выбора. */
const NEIGHBOURS: Record<string, string[]> = {
  FI: ['SE', 'NO', 'EE'],
  SE: ['NO', 'FI', 'DK', 'DE'],
  NO: ['SE', 'FI', 'DK'],
  DK: ['DE', 'SE', 'NO'],
  EE: ['LV', 'FI', 'LT'],
  LV: ['LT', 'EE', 'PL'],
  LT: ['LV', 'PL', 'EE'],
  PL: ['DE', 'CZ', 'SK', 'LT'],
  DE: ['PL', 'NL', 'DK', 'FR', 'AT', 'CZ'],
};

/** ЕС и ЕЭЗ. */
export const EU_EEA = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'NO',
  'IS',
  'LI',
];

/** Выбор страны дня: страна компании, соседи, затем весь ЕС/ЕЭЗ (по коду; экран сортирует по названию). */
export function countryChoices(home: string): {
  first: string[];
  rest: string[];
} {
  const h = home.toUpperCase();
  const first = [h, ...(NEIGHBOURS[h] ?? [])].filter((c, i, a) => a.indexOf(c) === i);
  return { first, rest: EU_EEA.filter((c) => !first.includes(c)) };
}
