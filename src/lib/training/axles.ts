/**
 * Расчёт в практике «Jaa kuorma» (распредели груз) модуля «Massat ja mitat».
 *
 * Упрощённая учебная модель пятиосного автопоезда: седельный тягач 4×2
 * (управляемая и ведущая оси) и полуприцеп с тележкой из трёх осей.
 * Статика рычага в две ступени:
 *
 *   1. Прицеп опирается на шкворень и на центр тележки. Груз в точке x
 *      делится между ними обратно расстояниям: чем ближе к шкворню,
 *      тем больше на седло.
 *   2. Нагрузка на седло делится между осями тягача так же: седло стоит
 *      чуть впереди ведущей оси, поэтому большая часть уходит на неё.
 *
 * Главный урок модели — частичная разгрузка сзади: общая масса падает,
 * а ведущая ось перегружается, потому что оставшийся груз теперь ближе
 * к седлу.
 *
 * Без коэффициентов динамики, развесовки по колёсам и допусков — это
 * должно быть сказано под результатом. Лимиты и геометрия — в
 * AXLE_CONFIG: их подтверждает инструктор.
 *
 * Модуль без импортов намеренно: тесты гоняются голым `node --test`.
 */

/** Значения учебной задачи. ПОДТВЕРЖДАЕТ ИНСТРУКТОР. Массы — тонны, расстояния — метры. */
export const AXLE_CONFIG = {
  tractor: {
    /** Снаряжённый тягач: на управляемой и на ведущей оси. */
    steerTare: 5,
    driveTare: 2,
    /** Колёсная база: от управляемой до ведущей оси. */
    wheelbase: 3.8,
    /** Седло — от управляемой оси (чуть впереди ведущей). */
    fifthWheel: 3.15,
  },
  trailer: {
    tare: 7,
    /** Центр масс пустого прицепа — от передней стенки. */
    tareCenter: 6.8,
    /** Шкворень и центр тележки — от передней стенки. */
    kingpin: 1.2,
    bogie: 9.8,
  },
  /** Места для груза: ряды по два европаллета, 1,2 м каждый, от передней стенки. */
  slots: 11,
  slotLength: 1.2,
  /** Лимиты, т. Tieliikenne: неведущая ось 10, ведущая 11,5; тележка из трёх осей и поезд из пяти осей. */
  limits: { steer: 10, drive: 11.5, bogie: 24, total: 44 },
  /**
   * Минимальная доля массы поезда на ведущей оси — иначе тягач теряет
   * сцепление на подъёме и на льду. 25 % — норма ЕС (96/53/EY);
   * финскую цифру подтверждает инструктор.
   */
  minDriveShare: 0.25,
} as const;

export type AxleConfig = typeof AXLE_CONFIG;
export type AxleName = 'steer' | 'drive' | 'bogie';

/** Раскладка: масса на каждом месте, т; 0 — пусто. Длина — AXLE_CONFIG.slots. */
export type SlotLoads = readonly number[];

export type AxleLoads = Record<AxleName, number> & { total: number; cargo: number };

export type AxleFinding =
  | { level: 'error'; code: 'over_axle'; axle: AxleName; load: number; limit: number }
  | { level: 'error'; code: 'over_total'; load: number; limit: number }
  | { level: 'error'; code: 'unplaced'; count: number }
  | { level: 'warn'; code: 'drive_light'; share: number; min: number }
  | { level: 'ok'; code: 'ok'; total: number };

export function slotCenter(index: number, config: AxleConfig = AXLE_CONFIG): number {
  return config.slotLength * (index + 0.5);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function calcAxleLoads(slots: SlotLoads, config: AxleConfig = AXLE_CONFIG): AxleLoads {
  const { tractor, trailer } = config;
  const span = trailer.bogie - trailer.kingpin;

  /* Ступень 1: прицеп и груз делятся между шкворнем и тележкой. */
  let kingpin = (trailer.tare * (trailer.bogie - trailer.tareCenter)) / span;
  let cargo = 0;
  slots.forEach((mass, index) => {
    if (!(mass > 0)) return;
    cargo += mass;
    kingpin += (mass * (trailer.bogie - slotCenter(index, config))) / span;
  });
  const bogie = trailer.tare + cargo - kingpin;

  /* Ступень 2: нагрузка на седло делится между осями тягача. */
  const driveShare = tractor.fifthWheel / tractor.wheelbase;
  const drive = tractor.driveTare + kingpin * driveShare;
  const steer = tractor.steerTare + kingpin * (1 - driveShare);

  return {
    steer: round2(steer),
    drive: round2(drive),
    bogie: round2(bogie),
    total: round2(tractor.steerTare + tractor.driveTare + trailer.tare + cargo),
    cargo: round2(cargo),
  };
}

/**
 * Проверить раскладку: каждая ось и общая масса против лимита. `unplaced` —
 * сколько единиц груза из задания ещё не поставлено.
 */
export function checkAxleLoads(
  slots: SlotLoads,
  unplaced: number,
  config: AxleConfig = AXLE_CONFIG,
): AxleFinding[] {
  const loads = calcAxleLoads(slots, config);
  const findings: AxleFinding[] = [];

  if (unplaced > 0) findings.push({ level: 'error', code: 'unplaced', count: unplaced });

  for (const axle of ['steer', 'drive', 'bogie'] as const) {
    if (loads[axle] > config.limits[axle]) {
      findings.push({ level: 'error', code: 'over_axle', axle, load: loads[axle], limit: config.limits[axle] });
    }
  }
  if (loads.total > config.limits.total) {
    findings.push({ level: 'error', code: 'over_total', load: loads.total, limit: config.limits.total });
  }

  const share = loads.drive / loads.total;
  if (share < config.minDriveShare) {
    findings.push({ level: 'warn', code: 'drive_light', share: Math.round(share * 100), min: Math.round(config.minDriveShare * 100) });
  }

  if (!findings.some((f) => f.level === 'error')) findings.unshift({ level: 'ok', code: 'ok', total: loads.total });
  return findings;
}

/** Доля лимита для полосы на экране: 0–1, выше 1 — перегруз. */
export function axleRatio(loads: AxleLoads, axle: AxleName | 'total', config: AxleConfig = AXLE_CONFIG): number {
  return loads[axle] / config.limits[axle];
}
