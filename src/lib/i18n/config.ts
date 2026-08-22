/**
 * Локали интерфейса.
 *
 * Чтобы добавить язык, нужно ровно три шага:
 *   1. создать src/lib/i18n/dictionaries/<код>.ts со `satisfies Dictionary`;
 *   2. добавить код в `locales` ниже;
 *   3. зарегистрировать словарь в `dictionaries/index.ts`.
 *
 * После шага 2 TypeScript сам покажет, чего не хватает: пропущенный словарь
 * в загрузчике и каждый непереведённый ключ станут ошибками компиляции.
 *
 * Финский первый: рынок финский, и посетитель без внятного
 * Accept-Language должен попадать на него. Английский нужен там, где
 * финского не хватает — водителям из Балтии и Польши, зарубежным
 * экспедиторам, которые ставят заказы из-за границы.
 */
export const locales = ['fi', 'en'] as const;

export type Locale = (typeof locales)[number];

/**
 * Язык по умолчанию: на него уходят запросы без явной локали.
 *
 * Финский, а не русский: рынок финский, и посетитель без внятного
 * Accept-Language должен попадать на финскую страницу, а не на ту, на
 * которой платформу пишут.
 */
export const defaultLocale: Locale = 'fi';

/**
 * Как язык называется на самом себе.
 *
 * Отдельно от словарей, а не `meta.label`: переключателю нужны имена
 * всех языков сразу, а тянуть ради двух слов каждый словарь целиком —
 * дорого. Эндоним не переводится: «Suomi» остаётся «Suomi» и в
 * английском интерфейсе.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  fi: 'Suomi',
  en: 'English',
};

/** Кука, в которой запоминается выбор пользователя. */
export const LOCALE_COOKIE = 'rahti_locale';

export function isLocale(value: string | undefined): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

/**
 * Разбирает заголовок Accept-Language и возвращает первую поддерживаемую локаль.
 * Без внешних зависимостей: список локалей короткий, полный RFC 4647 избыточен.
 */
export function matchLocale(acceptLanguage: string | null): Locale | undefined {
  if (!acceptLanguage) return undefined;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return {
        tag: (tag ?? '').trim().toLowerCase(),
        quality: q ? Number.parseFloat(q.split('=')[1] ?? '0') : 1,
      };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of ranked) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return undefined;
}
