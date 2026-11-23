/**
 * Страна расчёта на открытой странице калькулятора рассрочки (24.11.2026).
 *
 * Сделка всегда внутри одной страны, и порог просрочки, НДС, валюта и
 * документы зависят от неё. Поэтому калькулятор считает по выбранной стране:
 * по умолчанию — страна языка страницы, если раздел в ней открыт (sv → SE,
 * et → EE…), у русского и английского — Финляндия. Выбор — обычный параметр
 * ?country=: работает без JavaScript, на него можно сослаться. Неизвестная
 * или закрытая страна — та же страна по умолчанию.
 *
 * Без зависимостей: список открытых стран передаёт вызывающий
 * (openInstallmentCountries), тест подставляет свой.
 */

/** Страна языка страницы. Дании своего языка на сайте нет — она только через ?country=DK. */
export const LOCALE_COUNTRY: Record<string, string> = {
  fi: 'FI',
  sv: 'SE',
  et: 'EE',
  lv: 'LV',
  lt: 'LT',
  pl: 'PL',
  de: 'DE',
  ro: 'RO',
  ru: 'FI',
  en: 'FI',
};

/** Страна по умолчанию для языка: своя, если открыта, иначе Финляндия, иначе первая открытая. */
export function defaultInstallmentCountry(locale: string, open: readonly string[]): string {
  const own = LOCALE_COUNTRY[locale];
  if (own && open.includes(own)) return own;
  if (open.includes('FI')) return 'FI';
  return open[0] ?? 'FI';
}

/** Страна расчёта: из ?country=, если она открыта; иначе — по языку страницы. */
export function pickInstallmentCountry(locale: string, query: string | string[] | null | undefined, open: readonly string[]): string {
  const raw = Array.isArray(query) ? query[0] : query;
  const code = (raw ?? '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code) && open.includes(code)) return code;
  return defaultInstallmentCountry(locale, open);
}
