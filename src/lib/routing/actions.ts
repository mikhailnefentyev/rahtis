'use server';

import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { truckProfile } from './profiles';
import { tomtom } from './tomtom';
import { metresToKm, routeFingerprint, routingConfigured } from './index';
import { findPlaces, toSuggestion as placeSuggestion } from './places';
import { normalizeQuery } from './query';
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

  /*
   * Свои площадки — первыми и без обращения к поставщику.
   *
   * Они не догадка геокодера, а точки, названные оператором: у порта в
   * Ханко геокодер не знает даже номера дома, а «порт Раума» ищет как
   * улицу Porttitie. Заодно это самый дешёвый ответ из возможных —
   * подсказка вызывается на нажатие клавиши и стоит денег.
   */
  const own = findPlaces(trimmed).map(placeSuggestion);

  if (!routingConfigured()) {
    /* Без ключа справочник всё равно отвечает — это уже лучше пустоты. */
    return own.length > 0
      ? { ok: true, suggestions: own }
      : { ok: false, error: (await getDictionary(l)).routing.unavailable };
  }

  try {
    /*
     * Запрос переводится на язык данных: интерфейс русский, а места
     * финские, и «Порт Ханко» поставщик не найдёт никогда. Перевод стоит
     * здесь, а не в реализации: он про язык человека, а не про то, какой
     * поставщик отвечает.
     */
    const found = await provider.suggest(normalizeQuery(trimmed), { near });

    /*
     * Свои площадки не дублируются тем, что нашёл поставщик по тому же
     * адресу. Сравниваются именно адреса: в подписи названного места
     * впереди стоит имя, и целиком строки не совпали бы никогда —
     * «Ts Rauma Satama — Hakunintie 28» и «Порт Раума — Hakunintie 28»
     * это одна точка, названная по-разному.
     */
    const address = (label: string) =>
      label.includes(' — ') ? label.slice(label.indexOf(' — ') + 3) : label;
    const mine = new Set(own.map((s) => address(s.label)));

    return {
      ok: true,
      suggestions: [...own, ...found.filter((s) => !mine.has(address(s.label)))],
    };
  } catch {
    return own.length > 0
      ? { ok: true, suggestions: own }
      : { ok: false, error: (await getDictionary(l)).routing.suggestFailed };
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
