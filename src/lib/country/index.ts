/**
 * Пакеты стран: всё, что на платформе зависит от страны компании или
 * точки маршрута, — в одном месте.
 *
 * До пакетов Финляндия была зашита по коду: Y-tunnus в заявке, PRH как
 * единственный реестр, адреса только по FI/SE/NO/DK, часовой пояс точки —
 * только для пяти стран. Компания из Эстонии или Польши не могла даже
 * подать заявку. Теперь страна — это запись здесь; добавить страну —
 * дописать запись, а не искать по коду все места, где стоит 'FI'.
 *
 * Модуль без импортов из приложения: его читают и сервер, и клиент
 * (форма заявки), и тесты (country.test.mjs).
 *
 * Чего здесь нет и что остаётся решением, а не настройкой: на каких языках
 * открыт кабинет (src/lib/i18n/config.ts), по какому праву заключён договор
 * (оператор финский — финское право для всех стран), в какой валюте
 * считаются деньги (платформа считает в евро; местная валюта страны пока
 * только справочно).
 */

export type CountryCode = 'FI' | 'SE' | 'NO' | 'DK' | 'EE' | 'LV' | 'LT' | 'PL' | 'DE' | 'RO';

export type RegistryKind =
  /** Финский PRH/YTJ: открытые данные, название, ALV, ennakkoperintä. */
  | 'PRH'
  /** VIES — общий реестр плательщиков НДС ЕС: действует ли номер, название и адрес (не во всех странах). */
  | 'VIES'
  /** Норвежский Enhetsregisteret (Brønnøysund): открытый API — название, MVA, банкротство, ликвидация. */
  | 'BRREG'
  /** Автоматической проверки нет — оператор смотрит реестр страны сам. */
  | 'MANUAL';

export type CountryPack = {
  code: CountryCode;
  /** Член ЕС: внутри ЕС услуги B2B без НДС по reverse charge, номер проверяется в VIES. */
  eu: boolean;
  /** Часовой пояс точек маршрута в этой стране (простой, опоздания, «сегодня» у точки). */
  timeZone: string;
  /** Местная валюта — справочно: деньги на платформе в евро. */
  currency: 'EUR' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'RON';
  /** Обычная ставка НДС страны, базисные пункты — справочно, для подсказок и отчётов. */
  vatStandardBps: number;
  /** Номер компании, по которому она уникальна на платформе. */
  businessId: {
    /** Как номер называется в стране — показывается рядом с полем. */
    label: string;
    example: string;
    /** Проверка формата и контрольной цифры по нормализованному виду. */
    isValid: (normalized: string) => boolean;
    /** Убрать пробелы, привести к виду, в котором номер хранится. */
    normalize: (raw: string) => string;
  };
  /** Номер плательщика НДС из номера компании, если он из него следует; иначе его спрашивают отдельно. */
  vatFromBusinessId: ((normalized: string) => string) | null;
  registry: RegistryKind;
  /** Ссылка на карточку компании в реестре страны для оператора. */
  registryUrl: ((normalized: string) => string) | null;
  /** Телефонный код по умолчанию для водителя и контакта. */
  phonePrefix: string;
  /** Индекс в адресе: по нему из строки адреса отделяется город. */
  postcode: RegExp;
  /** Компании из этой страны могут подать заявку (адреса ищутся шире — ADDRESS_COUNTRIES). */
  enabled: boolean;
  /** Страна названа на витрине как зона работы (лендинг, разметка). С 21.10.2026 — все страны пакетов: интерфейс есть на их языках. */
  marketed: boolean;
  /** Язык приложения водителя по умолчанию для перевозчика из этой страны (код из DRIVER_LOCALES, заглавными). */
  driverLanguage: string;
  /**
   * Примеры в подсказках форм: номер машины, город, адрес, место, имя.
   * Польский диспетчер видел «HKO-441», «Helsinki» и «Antti Nieminen» —
   * пример должен выглядеть как то, что он сам впишет (прогон 21.10.2026).
   */
  sample: { plate: string; city: string; address: string; place: string; person: string; email: string };
};

