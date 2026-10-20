import 'server-only';

import { cache } from 'react';
import { getViewer } from '@/lib/auth/viewer';
import { APP } from '@/lib/config';
import { stopTimeZone } from '@/lib/country';
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

/** getI18n с временем по поясу компании зрителя — для страниц кабинетов. */
export async function getViewerI18n(locale: Locale): Promise<I18n> {
  const [dictionary, zone] = await Promise.all([getDictionary(locale), viewerTimeZone()]);
  return createI18n(locale, dictionary, zone);
}
