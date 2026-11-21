/**
 * Фото тягача по марке (21.11.2026): Volvo, Scania, MAN, Mercedes-Benz,
 * DAF, Iveco, Renault. Снимки приведены к одному виду (фон --color-ground,
 * кабина вправо, один масштаб, 960 × 600) и лежат в public/media/trucks.
 *
 * Фото — только для тягачей: остальных классов на снимках нет, и тягач на
 * карточке фургона или самосвала вводил бы в заблуждение.
 *
 * plate — где на снимке номерной знак: центр, ширина (доли кадра) и наклон.
 * Без зависимостей: модуль читают компонент и тесты.
 */

export type TruckBrand = 'volvo' | 'scania' | 'man' | 'mercedes' | 'daf' | 'iveco' | 'renault';

export const TRUCK_PHOTO_SIZE = { width: 960, height: 600 } as const;

/*
 * Площадка номера на каждом снимке (в пикселях кадра 960 × 600): центр,
 * ширина и наклон. Ширина — как у настоящего знака на этом бампере: у MAN
 * на снимке был свой номер 44 px, у Iveco — пустая рамка 35 px. Наклон
 * повторяет линию бампера.
 */
const PLATE: Record<TruckBrand, { x: number; y: number; w: number; skew: number }> = {
  volvo: { x: 612, y: 451, w: 42, skew: -1 },
  scania: { x: 680, y: 457, w: 40, skew: -1.5 },
  man: { x: 646, y: 414, w: 44, skew: -2 },
  mercedes: { x: 649, y: 459, w: 42, skew: -1.5 },
  daf: { x: 630, y: 457, w: 42, skew: -1 },
  iveco: { x: 665, y: 478.5, w: 36, skew: -1.5 },
  renault: { x: 665, y: 450, w: 40, skew: -1 },
};

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
  const p = PLATE[brand];
  return {
    brand,
    src: `/media/trucks/${brand}.webp`,
    plate: { x: p.x / TRUCK_PHOTO_SIZE.width, y: p.y / TRUCK_PHOTO_SIZE.height, w: p.w / TRUCK_PHOTO_SIZE.width, skew: p.skew },
  };
}

/** Международный код страны на номерном знаке (Венская конвенция). */
const PLATE_CODE: Record<string, string> = {
  FI: 'FIN', SE: 'S', NO: 'N', DK: 'DK', EE: 'EST', LV: 'LV', LT: 'LT', PL: 'PL', DE: 'D', RO: 'RO',
};

export function plateCountryCode(country: string | null | undefined): string | null {
  if (!country) return null;
  return PLATE_CODE[country.toUpperCase()] ?? country.toUpperCase();
}
