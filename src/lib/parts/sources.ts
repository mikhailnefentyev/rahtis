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

export const PARTS_COUNTRIES = ['FI', 'EE', 'LV', 'LT', 'PL', 'DE'] as const;
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
};

/* Слово для поиска в Google на языке страны. */
const WEB_WORD: Record<PartsCountry, { parts: string; tyres: string }> = {
  FI: { parts: 'varaosa', tyres: 'kuorma-auton rengas' },
  EE: { parts: 'varuosa', tyres: 'veoauto rehv' },
  LV: { parts: 'rezerves daļa', tyres: 'kravas auto riepa' },
  LT: { parts: 'atsarginė dalis', tyres: 'sunkvežimio padanga' },
  PL: { parts: 'część', tyres: 'opona ciężarowa' },
  DE: { parts: 'Ersatzteil', tyres: 'LKW Reifen' },
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
