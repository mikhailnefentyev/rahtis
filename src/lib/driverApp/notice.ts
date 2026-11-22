/**
 * Уведомление водителя: на каком языке текст, по какому адресу открыть и
 * как показать подстановки (22.11.2026).
 *
 * Одни и те же правила нужны push (src/lib/driverApp/push.ts) и экрану
 * «Сообщения» — поэтому они здесь, без сервера и без словарей: списки
 * языков и форматтер дат передаются снаружи, а модуль проверяют тесты
 * (`notice.test.mjs`).
 */

/**
 * Первый язык из предложенных, который приложение знает.
 *
 * Для push: сначала выбор водителя в профиле, потом язык, записанный при
 * подписке (язык телефона), потом запасной.
 */
export function firstKnown<T extends string>(
  candidates: readonly (string | null | undefined)[],
  known: readonly T[],
  fallback: T,
): T {
  for (const value of candidates) {
    if (typeof value === 'string' && (known as readonly string[]).includes(value)) return value as T;
  }
  return fallback;
}

/**
 * Язык адреса для языка водителя.
 *
 * Страницы приложения живут под языками сайта (/fi/driver, /ru/driver…), а
 * норвежского и датского среди них нет: такой водитель открывает /en, а
 * экран всё равно на его языке — язык приложения от адреса не зависит
 * (driverLocaleOf). Прокси для таких языков тоже ведёт на /en.
 */
export function routeLocale<T extends string>(language: string, siteLocales: readonly T[], fallback: T): T {
  return (siteLocales as readonly string[]).includes(language) ? (language as T) : fallback;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DAY_INSIDE = /\b\d{4}-\d{2}-\d{2}\b/g;

/**
 * Подстановки уведомления → значения для текста на языке водителя.
 *
 * В базе подстановки лежат без языка: дата — как YYYY-MM-DD. Здесь она
 * становится датой читающего. Строка, которая целиком дата (срок
 * документа), меняется в любом поле; внутри строки дата ищется только в
 * `when` (срок ТО: «2026-12-01 / 120 000 km»). Старые строки, где дата
 * уже записана словами по-фински («1.12.2026»), остаются как есть.
 */
export function eventValues(
  params: unknown,
  formatDay: (isoDay: string) => string,
): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  if (!params || typeof params !== 'object') return values;

  /* «2026-13-45» похоже на дату, но датой не является — остаётся как записано. */
  const day = (isoDay: string) => {
    try {
      return formatDay(isoDay) || isoDay;
    } catch {
      return isoDay;
    }
  };

  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (typeof value === 'number') {
      values[key] = value;
    } else if (typeof value === 'string') {
      if (ISO_DAY.test(value)) values[key] = day(value);
      else if (key === 'when') values[key] = value.replace(ISO_DAY_INSIDE, day);
      else values[key] = value;
    } else if (typeof value === 'boolean') {
      values[key] = value ? 'yes' : 'no';
    } else if (value === null) {
      /* Пустая подстановка из триггера — пустое место в тексте. */
      values[key] = '';
    }
  }
  return values;
}
