/**
 * Суточные водителя по правилам страны работодателя.
 *
 * СПРАВКА, А НЕ РАСЧЁТ ЗАРПЛАТЫ — как и финский калькулятор
 * (src/lib/driverPay.ts). Считает ровно то, что настроено в наборе
 * суточных, и показывает, где правило страны требует внимания: потолок
 * Латвии, налогооблагаемая часть в Литве, польская «диета», которая с
 * 2022 года — зарплата. Источники и цифры:
 * docs/pay/research-driver-pay-countries.md.
 *
 * День — местная дата смены (как у driverPay). Страна дня — где водитель
 * его провёл (правка перевозчика или последняя страна точек рейсов).
 *
 * Модуль без импортов: тесты гоняются голым `node --test`.
 */

export type AllowanceRule = 'PL_DOMESTIC' | 'PL_INTERNATIONAL' | 'EE_ABROAD' | 'LV_TRIP' | 'LT_ABROAD' | 'GENERIC';

export type AllowanceRate = {
  country: string;
  currency: string;
  dayCents: number;
  hotelLimitCents?: number | null;
};

export type AllowanceSet = {
  rule: AllowanceRule;
  /** Страна работодателя: дни в ней — внутренние. */
  country: string;
  /** Валюта набора (польская внутренняя диета — злотые). */
  currency: string;
  /** Параметры правила (см. ниже по правилам); числа — центы и б.п. */
  params: Record<string, unknown>;
  rates: AllowanceRate[];
};

export type NightType = 'HOME' | 'CAB' | 'HOTEL' | 'FREE';

export type AllowanceDayInput = {
  date: string;
  /** Страна дня; null — неизвестна (нет точек рейсов и правки). */
  country: string | null;
  /** Продолжительность смены от начала до конца, с перерывами, — для неполного дня. */
  spanMinutes: number;
  night?: NightType | null;
  /** Бесплатное питание: B, L, D. */
  meals?: string | null;
};

export type AllowanceDay = {
  date: string;
  country: string | null;
  abroad: boolean;
  /** Доля дня: 0, 1/3, 1/2, 1 — по правилу неполного дня. */
  fraction: number;
  /** Суточные (или надбавка за день за границей) в валюте строки. */
  allowanceCents: number;
  /** Ночлег без счёта (польский ryczałt) — в валюте строки. */
  lodgingCents: number;
  currency: string;
  /**
   * PER_DIEM — возмещение расходов, не зарплата; WAGE — польская
   * надбавка за день за границей: с 2022 это часть зарплаты.
   */
  kind: 'PER_DIEM' | 'WAGE';
  /** Без налога (по правилу страны) / облагается — справочно. */
  taxFreeCents: number;
  taxableCents: number;
};

export type AllowanceWarning =
  | { code: 'NO_COUNTRY'; days: number }
  | { code: 'NO_RATE'; countries: string[] }
  | { code: 'PL_INTL_IS_WAGE' }
  | { code: 'PL_ZUS_RELIEF'; days: number; eurCents: number }
  | { code: 'EE_LATER_RATE'; days: number }
  | { code: 'LV_CAP'; month: string; excessCents: number; currency: string }
  | { code: 'LT_TAXABLE'; month: string; taxableCents: number; currency: string };

export type AllowanceSummary = {
  days: AllowanceDay[];
  /** Итог в валюте отчёта (target): суточные, ночлег, без налога, облагается. */
  totals: {
    currency: string;
    allowanceCents: number;
    lodgingCents: number;
    taxFreeCents: number;
    taxableCents: number;
    /** Есть суммы, которые не пересчитать в валюту отчёта (нет курса). */
    missingRate: boolean;
  };
  warnings: AllowanceWarning[];
};

export type FxConvert = (cents: number, from: string, to: string, day: string) => number | null;

