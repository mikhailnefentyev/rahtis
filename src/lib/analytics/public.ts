/**
 * Где разрешена аналитика HeyCatch и что из адреса можно отдавать.
 *
 * Только витрина: главная, блог, заявка, условия, политика, описание API.
 * В кабинетах, приложении водителя и на ссылках отслеживания на экране
 * адреса, имена и номера машин — оттуда не уходит ни одно событие, даже
 * если посетитель согласился (решение 24.10.2026).
 */
export const CONSENT_KEY = 'rahtis-analytics';

const PUBLIC_PAGES = /^\/[a-z]{2}(\/(apply|terms|privacy|kayttoehdot|tietosuoja|api-docs|blog(\/[^/]+)?))?\/?$/;

export function isPublicPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/blog' || /^\/blog\/[^/]+\/?$/.test(pathname)) return true;
  return PUBLIC_PAGES.test(pathname);
}

/**
 * Адрес без строки запроса, кроме utm-меток: в ссылке заявки лежит код
 * приглашения (?invite=…), он не должен попасть к стороннему сервису.
 */
export function cleanUrl(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (!key.startsWith('utm_')) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}
