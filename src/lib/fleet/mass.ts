/**
 * Разрешённая масса машины и сцепки по стране (26.10.2026).
 *
 * Самосвальная работа меряется сцепкой: «5-осный nuppi + 4-осный
 * кассетный прицеп» в Финляндии везёт до 76 т, «2-осный тягач + 3-осный
 * полуприцеп» в Германии — до 40 т. Отсюда грузоподъёмность (разрешённая
 * масса минус тара) и предупреждение о перегрузе на весах.
 *
 * Правила — по числу осей. Там, где закон считает ещё и расстояние между
 * крайними осями (Швеция, Норвегия, Дания) или класс дороги, результат —
 * верхняя граница (basis 'upper'), и интерфейс говорит это словами.
 *
 * Источники (проверено 26.10.2026):
 *   FI — таблица SKAL «Mitat ja massat» (skal.fi/kuljetusala/ajoneuvosaadokset/mitat-ja-massat),
 *        совпадает с Traficom (HCT Forum: 10 осей 74 т, 11+ — 76 т). Сверить с
 *        Finlex 1257/1992 перед тем, как показывать как точное значение.
 *   SE — BK1 64 т, BK4 74 т (Trafikverket, обзор VBG).
 *   NO — 60 т на сети модульных сцепок (≥ 19 м между крайними осями), иначе 50 т (lastebil.no, Lovdata 2014-01-15-28).
 *   DK — 7+ осей 56 т, с 1.1.2027 — 58 т; модульная сцепка 60 т (DTL, 9.1.2026).
 *   DE и прочие ЕС — директива 96/53/EC: 18/26/32 т одиночные, 36 т 4 оси, 40 т 5+ осей (ITF).
 *   PL, LT, LV, EE — пока по директиве; национальные исключения не проверены.
 */

export type MassCountry = 'FI' | 'SE' | 'NO' | 'DK' | 'DE' | 'PL' | 'LT' | 'LV' | 'EE';
export const MASS_COUNTRIES: readonly MassCountry[] = ['FI', 'SE', 'NO', 'DK', 'DE', 'PL', 'LT', 'LV', 'EE'];

/** Класс дороги там, где он меняет предел: SE BK1/BK4, NO сеть 50/60 т, DK обычная/модульная. */
export type RoadClass = 'BK1' | 'BK4' | 'NET50' | 'NET60' | 'STANDARD' | 'EMS';
export const ROAD_CLASSES: Partial<Record<MassCountry, readonly RoadClass[]>> = {
  SE: ['BK1', 'BK4'],
  NO: ['NET50', 'NET60'],
  DK: ['STANDARD', 'EMS'],
};

export type MotorUnit = {
  /** TRACTOR — тягач под полуприцеп, TRUCK — грузовик с кузовом (nuppi). */
  kind: 'TRACTOR' | 'TRUCK';
  axles: number;
  grossMaxKg?: number | null;
  tareKg?: number | null;
};

export type TrailerUnit = {
  kind: 'SEMI' | 'FULL' | 'CENTER_AXLE';
  axles: number;
  /** ≥ 65 % массы прицепа на сдвоенных колёсах (FI: 68/76 т вместо 64/69 т). */
  twinWheels: boolean;
  grossMaxKg?: number | null;
  tareKg?: number | null;
};

export type CombinationProblem = 'SEMI_NEEDS_TRACTOR' | 'TRAILER_NEEDS_TRUCK' | 'TOO_MANY_TRAILERS';

export type MassResult = {
  /** Предел по закону. */
  legalKg: number;
  /** Сумма масс по техпаспортам, если известна у всех частей. */
  technicalKg: number | null;
  /** Что реально можно: меньшее из закона и техпаспорта. */
  limitKg: number;
  /** Тара сцепки, если известна у всех частей. */
  tareKg: number | null;
  /** Грузоподъёмность: limitKg − tareKg. */
  payloadKg: number | null;
  /** exact — по осям и закону; upper — верхняя граница, зависит от расстояния между осями или дороги. */
  basis: 'exact' | 'upper';
  totalAxles: number;
};

const EU_RIGID: Record<number, number> = { 2: 18_000, 3: 26_000, 4: 32_000 };
const FI_RIGID: Record<number, number> = { 2: 18_000, 3: 28_000, 4: 35_000, 5: 42_000 };
const FI_COMBINATION: Record<number, number> = { 4: 36_000, 5: 44_000, 6: 53_000, 7: 60_000, 8: 64_000, 9: 69_000, 10: 74_000 };

function rigid(table: Record<number, number>, axles: number): number {
  const keys = Object.keys(table).map(Number);
  const top = Math.max(...keys);
  return table[Math.min(Math.max(axles, Math.min(...keys)), top)];
}

/** EU 96/53: сцепка 4 оси — 36 т, 5 и больше — 40 т; меньше 4 осей — как одиночная трёхосная. */
function euCombination(totalAxles: number): number {
  if (totalAxles >= 5) return 40_000;
  if (totalAxles === 4) return 36_000;
  return 26_000;
}

