import { getDictionary } from './dictionaries';
import { createI18n, type I18n } from './bundle';
import type { Locale } from './config';

export { locales, defaultLocale, isLocale, matchLocale, LOCALE_COOKIE, LOCALE_NAMES } from './config';
export type { Locale } from './config';
export { getDictionary } from './dictionaries';
export type { Dictionary } from './dictionaries';
export { createI18n } from './bundle';
export type { I18n } from './bundle';
export type { MessageFn, MessageKey, MessageValues } from './message';

/**
 * Точка входа для серверных компонентов.
 *
 * Клиентские компоненты берут то же самое из контекста через useI18n() —
 * см. ./provider. Разные способы получить, один и тот же набор внутри.
 */
export async function getI18n(locale: Locale): Promise<I18n> {
  return createI18n(locale, await getDictionary(locale));
}
