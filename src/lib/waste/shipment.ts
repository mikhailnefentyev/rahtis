/**
 * Перевозка отходов обычным рейсом (26.10.2026) — правила без импортов,
 * их проверяет node --test (shipment.test.mjs).
 *
 * Через границу ЕС — Регламент (ЕС) 2024/1157:
 *   «зелёные» отходы на переработку тяжелее 20 кг — ст. 18, документ
 *   Приложения VII едет с грузом (с CMR); до 31.12.2026 на бумаге, с
 *   01.01.2027 — электронно в DIWASS (ст. 27, 86);
 *   смешанная упаковка 15 01 06, опасные, загрязнённые — предварительная
 *   нотификация и согласие властей (ст. 4(2)), Приложение VII не годится.
 * Внутри страны — национальная система (см. nationalSystem).
 * Многоразовая тара и поддоны, которые возвращают в оборот, — не отход.
 *
 * Сводка источников: docs/outreach/waste-integrations/README.md.
 */

export type WasteProcedure = 'ANNEX_VII' | 'NOTIFICATION' | 'DOMESTIC' | 'REUSE';
export const WASTE_PROCEDURES: readonly WasteProcedure[] = ['ANNEX_VII', 'NOTIFICATION', 'DOMESTIC', 'REUSE'];

export const RECOVERY_CODES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13'] as const;

/** С этого дня Приложение VII — только электронно в DIWASS. */
export const DIWASS_MANDATORY_FROM = '2027-01-01';

/** Частые коды тары и упаковки — подсказка в форме. */
export const PACKAGING_CODES: readonly { ewc: string; basel: string | null }[] = [
  { ewc: '150101', basel: 'B3020' }, // бумага и картон
  { ewc: '150102', basel: 'EU3011' }, // пластик — только чистый и почти однородный
  { ewc: '150103', basel: 'B3050' }, // дерево (сломанные поддоны)
  { ewc: '150104', basel: 'B1010' }, // металл (банки)
  { ewc: '150107', basel: 'B2020' }, // стекло
  { ewc: '150106', basel: null }, // смешанная упаковка — не «зелёный» список
];

export function isWasteProcedure(value: unknown): value is WasteProcedure {
  return typeof value === 'string' && (WASTE_PROCEDURES as readonly string[]).includes(value);
}

/** «150101», «15 01 01», «17 05 03*» → «150101» / «170503*»; иначе null. */
export function normalizeEwc(raw: string | null | undefined): string | null {
  const v = String(raw ?? '').replace(/\s/g, '');
  return /^\d{6}\*?$/.test(v) ? v : null;
}

export function ewcLabel(code: string): string {
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4)}`;
}

export function suggestedBasel(ewc: string | null): string | null {
  return PACKAGING_CODES.find((p) => p.ewc === ewc)?.basel ?? null;
}

export type WasteIssue = 'MIXED_NEEDS_NOTIFICATION' | 'HAZARDOUS_NEEDS_NOTIFICATION' | 'PLASTIC_MUST_BE_CLEAN' | 'NOT_CROSS_BORDER' | 'CROSS_BORDER_NOT_DOMESTIC';

/**
 * Что не так с выбранной процедурой. countries — страны точек рейса по
 * порядку (без пустых). Пустой список — всё в порядке.
 */
export function wasteIssues(procedure: WasteProcedure, ewc: string | null, countries: readonly string[]): WasteIssue[] {
  const issues: WasteIssue[] = [];
  const crossBorder = new Set(countries).size > 1;
  if (procedure === 'ANNEX_VII') {
    if (ewc === '150106') issues.push('MIXED_NEEDS_NOTIFICATION');
    if (ewc?.endsWith('*')) issues.push('HAZARDOUS_NEEDS_NOTIFICATION');
    if (ewc === '150102') issues.push('PLASTIC_MUST_BE_CLEAN');
    if (countries.length > 0 && !crossBorder) issues.push('NOT_CROSS_BORDER');
  }
  if (procedure === 'DOMESTIC' && crossBorder) issues.push('CROSS_BORDER_NOT_DOMESTIC');
  return issues;
}

/**
 * Национальная система для перевозки отхода внутри страны.
 * scope: ALL — нужен на любой отход; HAZARDOUS — только опасный (и
 * в Финляндии ещё загрязнённый грунт и строительные отходы); NONE —
 * отдельного документа нет. В Эстонии с 01.01.2027 — на любой.
 */
export type NationalSystem = { name: string; url: string; scope: 'ALL' | 'HAZARDOUS' | 'NONE' };

export function nationalSystem(country: string, day: string): NationalSystem {
  switch (country) {
    case 'PL':
      return { name: 'BDO (KPO)', url: 'https://bdo.mos.gov.pl', scope: 'ALL' };
    case 'LT':
      return { name: 'GPAIS', url: 'https://www.gpais.eu', scope: 'ALL' };
    case 'LV':
      return { name: 'APUS', url: 'https://apus.vvd.gov.lv', scope: 'ALL' };
    case 'EE':
      return { name: 'PISTRIK', url: 'https://kotkas.envir.ee', scope: day >= '2027-01-01' ? 'ALL' : 'HAZARDOUS' };
    case 'FI':
      return { name: 'SIIRTO', url: 'https://siirtorekisteri.fi', scope: 'HAZARDOUS' };
    case 'DE':
      return { name: 'eANV', url: 'https://www.gadsys.de', scope: 'HAZARDOUS' };
    case 'SE':
      return { name: 'Avfallsregistret', url: 'https://www.naturvardsverket.se', scope: 'HAZARDOUS' };
    case 'NO':
      return { name: 'Avfallsdeklarering', url: 'https://avfallsdeklarering.miljodirektoratet.no', scope: 'HAZARDOUS' };
    default:
      return { name: '—', url: '', scope: 'NONE' };
  }
}