function finnishCombination(totalAxles: number, twin: boolean, centerAxleOnly: boolean): number {
  let kg: number;
  if (totalAxles >= 11) kg = 76_000;
  else if (totalAxles >= 9 && twin) kg = 76_000;
  else if (totalAxles === 8 && twin) kg = 68_000;
  else if (totalAxles < 4) kg = 28_000;
  else kg = FI_COMBINATION[totalAxles];
  /* Грузовик с прицепом с центральной осью — не больше 50 т при любом числе осей. */
  return centerAxleOnly ? Math.min(kg, 50_000) : kg;
}

export function combinationProblem(motor: MotorUnit, trailers: readonly TrailerUnit[]): CombinationProblem | null {
  if (trailers.length > 2) return 'TOO_MANY_TRAILERS';
  const first = trailers[0];
  if (first?.kind === 'SEMI' && motor.kind !== 'TRACTOR') return 'SEMI_NEEDS_TRACTOR';
  if (first && first.kind !== 'SEMI' && motor.kind !== 'TRUCK') return 'TRAILER_NEEDS_TRUCK';
  /* Второй прицеп (A-/B-double) встаёт за первым; полуприцеп вторым — только за полуприцепом (B-линк). */
  return null;
}

export function legalMassKg(
  country: MassCountry,
  motor: MotorUnit,
  trailers: readonly TrailerUnit[],
  options: { roadClass?: RoadClass; on?: string } = {},
): { kg: number; basis: 'exact' | 'upper' } {
  const totalAxles = motor.axles + trailers.reduce((sum, t) => sum + t.axles, 0);
  const solo = trailers.length === 0;
  const on = options.on ?? new Date().toISOString().slice(0, 10);

  switch (country) {
    case 'FI': {
      if (solo) return { kg: rigid(FI_RIGID, motor.axles), basis: motor.axles >= 3 && motor.axles <= 4 ? 'upper' : 'exact' };
      const twin = trailers.every((t) => t.twinWheels);
      const centerOnly = trailers.length === 1 && trailers[0].kind === 'CENTER_AXLE';
      return { kg: finnishCombination(totalAxles, twin, centerOnly), basis: 'exact' };
    }
    case 'SE': {
      if (solo) return { kg: rigid(EU_RIGID, motor.axles), basis: 'upper' };
      const cap = options.roadClass === 'BK4' ? 74_000 : 64_000;
      return { kg: Math.min(cap, totalAxles >= 5 ? cap : euCombination(totalAxles)), basis: 'upper' };
    }
    case 'NO': {
      if (solo) return { kg: rigid(EU_RIGID, motor.axles), basis: 'upper' };
      const cap = options.roadClass === 'NET60' ? 60_000 : 50_000;
      return { kg: Math.min(cap, totalAxles >= 5 ? cap : euCombination(totalAxles)), basis: 'upper' };
    }
    case 'DK': {
      if (solo) return { kg: rigid(EU_RIGID, motor.axles), basis: 'upper' };
      if (options.roadClass === 'EMS') return { kg: 60_000, basis: 'upper' };
      if (totalAxles >= 7) return { kg: on >= '2027-01-01' ? 58_000 : 56_000, basis: 'upper' };
      return { kg: euCombination(totalAxles), basis: 'upper' };
    }
    case 'DE':
      return { kg: solo ? rigid(EU_RIGID, motor.axles) : euCombination(totalAxles), basis: 'exact' };
    default:
      /* PL, LT, LV, EE: директива ЕС; национальные исключения не проверены. */
      return { kg: solo ? rigid(EU_RIGID, motor.axles) : euCombination(totalAxles), basis: 'upper' };
  }
}

export function combinationMass(
  country: MassCountry,
  motor: MotorUnit,
  trailers: readonly TrailerUnit[],
  options: { roadClass?: RoadClass; on?: string } = {},
): MassResult {
  const legal = legalMassKg(country, motor, trailers, options);
  const parts = [motor, ...trailers];

  const technicalKg = parts.every((p) => p.grossMaxKg) ? parts.reduce((s, p) => s + (p.grossMaxKg ?? 0), 0) : null;
  const tareKg = parts.every((p) => p.tareKg) ? parts.reduce((s, p) => s + (p.tareKg ?? 0), 0) : null;
  const limitKg = technicalKg ? Math.min(legal.kg, technicalKg) : legal.kg;

  return {
    legalKg: legal.kg,
    technicalKg,
    limitKg,
    tareKg,
    payloadKg: tareKg !== null ? Math.max(0, limitKg - tareKg) : null,
    basis: legal.basis,
    totalAxles: parts.reduce((s, p) => s + p.axles, 0),
  };
}

/** Перегруз на весах: сколько килограммов сверх предела (0 — в норме). */
export function overloadKg(grossKg: number, limitKg: number): number {
  return Math.max(0, Math.round(grossKg - limitKg));
}

export function isMassCountry(value: unknown): value is MassCountry {
  return typeof value === 'string' && (MASS_COUNTRIES as readonly string[]).includes(value);
}
