/**
 * Договорённость с водителем — как платят на самом деле.
 *
 * Исследование 6.11.2026 (docs/pay/research-real-practice.md): в Польше и
 * Прибалтике с водителем договариваются о сумме «на руки» — за день, за
 * месяц, за рейс. По бумагам это оклад около минимального плюс суточные;
 * до законного потолка суточных такая схема законна, серая часть — всё,
 * что сверх потолка проходит как необлагаемое.
 *
 * Модуль считает:
 *   1. сколько водителю причитается по договорённости («на руки»);
 *   2. законную схему, которая выдаёт эту сумму: оклад не ниже минимума
 *      (на руки — по примерному коэффициенту страны) + суточные в пределах
 *      нормы (их считает allowances.ts);
 *   3. разрыв — что по закону должно идти облагаемой зарплатой, — и во
 *      что он обходится работодателю.
 * Как спрятать часть зарплаты, модуль не считает и не хранит (решение
 * 6.11.2026): только сколько стоит заплатить договорённое законно.
 *
 * Всё справочно: коэффициенты примерные, без личных вычетов и порогов.
 * Модуль без импортов: тесты гоняются голым `node --test`.
 */

export type AgreedModel = 'DAY_NET' | 'MONTHLY_NET' | 'PER_TRIP';

/**
 * Какие дни оплачиваются ставкой за день:
 *   ROUTE  — все дни в рейсе, включая выходные в кабине за границей;
 *   WORK   — только дни со сменой;
 *   ABROAD — только дни за границей (дома — homeDayCents, если задана).
 */
export type DayBasis = 'ROUTE' | 'WORK' | 'ABROAD';

export type Agreement = {
  model: AgreedModel;
  /** Валюта сумм договорённости. */
  currency: string;
  dayCents?: number | null;
  dayBasis?: DayBasis | null;
  /** Ставка за рабочий день дома (внутренние рейсы); нет — дома 0 при ABROAD, общая ставка иначе. */
  homeDayCents?: number | null;
  /** Ставки по стране дня: { NL: 12000, DE: 11000 }; нет страны — общая ставка. */
  countryDayCents?: Record<string, number> | null;
  monthlyCents?: number | null;
  tripCents?: number | null;
};

export type AgreedDayInput = {
  date: string;
  country: string | null;
  /** Была смена. */
  worked: boolean;
  /** Ночь вне дома (кабина, отель) — день в рейсе, даже без смены. */
  away: boolean;
  trips: number;
};

/** Примерные коэффициенты страны для оценки (docs/pay/research-real-practice.md § 6.2). */
export type CountryFactors = {
  /** Брутто на 1 «на руки»: зарплата сотрудника до налогов и взносов работника. */
  grossPerNet: number;
  /** Расходы работодателя на 1 «на руки»: брутто + взносы работодателя. */
  employerPerNet: number;
};

export const COUNTRY_FACTORS: Record<string, CountryFactors> = {
  /* ZUS работника 13,71 %, здоровье 9 %, PIT 12 %; ZUS работодателя ≈ 20,48 %. */
  PL: { grossPerNet: 1.39, employerPerNet: 1.68 },
  /* GPM 20 %, Sodra работника 19,5 %; работодателя ≈ 1,77 % + 0,32 %. */
  LT: { grossPerNet: 1.65, employerPerNet: 1.68 },
  /* VSAOI работника 10,5 %, IIN 25,5 %; VSAOI работодателя 23,59 %. */
  LV: { grossPerNet: 1.5, employerPerNet: 1.85 },
  /* Töötuskindlustus 1,6 %, II sammas 2 %, tulumaks 22 %; sotsiaalmaks 33 % + 0,8 %. */
  EE: { grossPerNet: 1.33, employerPerNet: 1.78 },
};

/** Порог зарплаты для разрешения на работу водителю из третьей страны (в валюте страны, центы). */
export const THIRD_COUNTRY_FLOOR: Record<string, { cents: number; currency: string }> = {
  LT: { cents: 289300, currency: 'EUR' },
  LV: { cents: 163700, currency: 'EUR' },
};

export type AgreedDay = { date: string; country: string | null; cents: number; basis: 'DAY' | 'HOME' | 'COUNTRY' | 'TRIP' | null };

export type AgreedResult = {
  currency: string;
  days: AgreedDay[];
  /** Причитается водителю по договорённости, «на руки». */
  agreedNetCents: number;
  /** Законная схема (в валюте договорённости). */
  legal: {
    /** Оклад брутто по бумагам (не ниже минимума страны за период). */
    baseGrossCents: number;
    /** Оклад «на руки» — по коэффициенту страны. */
    baseNetCents: number;
    /** Суточные без налога в пределах нормы. */
    taxFreeCents: number;
    /** Разрыв «на руки»: должен идти облагаемой зарплатой. */
    gapNetCents: number;
    /** Разрыв в брутто и в расходах работодателя. */
    gapGrossCents: number;
    gapEmployerCents: number;
    /** Расходы работодателя на всю законную схему: оклад + взносы, суточные, разрыв. */
    employerTotalCents: number;
  } | null;
  warnings: AgreedWarning[];
};

