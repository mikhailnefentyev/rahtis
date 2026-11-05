/**
 * Валюты RAHTIS.
 *
 * Деньги платформы (стол «RAHTIS-palvelu», сборы, счета Aivomaa) — всегда
 * евро. Деньги перевозчика (свои рейсы, расходы, топливо, зарплата,
 * объекты) — в рабочей валюте компании; каждая сумма в базе хранит свою
 * валюту рядом (колонка currency), поэтому смена валюты компании
 * историю не переписывает (решение 5.11.2026).
 *
 * Курсы — справочные ЕЦБ, «сколько единиц валюты за 1 €»
 * (таблица fx_rates). Модуль общий для сервера и браузера.
 */

export const CURRENCIES = ['EUR', 'SEK', 'NOK', 'DKK', 'PLN'] as const;

export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/** Строка из базы или формы → валюта; мусор → запасная (по умолчанию евро). */
export function asCurrency(value: unknown, fallback: Currency = 'EUR'): Currency {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : value;
  return isCurrency(v) ? v : fallback;
}

/** Валюта страны — как app.country_currency в базе. */
export function countryCurrency(country: string | null | undefined): Currency {
  switch ((country ?? '').toUpperCase()) {
    case 'SE':
      return 'SEK';
    case 'NO':
      return 'NOK';
    case 'DK':
      return 'DKK';
    case 'PL':
      return 'PLN';
    default:
      return 'EUR';
  }
}

/** Последние курсы: единиц валюты за 1 €. У евро курса нет — он 1. */
export type FxRates = Partial<Record<Currency, number>>;

export function perEur(rates: FxRates | null | undefined, currency: Currency): number | null {
  if (currency === 'EUR') return 1;
  const rate = rates?.[currency];
  return typeof rate === 'number' && rate > 0 ? rate : null;
}

/**
 * Пересчёт целых центов через евро. Курса нет — null: лучше пустое
 * место, чем злотые, сложенные с евро как равные.
 */
export function convertCents(
  cents: number,
  from: Currency,
  to: Currency,
  rates: FxRates | null | undefined,
): number | null {
  if (from === to) return cents;
  const a = perEur(rates, from);
  const b = perEur(rates, to);
  if (a === null || b === null) return null;
  return Math.round((cents / a) * b);
}

/**
 * Курсы по дням — для пересчёта истории (доходность за месяц, зарплата
 * с процентом от рейсов в разных валютах). Строки — как в fx_rates.
 */
export type FxRow = { day: string; currency: string; per_eur: number | string };

export type FxHistory = {
  /** Курс на день: последний опубликованный не позже этого дня. */
  perEur(currency: Currency, day: string): number | null;
  convert(cents: number, from: Currency, to: Currency, day: string): number | null;
};

export function fxHistory(rows: readonly FxRow[]): FxHistory {
  const byCurrency = new Map<Currency, { day: string; rate: number }[]>();
  for (const row of rows) {
    const cur = asCurrency(row.currency, 'EUR');
    if (cur === 'EUR') continue;
    const rate = Number(row.per_eur);
    if (!(rate > 0)) continue;
    const list = byCurrency.get(cur) ?? [];
    list.push({ day: row.day.slice(0, 10), rate });
    byCurrency.set(cur, list);
  }
  for (const list of byCurrency.values()) list.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  function rateOn(currency: Currency, day: string): number | null {
    if (currency === 'EUR') return 1;
    const list = byCurrency.get(currency);
    if (!list || list.length === 0) return null;
    const d = day.slice(0, 10);
    /* Последний курс не позже дня; раньше всей истории — самый ранний известный (как app.fx_per_eur). */
    let lo = 0;
    let hi = list.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].day <= d) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return list[found >= 0 ? found : 0].rate;
  }

  return {
    perEur: rateOn,
    convert(cents, from, to, day) {
      if (from === to) return cents;
      const a = rateOn(from, day);
      const b = rateOn(to, day);
      if (a === null || b === null) return null;
      return Math.round((cents / a) * b);
    },
  };
}

/** Последние курсы из той же истории. */
export function latestRates(rows: readonly FxRow[]): FxRates {
  const out: FxRates = {};
  const days: Partial<Record<Currency, string>> = {};
  for (const row of rows) {
    const cur = asCurrency(row.currency, 'EUR');
    if (cur === 'EUR') continue;
    const day = row.day.slice(0, 10);
    const rate = Number(row.per_eur);
    if (!(rate > 0)) continue;
    if (!days[cur] || day > days[cur]!) {
      days[cur] = day;
      out[cur] = rate;
    }
  }
  return out;
}

/**
 * Разбор ежедневного файла ЕЦБ (eurofxref-daily.xml / -hist-90d.xml):
 * <Cube time='2026-11-05'><Cube currency='PLN' rate='4.3890'/>…
 * Берутся только наши валюты.
 */
export function parseEcbXml(xml: string): { day: string; currency: Currency; per_eur: number }[] {
  const out: { day: string; currency: Currency; per_eur: number }[] = [];
  const dayRe = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g;
  let m: RegExpExecArray | null;
  while ((m = dayRe.exec(xml))) {
    const day = m[1];
    const rateRe = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]\s*\/>/g;
    let r: RegExpExecArray | null;
    while ((r = rateRe.exec(m[2]))) {
      const cur = r[1];
      const rate = Number(r[2]);
      if (isCurrency(cur) && cur !== 'EUR' && rate > 0) out.push({ day, currency: cur, per_eur: rate });
    }
  }
  return out;
}
