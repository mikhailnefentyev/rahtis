/**
 * Где искать запчасть и шины: поставщики грузовых запчастей, разборки,
 * площадки объявлений, шинные сети и дилеры — по стране перевозчика.
 *
 * Открытого API с ценой и наличием нет ни у кого (docs/parts/research-
 * suppliers.md, research-countries.md), а robots.txt у части сайтов
 * запрещает разбор страниц. Поэтому — только прямые ссылки: поиск
 * открывается у поставщика с уже подставленным номером или размером,
 * цену и наличие перевозчик видит у него. Страниц мы не читаем.
 *
 * Шаблоны поиска проверены в браузере 29.10.2026 (Финляндия — 28.10).
 * Где поиск по ссылке не открывается (B2B со входом, защита от ботов) —
 * ссылка на сайт и телефон, а для запроса цены — готовый текст.
 *
 * Без зависимостей: модуль читают тесты (node --test) и клиентский
 * компонент страницы.
 */

export const PARTS_COUNTRIES = ['FI', 'SE', 'NO', 'EE', 'LV', 'LT', 'PL', 'DE'] as const;
export type PartsCountry = (typeof PARTS_COUNTRIES)[number];

export type PartsMode = 'PARTS' | 'TYRES';

export type PartsQuery = { query: string; make: string | null; plate: string | null };

export type PartsSource = {
  id: string;
  name: string;
  kind: 'NEW' | 'USED' | 'DEALER' | 'WEB' | 'TYRES';
  /** Цены видны без входа. */
  pricesPublic: boolean;
  /** Ссылка с подставленным запросом или страница поставщика. */
  url: string;
  /** Поиск сразу по номеру или размеру (а не только сайт поставщика). */
  direct: boolean;
  email?: string;
  phone?: string;
  /** Есть круглосуточная выездная помощь (шины). */
  mobile24?: boolean;
  /** Срок доставки в страну перевозчика, дней («1–2»), если поставщик из соседней страны. */
  deliveryDays?: string;
};

/** Круглосуточная помощь при проколе шины в пути — номера опубликованы сетями. */
export type Breakdown = { name: string; phone: string; url: string; contractOnly: boolean };

export function partsCountry(value: string | null | undefined): PartsCountry {
  const v = String(value ?? '').toUpperCase();
  return (PARTS_COUNTRIES as readonly string[]).includes(v) ? (v as PartsCountry) : 'FI';
}

/** Номер детали: буквы и цифры без пробелов, хотя бы одна цифра. */
export function looksLikePartNumber(value: string): boolean {
  const v = value.replace(/[\s.\-/]/g, '');
  return /^[A-Za-z0-9]{4,24}$/.test(v) && /\d/.test(v);
}

export function compactNumber(value: string): string {
  return value.replace(/[\s.\-/]/g, '').toUpperCase();
}

/** Размер шины «315/80R22.5», «315/80 R 22,5», «385/65r22.5» → части; иначе null. */
export function parseTyreSize(value: string): { width: string; profile: string; rim: string } | null {
  const m = /^\s*(\d{3})\s*\/\s*(\d{2})\s*R?\s*(\d{2}(?:[.,]5)?)\s*$/i.exec(value.replace(/\s+R\s*/i, 'R'));
  if (!m) return null;
  return { width: m[1], profile: m[2], rim: m[3].replace(',', '.') };
}

/** Размер в виде, как его пишут каталоги: 315/80R22.5. */
export function normalTyreSize(value: string): string {
  const size = parseTyreSize(value);
  return size ? `${size.width}/${size.profile}R${size.rim}` : value.trim();
}

/** Base64 от UTF-8 — так Inter Cars в Прибалтике кладёт запрос в адрес. Работает и в браузере, и в Node. */
export function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

const enc = encodeURIComponent;

/* ── Дилеры марки ─────────────────────────────────────────────── */