export type AgreedWarning =
  | { code: 'GAP'; gapNetCents: number; gapEmployerCents: number; currency: string }
  | { code: 'NO_FACTORS'; country: string }
  | { code: 'THIRD_COUNTRY_FLOOR'; baseCents: number; floorCents: number; currency: string };

/** Что причитается по договорённости за дни периода. */
export function agreedDays(agreement: Agreement, days: AgreedDayInput[], homeCountry: string): AgreedDay[] {
  const home = homeCountry.toUpperCase();
  const out: AgreedDay[] = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const country = d.country ? d.country.toUpperCase() : null;
    const abroad = Boolean(country && country !== home);
    let cents = 0;
    let basis: AgreedDay['basis'] = null;

    if (agreement.model === 'DAY_NET') {
      const mode = agreement.dayBasis ?? 'ROUTE';
      const counts = mode === 'WORK' ? d.worked : mode === 'ABROAD' ? abroad && (d.worked || d.away) : d.worked || d.away;
      const own = country ? agreement.countryDayCents?.[country] : undefined;
      if (counts) {
        if (own != null) {
          cents = own;
          basis = 'COUNTRY';
        } else if (!abroad && agreement.homeDayCents != null && d.worked) {
          cents = agreement.homeDayCents;
          basis = 'HOME';
        } else {
          cents = agreement.dayCents ?? 0;
          basis = 'DAY';
        }
      } else if (mode === 'ABROAD' && !abroad && d.worked && agreement.homeDayCents != null) {
        /* Дома при оплате только за границу — своя ставка, если договорились. */
        cents = agreement.homeDayCents;
        basis = 'HOME';
      }
    } else if (agreement.model === 'PER_TRIP') {
      cents = d.trips * (agreement.tripCents ?? 0);
      basis = d.trips > 0 ? 'TRIP' : null;
    }

    out.push({ date: d.date, country, cents, basis });
  }
  return out;
}

/**
 * Договорённость против законной схемы за период.
 *
 * months — сколько полных месяцев в периоде (для оклада в месяц и минимума);
 * неполный период — доля месяца по дням. Суммы законной схемы — в валюте
 * договорённости (вызывающий пересчитал минимум и суточные заранее).
 */
export function compareAgreement(input: {
  agreement: Agreement;
  days: AgreedDayInput[];
  /** Страна работодателя: коэффициенты, минимум, порог для третьих стран. */
  country: string;
  /** Доля месяцев в периоде (1 — полный месяц). */
  months: number;
  /** Минимальная зарплата страны в месяц, брутто (в валюте договорённости). */
  minMonthlyCents: number | null;
  /** Оклад по бумагам в месяц, брутто; нет — минимальная. */
  baseMonthlyCents?: number | null;
  /** Суточные без налога за период (allowances.ts, totals.taxFreeCents) в валюте договорённости. */
  taxFreeCents: number;
  thirdCountryDriver?: boolean;
}): AgreedResult {
  const { agreement } = input;
  const days = agreedDays(agreement, input.days, input.country);
  const agreedNetCents =
    agreement.model === 'MONTHLY_NET'
      ? Math.round((agreement.monthlyCents ?? 0) * input.months)
      : days.reduce((sum, d) => sum + d.cents, 0);

  const warnings: AgreedWarning[] = [];
  const factors = COUNTRY_FACTORS[input.country.toUpperCase()];
  if (!factors) {
    warnings.push({ code: 'NO_FACTORS', country: input.country.toUpperCase() });
    return { currency: agreement.currency, days, agreedNetCents, legal: null, warnings };
  }

  const monthlyBase = Math.max(input.baseMonthlyCents ?? 0, input.minMonthlyCents ?? 0);
  const baseGrossCents = Math.round(monthlyBase * input.months);
  const baseNetCents = Math.round(baseGrossCents / factors.grossPerNet);
  const taxFreeCents = Math.max(0, input.taxFreeCents);
  const gapNetCents = Math.max(0, agreedNetCents - baseNetCents - taxFreeCents);
  const gapGrossCents = Math.round(gapNetCents * factors.grossPerNet);
  const gapEmployerCents = Math.round(gapNetCents * factors.employerPerNet);
  const baseEmployerCents = Math.round(baseNetCents * factors.employerPerNet);
  const employerTotalCents = baseEmployerCents + taxFreeCents + gapEmployerCents;

  if (gapNetCents > 0) {
    warnings.push({ code: 'GAP', gapNetCents, gapEmployerCents, currency: agreement.currency });
  }

  const floor = THIRD_COUNTRY_FLOOR[input.country.toUpperCase()];
  if (input.thirdCountryDriver && floor && floor.currency === agreement.currency && monthlyBase < floor.cents) {
    warnings.push({ code: 'THIRD_COUNTRY_FLOOR', baseCents: monthlyBase, floorCents: floor.cents, currency: floor.currency });
  }

  return {
    currency: agreement.currency,
    days,
    agreedNetCents,
    legal: { baseGrossCents, baseNetCents, taxFreeCents, gapNetCents, gapGrossCents, gapEmployerCents, employerTotalCents },
    warnings,
  };
}
