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

export type CountryCode = 'FI' | 'SE' | 'NO' | 'DK' | 'EE' | 'LV' | 'LT' | 'PL' | 'DE';

export type RegistryKind =
  /** Финский PRH/YTJ: открытые данные, название, ALV, ennakkoperintä. */
  | 'PRH'
  /** VIES — общий реестр плательщиков НДС ЕС: действует ли номер, название и адрес (не во всех странах). */
  | 'VIES'
  /** Автоматической проверки нет — оператор смотрит реестр страны сам. */
  | 'MANUAL';

export type CountryPack = {
  code: CountryCode;
  /** Член ЕС: внутри ЕС услуги B2B без НДС по reverse charge, номер проверяется в VIES. */
  eu: boolean;
  /** Часовой пояс точек маршрута в этой стране (простой, опоздания, «сегодня» у точки). */
  timeZone: string;
  /** Местная валюта — справочно: деньги на платформе в евро. */
  currency: 'EUR' | 'SEK' | 'NOK' | 'DKK' | 'PLN';
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
  /** Адреса ищутся в этой стране и компании из неё могут подать заявку. */
  enabled: boolean;
  /** Страна названа на витрине как зона работы (лендинг, разметка). С 21.10.2026 — все страны пакетов: интерфейс есть на их языках. */
  marketed: boolean;
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
    /* Норвегия не в ЕС: в VIES её нет, номер MVA — справочно. */
    vatFromBusinessId: null,
    registry: 'MANUAL',
    registryUrl: (id) => `https://virksomhet.brreg.no/oppslag/enheter/${encodeURIComponent(id)}`,
    phonePrefix: '+47',
    postcode: /\b\d{4}\b/,
    enabled: true,
    marketed: true,
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
  },
};

export const COUNTRY_CODES = Object.keys(COUNTRY_PACKS) as CountryCode[];

export const isCountryCode = (c: unknown): c is CountryCode => typeof c === 'string' && c in COUNTRY_PACKS;

/** Пакет страны; неизвестная или пустая страна — финский (так было до пакетов). */
export function countryPack(code: string | null | undefined): CountryPack {
  const c = (code ?? '').toUpperCase();
  return isCountryCode(c) ? COUNTRY_PACKS[c] : COUNTRY_PACKS.FI;
}

/** Страны, в которых ищутся адреса и из которых принимаются заявки. */
export const enabledCountries = (): CountryCode[] => COUNTRY_CODES.filter((c) => COUNTRY_PACKS[c].enabled);

/** Страны, названные на витрине. */
export const marketedCountries = (): CountryCode[] => COUNTRY_CODES.filter((c) => COUNTRY_PACKS[c].marketed);

/** Часовой пояс точки маршрута по её стране — то же, что app.stop_timezone в базе. */
export const stopTimeZone = (country: string | null | undefined) => countryPack(country).timeZone;

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

/** Название реестра, с которым сверялась заявка, — в письме и карточке оператора. */
export function registryName(country: string): string {
  const pack = countryPack(country);
  return pack.registry === 'PRH' ? 'PRH' : pack.registry === 'VIES' ? 'VIES' : 'Rekisteri';
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
