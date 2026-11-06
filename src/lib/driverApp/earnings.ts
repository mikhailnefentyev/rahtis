import 'server-only';

import {
  summarizeDriver,
  totalsOf,
  type PayModelCode,
  type PayProfileInput,
  type ShiftInput,
} from '@/lib/driverPay';
import { tesRules } from '@/lib/drivers/report';
import { todayInHelsinki } from '@/lib/dates';
import { asCurrency, countryCurrency } from '@/lib/money/currency';
import { loadFxHistory } from '@/lib/money/fx';
import { createClient } from '@/lib/supabase/server';
import { agreedDays } from '@/lib/pay/agreed';
import { agreedDayInputs, agreementOf, isAgreedModel, monthsIn, profileSegments } from '@/lib/pay/agreedPeriods';
import { getDriver } from './session';
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
 *
 * Валюта: сумма дня и рейса — в валюте ставки (профиль, у TES — набор);
 * доля share_cents база уже пересчитала в неё. Итог месяца и нарастающий
 * итог — в валюте компании, дни в другой валюте — по курсу своего дня.
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
  currency?: string | null;
  per_km_cents: number | null;
  hourly_cents: number | null;
  tes: TesRuleSet | null;
  tes_grade: string | null;
  tes_experience_since: string | null;
  rates: Array<{ grade: string; valid_from: string; hourly_cents: number }>;
  /* Премии поверх базы — если driver_earnings их отдаёт (иначе undefined). */
  bonus_per_km_cents?: number | null;
  bonus_trip_bps?: number | null;
  /* Договорённость «на руки» — если driver_earnings её отдаёт. */
  agreed_day_cents?: number | null;
  agreed_day_basis?: string | null;
  agreed_home_day_cents?: number | null;
  agreed_country_day_cents?: unknown;
  agreed_monthly_cents?: number | null;
  agreed_trip_cents?: number | null;
};

export type EarningTrip = {
  id: string;
  ref: string;
  routeFrom: string | null;
  routeTo: string | null;
  km: number | null;
  /** В валюте дня (EarningDay.currency). */
  amountCents: number | null;
};

export type EarningDay = {
  date: string;
  model: PayModelCode | null;
  workMinutes: number;
  amountCents: number | null;
  /** Валюта amountCents и сумм рейсов: валюта ставки дня. */
  currency: string | null;
  /** Сколько набралось за месяц к концу этого дня — в валюте компании. */
  runningCents: number;
  trips: EarningTrip[];
};

export type DriverEarnings = {
  month: string;
  hasProfile: boolean;
  /** Валюта итогов: рабочая валюта компании. */
  currency: string;
  totalCents: number;
  trips: number;
  workMinutes: number;
  /** Дни, свежие сверху. */
  days: EarningDay[];
  /**
   * Договорённость «на руки» в месяце. byShifts — дни посчитаны по сменам
   * (страны и ночей вне дома у приложения нет); monthlyCents — оклад за
   * месяц по договорённости (в валюте компании), он в totalCents, но не в днях.
   */
  agreed: { byShifts: boolean; monthlyCents: number | null } | null;
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

  const [supabase, driver] = await Promise.all([createClient(), getDriver()]);
  const currency = asCurrency(driver?.company_currency, countryCurrency(driver?.company_country));
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
    tesExperienceSince: p.tes_experience_since,
    currency: p.currency ?? null,
    /*
     * Страна, праздники и оклад набора приходят в p.tes (to_jsonb строки) —
     * их разбирает tesRules. Премия за км — как у перевозчика. Премия
     * процентом: share_cents — уже доля водителя, поэтому 100 %; пока
     * driver_earnings считает долю только по trip_bps, у TES она 0.
     */
    bonusPerKmCents: p.bonus_per_km_cents ?? null,
    bonusTripBps: p.bonus_trip_bps ? 10_000 : null,
  }));

  /* Курсы — только если есть ставка не в валюте компании. */
  const foreign = raw.profiles.some((p) => (p.tes?.currency ?? p.currency ?? currency) !== currency);
  const history = foreign ? await loadFxHistory(supabase, from, to) : null;
  const fx = history
    ? (cents: number, a: string, b: string, day: string) => history.convert(cents, asCurrency(a), asCurrency(b), day)
    : undefined;

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
    currency,
    /* share_cents уже в валюте ставки — пересчитывать нечего. */
    payoutCurrency: null,
    fx,
  });

  const dayOf = (iso: string) => todayInHelsinki(new Date(iso));

  /*
   * Договорённость «на руки». У driver_earnings нет страны дня и ночей вне
   * дома: день считается по смене (worked), ставки по странам и «только за
   * границей» не применяются — у водителя честная пометка «по сменам».
   * Полную картину видит перевозчик в отчёте.
   */
  const segments = profileSegments(
    raw.profiles.map((p) => ({ validFrom: p.valid_from })),
    from,
    to,
  ).filter((s) => isAgreedModel(raw.profiles[s.index].model));
  const agreedByDay = new Map<string, number>();
  let monthlyCents: number | null = null;
  for (const seg of segments) {
    const agreement = agreementOf(raw.profiles[seg.index], currency);
    if (!agreement) continue;
    if (agreement.model === 'MONTHLY_NET') {
      const amount = Math.round((agreement.monthlyCents ?? 0) * monthsIn(seg.from, seg.to));
      const inCompany =
        agreement.currency === currency ? amount : (fx?.(amount, agreement.currency, currency, seg.to) ?? null);
      if (inCompany != null) monthlyCents = (monthlyCents ?? 0) + inCompany;
      continue;
    }
    const segDays = summary.days.filter((d) => d.date >= seg.from && d.date <= seg.to);
    const inputs = agreedDayInputs({ days: segDays, country: () => null, night: () => null, home: 'XX' });
    const byShifts = { ...agreement, dayBasis: 'WORK' as const, countryDayCents: null, homeDayCents: null };
    for (const d of agreedDays(byShifts, inputs, 'XX')) agreedByDay.set(d.date, d.cents);
  }

  let running = 0;
  const days: EarningDay[] = [];

  for (const base of summary.days) {
    if (base.date < from || base.date > to) continue;
    /* Сумма дня по договорённости — в его валюте ставки (валюта профиля). */
    const own = isAgreedModel(base.model) ? agreedByDay.get(base.date) : undefined;
    const day =
      own == null
        ? base
        : {
            ...base,
            amountCents: own,
            parts: { ...base.parts, baseCents: own, overtimeCents: 0, eveningCents: 0, nightCents: 0, weekendCents: 0, bonusCents: 0 },
          };

    /* В валюте компании; день без курса в итог не входит. */
    running += totalsOf([day], { currency, fx }).amountCents;

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
      /* Оклад за месяц — строкой месяца, не днём. */
      amountCents: day.model === 'MONTHLY_NET' ? null : day.amountCents,
      currency: day.currency,
      runningCents: running,
      trips,
    });
  }

  return {
    month,
    hasProfile: profiles.length > 0,
    currency,
    totalCents: running + (monthlyCents ?? 0),
    trips: days.reduce((s, d) => s + d.trips.length, 0),
    workMinutes: days.reduce((s, d) => s + d.workMinutes, 0),
    days: days.reverse(),
    agreed: segments.length
      ? { byShifts: segments.some((s) => raw.profiles[s.index].model !== 'MONTHLY_NET'), monthlyCents }
      : null,
  };
}