const num = (value: unknown, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Неполный день по польским правилам командировки: < 8 ч — 0, 8–12 — ½, > 12 — 1. */
function plDomesticFraction(span: number): number {
  if (span < 8 * 60) return 0;
  if (span <= 12 * 60) return 0.5;
  return 1;
}

/** Дни за границей < 12 ч в польской льготе PIT: ≤ 8 ч — ⅓, 8–12 — ½, больше — целый. */
function plThirdsFraction(span: number): number {
  if (span <= 8 * 60) return 1 / 3;
  if (span < 12 * 60) return 0.5;
  return 1;
}

/** Вычет за бесплатное питание (PL § 7): завтрак 25 %, обед 50 %, ужин 25 %. */
function mealCut(meals: string | null | undefined): number {
  const m = (meals ?? '').toUpperCase();
  return (m.includes('B') ? 0.25 : 0) + (m.includes('L') ? 0.5 : 0) + (m.includes('D') ? 0.25 : 0);
}

const monthOf = (date: string) => date.slice(0, 7);

export function computeAllowances(input: {
  set: AllowanceSet;
  days: AllowanceDayInput[];
  /** Валюта итога (валюта компании). */
  currency: string;
  fx?: FxConvert;
  /**
   * Зарплата водителя за месяц (без суточных) в валюте набора — для
   * потолка Латвии (70 %) и 50 % Литвы. Нет — проверки не делаются.
   */
  wageByMonth?: Record<string, number>;
  /** Оклад по договору в месяц в валюте набора — для литовского 1,65 МЗП. */
  baseMonthlyCents?: number | null;
}): AllowanceSummary {
  const { set } = input;
  const p = set.params ?? {};
  const home = set.country.toUpperCase();
  const rateOf = (country: string) => set.rates.find((r) => r.country.toUpperCase() === country.toUpperCase()) ?? null;

  const days: AllowanceDay[] = [];
  const missingRates = new Set<string>();
  let noCountry = 0;
  let eeLater = 0;
  let plAbroadDays = 0;

  /* Эстония: номер дня в поездке и сколько «первых» дней уже ушло в месяце. */
  let tripDay = 0;
  let lastAbroadDate: string | null = null;
  const eeFirstInMonth = new Map<string, number>();

  const sorted = [...input.days].sort((a, b) => a.date.localeCompare(b.date));

  for (const d of sorted) {
    const country = d.country ? d.country.toUpperCase() : null;
    const abroad = Boolean(country && country !== home);
    const base: AllowanceDay = {
      date: d.date,
      country,
      abroad,
      fraction: 0,
      allowanceCents: 0,
      lodgingCents: 0,
      currency: set.currency,
      kind: 'PER_DIEM',
      taxFreeCents: 0,
      taxableCents: 0,
    };

    if (!country) {
      if (d.spanMinutes > 0) noCountry += 1;
      days.push(base);
      continue;
    }

    /* Поездка Эстонии: подряд идущие дни за границей. */
    if (abroad) {
      const prev = lastAbroadDate ? Date.parse(`${lastAbroadDate}T00:00:00Z`) : null;
      const cur = Date.parse(`${d.date}T00:00:00Z`);
      tripDay = prev !== null && cur - prev <= 86_400_000 ? tripDay + 1 : 1;
      lastAbroadDate = d.date;
    }

    switch (set.rule) {
      case 'PL_DOMESTIC': {
        if (abroad) break;
        const fraction = plDomesticFraction(d.spanMinutes);
        const dayCents = num(p.day_cents, 4500);
        const amount = Math.max(0, Math.round(dayCents * fraction - dayCents * mealCut(d.meals)));
        const cabLodging = p.cab_lodging === true;
        const lodging =
          d.night === 'HOTEL' || (d.night === 'CAB' && cabLodging) ? num(p.lodging_cents, Math.round(dayCents * 1.5)) : 0;
        Object.assign(base, {
          fraction,
          allowanceCents: amount,
          lodgingCents: lodging,
          taxFreeCents: amount + lodging,
        });
        break;
      }

      case 'PL_INTERNATIONAL': {
        if (!abroad) break;
        /* С 2022 не командировка: надбавка за день за границей — зарплата; без налога — до 20 € (⅓/½). */
        plAbroadDays += 1;
        const cur = String(p.day_currency ?? 'EUR');
        const dayCents = num(p.day_cents, 0);
        const fraction = plThirdsFraction(d.spanMinutes);
        const relief = Math.round(num(p.pit_relief_cents, 2000) * fraction);
        const amount = Math.round(dayCents * (fraction === 1 ? 1 : fraction));
        Object.assign(base, {
          fraction,
          allowanceCents: amount,
          currency: cur,
          kind: 'WAGE',
          taxFreeCents: Math.min(amount, relief),
          taxableCents: Math.max(0, amount - relief),
        });
        break;
      }

      case 'EE_ABROAD': {
        if (!abroad) break;
        const month = monthOf(d.date);
        const firstDays = num(p.first_days, 15);
        const used = eeFirstInMonth.get(month) ?? 0;
        const first = tripDay <= firstDays && used < firstDays;
        if (first) eeFirstInMonth.set(month, used + 1);
        else eeLater += 1;
        const amount = first ? num(p.first_cents, 7500) : num(p.later_cents, 4000);
        Object.assign(base, { fraction: 1, allowanceCents: amount, taxFreeCents: amount });
        break;
      }

      case 'LV_TRIP':
      case 'LT_ABROAD':
      case 'GENERIC': {
        /*
         * Внутренний день — по ставке страны работодателя (LV 8 €, LT 28 €,
         * SE 300 kr), только с ночёвкой вне дома: однодневная поездка
         * суточных не даёт (LV п. 43, LT — поездка дольше одного дня).
         */
        if (!abroad && !(d.night === 'CAB' || d.night === 'HOTEL' || d.night === 'FREE')) break;
        const rate = rateOf(country);
        if (!rate) {
          if (abroad) missingRates.add(country);
          break;
        }
        const amount = rate.dayCents;
        Object.assign(base, {
          fraction: 1,
          allowanceCents: amount,
          currency: rate.currency,
          taxFreeCents: amount,
        });
        break;
      }
    }

    days.push(base);
  }

  const warnings: AllowanceWarning[] = [];

  /* Месячные правила Латвии и Литвы — в валюте набора. */
  if ((set.rule === 'LV_TRIP' || set.rule === 'LT_ABROAD') && input.wageByMonth) {
    const byMonth = new Map<string, AllowanceDay[]>();
    for (const day of days) {
      if (day.allowanceCents <= 0) continue;
      const list = byMonth.get(monthOf(day.date)) ?? [];
      list.push(day);
      byMonth.set(monthOf(day.date), list);
    }

    for (const [month, list] of byMonth) {
      const wage = input.wageByMonth[month];
      if (wage == null) continue;
      /* Сумма суточных месяца в валюте набора. */
      let total = 0;
      for (const day of list) {
        const inSet =
          day.currency === set.currency ? day.allowanceCents : input.fx?.(day.allowanceCents, day.currency, set.currency, day.date);
        total += inSet ?? 0;
      }

      let limit: number;
      if (set.rule === 'LV_TRIP') {
        /* Суточные ≤ 70 % от (зарплата + суточные) ⇒ суточные ≤ зарплата × 0,7 / 0,3. */
        const cap = num(p.cap_bps, 7000) / 10_000;
        limit = cap >= 1 ? Infinity : Math.floor((wage * cap) / (1 - cap));
      } else {
        const coef = num(p.coef_bps, 16500) / 10_000;
        const mma = num(p.mma_cents, 115300);
        const contract = input.baseMonthlyCents ?? wage;
        limit = contract >= coef * mma ? Infinity : Math.floor((wage * num(p.half_bps, 5000)) / 10_000);
      }

      if (total > limit) {
        const excess = total - limit;
        /* Излишек — облагаемая часть: ложится на дни месяца с конца. */
        let left = excess;
        for (const day of [...list].reverse()) {
          if (left <= 0) break;
          const share = Math.min(day.taxFreeCents, left);
          day.taxFreeCents -= share;
          day.taxableCents += share;
          left -= share;
        }
        warnings.push(
          set.rule === 'LV_TRIP'
            ? { code: 'LV_CAP', month, excessCents: excess, currency: set.currency }
            : { code: 'LT_TAXABLE', month, taxableCents: excess, currency: set.currency },
        );
      }
    }
  }

  if (noCountry > 0) warnings.push({ code: 'NO_COUNTRY', days: noCountry });
  if (missingRates.size > 0) warnings.push({ code: 'NO_RATE', countries: [...missingRates].sort() });
  if (set.rule === 'PL_INTERNATIONAL' && plAbroadDays > 0) {
    warnings.push({ code: 'PL_INTL_IS_WAGE' });
    warnings.push({ code: 'PL_ZUS_RELIEF', days: plAbroadDays, eurCents: plAbroadDays * num(p.zus_relief_cents, 6000) });
  }
  if (eeLater > 0) warnings.push({ code: 'EE_LATER_RATE', days: eeLater });

  /* Итог в валюте отчёта: каждая строка — по курсу своего дня. */
  const totals = {
    currency: input.currency,
    allowanceCents: 0,
    lodgingCents: 0,
    taxFreeCents: 0,
    taxableCents: 0,
    missingRate: false,
  };
  for (const day of days) {
    if (day.allowanceCents === 0 && day.lodgingCents === 0) continue;
    const conv = (cents: number) =>
      cents === 0 || day.currency === input.currency ? cents : (input.fx?.(cents, day.currency, input.currency, day.date) ?? null);
    const a = conv(day.allowanceCents);
    const l = conv(day.lodgingCents);
    const f = conv(day.taxFreeCents);
    const t = conv(day.taxableCents);
    if (a == null || l == null || f == null || t == null) {
      totals.missingRate = true;
      continue;
    }
    totals.allowanceCents += a;
    totals.lodgingCents += l;
    totals.taxFreeCents += f;
    totals.taxableCents += t;
  }

  return { days, totals, warnings };
}

/** Предупреждения о самой оплате (не о суточных) — для профиля и отчёта. */
export type WageWarning =
  | { code: 'OUTPUT_PAY' }
  | { code: 'BELOW_MINIMUM'; month: string; wageCents: number; minCents: number; currency: string }
  | { code: 'LEGALITY'; level: 'GREY' | 'NON_COMPLIANT' };

/**
 * Проверки оплаты:
 *   OUTPUT_PAY — оплата только за км или процент от фрахта в стране ЕС
 *     (Reg. 561/2006 ст. 10): допустимо премией к часам или окладу;
 *   BELOW_MINIMUM — зарплата полного месяца ниже минимальной страны
 *     (суточные в минимум не входят);
 *   LEGALITY — шаблон помечен как серый или не соответствующий закону.
 */
export function wageWarnings(input: {
  model: string | null;
  /** Страна компании: проверка «только за км» — для стран ЕС/ЕЭЗ. */
  country: string;
  legality?: string | null;
  minMonthlyCents?: number | null;
  currency: string;
  /** Зарплата полных месяцев (без суточных) в валюте минимума. */
  wageByMonth?: Record<string, number>;
}): WageWarning[] {
  const out: WageWarning[] = [];
  if (input.model === 'PER_KM' || input.model === 'TRIP_PERCENT') out.push({ code: 'OUTPUT_PAY' });
  if (input.legality === 'GREY' || input.legality === 'NON_COMPLIANT') out.push({ code: 'LEGALITY', level: input.legality });
  if (input.minMonthlyCents && input.wageByMonth) {
    for (const [month, wage] of Object.entries(input.wageByMonth)) {
      if (wage < input.minMonthlyCents) {
        out.push({ code: 'BELOW_MINIMUM', month, wageCents: wage, minCents: input.minMonthlyCents, currency: input.currency });
      }
    }
  }
  return out;
}