const DEALERS: Record<string, { name: string; fi: string; intl: string }> = {
  VOLVO: { name: 'Volvo Trucks', fi: 'https://www.volvotrucks.fi/fi-fi/services/parts-accessories/parts.html', intl: 'https://www.volvotrucks.com' },
  SCANIA: { name: 'Scania', fi: 'https://www.scania.com/fi/fi/home.html', intl: 'https://www.scania.com' },
  MAN: { name: 'MAN · partslink24', fi: 'https://www.partslink24.com', intl: 'https://www.partslink24.com' },
  MERCEDES: { name: 'Mercedes-Benz B2B Connect', fi: 'https://b2bconnect.mercedes-benz.com/fi', intl: 'https://b2bconnect.mercedes-benz.com' },
  DAF: { name: 'DAF Parts Online', fi: 'https://parts.daf.com', intl: 'https://parts.daf.com' },
  IVECO: { name: 'Iveco', fi: 'https://www.iveco.com', intl: 'https://www.iveco.com' },
  RENAULT: { name: 'Renault Trucks', fi: 'https://www.renault-trucks.fi', intl: 'https://www.renault-trucks.com' },
};

export function dealerKey(make: string | null): string | null {
  const m = String(make ?? '').toUpperCase();
  if (m.includes('MERCEDES') || m.includes('BENZ')) return 'MERCEDES';
  return Object.keys(DEALERS).find((k) => m.includes(k)) ?? null;
}

/* ── Каталог по странам ───────────────────────────────────────── */

type Ctx = { text: string; number: string | null; size: string };
type Entry = Omit<PartsSource, 'url'> & { url: (c: Ctx) => string };

const site = (url: string) => () => url;

/* Inter Cars: одна сеть на всю Прибалтику, запрос — Base64 в пути, цены открыты. */
const interCars = (id: string, host: string, path: string, phone?: string): Entry => ({
  id,
  name: 'Inter Cars',
  kind: 'NEW',
  pricesPublic: true,
  direct: true,
  phone,
  url: (c) => `${host}/${path}/search=${base64(c.number ?? c.text)}`,
});
const interCarsTyres = (id: string, host: string, path: string): Entry => ({
  id,
  name: 'Inter Cars',
  kind: 'TYRES',
  pricesPublic: true,
  direct: true,
  url: (c) => `${host}/${path}/search=${base64(c.size)}`,
});
const autoline = (id: string, host: string, extra = ''): Entry => ({
  id,
  name: 'Autoline',
  kind: 'USED',
  pricesPublic: true,
  direct: true,
  url: (c) => `${host}/search_text.php?query=${enc(c.number ?? c.text)}${extra}`,
});

/*
 * Inter Cars своего магазина в Финляндии не держит (intercars.fi — пустой
 * домен, 29.10.2026), но возит в Финляндию из Эстонии за 1–2 дня (слова
 * пользователя). Поиск — тот же эстонский магазин.
 */
const interCarsFi: Entry = { ...interCars('ic-fi', 'https://www.intercars24.ee', 'autoosad'), deliveryDays: '1–2' };
const interCarsFiTyres: Entry = { ...interCarsTyres('ic-fi-t', 'https://www.intercars24.ee', 'autoosad'), deliveryDays: '1–2' };

