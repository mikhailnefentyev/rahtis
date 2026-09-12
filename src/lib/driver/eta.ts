import 'server-only';

import { operationsInstant } from '@/lib/dates';
import { metresToKm, routingConfigured, truckProfile } from '@/lib/routing';
import { findPlaces, toSuggestion } from '@/lib/routing/places';
import { normalizeQuery } from '@/lib/routing/query';
import { tomtom } from '@/lib/routing/tomtom';
import type { LatLon } from '@/lib/routing/types';
import { nextStop } from './calls';

/**
 * Сколько ехать до следующей точки и успевает ли водитель.
 *
 * Считает та же машина маршрутов, что считала километраж заказа, — и это
 * главное свойство ответа. Модель не складывает километры в уме и не
 * вспоминает, «часа три вроде»: число приходит от поставщика с грузовым
 * профилем, знающим про мосты и запреты для фур. Разойтись с диспетчером
 * оно поэтому не может — источник один.
 *
 * Пробки здесь включены, в отличие от расчёта заказа. Вопрос «успею ли к
 * 14:00» без них не имеет смысла: перед Вуосаари в пятницу вечером
 * теряется час, и ответ без пробок не просто неточен, а вреден.
 *
 * Точка отправления — со слов водителя. Своего положения платформа не
 * знает: GPS у неё нет, и выдумывать его она не станет. Нет слов — нет
 * расчёта, и агент обязан спросить, где человек находится.
 */

export type EtaFailure = { status: number; code: string; message: string };

export type Eta = {
  ref: string;
  from: string;
  to: string;
  role: string;
  distance_km: number;
  duration_minutes: number;
  /* Метка времени, а не «через сколько»: у водителя вопрос про часы. */
  arrival_at: string;
  scheduled_at: string | null;
  /* Плюс — опоздание, минус — запас. Ноль означает ровно вовремя. */
  late_minutes: number | null;
  traffic: true;
};

/**
 * Где водитель сейчас — в координаты.
 *
 * Сначала свой справочник площадок: «Вуосаари» и «Hanko satama» там
 * лежат с координатами ворот, выставленными оператором, и спрашивать о
 * них поставщика незачем. Потом геокодер — на всё остальное, от «Салo»
 * до «АЗС на седьмой дороге».
 *
 * Кириллица переводится тем же словарём, что и в форме заказа: водитель
 * пишет по-русски, а финские адреса по-русски не ищутся.
 *
 * Смещения к точке назначения здесь нет — и это главное отличие от
 * подсказки в форме заказа, где оно есть и помогает. Замер: с
 * координатами Вуосаари «Salo» отдаёт улицу Salotie в Хельсинки, «Lahti»
 * — Lahtisleden там же, «Kotka» — Kotkagatan. Без смещения все трое
 * находятся городами, где им и положено быть.
 *
 * Разница в том, что диспетчер в форме дописывает адрес и видит выдачу
 * глазами, а водитель называет город, за сто километров от цели, и
 * выдачу видит только машина. Ошибка тут не показывается человеку —
 * она выходит числом: сто десять километров превращаются в шестнадцать,
 * и водитель узнаёт об этом у закрытых ворот.
 */
async function locate(text: string): Promise<{ point: LatLon; label: string } | null> {
  const curated = findPlaces(text)[0];
  if (curated?.position) {
    const suggestion = toSuggestion(curated);
    return { point: curated.position, label: suggestion.label };
  }

  const found = await tomtom.suggest(normalizeQuery(text), { limit: 1 });
  const first = found.find((item) => item.position);

  return first?.position ? { point: first.position, label: first.label } : null;
}

export async function estimateArrival(
  phone: string,
  origin: string,
): Promise<{ data: Eta; failure: null } | { data: null; failure: EtaFailure }> {
  if (!routingConfigured()) {
    return {
      data: null,
      failure: { status: 503, code: 'routing_off', message: 'Расчёт маршрутов не настроен.' },
    };
  }

  const { data, failure } = await nextStop(phone);
  if (failure) return { data: null, failure };

  const stop = data as {
    ref: string;
    role: string;
    place: string | null;
    city: string | null;
    lat: number;
    lon: number;
    profile_country: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
  };

  const destination: LatLon = { lat: stop.lat, lon: stop.lon };

  const from = await locate(origin);
  if (!from) {
    return {
      data: null,
      failure: { status: 404, code: 'origin_unknown', message: 'Место отправления не найдено.' },
    };
  }

  let route;
  try {
    route = await tomtom.route([from.point, destination], truckProfile(stop.profile_country), {
      traffic: true,
    });
  } catch (cause) {
    /*
     * Отказ поставщика — не повод выдумать число. Агент скажет, что
     * посчитать не вышло, и это честнее любой оценки: водитель поверит
     * и тому и другому, но ошибётся только со второй.
     */
    return {
      data: null,
      failure: {
        status: 502,
        code: 'routing_failed',
        message: cause instanceof Error ? cause.message : 'Маршрут не посчитан.',
      },
    };
  }

  const arrival = Date.now() + route.durationS * 1000;

  const scheduled =
    stop.scheduled_date && stop.scheduled_time
      ? operationsInstant(stop.scheduled_date, stop.scheduled_time)
      : null;

  return {
    data: {
      ref: stop.ref,
      from: from.label,
      to: stop.place ?? stop.city ?? 'следующая точка',
      role: stop.role,
      distance_km: metresToKm(route.distanceM),
      duration_minutes: Math.round(route.durationS / 60),
      arrival_at: new Date(arrival).toISOString(),
      scheduled_at: scheduled === null ? null : new Date(scheduled).toISOString(),
      late_minutes: scheduled === null ? null : Math.round((arrival - scheduled) / 60_000),
      traffic: true,
    },
    failure: null,
  };
}
