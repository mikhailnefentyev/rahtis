import type { AddressSuggestion } from './types';

/**
 * Площадки, на которые платформа возит.
 *
 * Справочник появился потому, что геокодер на них плох. Замер: «Hanko
 * port» отдаёт водонапорную башню, «Hangon satama» — макаронную фабрику,
 * а адреса точек в реальных заказах получали оценку 3,8–6,1 при норме
 * 7,9–10,3 для настоящих адресов. То есть по названиям порты не ищутся, а
 * по адресам находятся приблизительно — и именно там, где ошибка стоит
 * дороже всего: километраж считается от этих точек, а километраж это
 * ставка.
 *
 * Адреса названы оператором, координаты взяты из ответа геокодера на эти
 * адреса, а не придуманы. Где геокодер не знает номера дома (Ханко),
 * координата приходится на улицу, а не на ворота: в пределах портовой
 * территории это сотни метров и на километраж не влияет, а водитель едет
 * по адресу, который написан точно.
 *
 * Хельсинки стоит четырьмя строками, а не одной: водитель едет не в
 * город, а в конкретную гавань, а между Вуосаари и Катаянокка
 * пятнадцать километров и полтора часа в пятницу вечером. Гавани названы
 * районами, а не операторами: Tallink стоит в двух из четырёх, а
 * Länsisatama делят Tallink и Eckerö. Оператор находится по слову.
 *
 * Länsiterminaali — единственная координата, взятая точкой интереса, а не
 * адресной: адресная точка Tyynenmerenkatu 8 приходится на середину
 * улицы в шестистах метрах от здания терминала.
 *
 * Список короткий и таким задуман: сюда попадает то, куда действительно
 * ездят. Всё остальное ищется у поставщика, как и раньше.
 */

export type CuratedPlace = {
  id: string;
  /** Как называется — по-фински, как написано на воротах. */
  name: string;
  address: string;
  city: string;
  /*
   * Страна двумя буквами. Весь нынешний справочник финский, но поле
   * обязательное: норвежский терминал, добавленный без него, тихо
   * поехал бы по финскому профилю грузовика.
   */
  country: string;
  position: { lat: number; lon: number };
  /**
   * По каким словам ищется. Русские и финские вперемешку: диспетчер
   * пишет и так, и так, иногда в одной строке.
   */
  terms: string[];
};

