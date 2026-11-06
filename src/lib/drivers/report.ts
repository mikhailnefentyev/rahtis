import 'server-only';

import {
  summarizeDriver,
  totalsOf,
  type DriverSummary,
  type PayProfileInput,
  type ShiftInput,
  type TesRate,
  type TesRules,
} from '@/lib/driverPay';
import { getViewer } from '@/lib/auth/viewer';
import { todayInHelsinki } from '@/lib/dates';
import { viewerMoney } from '@/lib/i18n/viewer';
import { asCurrency } from '@/lib/money/currency';
import { loadFxHistory } from '@/lib/money/fx';
import {
  computeAllowances,
  wageWarnings,
  type AllowanceRule,
  type AllowanceSet,
  type AllowanceSummary,
  type AllowanceWarning,
  type NightType,
  type WageWarning,
} from '@/lib/pay/allowances';
import { createClient } from '@/lib/supabase/server';
import type { Driver, TesRuleSet } from '@/types/db';
import { allowanceDayInputs, fullMonths, groupDaysBySet, type DayCountrySource, type DayFact } from './allowanceDays';

/**
 * Отчёт по водителям за период.
 *
 * Собирается под сессией перевозчика: RLS отдаёт только его водителей,
 * их смены и ставки, а driver_trips — только его рейсы. Секретный ключ
 * здесь не нужен и не участвует.
 *
 * Числа считает lib/driverPay; здесь только выборка и приведение строк
 * базы к входу калькулятора. Экран, PDF и таблицы берут один и тот же
 * результат этой функции. Суточные — lib/pay/allowances по набору
 * профиля оплаты и стране дня.
 */

/** Страна и суточные рабочего дня. Суммы — в валюте дня (currency). */
export type ReportDayAllowance = {
  country: string | null;
  /** manual — правка перевозчика, auto — по точкам рейсов, null — неизвестна. */
  source: DayCountrySource;
  /** Все страны точек рейсов дня. */
  countries: string[];
  night: NightType | null;
  meals: string | null;
  /** У дня есть набор суточных (через профиль оплаты). */
  hasSet: boolean;
  fraction: number;
  allowanceCents: number;
  lodgingCents: number;
  taxFreeCents: number;
  taxableCents: number;
  currency: string;
  kind: 'PER_DIEM' | 'WAGE';
};

/** Предупреждение отчёта; set — имя набора, к которому оно относится. */
export type ReportWarning = (AllowanceWarning | WageWarning) & { set?: string };

export type DriverReportEntry = {
  driver: Pick<Driver, 'id' | 'full_name' | 'phone' | 'status'>;
  summary: DriverSummary;
  /** По дате рабочего дня. */
  allowanceDays: Record<string, ReportDayAllowance>;
  /** Итог суточных в валюте отчёта. */
  allowanceTotals: AllowanceSummary['totals'];
  warnings: ReportWarning[];
};

export type DriverReport = {
  from: string;
  to: string;
  /** Валюта итогов: рабочая валюта компании. Суммы дней — каждая в своей валюте (day.currency). */
  currency: string;
  /** Страна компании: первая в выборе страны дня. */
  country: string;
  entries: DriverReportEntry[];
};

/** Строки набора и его таблицы ставок → правила калькулятора. */
export function tesRules(
  set: TesRuleSet,
  rates: Array<{
    grade: string;
    valid_from: string;
    hourly_cents: number;
  }> = [],
): TesRules {
  return {
    rates: rates.map((r): TesRate => ({
      grade: r.grade,
      validFrom: r.valid_from,
      hourlyCents: r.hourly_cents,
    })),
    overtimeBasis: set.overtime_basis === 'PERIOD' ? 'PERIOD' : 'DAY',
    periodRegularMinutes: set.period_regular_minutes,
    periodAnchor: set.period_anchor,
    eveningBps: set.evening_bps,
    nightBps: set.night_bps,
    holidaysAsSunday: set.holidays_as_sunday,
    minPaidMinutes: set.min_paid_minutes,
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
    currency: asCurrency(set.currency, 'EUR'),
    /* До миграции стран колонок нет — финские правила. */
    country: set.country ?? 'FI',
    holidayBps: set.holiday_bps ?? 0,
    baseMonthlyCents: set.base_monthly_cents ?? null,
  };
}

