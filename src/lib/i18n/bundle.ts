import { createFormat, type Format } from '@/lib/format';
import type { Locale } from './config';
import type { Dictionary } from './dictionaries';
import { createMessages, type MessageFn } from './message';

/**
 * Всё, что нужно для вывода текста на выбранном языке.
 *
 * Три инструмента с разными задачами — их нельзя подменять друг другом:
 *
 *   t — готовые подписи без подстановок: кнопки, заголовки, статусы;
 *   m — сообщения с переменными и множественным числом (ICU);
 *   f — Intl-форматтеры: суммы, даты, время, числа.
 *
 * Правило простое: как только в тексте появляется переменная или число,
 * которое влияет на окончание, это уже не `t`, а `m`. Как только появляется
 * дата или сумма — это `f`, а не строка в словаре.
 */
export type I18n = {
  locale: Locale;
  t: Dictionary;
  m: MessageFn;
  f: Format;
};

export function createI18n(locale: Locale, dictionary: Dictionary): I18n {
  return {
    locale,
    t: dictionary,
    m: createMessages(dictionary.meta.intl, dictionary),
    f: createFormat(dictionary.meta.intl),
  };
}
