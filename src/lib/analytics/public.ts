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
 * Адрес, который можно отдать: открытая страница без строки запроса
 * (кроме utm-меток) — в ссылке заявки лежит код приглашения. Адрес
 * закрытой страницы своего сайта (кабинет, ссылка отслеживания с кодом
 * в пути) сворачивается до корня сайта: он приходит как «откуда пришёл»,
 * когда человек из кабинета или со ссылки отслеживания открывает витрину.
 */
export function cleanUrl(value: string): string {
  try {
    const url = new URL(value);
    const own = /(^|\.)rahtis\.eu$/.test(url.hostname) || url.hostname === 'localhost';
    if (own && !isPublicPath(url.pathname)) return `${url.origin}/`;
    for (const key of [...url.searchParams.keys()]) {
      if (!key.startsWith('utm_')) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * Пройти все свойства события (вместе с вложенными $set, $set_once) и
 * вычистить всё, похожее на адрес: полные адреса — cleanUrl, пути
 * закрытых страниц ($prev_pageview_pathname и т. п.) — до «/».
 */
export function scrubProperties(value: unknown, depth = 0): unknown {
  if (depth > 4) return value;
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) return cleanUrl(value);
    if (value.startsWith('/') && !value.startsWith('//')) {
      const path = value.split(/[?#]/)[0];
      return isPublicPath(path) ? path : '/';
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => scrubProperties(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubProperties(v, depth + 1)]));
  }
  return value;
}
