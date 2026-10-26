/**
 * Работа на объекте: грузы, часы дня и сумма по объекту (26.10.2026).
 *
 * Часы — как считают финские самосвальщики: от прибытия на объект до
 * последней выгрузки плюс запас (обычно 30 минут). Если водитель сам
 * нажал «закончил», конец — это нажатие.
 */

/*
 * Грузы. Шесть цифр — код по перечню отходов (jäteluettelo, решение
 * Комиссии 2000/532/EY): на такой груз нужен документ на перевозку
 * (siirtoasiakirja, jätelaki 121 §). Буквенные — товарный материал, не
 * отход. registry — подаётся ли документ в реестр SIIRTO: да для
 * загрязнённого грунта и строительных отходов, нет для чистого грунта.
 * hazardous — опасный отход (в перечне со звёздочкой): в других странах
 * от него зависит, нужна ли госсистема (eANV, Avfallsregistret…).
 */
export const MATERIALS = [
  { code: '170504', waste: true, hazardous: false, registry: false },
  { code: '170506', waste: true, hazardous: false, registry: false },
  { code: '170503', waste: true, hazardous: true, registry: true },
  { code: '170107', waste: true, hazardous: false, registry: true },
  { code: '170302', waste: true, hazardous: false, registry: true },
  { code: '170904', waste: true, hazardous: false, registry: true },
  { code: 'SORA', waste: false, hazardous: false, registry: false },
  { code: 'MURSKE', waste: false, hazardous: false, registry: false },
  { code: 'HIEKKA', waste: false, hazardous: false, registry: false },
  { code: 'MULTA', waste: false, hazardous: false, registry: false },
  { code: 'LOUHE', waste: false, hazardous: false, registry: false },
] as const;

export type MaterialCode = (typeof MATERIALS)[number]['code'];

export function isMaterialCode(value: unknown): value is MaterialCode {
  return MATERIALS.some((m) => m.code === value);
}

export function material(code: string) {
  return MATERIALS.find((m) => m.code === code) ?? null;
}

/** «17 05 04», опасный — «17 05 03*»: как код пишут в документах. */
export function wasteCodeLabel(code: string): string {
  if (!/^\d{6}$/.test(code)) return code;
  return `${code.slice(0, 2)} ${code.slice(2, 4)} ${code.slice(4)}${material(code)?.hazardous ? '*' : ''}`;
}

export type DayTimes = {
  arrivedAt: string;
  endedAt: string | null;
  bufferMinutes: number;
  /** Времена выгрузок рейсов дня. */
  unloads: readonly string[];
};

/**
 * Конец рабочего дня: последняя выгрузка + запас (обычно 30 мин) — так
 * финские водители и пишут вечернее время. Нажатое «закончил» его не
 * укорачивает: водитель, нажавший сразу после выгрузки, не теряет запас;
 * нажал позже (работал на объекте без рейсов) — считается нажатие.
 * Без рейсов и без нажатия дня ещё нет конца — null.
 */
export function dayEnd(day: DayTimes): string | null {
  const last = day.unloads.length ? day.unloads.reduce((a, b) => (a > b ? a : b)) : null;
  const byUnload = last ? new Date(new Date(last).getTime() + day.bufferMinutes * 60_000).toISOString() : null;
  if (day.endedAt && byUnload) return new Date(day.endedAt) > new Date(byUnload) ? day.endedAt : byUnload;
  return day.endedAt ?? byUnload;
}

/** Часы дня в минутах; null — день ещё не закончен. */
export function dayMinutes(day: DayTimes): number | null {
  const end = dayEnd(day);
  if (!end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(day.arrivedAt).getTime()) / 60_000));
}

/** 9 ч 15 мин → «9:15». */
export function hoursLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

export type Pricing = 'HOUR' | 'LOAD' | 'TONNE';

/**
 * Сумма по объекту без ALV, в центах: часы × ставка, рейсы × ставка или
 * тонны нетто × ставка. Часы — по закрытым дням; тонны — по рейсам с весами.
 */
export function siteAmountCents(pricing: Pricing, rateCents: number, totals: { minutes: number; loads: number; netKg: number }): number {
  switch (pricing) {
    case 'HOUR':
      return Math.round((totals.minutes / 60) * rateCents);
    case 'LOAD':
      return totals.loads * rateCents;
    case 'TONNE':
      return Math.round((totals.netKg / 1000) * rateCents);
  }
}
