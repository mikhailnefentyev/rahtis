import 'server-only';

import { boundsOf, encodePolyline } from './polyline';
import type {
  AddressSuggestion,
  LatLon,
  RoutingProvider,
  RouteResult,
  SuggestOptions,
  TruckProfile,
} from './types';

/**
 * TomTom Search и Routing.
 *
 * Выбран замером по Финляндии: грузовой профиль расходится с легковым до
 * 12,6 % (Turku → Rauma 102,6 км против 91,1), высотные ограничения
 * учитываются, геокодинг и подсказка по финским адресам работают.
 * Известное ограничение — весовые лимиты по Финляндии не учитываются;
 * на километраж это почти не влияет, но записано здесь, чтобы не
 * забылось при разборе жалобы на маршрут.
 *
 * Габариты у TomTom в МЕТРАХ, масса в килограммах. У HERE габариты в
 * сантиметрах — если появится вторая реализация, пересчёт делает она,
 * а не вызывающий код.
 */

const SEARCH = 'https://api.tomtom.com/search/2';
const ROUTING = 'https://api.tomtom.com/routing/1';

/**
 * Выдача ограничена странами работы: подсказка не должна звать в Испанию.
 *
 * Норвегия и Дания добавлены вместе с выходом на порты Скандинавии. Без
 * них норвежский терминал не находился вовсе — не «плохо находился», а
 * отсутствовал в выдаче, и адрес пришлось бы набирать руками, то есть
 * без координат, то есть без километража.
 */
const COUNTRIES = 'FI,SE,NO,DK';

function key(): string {
  const value = process.env.TOMTOM_KEY;
  if (!value) {
    throw new Error(
      'Не задан TOMTOM_KEY. Расчёт маршрута недоступен, километраж вводится вручную.',
    );
  }
  return value;
}

type TomTomAddress = {
  freeformAddress?: string;
  municipality?: string;
  /* Двухбуквенный код: по нему выбирается профиль грузовика. */
  countryCode?: string;
  postalCode?: string;
  streetNumber?: string;
};

type TomTomResult = {
  id: string;
  type: string;
  score: number;
  address: TomTomAddress;
  position: { lat: number; lon: number };
  /* Есть только у названных мест: порт, терминал, склад. */
  poi?: { name?: string };
};

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`TomTom ${response.status}: ${body.slice(0, 200)}`);
  }

  return (await response.json()) as T;
}

/**
 * Точный адрес с номером дома или что-то менее определённое.
 *
 * Geography означает центроид индекса или города — по такой точке маршрут
 * считать можно, но она не там, где ворота склада.
 */
function isPrecise(result: TomTomResult): boolean {
  return (
    result.type === 'Point Address' ||
    result.type === 'Address Range' ||
    /* У названного места координата — сама точка, а не середина округа. */
    result.type === 'POI'
  );
}

function toSuggestion(result: TomTomResult): AddressSuggestion {
  /*
   * У названного места в строке стоит имя, а не только адрес: «Hietanen
   * Port — Merituulentie 424» отвечает на вопрос «то ли это место»,
   * тогда как один адрес заставляет вспоминать, что там находится.
   */
  const address = result.address.freeformAddress ?? '';
  const name = result.poi?.name;

  return {
    id: result.id,
    label: name ? `${name} — ${address}` : address,
    city: result.address.municipality ?? null,
    country: result.address.countryCode ?? null,
    postalCode: result.address.postalCode ?? null,
    position: result.position ? { lat: result.position.lat, lon: result.position.lon } : null,
    score: result.score,
    precise: isPrecise(result),
  };
}