const PARTS: Record<PartsCountry, Entry[]> = {
  FI: [
    { id: 'raskassarja', name: 'Raskassarja 24/7', kind: 'NEW', pricesPublic: true, direct: true, url: (c) => `https://raskassarja247.fi/fin/haku?s=${enc(c.number ?? c.text)}` },
    {
      id: 'varaosahaku',
      name: 'Varaosahaku.fi (purkamot)',
      kind: 'USED',
      pricesPublic: true,
      direct: true,
      url: (c) =>
        c.number
          ? `https://www.varaosahaku.fi/fi-fi/OEM/${enc(c.number)}`
          : `https://www.varaosahaku.fi/fi-fi/pb/Hae/Autonosat/s15/FTS?query=${enc(c.text)}`,
    },
    interCarsFi,
    { id: 'skuba', name: 'Skuba', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://ems.skuba.eu/login'), email: 'info@skuba.fi', phone: '0400 140 900' },
    { id: 'tavo', name: 'TAVO / ProTruck', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://protruck.fi') },
    { id: 'raskasvaraosa', name: 'Raskasvaraosa.fi', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://raskasvaraosa.fi') },
    { id: 'truck1', name: 'Truck1 · varaosat', kind: 'USED', pricesPublic: true, direct: false, url: site('https://www.truck1.fi/varaosat-kuorma-autot') },
  ],
  EE: [
    interCars('ic-ee', 'https://www.intercars24.ee', 'autoosad'),
    { id: 'skuba-ee', name: 'Skuba Eesti', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://ems.skuba.eu/login'), phone: '+372 5855 2225' },
    { id: 'tsvaruosad', name: 'TSVaruosad', kind: 'NEW', pricesPublic: true, direct: true, url: (c) => `https://tsvaruosad.ee/?s=${enc(c.number ?? c.text)}&post_type=product`, email: 'info@tsvaruosad.ee', phone: '+372 5811 6804' },
    {
      id: 'auto24',
      name: 'auto24.ee',
      kind: 'USED',
      pricesPublic: true,
      direct: true,
      url: (c) => `https://www.auto24.ee/products/search_result_product.php?cid=0&_sm=1&ad_type=1&cat[0][text]=${enc(c.number ?? c.text)}`,
    },
    autoline('autoline-ee', 'https://autoline.ee'),
  ],
  LV: [
    interCars('ic-lv', 'https://www.ic24.lv', 'detalas'),
    { id: 'skuba-lv', name: 'Skuba Latvija', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://ems.skuba.eu/login'), email: 'info@skuba.lv', phone: '+371 6735 7775' },
    { id: 'sslv', name: 'SS.LV', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.ss.lv/lv/search-result/?q=${enc(c.number ?? c.text)}` },
    autoline('autoline-lv', 'https://autoline.lv'),
  ],
  LT: [
    interCars('ic-lt', 'https://ic24.lt', 'dalys', '+370 700 88 288'),
    { id: 'skuba-lt', name: 'Skuba Lietuva', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://ems.skuba.eu/login'), email: 'info@skuba.lt', phone: '+370 5 255 3484' },
    autoline('autoline-lt', 'https://autoline.lt'),
    { id: 'egda', name: 'EGDA Truckparts (purkamo)', kind: 'USED', pricesPublic: true, direct: false, url: site('https://egda.lt') },
  ],
  PL: [
    { id: 'intercars-pl', name: 'Inter Cars', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://intercars.pl') },
    { id: 'martex', name: 'Martex Truck', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://b2b.martextruck.pl'), phone: '+48 32 439 08 10' },
    { id: 'allegro', name: 'Allegro', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://allegro.pl/listing?string=${enc(c.number ?? c.text)}` },
    { id: 'otomoto', name: 'Otomoto · części', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.otomoto.pl/czesci/q-${enc(c.number ?? c.text)}` },
    autoline('autoline-pl', 'https://autoline.com.pl', '&cat_id=456'),
  ],
  DE: [
    { id: 'winkler', name: 'Winkler', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://shop.winkler.com'), email: 'info@winkler.com', phone: '+49 711 85999-0' },
    { id: 'europart', name: 'Europart', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://europart.de') },
    { id: 'wm', name: 'WM SE', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://www.wm.de'), phone: '+49 541 9989-0' },
    { id: 'kleinanzeigen', name: 'Kleinanzeigen', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.kleinanzeigen.de/s-${enc(c.number ?? c.text)}/k0` },
    { id: 'ebay-de', name: 'eBay', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.ebay.de/sch/i.html?_nkw=${enc(c.number ?? c.text)}` },
  ],
  SE: [
    { id: 'rydahls', name: 'Rydahls Reservdelar', kind: 'NEW', pricesPublic: false, direct: true, url: (c) => `https://www.rydahlsreservdelar.se/search?q=${enc(c.number ?? c.text)}`, email: 'info@rydahls.se', phone: '0771-27 66 72' },
    { id: 'htd', name: 'Huzells Tunga Delar (Trucknik)', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://katalogen.htd.se'), email: 'info@htd.se', phone: '054-85 22 00' },
    { id: 'slapis', name: 'Släpis', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://webshop.slapis.se'), email: 'info@slapis.se' },
    { id: 'autokada-se', name: 'Auto Kada', kind: 'NEW', pricesPublic: false, direct: true, url: (c) => `https://b2b.aknet.eu/search?search=${enc(c.number ?? c.text)}` },
    { id: 'bildelsbasen', name: 'Bildelsbasen', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.bildelsbasen.se/sv-se/OEM/${enc(c.number ?? c.text)}` },
    { id: 'blocket', name: 'Blocket', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.blocket.se/recommerce/forsale/search?q=${enc(c.number ?? c.text)}` },
    { id: 'tradera', name: 'Tradera', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.tradera.com/search?q=${enc(c.number ?? c.text)}` },
  ],
  NO: [
    { id: 'vdlparts', name: 'VDL Parts (ex TTI)', kind: 'NEW', pricesPublic: false, direct: true, url: (c) => `https://www.vdlparts.no/search?q=${enc(c.number ?? c.text)}`, email: 'salg@vdlparts.no', phone: '95 00 08 84' },
    { id: 'bpw-hofstad', name: 'BPW Hofstad (henger)', kind: 'NEW', pricesPublic: false, direct: false, url: site('https://webshop.bpw.no'), email: 'post@bpw.no', phone: '+47 22 10 10 50' },
    { id: 'autokada-no', name: 'Auto Kada', kind: 'NEW', pricesPublic: false, direct: true, url: (c) => `https://b2b.aknet.eu/search?search=${enc(c.number ?? c.text)}` },
    { id: 'finn', name: 'FINN.no Torget', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.finn.no/recommerce/forsale/search?q=${enc(c.number ?? c.text)}` },
    { id: 'mascus-no', name: 'Mascus', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.mascus.no/+/${enc(c.number ?? c.text)},1,relevance,search.html` },
  ],
};

const TYRES: Record<PartsCountry, Entry[]> = {
  FI: [
    { id: 'vianor', name: 'Vianor', kind: 'TYRES', pricesPublic: false, direct: true, mobile24: true, url: (c) => `https://vianor.fi/haku/?search=${enc(c.size)}` },
    { id: 'euromaster-fi', name: 'Euromaster', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://www.euromaster.fi/pyyda-tarjous'), phone: '0207 700 800' },
    interCarsFiTyres,
    { id: 'rengascenter', name: 'RengasCenter', kind: 'TYRES', pricesPublic: false, direct: false, url: site('https://rengascenter.fi/renkaat-ja-vanteet/kuorma-auton-renkaat/'), phone: '+358 3 871 0811' },
  ],
  EE: [
    interCarsTyres('ic-ee-t', 'https://www.intercars24.ee', 'autoosad'),
    { id: 'rehvimeister', name: 'Rehvimeister', kind: 'TYRES', pricesPublic: false, direct: false, url: site('https://rehvimeister.ee'), email: 'info@rehvimeister.ee', phone: '+372 636 7110' },
    {
      id: 'auto24-t',
      name: 'auto24.ee',
      kind: 'USED',
      pricesPublic: true,
      direct: true,
      url: (c) => `https://www.auto24.ee/products/search_result_product.php?cid=0&_sm=1&ad_type=1&cat[0][text]=${enc(c.size)}`,
    },
  ],
  LV: [
    interCarsTyres('ic-lv-t', 'https://www.ic24.lv', 'detalas'),
    { id: 'sslv-t', name: 'SS.LV', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.ss.lv/lv/search-result/?q=${enc(c.size)}` },
  ],
  LT: [
    interCarsTyres('ic-lt-t', 'https://ic24.lt', 'dalys'),
    { id: 'norgile', name: 'Norgilė', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://norgile.lt') },
    { id: 'autoline-lt-t', name: 'Autoline', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://autoline.lt/search_text.php?query=${enc(c.size)}` },
  ],
  PL: [
    {
      id: 'oponeo',
      name: 'Oponeo',
      kind: 'TYRES',
      pricesPublic: true,
      direct: true,
      phone: '+48 52 341 88 00',
      url: (c) => {
        const size = parseTyreSize(c.size);
        return size
          ? `https://www.oponeo.pl/opony/ciezarowe/${size.width}-${size.profile}-r${size.rim.replace('.', '-')}`
          : 'https://www.oponeo.pl/opony/ciezarowe';
      },
    },
    { id: 'euromaster-pl', name: 'Euromaster', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://biznes.euromaster.pl') },
    { id: 'allegro-t', name: 'Allegro', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://allegro.pl/listing?string=${enc(c.size)}` },
  ],
  DE: [
    { id: 'euromaster-de', name: 'Euromaster', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://business.euromaster.de') },
    { id: 'vergoelst', name: 'Vergölst (BestDrive)', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://vergoelst.de/flottenkunden.html'), phone: '+49 511 938-20555' },
    { id: 'ebay-de-t', name: 'eBay', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.ebay.de/sch/i.html?_nkw=${enc(`${c.size} LKW Reifen`)}` },
  ],
  SE: [
    { id: 'vianor-se', name: 'Vianor', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://www.vianor.se/foretagskunder/kontakta-oss/offertforfragan/') },
    { id: 'dackteam', name: 'Däckteam', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://www.dackteam.se/lastbil') },
    { id: 'euromaster-se', name: 'Euromaster', kind: 'TYRES', pricesPublic: false, direct: false, url: site('https://foretag.euromaster.se/affarsomrade/lastbil-trailer'), phone: '0340-829 00' },
    { id: 'dackia', name: 'Däckia', kind: 'TYRES', pricesPublic: false, direct: false, url: site('https://www.dackia.se/foretag') },
    { id: 'blocket-t', name: 'Blocket', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.blocket.se/recommerce/forsale/search?q=${enc(c.size)}` },
  ],
  NO: [
    { id: 'vianor-no', name: 'Vianor', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://vianor.no/bedriftskunder/'), phone: '915 11 500' },
    { id: 'bestdrive-no', name: 'BestDrive (Continental)', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://www.bestdrive.no/bedrift/lastebil.html'), phone: '23 06 81 10' },
    { id: 'dekkteam-no', name: 'DekkTeam', kind: 'TYRES', pricesPublic: false, direct: false, url: site('https://dekkteam.no/dekk/buss-og-lastebildekk/'), phone: '800 33 558' },
    { id: 'dekkpartner', name: 'Dekkpartner', kind: 'TYRES', pricesPublic: false, direct: false, mobile24: true, url: site('https://www.dekkpartner.no/lastebildekk') },
    { id: 'finn-t', name: 'FINN.no Torget', kind: 'USED', pricesPublic: true, direct: true, url: (c) => `https://www.finn.no/recommerce/forsale/search?q=${enc(c.size)}` },
  ],
};

/* Слово для поиска в Google на языке страны. */
const WEB_WORD: Record<PartsCountry, { parts: string; tyres: string }> = {
  FI: { parts: 'varaosa', tyres: 'kuorma-auton rengas' },
  EE: { parts: 'varuosa', tyres: 'veoauto rehv' },
  LV: { parts: 'rezerves daļa', tyres: 'kravas auto riepa' },
  LT: { parts: 'atsarginė dalis', tyres: 'sunkvežimio padanga' },
  PL: { parts: 'część', tyres: 'opona ciężarowa' },
  DE: { parts: 'Ersatzteil', tyres: 'LKW Reifen' },
  SE: { parts: 'reservdel', tyres: 'lastbilsdäck' },
  NO: { parts: 'reservedel', tyres: 'lastebildekk' },
};

/** Опубликованные номера круглосуточной помощи при проколе, проверены 29.10.2026. */
export const BREAKDOWN: Record<PartsCountry, Breakdown[]> = {
  FI: [
    { name: 'VianorFlex 24/7', phone: '+358 10 401 247', url: 'https://www.vianor.fi/yritysasiakkaat/palvelut/vianorflex-247/', contractOnly: false },
    { name: 'Euromaster rengasrikkopalvelu', phone: '050 593 7423', url: 'https://www.euromaster.fi/rengasrikkopalvelu', contractOnly: false },
    { name: 'Road Mobility Services', phone: '+45 75 55 45 45', url: 'https://www.roadmobilityservices.com', contractOnly: true },
  ],
  EE: [{ name: 'Continental Conti360', phone: '+48 22 577 13 15', url: 'https://www.continental-tyres.co.uk/b2b/services-and-solutions/conti-360/breakdown-service', contractOnly: true }],
  LV: [{ name: 'Continental Conti360', phone: '+48 22 577 13 15', url: 'https://www.continental-tyres.co.uk/b2b/services-and-solutions/conti-360/breakdown-service', contractOnly: true }],
  LT: [{ name: 'Continental Conti360', phone: '+48 22 577 13 15', url: 'https://www.continental-tyres.co.uk/b2b/services-and-solutions/conti-360/breakdown-service', contractOnly: true }],
  PL: [
    { name: 'Euromaster Truck Assistance 24h', phone: '22 422 14 12', url: 'https://www.euromaster.pl', contractOnly: false },
    { name: 'Continental Conti360', phone: '+48 22 577 13 60', url: 'https://www.continental-tyres.co.uk/b2b/services-and-solutions/conti-360/breakdown-service', contractOnly: true },
  ],
  DE: [{ name: 'Continental Conti360', phone: '+49 511 938 2000', url: 'https://www.continental-tyres.co.uk/b2b/services-and-solutions/conti-360/breakdown-service', contractOnly: true }],
  SE: [
    { name: 'VianorFlex 24/7', phone: '0771-217 217', url: 'https://www.vianor.se/foretagskunder/foretagstjanster/vianor-flex-24-7/', contractOnly: false },
    { name: 'Hankook Road Assist 24h', phone: '+32 3540 5121', url: 'https://www.hankooktire.com/se/sv/help-support/tbr-support/road-assist-24h.html', contractOnly: true },
  ],
  NO: [
    { name: 'VianorFlex 24/7', phone: '+47 22 07 04 04', url: 'https://vianor.no/bedriftskunder/bedriftstjenester/vianor-flex-24-7/', contractOnly: false },
    { name: 'BestDrive 24-timers veihjelp', phone: '920 70 111', url: 'https://www.bestdrive.no/bedrift/veihjelp.html', contractOnly: true },
  ],
};

export function partsSources(q: PartsQuery & { country?: PartsCountry; mode?: PartsMode }): PartsSource[] {
  const country = q.country ?? 'FI';
  const mode = q.mode ?? 'PARTS';
  const text = q.query.trim();
  const ctx: Ctx = {
    text,
    number: mode === 'PARTS' && looksLikePartNumber(text) ? compactNumber(text) : null,
    size: normalTyreSize(text),
  };

  const list = (mode === 'TYRES' ? TYRES : PARTS)[country];
  const sources: PartsSource[] = list.map(({ url, ...rest }) => ({ ...rest, url: url(ctx) }));

  const dealer = mode === 'PARTS' ? dealerKey(q.make) : null;
  if (dealer) {
    const d = DEALERS[dealer];
    sources.push({ id: `dealer-${dealer}`, name: d.name, kind: 'DEALER', pricesPublic: false, url: country === 'FI' ? d.fi : d.intl, direct: false });
  }

  const word = WEB_WORD[country][mode === 'TYRES' ? 'tyres' : 'parts'];
  const term = mode === 'TYRES' ? ctx.size : (ctx.number ?? `"${text}"`);
  sources.push({
    id: 'web',
    name: 'Google',
    kind: 'WEB',
    pricesPublic: true,
    url: `https://www.google.com/search?q=${enc(`${term} ${mode === 'PARTS' ? (q.make ?? '') : ''} ${word}`.replace(/\s+/g, ' ').trim())}`,
    direct: true,
  });

  return sources;
}

/* ── Запрос цены на языке поставщика ──────────────────────────── */

const QUOTE: Record<PartsCountry, { subject: string; vehicle: string; note: string; ask: string; tyresAsk: string }> = {
  FI: {
    subject: 'Tarjouspyyntö',
    vehicle: 'Ajoneuvo',
    note: 'Lisätiedot',
    ask: 'Pyydämme hinnan, toimitusajan ja tiedon, onko osa alkuperäinen vai vastaava.',
    tyresAsk: 'Pyydämme hinnan, toimitusajan, merkin ja kuviotiedon (ohjaava, veto, perävaunu) sekä asennuksen hinnan.',
  },
  EE: {
    subject: 'Hinnapäring',
    vehicle: 'Sõiduk',
    note: 'Lisainfo',
    ask: 'Palume hinda, tarneaega ja infot, kas osa on originaal või analoog.',
    tyresAsk: 'Palume hinda, tarneaega, marki ja mustrit (rool, vedu, haagis) ning paigalduse hinda.',
  },
  LV: {
    subject: 'Cenas pieprasījums',
    vehicle: 'Transportlīdzeklis',
    note: 'Papildu informācija',
    ask: 'Lūdzam cenu, piegādes laiku un informāciju, vai detaļa ir oriģināla vai analogs.',
    tyresAsk: 'Lūdzam cenu, piegādes laiku, zīmolu un protektoru (stūres, dzenošā, piekabes ass) un montāžas cenu.',
  },
  LT: {
    subject: 'Kainos užklausa',
    vehicle: 'Transporto priemonė',
    note: 'Papildoma informacija',
    ask: 'Prašome nurodyti kainą, pristatymo laiką ir ar detalė originali, ar analogas.',
    tyresAsk: 'Prašome nurodyti kainą, pristatymo laiką, gamintoją ir protektorių (vairo, varančioji, priekabos ašis) bei montavimo kainą.',
  },
  PL: {
    subject: 'Zapytanie ofertowe',
    vehicle: 'Pojazd',
    note: 'Dodatkowe informacje',
    ask: 'Prosimy o cenę, termin dostawy i informację, czy część jest oryginalna, czy zamiennik.',
    tyresAsk: 'Prosimy o cenę, termin dostawy, markę i bieżnik (oś prowadząca, napędowa, naczepa) oraz cenę montażu.',
  },
  DE: {
    subject: 'Preisanfrage',
    vehicle: 'Fahrzeug',
    note: 'Weitere Angaben',
    ask: 'Bitte um Preis, Lieferzeit und Angabe, ob Original- oder Nachbauteil.',
    tyresAsk: 'Bitte um Preis, Lieferzeit, Marke und Profil (Lenk-, Antriebs-, Aufliegerachse) sowie den Montagepreis.',
  },
  SE: {
    subject: 'Offertförfrågan',
    vehicle: 'Fordon',
    note: 'Övrigt',
    ask: 'Vi ber om pris, leveranstid och om delen är original eller motsvarande.',
    tyresAsk: 'Vi ber om pris, leveranstid, märke och mönster (styr, driv, trailer) samt pris för montering.',
  },
  NO: {
    subject: 'Tilbudsforespørsel',
    vehicle: 'Kjøretøy',
    note: 'Annet',
    ask: 'Vi ber om pris, leveringstid og om delen er original eller tilsvarende.',
    tyresAsk: 'Vi ber om pris, leveringstid, merke og mønster (styring, driv, henger) samt pris for montering.',
  },
};

export function quoteSubject(country: PartsCountry, query: string): string {
  return `${QUOTE[country].subject}: ${query.trim()}`;
}

/** Текст запроса цены — для письма поставщику, разборке или шинной сети. */
export function quoteRequestText(
  q: PartsQuery & { company: string; note: string; country?: PartsCountry; mode?: PartsMode },
): string {
  const t = QUOTE[q.country ?? 'FI'];
  const query = q.mode === 'TYRES' ? normalTyreSize(q.query) : q.query.trim();
  return [
    `${t.subject}: ${query}`,
    q.make || q.plate ? `${t.vehicle}: ${[q.make, q.plate].filter(Boolean).join(' · ')}` : null,
    q.note.trim() ? `${t.note}: ${q.note.trim()}` : null,
    '',
    q.mode === 'TYRES' ? t.tyresAsk : t.ask,
    '',
    q.company,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
