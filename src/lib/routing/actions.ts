'use server';

import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { truckProfile } from './profiles';
import { tomtom } from './tomtom';
import { metresToKm, routeFingerprint, routingConfigured } from './index';
import type { AddressSuggestion, LatLon } from './types';

/**
 * Роутинг наружу — только через эти действия.
 *
 * Ключ TomTom живёт в переменной без префикса NEXT_PUBLIC_ и читается
 * внутри tomtom.ts, помеченного 'server-only'. Из браузера к поставщику
 * не ходит ни один запрос: иначе ключ уехал бы в бандл в первый же день,
 * а счёт за него пришёл бы нам.
 *
 * Оба действия закрыты ролью заказчика. Подсказка адресов — платный
 * вызов, и открывать её всем, кто может подобрать URL, значит платить
 * за чужой трафик.
 */

const provider = tomtom;

async function forbidden(locale: Locale) {
  return (await getDictionary(locale)).error.forbidden;
}

function toLocale(value: string | undefined): Locale {
  return value && isLocale(value) ? value : 'ru';
}

export type SuggestState =
  | { ok: true; suggestions: AddressSuggestion[] }
  | { ok: false; error: string };

/** Подсказка адреса при наборе. */
export async function suggestAddressAction(
  query: string,
  near?: LatLon,
  locale?: string,
): Promise<SuggestState> {
  const l = toLocale(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') {
    return { ok: false, error: await forbidden(l) };
  }

  /*
   * Порог в три символа держится и здесь, а не только в поле ввода.
   * Клиентскую задержку легко обойти, а платит за вызовы платформа.
   */
  const trimmed = query.trim();
  if (trimmed.length < 3) return { ok: true, suggestions: [] };

  if (!routingConfigured()) {
    return { ok: false, error: (await getDictionary(l)).routing.unavailable };
  }

  try {
    return { ok: true, suggestions: await provider.suggest(trimmed, { near }) };
  } catch {
    return { ok: false, error: (await getDictionary(l)).routing.suggestFailed };
  }
}

export type RouteState =
  | {
      ok: true;
      km: number;
      durationS: number;
      geometry: string;
      bounds: [number, number, number, number];
      fingerprint: string;
      legs: { distanceM: number; durationS: number }[];
    }
  | { ok: false; error: string };

/**
 * Расчёт пробега по точкам маршрута.
 *
 * Возвращает предложение, а не решение: подставлять ли результат в
 * distance_km, решает форма, и заказчик вправе его переписать. Ставка
 * считается от distance_km, поэтому молча менять это число нельзя.
 */
export async function computeRouteAction(
  points: LatLon[],
  countryCode = 'FI',
  locale?: string,
): Promise<RouteState> {
  const l = toLocale(locale);
  const t = await getDictionary(l);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER') {
    return { ok: false, error: await forbidden(l) };
  }

  if (points.length < 2) {
    return { ok: false, error: t.routing.needTwoPoints };
  }

  if (!routingConfigured()) {
    return { ok: false, error: t.routing.unavailable };
  }

  try {
    const result = await provider.route(points, truckProfile(countryCode));

    return {
      ok: true,
      km: metresToKm(result.distanceM),
      durationS: result.durationS,
      geometry: result.geometry,
      bounds: result.bounds,
      fingerprint: routeFingerprint(points, countryCode),
      legs: result.legs,
    };
  } catch {
    return { ok: false, error: t.routing.routeFailed };
  }
}
