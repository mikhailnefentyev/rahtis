/**
 * Где искать запчасть: поставщики грузовых запчастей, разборки, дилеры.
 *
 * Открытого API с ценой и наличием нет ни у одного финского поставщика
 * (docs/parts/research-suppliers.md), а robots.txt у Raskassarja и
 * Varaosahaku запрещает разбор страниц. Поэтому — прямые ссылки: поиск
 * открывается у поставщика с уже подставленным номером, цену и наличие
 * перевозчик видит у него. Шаблоны проверены 28.10.2026; Raskassarja
 * переезжает в новый магазин 29.10.2026 — перепроверить.
 */

export type PartsQuery = { query: string; make: string | null; plate: string | null };

export type PartsSource = {
  id: string;
  name: string;
  kind: 'NEW' | 'USED' | 'DEALER' | 'WEB';
  /** Цены видны без входа. */
  pricesPublic: boolean;
  /** Ссылка с подставленным запросом или страница входа поставщика. */
  url: string;
  /** Поиск сразу по номеру (а не только вход в кабинет поставщика). */
  direct: boolean;
  email?: string;
  phone?: string;
};

/** Номер детали: буквы и цифры без пробелов, хотя бы одна цифра. */
export function looksLikePartNumber(value: string): boolean {
  const v = value.replace(/[\s.\-/]/g, '');
  return /^[A-Za-z0-9]{4,24}$/.test(v) && /\d/.test(v);
}

export function compactNumber(value: string): string {
  return value.replace(/[\s.\-/]/g, '').toUpperCase();
}

const enc = encodeURIComponent;

const DEALERS: Record<string, { name: string; url: string }> = {
  VOLVO: { name: 'Volvo Trucks (jälleenmyyjä)', url: 'https://www.volvotrucks.fi/fi-fi/services/parts-accessories/parts.html' },
  SCANIA: { name: 'Scania (jälleenmyyjä)', url: 'https://www.scania.com/fi/fi/home.html' },
  MAN: { name: 'MAN · partslink24', url: 'https://www.partslink24.com' },
  MERCEDES: { name: 'Mercedes-Benz B2B Connect', url: 'https://b2bconnect.mercedes-benz.com/fi' },
  DAF: { name: 'DAF Parts Online', url: 'https://parts.daf.com' },
  IVECO: { name: 'Iveco (jälleenmyyjä)', url: 'https://www.iveco.com' },
  RENAULT: { name: 'Renault Trucks (jälleenmyyjä)', url: 'https://www.renault-trucks.fi' },
};

export function dealerKey(make: string | null): string | null {
  const m = String(make ?? '').toUpperCase();
  if (m.includes('MERCEDES') || m.includes('BENZ')) return 'MERCEDES';
  return Object.keys(DEALERS).find((k) => m.includes(k)) ?? null;
}

export function partsSources(q: PartsQuery): PartsSource[] {
  const text = q.query.trim();
  const number = looksLikePartNumber(text) ? compactNumber(text) : null;
  const sources: PartsSource[] = [
    {
      id: 'raskassarja',
      name: 'Raskassarja 24/7',
      kind: 'NEW',
      pricesPublic: true,
      url: `https://raskassarja247.fi/fin/haku?s=${enc(number ?? text)}`,
      direct: true,
    },
    {
      id: 'varaosahaku',
      name: 'Varaosahaku.fi (purkamot)',
      kind: 'USED',
      pricesPublic: true,
      url: number
        ? `https://www.varaosahaku.fi/fi-fi/OEM/${enc(number)}`
        : `https://www.varaosahaku.fi/fi-fi/pb/Hae/Autonosat/s15/FTS?query=${enc(text)}`,
      direct: true,
    },
    {
      id: 'skuba',
      name: 'Skuba',
      kind: 'NEW',
      pricesPublic: false,
      url: 'https://ems.skuba.eu/login',
      direct: false,
      email: 'info@skuba.fi',
      phone: '0400 140 900',
    },
    {
      id: 'tavo',
      name: 'TAVO / ProTruck',
      kind: 'NEW',
      pricesPublic: false,
      url: 'https://protruck.fi',
      direct: false,
    },
    {
      id: 'raskasvaraosa',
      name: 'Raskasvaraosa.fi',
      kind: 'NEW',
      pricesPublic: false,
      url: 'https://raskasvaraosa.fi',
      direct: false,
    },
    {
      id: 'truck1',
      name: 'Truck1 · varaosat',
      kind: 'USED',
      pricesPublic: true,
      url: 'https://www.truck1.fi/varaosat-kuorma-autot',
      direct: false,
    },
  ];

  const dealer = dealerKey(q.make);
  if (dealer) {
    sources.push({ id: `dealer-${dealer}`, name: DEALERS[dealer].name, kind: 'DEALER', pricesPublic: false, url: DEALERS[dealer].url, direct: false });
  }

  sources.push({
    id: 'web',
    name: 'Google',
    kind: 'WEB',
    pricesPublic: true,
    url: `https://www.google.com/search?q=${enc(`${number ?? `"${text}"`} ${q.make ?? ''} varaosa`.replace(/\s+/g, ' ').trim())}`,
    direct: true,
  });

  return sources;
}

/** Текст запроса цены — для письма поставщику или разборке. */
export function quoteRequestText(q: PartsQuery & { company: string; note: string }): string {
  return [
    `Tarjouspyyntö: ${q.query.trim()}`,
    q.make || q.plate ? `Ajoneuvo: ${[q.make, q.plate].filter(Boolean).join(' · ')}` : null,
    q.note.trim() ? `Lisätiedot: ${q.note.trim()}` : null,
    '',
    'Pyydämme hinnan, toimitusajan ja tiedon, onko osa alkuperäinen vai vastaava.',
    '',
    q.company,
  ]
    .filter((l) => l !== null)
    .join('\n');
}
