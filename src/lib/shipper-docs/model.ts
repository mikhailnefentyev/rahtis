/**
 * Документы заказчика (6.11.2026): выписка из реестра, налоговые
 * справки, право подписи. Сроки отметки и названия документов по странам.
 *
 * Без импортов из приложения: модуль читают сервер, клиент и тесты
 * (node --test). Срок считает и база (app.company_document_fresh_until) —
 * здесь то же правило для формы и отметок.
 */

export const SHIPPER_DOC_KINDS = [
  'REGISTER_EXTRACT',
  'TAX_DEBT_CERTIFICATE',
  'VAT_CERTIFICATE',
  'SIGNATORY_AUTHORITY',
] as const;
export type ShipperDocKind = (typeof SHIPPER_DOC_KINDS)[number];

export function isShipperDocKind(value: unknown): value is ShipperDocKind {
  return typeof value === 'string' && (SHIPPER_DOC_KINDS as readonly string[]).includes(value);
}

/** Дата выдачи обязательна: по ней судят о свежести. */
export function needsIssuedOn(kind: ShipperDocKind): boolean {
  return kind !== 'SIGNATORY_AUTHORITY';
}

/** Справка о налогах без указанного срока — 90 дней от выдачи. */
export const TAX_DEBT_DAYS = 90;
/** Выписка из реестра «свежая» 12 месяцев от выдачи. */
export const EXTRACT_MONTHS = 12;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/* Как date + interval в Postgres: 29.02 + 12 мес. = 28.02. */
function addMonths(iso: string, months: number): string {
  const [y, m, day] = iso.split('-').map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/**
 * До какой даты действует отметка «проверено». null — бессрочно или
 * дат нет вовсе.
 */
export function freshUntil(kind: ShipperDocKind, issuedOn: string | null, validUntil: string | null): string | null {
  const issued = issuedOn && ISO.test(issuedOn) ? issuedOn : null;
  const until = validUntil && ISO.test(validUntil) ? validUntil : null;
  if (kind === 'TAX_DEBT_CERTIFICATE') return until ?? (issued ? addDays(issued, TAX_DEBT_DAYS) : null);
  if (kind === 'REGISTER_EXTRACT') {
    const byAge = issued ? addMonths(issued, EXTRACT_MONTHS) : null;
    if (until && byAge) return until < byAge ? until : byAge;
    return until ?? byAge;
  }
  return until;
}

/** Отметка у перевозчика: зелёная (действует) или нейтральная «истёк». */
export type DocMarkState = 'ok' | 'expired';

export function markState(until: string | null, today: string): DocMarkState {
  return until !== null && until < today ? 'expired' : 'ok';
}

/**
 * Официальные названия документов по стране заказчика — на языке страны,
 * как их называет выдающий орган. Нет страны в списке — подсказки нет.
 */
export const DOC_NAMES: Record<string, Partial<Record<ShipperDocKind, string>>> = {
  FI: {
    REGISTER_EXTRACT: 'Kaupparekisteriote (PRH)',
    TAX_DEBT_CERTIFICATE: 'Verovelkatodistus (OmaVero)',
    VAT_CERTIFICATE: 'YTJ-yritysote, josta näkyy arvonlisäverorekisteröinti',
  },
  DE: {
    REGISTER_EXTRACT: 'Handelsregisterauszug oder Gewerbeanmeldung',
    TAX_DEBT_CERTIFICATE: 'Unbedenklichkeitsbescheinigung des Finanzamts',
    VAT_CERTIFICATE: 'Bestätigung der USt-IdNr. (Bundeszentralamt für Steuern)',
  },
  PL: {
    REGISTER_EXTRACT: 'Odpis z KRS lub wydruk z CEIDG',
    TAX_DEBT_CERTIFICATE: 'Zaświadczenie o niezaleganiu w podatkach (urząd skarbowy)',
    VAT_CERTIFICATE: 'Potwierdzenie rejestracji jako podatnik VAT (VAT-5) lub wydruk z Białej listy',
  },
  LT: {
    REGISTER_EXTRACT: 'Registrų centro išrašas',
    TAX_DEBT_CERTIFICATE: 'VMI pažyma apie neturimą skolą',
    VAT_CERTIFICATE: 'VMI PVM mokėtojo įregistravimo pažyma',
  },
  LV: {
    REGISTER_EXTRACT: 'Uzņēmumu reģistra izziņa',
    TAX_DEBT_CERTIFICATE: 'VID izziņa par nodokļu parāda neesamību',
    VAT_CERTIFICATE: 'VID izziņa par reģistrāciju PVN maksātāju reģistrā',
  },
  EE: {
    REGISTER_EXTRACT: 'Äriregistri registrikaart',
    TAX_DEBT_CERTIFICATE: 'EMTA tõend maksuvõla puudumise kohta',
    VAT_CERTIFICATE: 'EMTA teatis käibemaksukohustuslasena registreerimise kohta',
  },
  SE: {
    REGISTER_EXTRACT: 'Registreringsbevis (Bolagsverket)',
    TAX_DEBT_CERTIFICATE: 'Intyg från Skatteverket om skatter och avgifter',
    VAT_CERTIFICATE: 'Registreringsbevis som visar momsregistrering',
  },
  NO: {
    REGISTER_EXTRACT: 'Firmaattest (Brønnøysundregistrene)',
    TAX_DEBT_CERTIFICATE: 'Skatteattest (Skatteetaten)',
    VAT_CERTIFICATE: 'Firmaattest som viser registrering i Merverdiavgiftsregisteret',
  },
  DK: {
    REGISTER_EXTRACT: 'CVR-udskrift (Erhvervsstyrelsen)',
    TAX_DEBT_CERTIFICATE: 'Restanceattest (Skattestyrelsen)',
    VAT_CERTIFICATE: 'CVR-udskrift, der viser momsregistrering',
  },
};

export function docNameFor(country: string | null | undefined, kind: ShipperDocKind): string | null {
  return (country && DOC_NAMES[country.toUpperCase()]?.[kind]) || null;
}
