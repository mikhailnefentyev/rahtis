import IntlMessageFormat from 'intl-messageformat';
import type { Dictionary } from './dictionaries';

/**
 * Форматирование сообщений ICU MessageFormat.
 *
 * Почему именно ICU, а не собственный шаблонизатор: это тот же формат,
 * который понимают Crowdin, Lokalise, POEditor и переводчики-люди. Строки
 * можно выгрузить, отдать на перевод и загрузить обратно без конвертации,
 * а множественное число посчитает Intl.PluralRules по правилам CLDR — те же,
 * что у операционных систем. *
 * Сообщения об ошибках здесь по-английски, в отличие от остального
 * src/lib. Правило «в src/lib можно по-русски» держится на том, что этих
 * строк не видит никто, кроме разработчика; для модулей, уезжающих в
 * браузер, оно неверно — код попадает в бандл вместе со строками, и
 * русский текст оказывается на финском и английском сайте.
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
        throw new Error(`i18n: cannot format message "${key}" for locale ${intlLocale}`, {
          cause,
        });
      }
      console.error(`i18n: message "${key}" was not formatted`, cause);
      return pattern;
    }
  };
}
