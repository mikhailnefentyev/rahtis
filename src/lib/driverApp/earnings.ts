import 'server-only';

import { summarizeDriver, type PayModelCode, type PayProfileInput, type ShiftInput } from '@/lib/driverPay';
import { tesRules } from '@/lib/drivers/report';
import { todayInHelsinki } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import type { TesRuleSet } from '@/types/db';

/**
 * Заработок водителя за месяц — для экрана «Ansiot».
 *
 * Считает тот же summarizeDriver, что и отчёт перевозчика, — поэтому
 * число у водителя и в отчёте одно. Отличие только во входе: модели
 * «процент от выплаты» база отдаёт уже готовую долю водителя за рейс
 * (share_cents), а не выплату перевозчику. Калькулятору доля подаётся
 * как «выплата» со ставкой 100 %.
 *
 * Сумма у рейса есть там, где деньги считаются от рейса: процент и
 * километры (если в тот день не записан одометр — тогда километры дня
 * берутся с одометра и на рейсы не делятся). У почасовых моделей и TES
 * сумма есть только у дня: час работы не принадлежит одному рейсу.
 */

type RawShift = {
  id: string;
  started_at: string;
  ended_at: string | null;
  odometer_start: number | null;
  odometer_end: number | null;
  breaks: { started_at: string; ended_at: string | null }[];
};

type RawTrip = {
  id: string;
  ref: string;
  closed_at: string;
  distance_km: number | null;
  stops_done: number;
  route_from: string | null;
  route_to: string | null;
  share_cents: number;
};

type RawProfile = {
  valid_from: string;
  model: PayModelCode;
  per_km_cents: number | null;
  hourly_cents: number | null;
  tes: TesRuleSet | null;
  tes_grade: string | null;
  rates: Array<{ grade: string; valid_from: string; hourly_cents: number }>;
};

export type EarningTrip = {
  id: string;
  ref: string;
  routeFrom: string | null;
  routeTo: string | null;
  km: number | null;
  amountCents: number | null;
};

export type EarningDay = {
  date: string;
  model: PayModelCode | null;
  workMinutes: number;
  amountCents: number | null;
  /** Сколько набралось за месяц к концу этого дня. */
  runningCents: number;
  trips: EarningTrip[];
};

export type DriverEarnings = {
  month: string;
  hasProfile: boolean;
  totalCents: number;
  trips: number;
  workMinutes: number;
  /** Дни, свежие сверху. */
  days: EarningDay[];
};

const DATE = /^\d{4}-\d{2}$/;

/** Месяц YYYY-MM: из адреса, если он правильный и не в будущем, иначе текущий. */
export function monthOf(value: string | undefined): string {
  const current = todayInHelsinki().slice(0, 7);
  return value && DATE.test(value) && value <= current ? value : current;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

export async function getDriverEarnings(month: string): Promise<DriverEarnings> {
  const from = `${month}-01`;
  const to = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10);

  const supabase = await createClient();
  const { data } = await supabase.rpc('driver_earnings', { p_from: from, p_to: to });
  const raw = (data ?? { shifts: [], trips: [], profiles: [] }) as unknown as {
    shifts: RawShift[];
    trips: RawTrip[];
    profiles: RawProfile[];
  };

  const profiles: PayProfileInput[] = raw.profiles.map((p) => ({
    validFrom: p.valid_from,
    model: p.model,
    perKmCents: p.per_km_cents,
    tripBps: p.model === 'TRIP_PERCENT' ? 10_000 : null,
    hourlyCents: p.hourly_cents,
    tes: p.tes ? tesRules(p.tes, p.rates) : null,
    tesGrade: p.tes_grade,
  }));

  const shifts: ShiftInput[] = raw.shifts.map((s) => ({
    id: s.id,
    start: s.started_at,
    end: s.ended_at,
    breaks: s.breaks.map((b) => ({ start: b.started_at, end: b.ended_at })),
    odometerStart: s.odometer_start,
    odometerEnd: s.odometer_end,
  }));

  const summary = summarizeDriver({
    shifts,
    trips: raw.trips.map((t) => ({
      closedAt: t.closed_at,
      distanceKm: t.distance_km,
      stopsDone: t.stops_done,
      payoutCents: t.share_cents,
    })),
    profiles,
    now: new Date().getTime(),
  });

  const dayOf = (iso: string) => todayInHelsinki(new Date(iso));

  let running = 0;
  const days: EarningDay[] = [];

  for (const day of summary.days) {
    if (day.date < from || day.date > to) continue;

    running += day.amountCents ?? 0;

    const trips = raw.trips
      .filter((t) => dayOf(t.closed_at) === day.date)
      .map((t): EarningTrip => {
        let amountCents: number | null = null;
        if (day.model === 'TRIP_PERCENT') amountCents = t.share_cents;
        if (day.model === 'PER_KM' && day.odometerKm === 0 && t.distance_km != null) {
          const rate = profiles.filter((p) => p.validFrom <= day.date).at(-1)?.perKmCents ?? 0;
          amountCents = t.distance_km * rate;
        }
        return {
          id: t.id,
          ref: t.ref,
          routeFrom: t.route_from,
          routeTo: t.route_to,
          km: t.distance_km,
          amountCents,
        };
      });

    days.push({
      date: day.date,
      model: day.model,
      workMinutes: day.workMinutes,
      amountCents: day.amountCents,
      runningCents: running,
      trips,
    });
  }

  return {
    month,
    hasProfile: profiles.length > 0,
    totalCents: running,
    trips: days.reduce((s, d) => s + d.trips.length, 0),
    workMinutes: days.reduce((s, d) => s + d.workMinutes, 0),
    days: days.reverse(),
  };
}
