/**
 * Фото тягача по марке (21.11.2026): Volvo, Scania, MAN, Mercedes-Benz,
 * DAF, Iveco, Renault. Снимки приведены к одному виду (фон --color-ground,
 * кабина вправо, один масштаб, 960 × 600) и лежат в public/media/trucks.
 *
 * Фото — только для тягачей: остальных классов на снимках нет, и тягач на
 * карточке фургона или самосвала вводил бы в заблуждение.
 *
 * plate — где на снимке номерной знак: центр и ширина в долях кадра.
 * Без зависимостей: модуль читают компонент и тесты.
 */

export type TruckBrand = 'volvo' | 'scania' | 'man' | 'mercedes' | 'daf' | 'iveco' | 'renault';

export const TRUCK_PHOTO_SIZE = { width: 960, height: 600 } as const;

const PLATE: Record<TruckBrand, { x: number; y: number }> = {
  volvo: { x: 623 / 960, y: 451 / 600 },
  scania: { x: 687 / 960, y: 452 / 600 },
  man: { x: 647 / 960, y: 412 / 600 },
  mercedes: { x: 640 / 960, y: 453 / 600 },
  daf: { x: 632 / 960, y: 456 / 600 },
  iveco: { x: 662 / 960, y: 478 / 600 },
  renault: { x: 667 / 960, y: 455 / 600 },
};

/** Ширина знака в долях кадра: крупнее настоящего, чтобы номер читался. */
export const PLATE_WIDTH = 0.105;

const PATTERNS: [TruckBrand, RegExp][] = [
  ['mercedes', /mercedes|benz|\bmb\b|actros|arocs|axor/i],
  ['scania', /scania/i],
  ['volvo', /volvo/i],
  ['daf', /\bdaf\b/i],
  ['iveco', /iveco|stralis|s-?way/i],
  ['renault', /renault/i],
  ['man', /\bman\b|\btgx\b|\btgs\b/i],
];

/** Марка из свободного текста поля «марка»: «Volvo FH 500», «MB Actros», «MAN TGX». */
export function truckBrand(make: string | null | undefined): TruckBrand | null {
  if (!make) return null;
  for (const [brand, re] of PATTERNS) if (re.test(make)) return brand;
  return null;
}

export function truckPhoto(make: string | null | undefined, vehicleClass: string | null | undefined) {
  if (vehicleClass !== 'TRACTOR') return null;
  const brand = truckBrand(make);
  if (!brand) return null;
  return { brand, src: `/media/trucks/${brand}.webp`, plate: PLATE[brand] };
}

/** Международный код страны на номерном знаке (Венская конвенция). */
const PLATE_CODE: Record<string, string> = {
  FI: 'FIN', SE: 'S', NO: 'N', DK: 'DK', EE: 'EST', LV: 'LV', LT: 'LT', PL: 'PL', DE: 'D', RO: 'RO',
};

export function plateCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  return PLATE_CODE[country.toUpperCase()] ?? country.toUpperCase();
}