export const PLACES: CuratedPlace[] = [
  {
    id: 'hanko-port',
    name: 'Hangon satama',
    address: 'Korsmaninkatu 6, 10900 Hanko',
    city: 'Hanko',
    country: 'FI',
    position: { lat: 59.824178, lon: 22.96404 },
    terms: ['порт', 'ханко', 'hanko', 'hangon', 'satama', 'port', 'korsmaninkatu'],
  },
  {
    id: 'helsinki-vuosaari',
    name: 'Helsinki · Vuosaari',
    address: 'Satamakaari 24, 00980 Helsinki',
    city: 'Helsinki',
    country: 'FI',
    position: { lat: 60.213578, lon: 25.172049 },
    terms: [
      'хельсинки', 'вуосаари', 'helsinki', 'vuosaari', 'nordsjö', 'nordsjo',
      'satama', 'port', 'порт', 'satamakaari', 'rahti',
    ],
  },
  {
    id: 'helsinki-lansisatama',
    name: 'Helsinki · Länsisatama',
    address: 'Tyynenmerenkatu 8, 00220 Helsinki',
    city: 'Helsinki',
    country: 'FI',
    position: { lat: 60.149625, lon: 24.916633 },
    terms: [
      'хельсинки', 'лянсисатама', 'западный', 'helsinki', 'länsisatama', 'lansisatama',
      'länsiterminaali', 'lansiterminaali', 'jätkäsaari', 'jatkasaari', 'tyynenmerenkatu',
      'tallink', 'silja', 'таллинк', 'eckerö', 'eckero', 'ekerö', 'ekero', 'экерё', 'экере',
      'satama', 'port', 'порт',
    ],
  },
  {
    id: 'helsinki-etelasatama',
    name: 'Helsinki · Eteläsatama',
    address: 'Olympiaranta 1, 00140 Helsinki',
    city: 'Helsinki',
    country: 'FI',
    position: { lat: 60.160774, lon: 24.957726 },
    terms: [
      'хельсинки', 'этеля', 'этелясатама', 'южный', 'helsinki', 'eteläsatama', 'etelasatama',
      'olympiaterminaali', 'olympiaranta', 'olympia', 'олимпия',
      'tallink', 'silja', 'таллинк', 'силья', 'satama', 'port', 'порт',
    ],
  },
  {
    id: 'helsinki-katajanokka',
    name: 'Helsinki · Katajanokka',
    address: 'Katajanokanlaituri 8, 00160 Helsinki',
    city: 'Helsinki',
    country: 'FI',
    position: { lat: 60.163838, lon: 24.96835 },
    terms: [
      'хельсинки', 'катаянокка', 'helsinki', 'katajanokka', 'katajanokan',
      'katajanokanlaituri', 'viking', 'line', 'викинг', 'satama', 'port', 'порт',
    ],
  },
  {
    id: 'rauma-port',
    name: 'Rauman satama',
    address: 'Hakunintie 28, 26100 Rauma',
    city: 'Rauma',
    country: 'FI',
    position: { lat: 61.129872, lon: 21.466139 },
    terms: ['порт', 'раума', 'rauma', 'rauman', 'satama', 'port', 'hakunintie'],
  },
  {
    id: 'kotka-hietanen',
    name: 'Kotka · Hietanen',
    address: 'Murtajantie 2, 48100 Kotka',
    city: 'Kotka',
    country: 'FI',
    position: { lat: 60.479838, lon: 26.942221 },
    terms: [
      'порт', 'котка', 'хиетанен', 'kotka', 'hietanen', 'satama', 'port', 'murtajantie',
    ],
  },
  {
    id: 'naantali-port',
    name: 'Naantalin satama',
    address: 'Satamatie 13, 21100 Naantali',
    city: 'Naantali',
    country: 'FI',
    position: { lat: 60.457947, lon: 22.043417 },
    terms: ['порт', 'наантали', 'naantali', 'satama', 'port', 'satamatie'],
  },
  {
    id: 'turku-viking',
    name: 'Turku · Viking Line',
    address: 'Kuninkaantie, 20100 Turku',
    city: 'Turku',
    country: 'FI',
    position: { lat: 60.433165, lon: 22.222195 },
    terms: ['турку', 'викинг', 'turku', 'viking', 'line', 'satama', 'порт', 'port'],
  },
  {
    id: 'turku-silja',
    name: 'Turku · Silja Line',
    address: 'Linnankatu 91, 20100 Turku',
    city: 'Turku',
    country: 'FI',
    position: { lat: 60.435567, lon: 22.217776 },
    terms: [
      'турку', 'силья', 'сильялайн', 'turku', 'silja', 'tallink', 'line', 'satama', 'порт', 'port',
    ],
  },
];

/** Слова запроса без пунктуации и регистра. */
function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

/**
 * Площадки, подходящие под запрос.
 *
 * Совпадением считается начало слова, а не вхождение: «сила» не должна
 * находить Silja, а «силь» — должна. Все слова запроса обязаны найтись,
 * иначе «порт Ханко» отдавал бы заодно все остальные порты.
 */
export function findPlaces(query: string): CuratedPlace[] {
  const words = tokens(query);
  if (words.length === 0) return [];

  return PLACES.filter((place) =>
    words.every((word) => place.terms.some((term) => term.startsWith(word))),
  );
}

/**
 * Площадка в виде подсказки.
 *
 * Оценка выставляется выше всего, что приходит от поставщика: это не
 * догадка геокодера, а точка, названная оператором. Признак precise
 * поднят по той же причине — предупреждать «адрес найден неточно» о
 * собственном справочнике было бы странно.
 */
export function toSuggestion(place: CuratedPlace): AddressSuggestion {
  return {
    id: `place:${place.id}`,
    label: `${place.name} — ${place.address}`,
    city: place.city,
    country: place.country,
    postalCode: null,
    position: place.position,
    score: 100,
    precise: true,
  };
}

/**
 * Города справочника — для полосы направлений на витрине.
 *
 * Полоса перечисляла города строкой в разметке, а комментарий рядом
 * утверждал, что список «ровно тот же, что в справочнике». Два источника
 * одной правды: добавленный сюда порт на витрине не появлялся, убранный
 * — оставался обещанием, за которым уже ничего нет.
 *
 * Порядок — по стране, потом по имени: полоса читается как карта, а не
 * как случайный набор. Внутри страны алфавит, потому что другого
 * осмысленного порядка у портов нет.
 */
export function placeCities(): string[] {
  const seen = new Map<string, string>();

  for (const place of PLACES) {
    const key = `${place.country}|${place.city}`;
    if (!seen.has(key)) seen.set(key, place.city);
  }

  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, city]) => city);
}