/** Сдвиг даты YYYY-MM-DD на n дней. */
function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const RULES = new Set(['PL_DOMESTIC', 'PL_INTERNATIONAL', 'EE_ABROAD', 'LV_TRIP', 'LT_ABROAD', 'GENERIC']);

const emptyAllowanceTotals = (currency: string): AllowanceSummary['totals'] => ({
  currency,
  allowanceCents: 0,
  lodgingCents: 0,
  taxFreeCents: 0,
  taxableCents: 0,
  missingRate: false,
});

export async function buildDriverReport(input: {
  from: string;
  to: string;
  driverId?: string | null;
}): Promise<DriverReport> {
  const supabase = await createClient();

  /*
   * Смены берутся с запасом: граница периода — местная дата начала смены,
   * а в запросе время в UTC, и сверхурочные по TES считаются за
   * 2-недельный период, который может начаться до начала отчёта. Лишнее
   * отсекается после расчёта, по дате дня.
   */
  const since = `${shiftDate(input.from, -14)}T00:00:00Z`;
  const until = `${shiftDate(input.to, 2)}T00:00:00Z`;

  let driversQuery = supabase.from('drivers').select('id, full_name, phone, status').order('full_name');
  if (input.driverId) driversQuery = driversQuery.eq('id', input.driverId);

  let shiftsQuery = supabase
    .from('driver_shifts')
    .select('id, driver_id, started_at, ended_at, odometer_start, odometer_end, driver_breaks(started_at, ended_at)')
    .gte('started_at', since)
    .lt('started_at', until)
    .order('started_at');
  if (input.driverId) shiftsQuery = shiftsQuery.eq('driver_id', input.driverId);

  let factsQuery = supabase
    .from('driver_day_facts')
    .select('driver_id, day, country, night, meals')
    .gte('day', input.from)
    .lte('day', input.to);
  if (input.driverId) factsQuery = factsQuery.eq('driver_id', input.driverId);

  /*
   * Суточные и страны дня: до применения миграции стран таблиц нет —
   * запрос вернёт ошибку и пустые данные, отчёт считается без суточных.
   */
  const [
    { data: drivers },
    { data: shifts },
    { data: trips },
    { data: profiles },
    { data: sets },
    { data: rates },
    { data: allowanceSets },
    { data: facts },
    { data: dayCountries },
    viewer,
  ] = await Promise.all([
    driversQuery,
    shiftsQuery,
    supabase.rpc('driver_trips', { p_from: input.from, p_to: input.to }),
    supabase.from('driver_pay_profiles').select('*'),
    supabase.from('tes_rule_sets').select('*'),
    supabase.from('tes_wage_rates').select('rule_set_id, grade, valid_from, hourly_cents'),
    supabase.from('allowance_rule_sets').select('id, name, country, currency, rule, params, legality'),
    factsQuery,
    supabase.rpc('driver_day_countries', {
      p_from: input.from,
      p_to: input.to,
    }),
    getViewer(),
  ]);

  const companyCountry =
    (viewer.status === 'ready' ? (viewer.company as { country?: string } | null)?.country : null)?.toUpperCase() ??
    'FI';

  /* Наборы суточных, на которые ссылаются профили, — с их ставками по странам. */
  const usedSetIds = [
    ...new Set((profiles ?? []).map((p) => p.allowance_rule_set_id).filter((id): id is string => Boolean(id))),
  ];
  const { data: allowanceRates } = usedSetIds.length
    ? await supabase
        .from('allowance_rates')
        .select('rule_set_id, country, currency, day_cents, hotel_limit_cents')
        .in('rule_set_id', usedSetIds)
    : { data: [] };

  const allowanceById = new Map<string, AllowanceSet & { name: string; legality: string }>();
  for (const s of allowanceSets ?? []) {
    if (!usedSetIds.includes(s.id) || !RULES.has(s.rule)) continue;
    allowanceById.set(s.id, {
      name: s.name,
      legality: s.legality,
      rule: s.rule as AllowanceRule,
      country: s.country,
      currency: s.currency,
      params:
        s.params && typeof s.params === 'object' && !Array.isArray(s.params)
          ? (s.params as Record<string, unknown>)
          : {},
      rates: (allowanceRates ?? [])
        .filter((r) => r.rule_set_id === s.id)
        .map((r) => ({
          country: r.country,
          currency: r.currency,
          dayCents: r.day_cents,
          hotelLimitCents: r.hotel_limit_cents,
        })),
    });
  }

  /*
   * Курсы нужны, только если есть ставка не в валюте компании (компания
   * сменила валюту, набор из финского шаблона в евро, польские суточные
   * за границей в евро): тогда процент от рейса и итог пересчитываются
   * по курсу дня.
   */
  const { currency } = await viewerMoney();
  const foreign =
    (profiles ?? []).some((p) => p.currency !== currency) ||
    (sets ?? []).some((s) => s.currency !== currency) ||
    [...allowanceById.values()].some((s) => s.currency !== currency || s.rates.some((r) => r.currency !== currency));
  const fx = foreign ? await loadFxHistory(supabase, since.slice(0, 10), input.to) : null;
  const convert = fx
    ? (cents: number, from: string, to: string, day: string) => fx.convert(cents, asCurrency(from), asCurrency(to), day)
    : undefined;

  const setById = new Map((sets ?? []).map((s) => [s.id, s]));
  const rulesById = new Map(
    (sets ?? []).map((s) => [
      s.id,
      tesRules(
        s,
        (rates ?? []).filter((r) => r.rule_set_id === s.id),
      ),
    ]),
  );
  const now = Date.now();
  const months = fullMonths(input.from, input.to);

  const entries: DriverReportEntry[] = [];

  for (const driver of drivers ?? []) {
    const own = (shifts ?? []).filter((s) => s.driver_id === driver.id);
    const shiftInputs: ShiftInput[] = own.map((s) => ({
      id: s.id,
      start: s.started_at,
      end: s.ended_at,
      breaks: (s.driver_breaks ?? []).map((b) => ({
        start: b.started_at,
        end: b.ended_at,
      })),
      odometerStart: s.odometer_start,
      odometerEnd: s.odometer_end,
    }));

    const ownProfiles = (profiles ?? [])
      .filter((p) => p.driver_id === driver.id)
      .sort((a, b) => a.valid_from.localeCompare(b.valid_from));
    const payProfiles: PayProfileInput[] = ownProfiles.map((p) => ({
      validFrom: p.valid_from,
      model: p.model,
      perKmCents: p.per_km_cents,
      tripBps: p.trip_bps,
      hourlyCents: p.hourly_cents,
      tes: p.tes_rule_set_id ? (rulesById.get(p.tes_rule_set_id) ?? null) : null,
      tesGrade: p.tes_grade,
      tesExperienceSince: p.tes_experience_since,
      currency: p.currency,
      bonusPerKmCents: p.bonus_per_km_cents ?? null,
      bonusTripBps: p.bonus_trip_bps ?? null,
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
      /* driver_trips отдаёт выплату уже в валюте компании. */
      currency,
      fx: convert,
    });

    const days = summary.days.filter((d) => d.date >= input.from && d.date <= input.to);

    /*
     * Итоги пересчитываются по отфильтрованным дням: смена, взятая с
     * запасом, не должна попасть в сумму периода, которому не
     * принадлежит.
     */
    const trimmed = totalsOf(days, { currency, fx: convert });

    /* Водитель без единой строки за период в отчёт не попадает — кроме выбранного явно. */
    if (days.length === 0 && !input.driverId) continue;

    /* Зарплата полных месяцев с работой (без суточных) в нужной валюте — для потолков и минимума. */
    const wageByMonth = (target: string): Record<string, number> | undefined => {
      const out: Record<string, number> = {};
      for (const month of months) {
        const inMonth = days.filter((d) => d.date.startsWith(month));
        if (inMonth.length === 0) continue;
        const t = totalsOf(inMonth, { currency: target, fx: convert });
        if (!t.missingRate) out[month] = t.amountCents;
      }
      return Object.keys(out).length ? out : undefined;
    };

    /* ── Страна дня и суточные ── */
    const ownFacts = new Map<string, DayFact>();
    for (const f of facts ?? []) if (f.driver_id === driver.id) ownFacts.set(f.day, f);
    const auto = new Map<string, string | null>();
    const autoList = new Map<string, string[]>();
    for (const c of dayCountries ?? []) {
      if (c.driver_id !== driver.id) continue;
      auto.set(c.day, c.last_country);
      autoList.set(c.day, c.countries ?? []);
    }

    const dayInputs = allowanceDayInputs({
      dates: days.map((d) => d.date),
      shifts: own.map((s) => ({ start: s.started_at, end: s.ended_at })),
      dayOf: (iso) => todayInHelsinki(new Date(iso)),
      facts: ownFacts,
      auto,
      now,
    });

    const allowanceDays: Record<string, ReportDayAllowance> = {};
    for (const d of dayInputs) {
      allowanceDays[d.date] = {
        country: d.country,
        source: d.source,
        countries: autoList.get(d.date) ?? [],
        night: d.night ?? null,
        meals: d.meals ?? null,
        hasSet: false,
        fraction: 0,
        allowanceCents: 0,
        lodgingCents: 0,
        taxFreeCents: 0,
        taxableCents: 0,
        currency,
        kind: 'PER_DIEM',
      };
    }

    const allowanceTotals = emptyAllowanceTotals(currency);
    const warnings: ReportWarning[] = [];
    const seen = new Set<string>();
    const warn = (w: ReportWarning) => {
      const key = JSON.stringify(w);
      if (seen.has(key)) return;
      seen.add(key);
      warnings.push(w);
    };

    const groups = groupDaysBySet(
      days.map((d) => d.date),
      ownProfiles.map((p) => ({
        validFrom: p.valid_from,
        setId: p.allowance_rule_set_id ?? null,
      })),
    );
    for (const [setId, dates] of groups) {
      const set = allowanceById.get(setId);
      if (!set) continue;
      const inSet = new Set(dates);
      const last = dates[dates.length - 1];
      /* Оклад по договору — из набора оплаты профиля, действующего в последний день группы. */
      const profile = ownProfiles.filter((p) => p.valid_from <= last).at(-1);
      const tes = profile?.tes_rule_set_id ? setById.get(profile.tes_rule_set_id) : undefined;
      let baseMonthlyCents: number | null = null;
      if (tes?.base_monthly_cents) {
        baseMonthlyCents =
          tes.currency === set.currency
            ? tes.base_monthly_cents
            : (convert?.(tes.base_monthly_cents, tes.currency, set.currency, last) ?? null);
      }

      const result = computeAllowances({
        set,
        days: dayInputs.filter((d) => inSet.has(d.date)),
        currency,
        fx: convert,
        wageByMonth: wageByMonth(set.currency),
        baseMonthlyCents,
      });

      for (const day of result.days) {
        const row = allowanceDays[day.date];
        if (!row) continue;
        Object.assign(row, {
          hasSet: true,
          fraction: day.fraction,
          allowanceCents: day.allowanceCents,
          lodgingCents: day.lodgingCents,
          taxFreeCents: day.taxFreeCents,
          taxableCents: day.taxableCents,
          currency: day.currency,
          kind: day.kind,
        });
      }
      allowanceTotals.allowanceCents += result.totals.allowanceCents;
      allowanceTotals.lodgingCents += result.totals.lodgingCents;
      allowanceTotals.taxFreeCents += result.totals.taxFreeCents;
      allowanceTotals.taxableCents += result.totals.taxableCents;
      allowanceTotals.missingRate ||= result.totals.missingRate;
      for (const w of result.warnings) warn({ ...w, set: set.name });
      if (set.legality === 'GREY' || set.legality === 'NON_COMPLIANT') {
        warn({ code: 'LEGALITY', level: set.legality, set: set.name });
      }
    }

    /* ── Предупреждения об оплате: по профилям, действовавшим в периоде ── */
    ownProfiles.forEach((p, i) => {
      const next = ownProfiles[i + 1];
      if (p.valid_from > input.to || (next && next.valid_from <= input.from)) return;
      const tes = p.tes_rule_set_id ? setById.get(p.tes_rule_set_id) : undefined;
      const minCurrency = tes?.currency ?? p.currency ?? currency;
      for (const w of wageWarnings({
        model: p.model,
        country: companyCountry,
        legality: tes?.legality ?? null,
        minMonthlyCents: tes?.min_monthly_cents ?? null,
        currency: minCurrency,
        wageByMonth: tes?.min_monthly_cents ? wageByMonth(minCurrency) : undefined,
      })) {
        warn(w.code === 'LEGALITY' && tes ? { ...w, set: tes.name } : w);
      }
    });

    entries.push({
      driver,
      summary: { days, totals: trimmed },
      allowanceDays,
      allowanceTotals,
      warnings,
    });
  }

  return {
    from: input.from,
    to: input.to,
    currency,
    country: companyCountry,
    entries,
  };
}
