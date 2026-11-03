import 'server-only';

import { unstable_cache } from 'next/cache';
import { bbox, pickMessages, pickWeather, type Point, type RoadMessage, type RoadWeather } from './geo';

/**
 * Дорожная обстановка у оставшегося пути — открытые данные Fintraffic
 * Digitraffic (лицензия CC BY 4.0, ключ не нужен, просят заголовок
 * Digitraffic-User).
 *
 * Только Финляндия. Ответы кэшируются на 10 минут по коридору: ссылку
 * клиент обновляет часто, а данные у Fintraffic меняются не чаще.
 * Любая ошибка — пустой блок, страница от неё не зависит.
 */

const BASE = 'https://tie.digitraffic.fi';
const HEADERS = { 'Digitraffic-User': 'RAHTIS/1.0', 'Accept-Encoding': 'gzip', Accept: 'application/json' };

export type RoadConditions = { messages: RoadMessage[]; weather: RoadWeather[] };

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: HEADERS,
      /* Кэширует unstable_cache уже отфильтрованное: сырые ответы до мегабайтов. */
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const load = unstable_cache(
  async (key: string): Promise<RoadConditions | null> => {
    const route: Point[] = key.split(';').map((pair) => {
      const [lat, lon] = pair.split(',').map(Number);
      return { lat, lon };
    });
    if (route.length === 0 || route.some((p) => !Number.isFinite(p.lat) || !Number.isFinite(p.lon))) return null;

    const [xMin, yMin, xMax, yMax] = bbox(route);
    const area = `xMin=${xMin.toFixed(3)}&yMin=${yMin.toFixed(3)}&xMax=${xMax.toFixed(3)}&yMax=${yMax.toFixed(3)}`;

    type Features = { features?: Parameters<typeof pickMessages>[0] };
    const [announcements, roadworks, sections, forecasts] = await Promise.all([
      get<Features>(`/api/traffic-message/v2/traffic-announcements?${area}`),
      get<Features>(`/api/traffic-message/v2/roadworks?${area}`),
      get<{ features?: Parameters<typeof pickWeather>[0] }>(`/api/weather/v2/forecast-sections-simple?${area}`),
      get<{ forecastSections?: Parameters<typeof pickWeather>[1] }>(`/api/weather/v2/forecast-sections-simple/forecasts?${area}`),
    ]);
    /* Исключение, а не null: сбой Fintraffic не должен лечь в кэш на 10 минут. */
    if (!announcements && !roadworks && !forecasts) throw new Error('digitraffic unavailable');

    const now = Date.now();
    return {
      messages: pickMessages([...(announcements?.features ?? []), ...(roadworks?.features ?? [])], route, now),
      weather: pickWeather(sections?.features ?? [], forecasts?.forecastSections ?? [], route, now),
    };
  },
  ['track-road-conditions-v1'],
  { revalidate: 600 },
);

/**
 * Обстановка у коридора (точки в Финляндии, см. geo.corridor). Ключ кэша —
 * точки, округлённые до ~1 км: соседние просмотры одного рейса попадают
 * в одну запись.
 */
export async function roadConditions(route: Point[]): Promise<RoadConditions | null> {
  if (route.length === 0) return null;
  const key = route.map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`).filter((s, i, a) => s !== a[i - 1]).join(';');
  try {
    return await load(key);
  } catch {
    return null;
  }
}
