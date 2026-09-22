import 'server-only';

import { headers } from 'next/headers';
import { cache } from 'react';
import { createI18n, type I18n, type Locale } from '@/lib/i18n';
import {
  driverDictionary,
  isDriverLocale,
  matchDriverLocale,
  type DriverLocale,
} from '@/lib/i18n/driver';
import { getDriver } from './session';

/**
 * Язык приложения водителя.
 *
 * Порядок: выбор самого водителя в профиле, потом язык телефона из
 * Accept-Language, потом язык адреса страницы. Телефон спрашивается до
 * первого экрана, поэтому эстонец видит эстонский сразу, не листая
 * настройки.
 *
 * Кэш на запрос: страница водителя дёргает язык из нескольких мест, а
 * заголовки и сессия читаются один раз.
 */
export const driverLocaleOf = cache(async (locale: Locale): Promise<DriverLocale> => {
  const driver = await getDriver();
  if (isDriverLocale(driver?.app_language)) return driver.app_language;

  const header = (await headers()).get('accept-language');
  return matchDriverLocale(header) ?? locale;
});

/** Словарь и форматтеры страницы водителя — вместо общего getI18n. */
export const getDriverI18n = cache(async (locale: Locale): Promise<I18n> => {
  const driverLocale = await driverLocaleOf(locale);
  return createI18n(locale, await driverDictionary(locale, driverLocale));
});
