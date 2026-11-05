import 'server-only';

import { cache } from 'react';
import { getViewer } from '@/lib/auth/viewer';
import { APP } from '@/lib/config';
import { stopTimeZone } from '@/lib/country';
import type { MoneyContext } from '@/lib/format';
import { asCurrency } from '@/lib/money/currency';
import { latestFxRates } from '@/lib/money/fx';
import { createI18n, type I18n } from './bundle';
import type { Locale } from './config';
import { getDictionary } from './dictionaries';

/**
 * Часовой пояс компании того, кто смотрит: страна перевозчика или
 * заказчика (src/lib/country). Оператор и гость — по Хельсинки: оператор
 * финский, а гостю время событий не показывается.
 *
 * Для страниц кабинетов, где зритель и так известен; публичные страницы
 * берут getI18n и вход не проверяют.
 */
export const viewerTimeZone = cache(async (): Promise<string> => {
  try {
    const viewer = await getViewer();
    if (viewer.status !== 'ready' || viewer.role === 'ADMIN' || !viewer.company) return APP.timeZone;
    return stopTimeZone(viewer.company.country);
  } catch {
    return APP.timeZone;
  }
});

/**
 * Деньги зрителя: рабочая валюта компании и последние курсы ЕЦБ.
 * Оператор и гость — евро (деньги платформы).
 */
export const viewerMoney = cache(async (): Promise<MoneyContext> => {
  try {
    const viewer = await getViewer();
    if (viewer.status !== 'ready' || viewer.role === 'ADMIN' || !viewer.company) {
      return { currency: 'EUR', rates: null };
    }
    const currency = asCurrency((viewer.company as { currency?: string }).currency, 'EUR');
    return { currency, rates: await latestFxRates() };
  } catch {
    return { currency: 'EUR', rates: null };
  }
});

/** getI18n с временем и валютой компании зрителя — для страниц кабинетов. */
export async function getViewerI18n(locale: Locale): Promise<I18n> {
  const [dictionary, zone, money] = await Promise.all([getDictionary(locale), viewerTimeZone(), viewerMoney()]);
  return createI18n(locale, dictionary, zone, money);
}
