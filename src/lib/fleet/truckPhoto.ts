/**
 * Фото машины по марке (21.11.2026). Тягачи — Volvo, Scania, MAN,
 * Mercedes-Benz, DAF, Iveco, Renault (public/media/trucks); самосвалы 8×4 —
 * Volvo, Scania, MAN, Mercedes-Benz, DAF, Iveco, Renault (public/media/tippers);
 * грузовики с фургонным кузовом — Volvo, Scania, MAN, Mercedes-Benz, DAF,
 * Iveco, Renault (public/media/rigids);
 * фургоны — Ford, Citroën, Fiat, Volkswagen, Mercedes-Benz (public/media/vans). Снимки
 * приведены к одному виду: фон --color-ground, мордой вправо, один масштаб,
 * 960 × 600.
 *
 * Цвет по классу машины — решение владельца 21.11.2026: тягачи графитовые,
 * фургоны белые, самосвалы и грузовики — светлая кабина и серый кузов, как
 * на снимках владельца. Самосвал любой осности показывается снимком 8×4,
 * грузовик — снимком своей марки (у Iveco 4×2, у остальных 6×2). Класс без снимков и
 * марка не из списка — без фото: чужая машина на карточке вводила бы в
 * заблуждение.
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

/* Номер на бампере самосвала (кадр 960 × 600). */
const TIPPER_PLATE: Partial<Record<TruckBrand, { x: number; y: number; w: number; skew: number }>> = {
  renault: { x: 683, y: 447, w: 40, skew: -1 },
  iveco: { x: 667, y: 449, w: 44, skew: -1 },
  mercedes: { x: 717, y: 455, w: 46, skew: -2 },
  man: { x: 683, y: 438, w: 30, skew: -1 },
  volvo: { x: 707, y: 467, w: 34, skew: -1 },
  scania: { x: 707, y: 457, w: 34, skew: -1 },
  daf: { x: 677, y: 452, w: 38, skew: -1 },
};

/* Номер на бампере грузовика (кадр 960 × 600). */
const RIGID_PLATE: Partial<Record<TruckBrand, { x: number; y: number; w: number; skew: number }>> = {
  iveco: { x: 667, y: 447, w: 40, skew: -1 },
  daf: { x: 661, y: 467, w: 40, skew: -1 },
  mercedes: { x: 718, y: 467, w: 48, skew: -2 },
  man: { x: 757, y: 445, w: 40, skew: -2 },
  scania: { x: 740, y: 477, w: 34, skew: -1 },
  volvo: { x: 697, y: 463, w: 40, skew: -1 },
  renault: { x: 687, y: 467, w: 36, skew: -1 },
};

export type VanBrand = 'ford' | 'citroen' | 'fiat' | 'vw' | 'mercedes';

/* Номер на бампере фургона (кадр 960 × 600). */
const VAN_PLATE: Record<VanBrand, { x: number; y: number; w: number; skew: number }> = {
  ford: { x: 672, y: 448, w: 54, skew: -2 },
  citroen: { x: 693, y: 441, w: 77, skew: -3 },
  fiat: { x: 739, y: 423, w: 75, skew: -2 },
  vw: { x: 695, y: 413, w: 71, skew: -3 },
  mercedes: { x: 733, y: 445, w: 67, skew: -3 },
};

const VAN_PATTERNS: [VanBrand, RegExp][] = [
  ['mercedes', /mercedes|benz|\bmb\b|sprinter|vito/i],
  ['vw', /\bvw\b|volkswagen|crafter|transporter/i],
  ['ford', /\bford\b|transit/i],
  ['citroen', /citro[eë]n|jumper|relay/i],
  ['fiat', /\bfiat\b|ducato/i],
];

export function vanBrand(make: string | null | undefined): VanBrand | null {
  if (!make) return null;
  for (const [brand, re] of VAN_PATTERNS) if (re.test(make)) return brand;
  return null;
}

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
  if (vehicleClass === 'VAN') {
    const van = vanBrand(make);
    if (!van) return null;
    const v = VAN_PLATE[van];
    return {
      brand: van,
      src: `/media/vans/${van}.webp`,
      plate: { x: v.x / TRUCK_PHOTO_SIZE.width, y: v.y / TRUCK_PHOTO_SIZE.height, w: v.w / TRUCK_PHOTO_SIZE.width, skew: v.skew },
    };
  }
  if (vehicleClass === 'TIPPER' || vehicleClass === 'TRUCK') {
    const brand = truckBrand(make);
    const tipper = vehicleClass === 'TIPPER';
    const t = brand ? (tipper ? TIPPER_PLATE : RIGID_PLATE)[brand] : undefined;
    if (!brand || !t) return null;
    return {
      brand,
      src: `/media/${tipper ? 'tippers' : 'rigids'}/${brand}.webp`,
      plate: { x: t.x / TRUCK_PHOTO_SIZE.width, y: t.y / TRUCK_PHOTO_SIZE.height, w: t.w / TRUCK_PHOTO_SIZE.width, skew: t.skew },
    };
  }
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
