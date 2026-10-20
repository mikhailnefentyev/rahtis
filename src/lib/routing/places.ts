import { marketedCountries } from '@/lib/country';
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
  /*
   * Порты паромных коридоров Финляндии на юг — Прибалтика, Польша,
   * Германия, и шведские порты этих линий (пакет стран 21.10.2026).
   * Координаты сверены с OpenStreetMap: у паромного терминала — въезд
   * к терминалу, у контейнерного — сам терминал, а не офис порта.
   */
  {
    id: 'nynashamn-port',
    name: 'Nynäshamns hamn · färjeterminal',
    address: 'Fiskargränd, 149 31 Nynäshamn',
    city: 'Nynäshamn',
    country: 'SE',
    position: { lat: 58.900994, lon: 17.953058 },
    terms: ['нюнесхамн', 'nynashamn', 'hamn', 'порт', 'port', 'gdansk', 'ventspils', 'stena', 'polferries'],
  },
  {
    id: 'karlshamn-stilleryd',
    name: 'Karlshamn · Stilleryd (DFDS)',
    address: 'Stilleryd, 374 93 Karlshamn',
    city: 'Karlshamn',
    country: 'SE',
    position: { lat: 56.173149, lon: 14.819885 },
    terms: ['карлсхамн', 'karlshamn', 'stilleryd', 'dfds', 'klaipeda', 'hamn', 'порт', 'port'],
  },
  {
    id: 'ystad-port',
    name: 'Ystads hamn',
    address: 'Hamngatan, 271 22 Ystad',
    city: 'Ystad',
    country: 'SE',
    position: { lat: 55.428802, lon: 13.821164 },
    terms: ['истад', 'ystad', 'hamn', 'порт', 'port', 'swinoujscie', 'unity', 'polferries', 'ttline'],
  },
  {
    id: 'tallinn-muuga',
    name: 'Muuga sadam',
    address: 'Muuga sadam, 74115 Maardu',
    city: 'Maardu',
    country: 'EE',
    position: { lat: 59.493126, lon: 24.947656 },
    terms: ['мууга', 'muuga', 'таллин', 'tallinn', 'maardu', 'sadam', 'порт', 'port', 'vuosaari'],
  },
  {
    id: 'tallinn-vanasadam',
    name: 'Tallinna Vanasadam · D-terminal',
    address: 'Lootsi 13, 10151 Tallinn',
    city: 'Tallinn',
    country: 'EE',
    position: { lat: 59.44469, lon: 24.76993 },
    terms: ['таллин', 'tallinn', 'vanasadam', 'lootsi', 'tallink', 'eckero', 'viking', 'sadam', 'порт', 'port'],
  },
  {
    id: 'paldiski-lounasadam',
    name: 'Paldiski Lõunasadam',
    address: 'Lõunasadama tee, 76806 Paldiski',
    city: 'Paldiski',
    country: 'EE',
    position: { lat: 59.335083, lon: 24.07829 },
    terms: ['палдиски', 'paldiski', 'lounasadam', 'sadam', 'порт', 'port', 'kapellskar', 'dfds'],
  },
  {
    id: 'riga-ferry',
    name: 'Rīgas prāmju terminālis',
    address: 'Eksporta iela 3A, LV-1010 Rīga',
    city: 'Rīga',
    country: 'LV',
    position: { lat: 56.959292, lon: 24.094579 },
    terms: ['рига', 'riga', 'eksporta', 'tallink', 'stena', 'osta', 'порт', 'port'],
  },
  {
    id: 'ventspils-ferry',
    name: 'Ventspils prāmju terminālis',
    address: 'Prāmju iela, LV-3602 Ventspils',
    city: 'Ventspils',
    country: 'LV',
    position: { lat: 57.398982, lon: 21.571278 },
    terms: ['вентспилс', 'ventspils', 'stena', 'nynashamn', 'travemunde', 'osta', 'порт', 'port'],
  },
  {
    id: 'liepaja-port',
    name: 'Liepājas osta',
    address: 'Liepājas osta, LV-3405 Liepāja',
    city: 'Liepāja',
    country: 'LV',
    position: { lat: 56.52925, lon: 20.998345 },
    terms: ['лиепая', 'liepaja', 'stena', 'travemunde', 'osta', 'порт', 'port'],
  },
  {
    id: 'klaipeda-dfds',
    name: 'Klaipėda · Centrinis terminalas (DFDS)',
    address: 'Perkėlos g. 10, 93264 Klaipėda',
    city: 'Klaipėda',
    country: 'LT',
    position: { lat: 55.660757, lon: 21.146495 },
    terms: ['клайпеда', 'klaipeda', 'perkelos', 'dfds', 'kiel', 'karlshamn', 'uostas', 'порт', 'port'],
  },
  {
    id: 'gdynia-ferry',
    name: 'Gdynia · Terminal Promowy (Stena)',
    address: 'ul. Kwiatkowskiego 60, 81-127 Gdynia',
    city: 'Gdynia',
    country: 'PL',
    position: { lat: 54.546737, lon: 18.502472 },
    terms: ['гдыня', 'gdynia', 'kwiatkowskiego', 'stena', 'karlskrona', 'promowy', 'port', 'порт'],
  },
  {
    id: 'gdansk-westerplatte',
    name: 'Gdańsk · Terminal Westerplatte (Polferries)',
    address: 'ul. Majora Henryka Sucharskiego 2, 80-601 Gdańsk',
    city: 'Gdańsk',
    country: 'PL',
    position: { lat: 54.40357, lon: 18.681103 },
    terms: ['гданьск', 'gdansk', 'westerplatte', 'polferries', 'nynashamn', 'promowy', 'port', 'порт'],
  },
  {
    id: 'swinoujscie-ferry',
    name: 'Świnoujście · Terminal Promowy',
    address: 'ul. Dworcowa 3, 72-600 Świnoujście',
    city: 'Świnoujście',
    country: 'PL',
    position: { lat: 53.90097, lon: 14.257956 },
    terms: ['свиноуйсце', 'swinoujscie', 'unity', 'polferries', 'ttline', 'ystad', 'trelleborg', 'promowy', 'port', 'порт'],
  },
  {
    id: 'travemunde-skandinavienkai',
    name: 'Lübeck-Travemünde · Skandinavienkai',
    address: 'Skandinavienkai, 23570 Lübeck',
    city: 'Lübeck',
    country: 'DE',
    position: { lat: 53.941732, lon: 10.856759 },
    terms: ['травемюнде', 'любек', 'travemunde', 'lubeck', 'luebeck', 'skandinavienkai', 'finnlines', 'ttline', 'hafen', 'порт', 'port'],
  },
  {
    id: 'rostock-faehrterminal',
    name: 'Rostock · Fährterminal Überseehafen',
    address: 'Ost-West-Straße, 18147 Rostock',
    city: 'Rostock',
    country: 'DE',
    position: { lat: 54.146869, lon: 12.099999 },
    terms: ['росток', 'rostock', 'uberseehafen', 'ueberseehafen', 'ttline', 'stena', 'scandlines', 'hafen', 'порт', 'port'],
  },
  {
    id: 'kiel-ostuferhafen',
    name: 'Kiel · Ostuferhafen (DFDS)',
    address: 'Ostuferhafen, 24149 Kiel',
    city: 'Kiel',
    country: 'DE',
    position: { lat: 54.331696, lon: 10.173986 },
    terms: ['киль', 'kiel', 'ostuferhafen', 'dfds', 'klaipeda', 'hafen', 'порт', 'port'],
  },
  {
    id: 'kiel-norwegenkai',
    name: 'Kiel · Norwegenkai (Color Line)',
    address: 'Norwegenkai, 24143 Kiel',
    city: 'Kiel',
    country: 'DE',
    position: { lat: 54.31627, lon: 10.143546 },
    terms: ['киль', 'kiel', 'norwegenkai', 'colorline', 'color', 'oslo', 'hafen', 'порт', 'port'],
  },
  {
    id: 'kiel-schwedenkai',
    name: 'Kiel · Schwedenkai (Stena)',
    address: 'Schwedenkai, 24103 Kiel',
    city: 'Kiel',
    country: 'DE',
    position: { lat: 54.319076, lon: 10.137073 },
    terms: ['киль', 'kiel', 'schwedenkai', 'stena', 'goteborg', 'hafen', 'порт', 'port'],
  },
  {
    id: 'puttgarden-scandlines',
    name: 'Puttgarden · Scandlines',
    address: 'Fährhafen Puttgarden, 23769 Fehmarn',
    city: 'Fehmarn',
    country: 'DE',
    position: { lat: 54.484541, lon: 11.212905 },
    terms: ['путтгарден', 'puttgarden', 'fehmarn', 'scandlines', 'rodby', 'hafen', 'порт', 'port'],
  },
  {
    id: 'hamburg-ctb',
    name: 'Hamburg · Container Terminal Burchardkai',
    address: 'Waltershofer Damm, 21129 Hamburg',
    city: 'Hamburg',
    country: 'DE',
    position: { lat: 53.526977, lon: 9.930001 },
    terms: ['гамбург', 'hamburg', 'burchardkai', 'ctb', 'hhla', 'контейнер', 'container', 'terminal', 'hafen', 'порт', 'port'],
  },
  {
    id: 'hamburg-cta',
    name: 'Hamburg · Container Terminal Altenwerder',
    address: 'Altenwerder, 21129 Hamburg',
    city: 'Hamburg',
    country: 'DE',
    position: { lat: 53.504636, lon: 9.932809 },
    terms: ['гамбург', 'hamburg', 'altenwerder', 'cta', 'hhla', 'контейнер', 'container', 'terminal', 'hafen', 'порт', 'port'],
  },
  {
    id: 'bremerhaven-eurogate',
    name: 'Bremerhaven · EUROGATE Container Terminal',
    address: 'Senator-Borttscheller-Straße 1, 27568 Bremerhaven',
    city: 'Bremerhaven',
    country: 'DE',
    position: { lat: 53.579675, lon: 8.547411 },
    terms: ['бремерхафен', 'bremerhaven', 'eurogate', 'ntb', 'контейнер', 'container', 'terminal', 'hafen', 'порт', 'port'],
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
    /* Польская ł, как ø, нормализацией не раскладывается: «Białystok» → bialystok. */
    .replace(/ł/g, 'l')
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
 * Страны справочника — для полосы направлений на витрине.
 *
 * Полоса перечисляла двадцать девять городов четырьмя центрированными
 * строками разной длины. Список был честный, но читался как перенос по
 * ширине, а не как география: в строке FI двенадцать городов, в строке DK
 * четыре, и рваный край съедал всё, ради чего полосу заводили.
 *
 * Осталась страна. Четыре слова в строку говорят то же самое —
 * «Скандинавия целиком, а не один берег», — и говорят это с одного
 * взгляда.
 *
 * Выводится по-прежнему из справочника, а не переписывается в разметку.
 * Правило то же, ради которого сюда переехали города: убранная отсюда
 * страна не должна остаться на витрине обещанием, за которым уже нет
 * ни одного порта.
 */
export function placeCountries(): string[] {
  const present = new Set(PLACES.map((place) => place.country));

  /*
   * Порядок стран задан списком, а не алфавитом: Финляндия первой,
   * потому что оператор финский и оттуда идёт большинство рейсов, дальше
   * соседи по часовой стрелке вокруг Ботнического залива. Алфавит
   * поставил бы Данию во главе полосы, где ей нечего делать.
   */
  /*
   * Только объявленные страны (marketed в src/lib/country): порты
   * Прибалтики, Польши и Германии находятся в подсказке, но полосу
   * «откуда возим» не меняют, пока страну не объявили. Порядок — пакетов.
   */
  return marketedCountries().filter((code) => present.has(code));
}
