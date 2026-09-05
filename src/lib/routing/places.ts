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

  /* ── Suomi · pohjoinen ja itä ──────────────────────────────────── */

  {
    id: 'hamina-port',
    name: 'HaminaKotka · Hamina',
    address: 'Hiirenkarintie, 49460 Hamina',
    city: 'Hamina',
    country: 'FI',
    position: { lat: 60.539762, lon: 27.161054 },
    terms: ['хамина', 'hamina', 'haminakotka', 'satama', 'порт', 'port', 'hiirenkarintie'],
  },
  {
    id: 'pori-mantyluoto',
    name: 'Pori · Mäntyluoto',
    address: 'Merisatamantie 4, 28880 Pori',
    city: 'Pori',
    country: 'FI',
    position: { lat: 61.592165, lon: 21.493232 },
    terms: [
      'пори', 'мянтылуото', 'pori', 'mantyluoto', 'mäntyluoto', 'satama', 'порт', 'port',
      'merisatamantie',
    ],
  },
  {
    id: 'vaasa-wasaline',
    name: 'Vaasa · Wasaline',
    address: 'Laivanvarustajankatu 6, 65170 Vaasa',
    city: 'Vaasa',
    country: 'FI',
    position: { lat: 63.087635, lon: 21.557295 },
    terms: [
      'вааса', 'васа', 'васалайн', 'vaasa', 'vasa', 'wasaline', 'vaskiluoto', 'vasklot',
      'kvarken', 'merenkurkku', 'satama', 'порт', 'port',
    ],
  },
  {
    id: 'kokkola-port',
    name: 'Kokkolan satama',
    address: 'Satamatie 330, 67900 Kokkola',
    city: 'Kokkola',
    country: 'FI',
    position: { lat: 63.843609, lon: 23.058471 },
    terms: ['коккола', 'kokkola', 'karleby', 'satama', 'порт', 'port', 'satamatie'],
  },
  {
    id: 'oulu-oritkari',
    name: 'Oulu · Oritkari',
    address: 'Poikkimaantie 16, 90400 Oulu',
    city: 'Oulu',
    country: 'FI',
    position: { lat: 64.991073, lon: 25.426792 },
    terms: [
      'оулу', 'оритькари', 'oulu', 'uleaborg', 'oritkari', 'satama', 'порт', 'port',
      'poikkimaantie',
    ],
  },
  {
    id: 'kemi-ajos',
    name: 'Kemi · Ajos',
    address: 'Ajoksentie 708, 94900 Kemi',
    city: 'Kemi',
    country: 'FI',
    position: { lat: 65.668129, lon: 24.529924 },
    terms: ['кеми', 'айос', 'kemi', 'ajos', 'satama', 'порт', 'port', 'ajoksentie'],
  },

  /* ── Ruotsi ────────────────────────────────────────────────────── */

  {
    id: 'umea-holmsund',
    name: 'Umeå · Holmsund',
    address: 'Blå vägen 4, 913 32 Holmsund',
    city: 'Holmsund',
    country: 'SE',
    position: { lat: 63.681067, lon: 20.339712 },
    terms: [
      'умео', 'умеа', 'холмсунд', 'umea', 'holmsund', 'wasaline', 'kvarken',
      'hamn', 'satama', 'порт', 'port',
    ],
  },
  {
    id: 'stockholm-varta',
    name: 'Stockholm · Värtahamnen',
    address: 'Hamnpirsvägen 10, 115 41 Stockholm',
    city: 'Stockholm',
    country: 'SE',
    position: { lat: 59.351467, lon: 18.112716 },
    terms: [
      'стокгольм', 'вярта', 'вяртахамнен', 'stockholm', 'varta', 'vartahamnen',
      'tallink', 'silja', 'hamn', 'порт', 'port',
    ],
  },
  {
    id: 'stockholm-tegelvik',
    name: 'Stockholm · Tegelvikshamn',
    address: 'Stadsgården, Tegelvikshamn, 116 30 Stockholm',
    city: 'Stockholm',
    country: 'SE',
    position: { lat: 59.316, lon: 18.0958 },
    terms: [
      'стокгольм', 'стадсгорден', 'тегельвик', 'викинг', 'stockholm', 'stadsgarden',
      'tegelvik', 'tegelvikshamn', 'viking', 'line', 'hamn', 'порт', 'port',
    ],
  },
  {
    id: 'kapellskar',
    name: 'Kapellskär',
    address: 'Västra Kapellskär 8, 760 15 Gräddö',
    city: 'Kapellskär',
    country: 'SE',
    position: { lat: 59.722722, lon: 19.061172 },
    terms: [
      'капельскар', 'капельшер', 'kapellskar', 'graddo', 'finnlines',
      'hamn', 'порт', 'port',
    ],
  },
  {
    id: 'stockholm-norvik',
    name: 'Stockholm Norvik · Nynäshamn',
    address: 'Norvikvägen 18, 149 45 Nynäshamn',
    city: 'Nynäshamn',
    country: 'SE',
    position: { lat: 58.937555, lon: 17.9745 },
    terms: [
      'норвик', 'нюнесхамн', 'norvik', 'nynashamn', 'hutchison', 'hamn',
      'порт', 'port', 'container', 'kontti',
    ],
  },
  {
    id: 'goteborg-portentry',
    name: 'Göteborg · Port Entry',
    address: 'Ytterhamnsvägen 1, 418 78 Göteborg',
    city: 'Göteborg',
    country: 'SE',
    position: { lat: 57.701867, lon: 11.858883 },
    terms: [
      'гётеборг', 'гетеборг', 'goteborg', 'gothenburg', 'entry', 'apm',
      'skandiahamnen', 'hamn', 'порт', 'port', 'container', 'kontti',
    ],
  },
  {
    id: 'goteborg-stena-dk',
    name: 'Göteborg · Stena Danmarksterminalen',
    address: 'Emigrantvägen 20, 413 27 Göteborg',
    city: 'Göteborg',
    country: 'SE',
    position: { lat: 57.701187, lon: 11.946307 },
    terms: [
      'гётеборг', 'гетеборг', 'стена', 'goteborg', 'gothenburg', 'stena',
      'danmarksterminalen', 'emigrantvagen', 'hamn', 'порт', 'port',
    ],
  },
  {
    id: 'helsingborg-gate',
    name: 'Helsingborg · Central Gate',
    address: 'Massgodsleden 4, 252 28 Helsingborg',
    city: 'Helsingborg',
    country: 'SE',
    position: { lat: 56.028709, lon: 12.700896 },
    terms: [
      'хельсингборг', 'helsingborg', 'gate', 'hamn', 'порт', 'port', 'container', 'kontti',
      'massgodsleden',
    ],
  },
  {
    id: 'malmo-finnlines',
    name: 'Malmö · Finnlines',
    address: 'Lappögatan 3B, 211 24 Malmö',
    city: 'Malmö',
    country: 'SE',
    position: { lat: 55.629423, lon: 13.008892 },
    terms: [
      'мальмё', 'мальме', 'malmo', 'finnlines', 'norra', 'hamnen', 'hamn',
      'порт', 'port', 'lappogatan',
    ],
  },
  {
    id: 'trelleborg-port',
    name: 'Trelleborgs hamn',
    address: 'Norra Nyhamnsgatan 1A, 231 61 Trelleborg',
    city: 'Trelleborg',
    country: 'SE',
    position: { lat: 55.373539, lon: 13.142069 },
    terms: [
      'треллеборг', 'trelleborg', 'hamn', 'порт', 'port', 'rostock', 'travemunde',
      'nyhamnsgatan',
    ],
  },
  {
    id: 'stromstad-colorline',
    name: 'Strömstad · Color Line',
    address: 'Torskholmen, 452 31 Strömstad',
    city: 'Strömstad',
    country: 'SE',
    position: { lat: 58.935797, lon: 11.170935 },
    terms: [
      'стрёмстад', 'стремстад', 'stromstad', 'color', 'line', 'torskholmen',
      'hamn', 'порт', 'port',
    ],
  },

  /* ── Norja ─────────────────────────────────────────────────────── */

  {
    id: 'oslo-yilport',
    name: 'Oslo · Yilport, Sjursøya',
    address: 'Sjursøya 9, 0193 Oslo',
    city: 'Oslo',
    country: 'NO',
    position: { lat: 59.888232, lon: 10.755263 },
    terms: [
      'осло', 'шурсёйа', 'сюрсойа', 'oslo', 'yilport', 'sjursoya', 'havn',
      'порт', 'port', 'container', 'kontti',
    ],
  },
  {
    id: 'oslo-colorline',
    name: 'Oslo · Color Line, Hjortnes',
    address: 'Filipstadveien 16, 0250 Oslo',
    city: 'Oslo',
    country: 'NO',
    position: { lat: 59.909079, lon: 10.713785 },
    terms: [
      'осло', 'колорлайн', 'хьортнес', 'oslo', 'color', 'line', 'hjortnes', 'filipstad',
      'filipstadveien', 'kiel', 'havn', 'порт', 'port',
    ],
  },
  {
    id: 'oslo-vippetangen',
    name: 'Oslo · Vippetangen',
    address: 'Akershusstranda 31, 0150 Oslo',
    city: 'Oslo',
    country: 'NO',
    position: { lat: 59.90293, lon: 10.74314 },
    terms: [
      'осло', 'виппетанген', 'oslo', 'vippetangen', 'dfds', 'stena', 'akershusstranda',
      'havn', 'порт', 'port',
    ],
  },
  {
    id: 'larvik-colorline',
    name: 'Larvik · Color Line',
    address: 'Revet 8, 3263 Larvik',
    city: 'Larvik',
    country: 'NO',
    position: { lat: 59.040573, lon: 10.047404 },
    terms: [
      'ларвик', 'larvik', 'color', 'line', 'revet', 'hirtshals', 'havn', 'порт', 'port',
    ],
  },
  {
    id: 'kristiansand-colorline',
    name: 'Kristiansand · Color Line',
    address: 'Vestre Strandgate 31, 4611 Kristiansand',
    city: 'Kristiansand',
    country: 'NO',
    position: { lat: 58.144565, lon: 7.991197 },
    terms: [
      'кристиансанн', 'kristiansand', 'color', 'line', 'havn', 'порт', 'port',
    ],
  },
  {
    id: 'sandefjord-colorline',
    name: 'Sandefjord · Color Line',
    address: 'Strandpromenaden 20, 3210 Sandefjord',
    city: 'Sandefjord',
    country: 'NO',
    position: { lat: 59.126944, lon: 10.228017 },
    terms: [
      'сандефьорд', 'sandefjord', 'color', 'line', 'stromstad', 'havn',
      'порт', 'port',
    ],
  },

  /* ── Tanska ────────────────────────────────────────────────────── */

  {
    id: 'frederikshavn-dfds',
    name: 'Frederikshavn · DFDS',
    address: 'Færgehavnsvej 31, 9900 Frederikshavn',
    city: 'Frederikshavn',
    country: 'DK',
    position: { lat: 57.43459, lon: 10.537014 },
    terms: [
      'фредериксхавн', 'frederikshavn', 'dfds', 'faergehavnsvej', 'havn', 'порт', 'port',
    ],
  },
  {
    id: 'frederikshavn-stena',
    name: 'Frederikshavn · Stena Line',
    address: 'Færgehavnsvej 10, 9900 Frederikshavn',
    city: 'Frederikshavn',
    country: 'DK',
    position: { lat: 57.434581, lon: 10.54364 },
    terms: [
      'фредериксхавн', 'стена', 'frederikshavn', 'stena', 'line', 'havn', 'порт', 'port',
    ],
  },
  {
    id: 'hirtshals-colorline',
    name: 'Hirtshals · Color Line',
    address: 'Dalsagervej 5, 9850 Hirtshals',
    city: 'Hirtshals',
    country: 'DK',
    position: { lat: 57.576132, lon: 9.986374 },
    terms: [
      'хиртсхальс', 'hirtshals', 'color', 'line', 'dalsagervej', 'havn', 'порт', 'port',
    ],
  },
  {
    id: 'kobenhavn-dfds',
    name: 'København · DFDS',
    address: 'Dampfærgevej 30, 2100 København Ø',
    city: 'København',
    country: 'DK',
    position: { lat: 55.70116, lon: 12.595405 },
    terms: [
      'копенгаген', 'kobenhavn', 'copenhagen', 'dfds', 'dampfaergevej',
      'havn', 'порт', 'port',
    ],
  },
  {
    id: 'esbjerg-dfds',
    name: 'Esbjerg · DFDS',
    address: 'Zodiakvej 5, 6700 Esbjerg',
    city: 'Esbjerg',
    country: 'DK',
    position: { lat: 55.453823, lon: 8.488956 },
    terms: [
      'эсбьерг', 'esbjerg', 'dfds', 'zodiakvej', 'immingham', 'havn', 'порт', 'port',
    ],
  },
];