export const tomtom: RoutingProvider = {
  name: 'tomtom',

  async suggest(query, options: SuggestOptions = {}) {
    const params = new URLSearchParams({
      key: key(),
      typeahead: 'true',
      countrySet: COUNTRIES,
      limit: String(options.limit ?? 6),
      /*
       * Адреса, улицы, местности — и названные места.
       *
       * Addr — дома, которых нет отдельной точкой (PAD), но которые
       * поставщик выводит интерполяцией по диапазону номеров улицы. Его
       * отсутствие здесь было настоящим дефектом, а не экономией: без
       * Addr запрос «Tehtaankatu 1, 44100 Äänekoski» отдавал одну строку
       * «Tehtaankatu, 44100 Äänekoski» — улицу без дома. Такая подсказка
       * не проходит isPrecise, помечается в списке как «arvio», и
       * заказчик, видя вместо своего адреса улицу, набирает адрес руками.
       * А набранный руками адрес координат не имеет вовсе: не считается
       * маршрут, пустует километраж, точка не появляется на карте.
       *
       * Круг замыкался тем, что isPrecise с самого начала считает
       * 'Address Range' точным адресом — код ждал результатов, которые
       * запрос не просил. Замер: с Addr тот же запрос отдаёт «Tehtaankatu
       * 1, 44100 Äänekoski», тип Address Range, оценка 7,78.
       *
       * POI добавлен затем, что груз едет не на улицу, а в порт или на
       * терминал, и диспетчер знает их по имени. Замер по Финляндии:
       * «Kotka port» находит настоящие «Hietanen Port» и «New Port
       * Kotka», «Turku satama» — терминалы в Пансио. Покрытие при этом
       * неровное: у Ханко и Раумы портовых точек у поставщика нет, и
       * запрос отдаёт водонапорную башню и макаронную фабрику. Поэтому
       * POI стоит после адресов и ничего не вытесняет — он добавляет
       * попадания там, где они есть.
       */
      idxSet: 'PAD,Addr,Str,Geo,POI',
    });

    /*
     * Смещение к месту. Без него «Satamak» отдаёт Вааса и Коккола раньше
     * Ханко — проверено замером; с координатами нужная улица идёт первой.
     */
    if (options.near) {
      params.set('lat', String(options.near.lat));
      params.set('lon', String(options.near.lon));
      params.set('radius', '80000');
    }

    const data = await get<{ results?: TomTomResult[] }>(
      `${SEARCH}/search/${encodeURIComponent(query)}.json?${params}`,
    );

    return (data.results ?? []).map(toSuggestion);
  },

  async resolve(id) {
    const params = new URLSearchParams({ key: key(), entityId: id });

    const data = await get<{ results?: TomTomResult[] }>(`${SEARCH}/place.json?${params}`);
    const result = data.results?.[0];

    return result ? toSuggestion(result) : null;
  },

  async route(points: LatLon[], profile: TruckProfile): Promise<RouteResult> {
    if (points.length < 2) {
      throw new Error('Для маршрута нужны хотя бы две точки с координатами.');
    }

    const params = new URLSearchParams({
      key: key(),
      routeType: 'fastest',
      /*
       * Без пробок: километраж не должен зависеть от того, в какую минуту
       * заказчик нажал кнопку. Время в пути от этого становится оценкой
       * без пробок — для планирования этого достаточно.
       */
      traffic: 'false',
      travelMode: 'truck',
      vehicleCommercial: 'true',
      vehicleWeight: String(profile.grossWeightKg),
      vehicleAxleWeight: String(profile.weightPerAxleKg),
      vehicleHeight: String(profile.heightM),
      vehicleWidth: String(profile.widthM),
      vehicleLength: String(profile.lengthM),
    });

    const path = points.map((p) => `${p.lat},${p.lon}`).join(':');

    const data = await get<{
      routes?: {
        summary: { lengthInMeters: number; travelTimeInSeconds: number };
        legs?: {
          summary: { lengthInMeters: number; travelTimeInSeconds: number };
          points?: { latitude: number; longitude: number }[];
        }[];
      }[];
    }>(`${ROUTING}/calculateRoute/${path}/json?${params}`);

    const route = data.routes?.[0];
    if (!route) throw new Error('TomTom не вернул маршрут.');

    const legs = route.legs ?? [];

    const geometryPoints = legs.flatMap(
      (leg) => leg.points?.map((p) => ({ lat: p.latitude, lon: p.longitude })) ?? [],
    );

    return {
      distanceM: route.summary.lengthInMeters,
      durationS: route.summary.travelTimeInSeconds,
      legs: legs.map((leg) => ({
        distanceM: leg.summary.lengthInMeters,
        durationS: leg.summary.travelTimeInSeconds,
      })),
      geometry: encodePolyline(geometryPoints),
      bounds: boundsOf(geometryPoints.length > 0 ? geometryPoints : points),
    };
  },
};
