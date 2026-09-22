/**
 * Язык приложения водителя: список языков и выбор по телефону.
 *
 * Платформа говорит на финском и английском: кабинеты, витрина, письма,
 * документы. Водитель — другое дело. Он не выбирал платформу, он просто
 * работает, и половина водителей в Скандинавии не читает ни по-фински,
 * ни по-английски. Поэтому приложение подхватывает язык телефона, а в
 * профиле язык можно выбрать вручную.
 *
 * Ссылки при этом остаются в /fi и /en: адрес страницы — не язык
 * интерфейса, и менять его ради подписи на кнопке нельзя.
 *
 * Здесь только сам выбор языка, без словарей: его проверяют тесты
 * (`driver.test.mjs`), а сборка словаря живёт в `driver.ts`.
 */

export const DRIVER_LOCALES = ['fi', 'en', 'et', 'ru', 'sv', 'lv', 'lt', 'pl', 'nb', 'da'] as const;

export type DriverLocale = (typeof DRIVER_LOCALES)[number];

/** Как язык называется на самом себе — для выбора в профиле. */
export const DRIVER_LOCALE_NAMES: Record<DriverLocale, string> = {
  fi: 'Suomi',
  en: 'English',
  et: 'Eesti',
  ru: 'Русский',
  sv: 'Svenska',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  pl: 'Polski',
  nb: 'Norsk',
  da: 'Dansk',
};

export function isDriverLocale(value: string | null | undefined): value is DriverLocale {
  return typeof value === 'string' && (DRIVER_LOCALES as readonly string[]).includes(value);
}

/**
 * Язык устройства из Accept-Language.
 *
 * Берётся первый поддерживаемый по весу q. Норвежский приходит как nb,
 * nn или no — все три ведут к nb: букмол понимают обе стороны.
 */
export function matchDriverLocale(header: string | null | undefined): DriverLocale | null {
  if (!header) return null;

  const wanted = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((item) => item.tag && Number.isFinite(item.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of wanted) {
    const base = tag.split('-')[0];
    if (base === 'no' || base === 'nn' || base === 'nb') return 'nb';
    if (isDriverLocale(base)) return base;
  }
  return null;
}
