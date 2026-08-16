import IntlMessageFormat from 'intl-messageformat';
import type { Dictionary } from './dictionaries';

/**
 * Форматирование сообщений ICU MessageFormat.
 *
 * Почему именно ICU, а не собственный шаблонизатор: это тот же формат,
 * который понимают Crowdin, Lokalise, POEditor и переводчики-люди. Строки
 * можно выгрузить, отдать на перевод и загрузить обратно без конвертации,
 * а множественное число посчитает Intl.PluralRules по правилам CLDR — те же,
 * что у операционных систем.
 */

export type MessageKey = keyof Dictionary['msg'];

/**
 * Значения подстановок. Только именованные: {company}, а не {0}.
 * Позиционные ломают перевод — в финском и немецком порядок слов другой.
 */
export type MessageValues = Record<string, string | number | Date>;

export type MessageFn = (key: MessageKey, values?: MessageValues) => string;

/**
 * Собирает функцию сообщений для конкретной локали.
 *
 * Разбор ICU-строки и создание форматтера стоят заметно дороже самого
 * форматирования, поэтому готовые форматтеры кешируются по ключу. Кеш
 * привязан к локали: смена языка не переиспользует чужие правила.
 */
export function createMessages(intlLocale: string, dictionary: Dictionary): MessageFn {
  const cache = new Map<MessageKey, IntlMessageFormat>();

  return function message(key, values) {
    const pattern = dictionary.msg[key];

    try {
      let formatter = cache.get(key);
      if (!formatter) {
        formatter = new IntlMessageFormat(pattern, intlLocale);
        cache.set(key, formatter);
      }

      const result = formatter.format(values);
      return Array.isArray(result) ? result.join('') : String(result);
    } catch (cause) {
      // Чаще всего сюда попадают из-за забытой подстановки. В разработке
      // это должно падать громко: молча отданный ключ вместо текста
      // доедет до продакшена. В продакшене падать нельзя — экран важнее
      // одной строки, поэтому отдаём исходный шаблон.
      if (process.env.NODE_ENV !== 'production') {
        throw new Error(`Не удалось отформатировать сообщение «${key}» для локали ${intlLocale}`, {
          cause,
        });
      }
      console.error(`i18n: сообщение «${key}» не отформатировано`, cause);
      return pattern;
    }
  };
}