const digits = (s: string) => s.replace(/\D/g, '');

/** Сумма произведений цифр на веса. */
const weighted = (s: string, weights: number[]) => weights.reduce((sum, w, i) => sum + w * Number(s[i]), 0);

/* --- Проверки номеров. Каждая — по официальному алгоритму контрольной цифры. --- */

/** Y-tunnus: 7 цифр, дефис, контрольная (веса 7,9,10,5,8,4,2; остаток 1 недопустим). */
function validFiBusinessId(s: string): boolean {
  if (!/^\d{7}-\d$/.test(s)) return false;
  const r = weighted(s, [7, 9, 10, 5, 8, 4, 2]) % 11;
  if (r === 1) return false;
  return (r === 0 ? 0 : 11 - r) === Number(s[8]);
}

/** Luhn — шведский organisationsnummer. */
function luhn(s: string): boolean {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    let d = Number(s[s.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Норвежский organisasjonsnummer: 9 цифр, mod 11 с весами 3,2,7,6,5,4,3,2. */
function validNoOrgnr(s: string): boolean {
  if (!/^\d{9}$/.test(s)) return false;
  const r = 11 - (weighted(s, [3, 2, 7, 6, 5, 4, 3, 2]) % 11);
  const check = r === 11 ? 0 : r;
  return check !== 10 && check === Number(s[8]);
}

/** Датский CVR: 8 цифр, сумма с весами 2,7,6,5,4,3,2,1 делится на 11. */
function validDkCvr(s: string): boolean {
  return /^\d{8}$/.test(s) && weighted(s, [2, 7, 6, 5, 4, 3, 2, 1]) % 11 === 0;
}

/** Эстонский registrikood: 8 цифр, контрольная по двум рядам весов (1..7, затем 3..9). */
function validEeRegistrikood(s: string): boolean {
  if (!/^[1789]\d{7}$/.test(s)) return false;
  let r = weighted(s, [1, 2, 3, 4, 5, 6, 7]) % 11;
  if (r === 10) {
    r = weighted(s, [3, 4, 5, 6, 7, 8, 9]) % 11;
    if (r === 10) r = 0;
  }
  return r === Number(s[7]);
}

/** Польский NIP: 10 цифр, веса 6,5,7,2,3,4,5,6,7, остаток по 11 — последняя цифра. */
function validPlNip(s: string): boolean {
  if (!/^\d{10}$/.test(s)) return false;
  const r = weighted(s, [6, 5, 7, 2, 3, 4, 5, 6, 7]) % 11;
  return r !== 10 && r === Number(s[9]);
}

/** Немецкий USt-IdNr (цифровая часть): 9 цифр, ISO 7064 MOD 11,10. */
function validDeUstId(s: string): boolean {
  if (!/^\d{9}$/.test(s) || s[0] === '0') return false;
  let p = 10;
  for (let i = 0; i < 8; i++) {
    let sum = (Number(s[i]) + p) % 10;
    if (sum === 0) sum = 10;
    p = (2 * sum) % 11;
  }
  const check = (11 - p) % 10;
  return check === Number(s[8]);
}

/**
 * Румынский CUI (cod de identificare fiscală): 2–10 цифр, последняя —
 * контрольная. Без неё номер дополняется нулями слева до 9 цифр, сумма
 * произведений на ключ 7,5,3,2,1,7,5,3,2 умножается на 10, остаток по 11
 * (10 → 0) и есть контрольная цифра. Сверено на действующих компаниях
 * (eMAG 14399840, Petrom 1590082, Dacia 160796).
 */
function validRoCui(s: string): boolean {
  if (!/^\d{2,10}$/.test(s)) return false;
  const body = s.slice(0, -1).padStart(9, '0');
  let r = (weighted(body, [7, 5, 3, 2, 1, 7, 5, 3, 2]) * 10) % 11;
  if (r === 10) r = 0;
  return r === Number(s[s.length - 1]);
}

export const COUNTRY_PACKS: Record<CountryCode, CountryPack> = {
  FI: {
    code: 'FI',
    eu: true,
    timeZone: 'Europe/Helsinki',
    currency: 'EUR',
    vatStandardBps: 2550,
    businessId: {
      label: 'Y-tunnus',
      example: '1234567-8',
      isValid: validFiBusinessId,
      normalize: (raw) => {
        const d = digits(raw);
        return d.length === 8 ? `${d.slice(0, 7)}-${d[7]}` : raw.trim();
      },
    },
    vatFromBusinessId: (id) => `FI${digits(id)}`,
    registry: 'PRH',
    registryUrl: (id) => `https://tietopalvelu.ytj.fi/yritys/${encodeURIComponent(id)}`,
    phonePrefix: '+358',
    postcode: /\b\d{5}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'FI',
    sample: { plate: 'HKO-441', city: 'Helsinki', address: 'Satamakatu 1, 10900 Hanko', place: 'Hanko Port, Terminal 2', person: 'Antti Nieminen', email: 'antti@esimerkki.fi' },
  },
  SE: {
    code: 'SE',
    eu: true,
    timeZone: 'Europe/Stockholm',
    currency: 'SEK',
    vatStandardBps: 2500,
    businessId: {
      label: 'Organisationsnummer',
      example: '556677-8899',
      isValid: (s) => /^\d{6}-\d{4}$/.test(s) && luhn(digits(s)),
      normalize: (raw) => {
        const d = digits(raw);
        return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : raw.trim();
      },
    },
    vatFromBusinessId: (id) => `SE${digits(id)}01`,
    registry: 'VIES',
    registryUrl: null,
    phonePrefix: '+46',
    postcode: /\b\d{3}\s?\d{2}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'SV',
    sample: { plate: 'ABC 123', city: 'Göteborg', address: 'Skandiahamnen, 418 34 Göteborg', place: 'Göteborgs hamn, Skandiaterminalen', person: 'Erik Lindqvist', email: 'erik@exempel.se' },
  },
  NO: {
    code: 'NO',
    eu: false,
    timeZone: 'Europe/Oslo',
    currency: 'NOK',
    vatStandardBps: 2500,
    businessId: {
      label: 'Organisasjonsnummer',
      example: '923609016',
      isValid: validNoOrgnr,
      normalize: (raw) => digits(raw),
    },
    /* Норвегия не в ЕС: в VIES её нет — сверка по открытому Enhetsregisteret. */
    vatFromBusinessId: null,
    registry: 'BRREG',
    registryUrl: (id) => `https://virksomhet.brreg.no/oppslag/enheter/${encodeURIComponent(id)}`,
    phonePrefix: '+47',
    postcode: /\b\d{4}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'NO',
    sample: { plate: 'EL 12345', city: 'Oslo', address: 'Sydhavna, 0194 Oslo', place: 'Oslo havn, Sydhavna', person: 'Ola Nordmann', email: 'ola@eksempel.no' },
  },
  DK: {
    code: 'DK',
    eu: true,
    timeZone: 'Europe/Copenhagen',
    currency: 'DKK',
    vatStandardBps: 2500,
    businessId: {
      label: 'CVR-nummer',
      example: '25313763',
      isValid: validDkCvr,
      normalize: (raw) => digits(raw),
    },
    vatFromBusinessId: (id) => `DK${id}`,
    registry: 'VIES',
    registryUrl: (id) => `https://datacvr.virk.dk/enhed/virksomhed/${encodeURIComponent(id)}`,
    phonePrefix: '+45',
    postcode: /\b\d{4}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'DA',
    sample: { plate: 'AB 12 345', city: 'Aarhus', address: 'Hveensvej 1, 8000 Aarhus', place: 'Aarhus Havn, Containerterminal', person: 'Lars Jensen', email: 'lars@eksempel.dk' },
  },
  EE: {
    code: 'EE',
    eu: true,
    timeZone: 'Europe/Tallinn',
    currency: 'EUR',
    vatStandardBps: 2400,
    businessId: {
      label: 'Registrikood',
      example: '10137319',
      isValid: validEeRegistrikood,
      normalize: (raw) => digits(raw),
    },
    /* Номер плательщика НДС (KMKR) в Эстонии свой, из registrikood не выводится. */
    vatFromBusinessId: null,
    registry: 'VIES',
    registryUrl: (id) => `https://ariregister.rik.ee/est/company/${encodeURIComponent(id)}`,
    phonePrefix: '+372',
    postcode: /\b\d{5}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'ET',
    sample: { plate: '123 ABC', city: 'Tallinn', address: 'Lootsi 13, 10151 Tallinn', place: 'Tallinna Vanasadam, D-terminal', person: 'Jaan Tamm', email: 'jaan@naide.ee' },
  },
  LV: {
    code: 'LV',
    eu: true,
    timeZone: 'Europe/Riga',
    currency: 'EUR',
    vatStandardBps: 2100,
    businessId: {
      label: 'Reģistrācijas numurs',
      example: '40003032949',
      /* Контрольная цифра у латвийского номера есть не у всех старых номеров — проверяется длина. */
      isValid: (s) => /^[45]\d{10}$/.test(s),
      normalize: (raw) => digits(raw),
    },
    vatFromBusinessId: (id) => `LV${id}`,
    registry: 'VIES',
    registryUrl: null,
    phonePrefix: '+371',
    postcode: /\bLV-?\d{4}\b/i,
    enabled: true,
    marketed: true,
    driverLanguage: 'LV',
    sample: { plate: 'AB-1234', city: 'Rīga', address: 'Eksporta iela 3A, LV-1010 Rīga', place: 'Rīgas prāmju terminālis', person: 'Jānis Bērziņš', email: 'janis@piemers.lv' },
  },
  LT: {
    code: 'LT',
    eu: true,
    timeZone: 'Europe/Vilnius',
    currency: 'EUR',
    vatStandardBps: 2100,
    businessId: {
      label: 'Įmonės kodas',
      example: '110053842',
      isValid: (s) => /^\d{9}$/.test(s),
      normalize: (raw) => digits(raw),
    },
    /* Литовский PVM kodas свой (9 или 12 цифр), из кода предприятия не выводится. */
    vatFromBusinessId: null,
    registry: 'VIES',
    registryUrl: null,
    phonePrefix: '+370',
    postcode: /\bLT-?\d{5}\b/i,
    enabled: true,
    marketed: true,
    driverLanguage: 'LT',
    sample: { plate: 'ABC 123', city: 'Klaipėda', address: 'Perkėlos g. 10, 93264 Klaipėda', place: 'Klaipėda, Centrinis terminalas', person: 'Jonas Kazlauskas', email: 'jonas@pavyzdys.lt' },
  },
  PL: {
    code: 'PL',
    eu: true,
    timeZone: 'Europe/Warsaw',
    currency: 'PLN',
    vatStandardBps: 2300,
    businessId: {
      label: 'NIP',
      example: '5260250995',
      isValid: validPlNip,
      normalize: (raw) => digits(raw),
    },
    vatFromBusinessId: (id) => `PL${id}`,
    registry: 'VIES',
    registryUrl: (id) => `https://wl-api.mf.gov.pl/api/search/nip/${encodeURIComponent(id)}`,
    phonePrefix: '+48',
    postcode: /\b\d{2}-\d{3}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'PL',
    sample: { plate: 'GD 12345', city: 'Gdynia', address: 'ul. Kwiatkowskiego 60, 81-127 Gdynia', place: 'Gdynia, Terminal Promowy', person: 'Jan Kowalski', email: 'jan@przyklad.pl' },
  },
  DE: {
    code: 'DE',
    eu: true,
    timeZone: 'Europe/Berlin',
    currency: 'EUR',
    vatStandardBps: 1900,
    businessId: {
      /*
       * Единого номера компании в Германии нет: номер торгового реестра
       * (HRB) уникален только внутри суда. Транспортная компания,
       * работающая с другими странами ЕС, всегда имеет USt-IdNr — по нему
       * и различаем.
       */
      label: 'USt-IdNr.',
      example: '136695976',
      isValid: validDeUstId,
      normalize: (raw) => digits(raw.replace(/^\s*DE/i, '')),
    },
    vatFromBusinessId: (id) => `DE${id}`,
    registry: 'VIES',
    registryUrl: null,
    phonePrefix: '+49',
    postcode: /\b\d{5}\b/,
    enabled: true,
    marketed: true,
    driverLanguage: 'DE',
    sample: { plate: 'HH-AB 1234', city: 'Hamburg', address: 'Waltershofer Damm, 21129 Hamburg', place: 'Hamburg, Burchardkai', person: 'Max Mustermann', email: 'max@beispiel.de' },
  },
  /*
   * Румыния (16.11.2026): первый клиент оттуда попросил регистрацию.
   * Заявки и адреса — да; на витрине как зона работы пока не названа
   * (marketed: false). Кабинет и приложение водителя — на румынском
   * (словарь ro: src/lib/i18n/config.ts, DRIVER_LOCALES в driverLocale.ts).
   */
  RO: {
    code: 'RO',
    eu: true,
    timeZone: 'Europe/Bucharest',
    currency: 'RON',
    vatStandardBps: 2100,
    businessId: {
      /* CUI — он же cod fiscal; у плательщика НДС в VIES тот же номер с приставкой RO. */
      label: 'CUI (cod fiscal)',
      example: '14399840',
      isValid: validRoCui,
      normalize: (raw) => digits(raw.replace(/^\s*RO/i, '')),
    },
    /* Не всякая румынская фирма — плательщик НДС; если нет, VIES ответит «не найден», и оператор проверит в ONRC сам. */
    vatFromBusinessId: (id) => `RO${id}`,
    registry: 'VIES',
    registryUrl: null,
    phonePrefix: '+40',
    postcode: /\b\d{6}\b/,
    enabled: true,
    marketed: false,
    driverLanguage: 'RO',
    sample: { plate: 'B 123 ABC', city: 'Constanța', address: 'Incinta Port, 900900 Constanța', place: 'Port Constanța, Terminal Sud', person: 'Andrei Popescu', email: 'andrei@exemplu.ro' },
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRY_PACKS) as CountryCode[];

/*
 * Часовые пояса и «страны адресов» Европы (аудит 21.11.2026, 2.8).
 *
 * Таблица жила в eFTI (src/lib/efti/xml/common.ts); теперь её читают и
 * eFTI, и пояс точки маршрута (stopTimeZone) для стран вне пакетов, а SQL
 * app.stop_timezone повторяет её (country.test.mjs сверяет). Для стран с
 * несколькими поясами — основной (материковый).
 */
export const COUNTRY_TZ: Readonly<Record<string, string>> = {
  AL: 'Europe/Tirane', AT: 'Europe/Vienna', BA: 'Europe/Sarajevo', BE: 'Europe/Brussels',
  BG: 'Europe/Sofia', BY: 'Europe/Minsk', CH: 'Europe/Zurich', CY: 'Asia/Nicosia',
  CZ: 'Europe/Prague', DE: 'Europe/Berlin', DK: 'Europe/Copenhagen', EE: 'Europe/Tallinn',
  ES: 'Europe/Madrid', FI: 'Europe/Helsinki', FR: 'Europe/Paris', GB: 'Europe/London',
  GR: 'Europe/Athens', HR: 'Europe/Zagreb', HU: 'Europe/Budapest', IE: 'Europe/Dublin',
  IS: 'Atlantic/Reykjavik', IT: 'Europe/Rome', LI: 'Europe/Vaduz', LT: 'Europe/Vilnius',
  LU: 'Europe/Luxembourg', LV: 'Europe/Riga', MD: 'Europe/Chisinau', ME: 'Europe/Podgorica',
  MK: 'Europe/Skopje', MT: 'Europe/Malta', NL: 'Europe/Amsterdam', NO: 'Europe/Oslo',
  PL: 'Europe/Warsaw', PT: 'Europe/Lisbon', RO: 'Europe/Bucharest', RS: 'Europe/Belgrade',
  RU: 'Europe/Moscow', SE: 'Europe/Stockholm', SI: 'Europe/Ljubljana', SK: 'Europe/Bratislava',
  TR: 'Europe/Istanbul', UA: 'Europe/Kyiv',
};

/** Пояс страны по таблице; неизвестная — null (решает вызывающий). */
export function countryTimeZone(country: string | null | undefined): string | null {
  return COUNTRY_TZ[(country ?? '').toUpperCase()] ?? null;
}

/**
 * Страны, в которых ищутся адреса (TomTom countrySet) — шире, чем страны
 * заявок (CountryPack.enabled): рейс RO→HU→AT→DE строится через страны,
 * из которых компании на платформу не принимаются.
 * ЕС + ЕЭЗ (IS, LI, NO) + CH, GB, UA, MD, RS, TR, BA, MK, AL, ME.
 */
export const ADDRESS_COUNTRIES: readonly string[] = [
  // ЕС
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // ЕЭЗ вне ЕС
  'IS', 'LI', 'NO',
  // прочие страны рейсов
  'CH', 'GB', 'UA', 'MD', 'RS', 'TR', 'BA', 'MK', 'AL', 'ME',
];


export const isCountryCode = (c: unknown): c is CountryCode => typeof c === 'string' && c in COUNTRY_PACKS;

/**
 * Пакет страны; неизвестная или пустая страна — финский (так было до пакетов).
 * Для пояса точки в стране вне пакетов — stopTimeZone, не countryPack(...).timeZone.
 */
export function countryPack(code: string | null | undefined): CountryPack {
  const c = (code ?? '').toUpperCase();
  return isCountryCode(c) ? COUNTRY_PACKS[c] : COUNTRY_PACKS.FI;
}

/** Страны, из которых принимаются заявки (адреса ищутся шире — ADDRESS_COUNTRIES). */
export const enabledCountries = (): CountryCode[] => COUNTRY_CODES.filter((c) => COUNTRY_PACKS[c].enabled);

/** Страны, названные на витрине. */
export const marketedCountries = (): CountryCode[] => COUNTRY_CODES.filter((c) => COUNTRY_PACKS[c].marketed);

/**
 * Часовой пояс точки маршрута по её стране — то же, что app.stop_timezone в базе.
 * Страна пакета — пояс пакета; другая европейская (HU, NL, CZ…) — по COUNTRY_TZ;
 * пустая или неизвестная — Хельсинки, как было.
 */
export const stopTimeZone = (country: string | null | undefined): string => {
  const c = (country ?? '').toUpperCase();
  if (isCountryCode(c)) return COUNTRY_PACKS[c].timeZone;
  return countryTimeZone(c) ?? COUNTRY_PACKS.FI.timeZone;
};

/**
 * Телефонный код по языку экрана (вход водителя по коду, аудит 21.11.2026,
 * 2.13): ro → +40, pl → +48… Язык без своей страны пакета (en, ru) — +358,
 * как было: основные водители — у финских перевозчиков.
 */
export function phonePrefixForLocale(locale: string | null | undefined): string {
  const two = (locale ?? '').slice(0, 2).toUpperCase();
  /* Норвежский водитель — nb/nn, в пакете язык записан как NO. */
  const lang = two === 'NB' || two === 'NN' ? 'NO' : two;
  const code = COUNTRY_CODES.find((c) => COUNTRY_PACKS[c].driverLanguage === lang);
  return code ? COUNTRY_PACKS[code].phonePrefix : COUNTRY_PACKS.FI.phonePrefix;
}

/**
 * Номер в международном виде без национального «0» после кода страны:
 * «+40 0722 123 456» → «+40722123456», «0035804012345» → «+3584012345».
 * Только для кодов стран пакетов: у них «0» — префикс внутренней связи,
 * в международном номере его нет. Пробелы, скобки, дефисы убираются.
 */
export function normalizeIntlPhone(raw: string): string {
  let phone = raw.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  for (const c of COUNTRY_CODES) {
    const prefix = COUNTRY_PACKS[c].phonePrefix;
    if (phone.startsWith(`${prefix}0`)) return prefix + phone.slice(prefix.length).replace(/^0+/, '');
  }
  return phone;
}

/** Номер компании в виде для хранения и признак, что он верен для страны. */
export function checkBusinessId(country: string, raw: string): { normalized: string; valid: boolean } {
  const pack = countryPack(country);
  const normalized = pack.businessId.normalize(raw);
  return { normalized, valid: pack.businessId.isValid(normalized) };
}

/**
 * Где оператор смотрит компанию сам: карточка в реестре страны, а где
 * прямой ссылки нет — страница проверки VIES (номер вводится вручную).
 */
export function registryLink(country: string, businessId: string): string {
  const pack = countryPack(country);
  return pack.registryUrl?.(businessId) ?? 'https://ec.europa.eu/taxation_customs/vies/#/vat-validation';
}

/**
 * Подпись к номеру компании. Финской — переведённая подпись из словаря
 * («Y-tunnus», «Business ID (Y-tunnus)»…), остальным — как номер
 * называется в их стране (NIP, CVR-nummer…): «Y-tunnus» у польской
 * компании был бы неправдой. Пустая или неизвестная страна — финская,
 * как в countryPack.
 */
export function businessIdLabel(country: string | null | undefined, finnishLabel: string): string {
  const pack = countryPack(country);
  return pack.code === 'FI' ? finnishLabel : pack.businessId.label;
}

/**
 * Подпись к номеру чужой компании, когда страны под рукой нет (выдача
 * known_vehicles_for_shipper отдаёт только номер). Финский номер хранится
 * ровно как 1234567-8 (app.business_id_ok), номера других стран в таком
 * виде не хранятся — по виду и решаем: «Y-tunnus» или общая подпись.
 */
export function businessIdLabelByShape(businessId: string, genericLabel: string): string {
  return /^\d{7}-\d$/.test(businessId) ? COUNTRY_PACKS.FI.businessId.label : genericLabel;
}

/** Название реестра, с которым сверялась заявка, — в письме и карточке оператора. */
export function registryName(country: string): string {
  const pack = countryPack(country);
  return pack.registry === 'PRH' ? 'PRH' : pack.registry === 'VIES' ? 'VIES' : pack.registry === 'BRREG' ? 'Brønnøysund' : 'Rekisteri';
}

/** Номер плательщика НДС: из номера компании, если выводится, иначе введённый; в виде «XX…» без пробелов. */
export function vatNumberFor(country: string, businessId: string, entered: string | null | undefined): string | null {
  const pack = countryPack(country);
  if (pack.vatFromBusinessId) return pack.vatFromBusinessId(businessId);
  const v = (entered ?? '').replace(/[\s.-]/g, '').toUpperCase();
  if (!v) return null;
  /* Греция в VIES — EL, но здесь её нет; прочие — по коду страны. */
  return v.startsWith(pack.code) ? v : `${pack.code}${v}`;
}
