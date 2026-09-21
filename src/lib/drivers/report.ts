import 'server-only';

import {
  summarizeDriver,
  totalsOf,
  type DriverSummary,
  type PayProfileInput,
  type ShiftInput,
  type TesRules,
} from '@/lib/driverPay';
import { createClient } from '@/lib/supabase/server';
import type { Driver, TesRuleSet } from '@/types/db';

/**
 * Отчёт по водителям за период.
 *
 * Собирается под сессией перевозчика: RLS отдаёт только его водителей,
 * их смены и ставки, а driver_trips — только его рейсы. Секретный ключ
 * здесь не нужен и не участвует.
 *
 * Числа считает lib/driverPay; здесь только выборка и приведение строк
 * базы к входу калькулятора. Экран, PDF и таблицы берут один и тот же
 * результат этой функции.
 */

export type DriverReportEntry = {
  driver: Pick<Driver, 'id' | 'full_name' | 'phone' | 'status'>;
  summary: DriverSummary;
};

export type DriverReport = {
  from: string;
  to: string;
  entries: DriverReportEntry[];
};

export function tesRules(set: TesRuleSet): TesRules {
  return {
    baseHourlyCents: set.base_hourly_cents,
    dailyRegularMinutes: set.daily_regular_minutes,
    overtime1Minutes: set.overtime1_minutes,
    overtime1Bps: set.overtime1_bps,
    overtime2Bps: set.overtime2_bps,
    eveningStart: set.evening_start,
    eveningEnd: set.evening_end,
    eveningCents: set.evening_cents,
    nightStart: set.night_start,
    nightEnd: set.night_end,
    nightCents: set.night_cents,
    saturdayBps: set.saturday_bps,
    sundayBps: set.sunday_bps,
  };
}

/** Сдвиг даты YYYY-MM-DD на n дней. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function buildDriverReport(input: {
  from: string;
  to: string;
  driverId?: string | null;
}): Promise<DriverReport> {
  const supabase = await createClient();

  /*
   * Смены берутся с запасом в сутки с обеих сторон: граница периода —
   * местная дата начала смены, а в запросе время в UTC. Лишнее отсекается
   * после расчёта, по дате дня.
   */
  const since = `${shiftDate(input.from, -1)}T00:00:00Z`;
  const until = `${shiftDate(input.to, 2)}T00:00:00Z`;

  let driversQuery = supabase
    .from('drivers')
    .select('id, full_name, phone, status')
    .order('full_name');
  if (input.driverId) driversQuery = driversQuery.eq('id', input.driverId);

  let shiftsQuery = supabase
    .from('driver_shifts')
    .select('id, driver_id, started_at, ended_at, odometer_start, odometer_end, driver_breaks(started_at, ended_at)')
    .gte('started_at', since)
    .lt('started_at', until)
    .order('started_at');
  if (input.driverId) shiftsQuery = shiftsQuery.eq('driver_id', input.driverId);

  const [{ data: drivers }, { data: shifts }, { data: trips }, { data: profiles }, { data: sets }] =
    await Promise.all([
      driversQuery,
      shiftsQuery,
      supabase.rpc('driver_trips', { p_from: input.from, p_to: input.to }),
      supabase.from('driver_pay_profiles').select('*'),
      supabase.from('tes_rule_sets').select('*'),
    ]);

  const rulesById = new Map((sets ?? []).map((s) => [s.id, tesRules(s)]));
  const now = Date.now();

  const entries: DriverReportEntry[] = [];

  for (const driver of drivers ?? []) {
    const own = (shifts ?? []).filter((s) => s.driver_id === driver.id);
    const shiftInputs: ShiftInput[] = own.map((s) => ({
      id: s.id,
      start: s.started_at,
      end: s.ended_at,
      breaks: (s.driver_breaks ?? []).map((b) => ({ start: b.started_at, end: b.ended_at })),
      odometerStart: s.odometer_start,
      odometerEnd: s.odometer_end,
    }));

    const payProfiles: PayProfileInput[] = (profiles ?? [])
      .filter((p) => p.driver_id === driver.id)
      .map((p) => ({
        validFrom: p.valid_from,
        model: p.model,
        perKmCents: p.per_km_cents,
        tripBps: p.trip_bps,
        hourlyCents: p.hourly_cents,
        tes: p.tes_rule_set_id ? (rulesById.get(p.tes_rule_set_id) ?? null) : null,
      }));

    const summary = summarizeDriver({
      shifts: shiftInputs,
      trips: (trips ?? [])
        .filter((t) => t.driver_id === driver.id)
        .map((t) => ({
          closedAt: t.closed_at,
          distanceKm: t.distance_km,
          stopsDone: t.stops_done,
          payoutCents: t.payout_cents,
        })),
      profiles: payProfiles,
      now,
    });

    const days = summary.days.filter((d) => d.date >= input.from && d.date <= input.to);

    /*
     * Итоги пересчитываются по отфильтрованным дням: смена, взятая с
     * запасом, не должна попасть в сумму периода, которому не
     * принадлежит.
     */
    const trimmed = totalsOf(days);

    /* Водитель без единой строки за период в отчёт не попадает — кроме выбранного явно. */
    if (days.length === 0 && !input.driverId) continue;

    entries.push({ driver, summary: { days, totals: trimmed } });
  }

  return { from: input.from, to: input.to, entries };
}