/**
 * Скандинавские буквы к латинским.
 *
 * Диспетчер пишет «Göteborg» и «Mäntyluoto» правильно, а в списке слов
 * они записаны без диакритики — и поиск не находил ничего. Держать в
 * terms оба написания каждого слова значит удваивать список и всё равно
 * забыть половину: у одного порта их пять.
 *
 * Складываются обе стороны, поэтому неважно, кто как написал. Норвежские
 * ø и æ и датское å нормализацией не раскладываются — их приходится
 * называть поимённо.
 */
function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Слова запроса без пунктуации, регистра и диакритики. */
function tokens(query: string): string[] {
  return fold(query)
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
    words.every((word) => place.terms.some((term) => fold(term).startsWith(word))),
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
export function placeCities(): { country: string; cities: string[] }[] {
  const byCountry = new Map<string, Set<string>>();

  for (const place of PLACES) {
    const cities = byCountry.get(place.country) ?? new Set<string>();
    cities.add(place.city);
    byCountry.set(place.country, cities);
  }

  /*
   * Порядок стран задан списком, а не алфавитом: Финляндия первой,
   * потому что оператор финский и оттуда идёт большинство рейсов, дальше
   * соседи по часовой стрелке вокруг Ботнического залива. Алфавит
   * поставил бы Данию во главе полосы, где ей нечего делать.
   */
  const order = ['FI', 'SE', 'NO', 'DK'];

  return order
    .filter((code) => byCountry.has(code))
    .map((code) => ({
      country: code,
      cities: [...byCountry.get(code)!].sort((a, b) => a.localeCompare(b, 'sv')),
    }));
}
