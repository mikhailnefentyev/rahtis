/*
 * Стол: какая своя машина подходит заказу (6.11.2026).
 *
 * Чистый модуль без базы и путей @/ — его гоняет node --test
 * (match.test.mjs). Годность и прямые километры считает база
 * (desk_matches, fleet_free_points) теми же проверками, что у отклика;
 * здесь — порожний пробег по дорогам (оценка) и порядок машин.
 *
 * Порядок: подходит и успевает к забору, потом меньше порожних км.
 * Машина без известной точки — после машин с километрами.
 */

/** Откуда считаются порожние км: конец идущего рейса, GPS, прошлый рейс, база. */
export type FreeSource = 'ORDER' | 'GPS' | 'LAST' | 'BASE';

/** Почему не подходит: вид, размер, кузов или загрузка, вес. */
export type Misfit = 'CLASS' | 'SIZE' | 'BODY' | 'WEIGHT';

/** Дорога длиннее прямой: оценка без маршрутизатора. */
export const ROAD_FACTOR = 1.25;

export type MatchRow = {
  orderId: string;
  vehicleId: string;
  comboId: string | null;
  misfit: string | null;
  /** Прямая до забора, кратно 5 км; null — нет точки машины или забора. */
  lineKm: number | null;
};

export type FreePoint = {
  vehicleId: string;
  source: FreeSource;
  afterRef: string | null;
  /** Местное время (Хельсинки) без пояса: «2026-11-06T14:00:00». */
  freeLocal: string;
};

export type MatchOrder = { id: string; pickupDate: string | null; pickupTime: string | null };

export type MatchChoice = {
  /** Значение для отклика: id машины или «c:<id сцепки>» (takeOrderAction). */
  value: string;
  vehicleId: string;
  plate: string;
  /** Имя сцепки, если отклик сцепкой. */
  comboName: string | null;
  source: FreeSource | null;
  afterRef: string | null;
  /** «2026-11-06T14:00»; null — точки нет, считаем свободной сейчас. */
  freeLocal: string | null;
  /** Успевает к забору (или время забора не задано). */
  inTime: boolean;
  /** Оценка порожнего пробега по дорогам, кратно 5 км. */
  emptyKm: number | null;
};

export type OrderMatch = {
  /** Подходящие машины по порядку; первая — для кнопки. */
  choices: MatchChoice[];
  /** Когда подходящих нет: ближайшая к годности причина или NONE (нет машин на рейсы). */
  reason: Misfit | 'NONE' | null;
};

/** Чем ближе к годности, тем полезнее подсказка: вес > кузов > размер > вид. */
const MISFIT_ORDER: Misfit[] = ['WEIGHT', 'BODY', 'SIZE', 'CLASS'];

/** Прямая → дорога, кратно 5 км. */
export function roadKm(lineKm: number | null): number | null {
  if (lineKm === null || !Number.isFinite(lineKm)) return null;
  return Math.round((lineKm * ROAD_FACTOR) / 5) * 5;
}

/** «2026-11-06 14:00:00+…» / «2026-11-06T14:00:00» → «2026-11-06T14:00». */
export function localMinute(value: string): string {
  return value.replace(' ', 'T').slice(0, 16);
}

/** Момент забора местным временем; без времени — конец дня, как в backhaul_suggestions. */
export function pickupLocal(order: MatchOrder): string | null {
  if (!order.pickupDate) return null;
  return `${order.pickupDate}T${(order.pickupTime ?? '23:59').slice(0, 5)}`;
}

function compare(a: MatchChoice, b: MatchChoice): number {
  if (a.inTime !== b.inTime) return a.inTime ? -1 : 1;
  const ak = a.emptyKm ?? Number.POSITIVE_INFINITY;
  const bk = b.emptyKm ?? Number.POSITIVE_INFINITY;
  if (ak !== bk) return ak - bk;
  /* Свободная раньше — выше; при равенстве сцепка (с прицепом рейса) раньше голой машины. */
  const af = a.freeLocal ?? '';
  const bf = b.freeLocal ?? '';
  if (af !== bf) return af < bf ? -1 : 1;
  if (Boolean(a.comboName) !== Boolean(b.comboName)) return a.comboName ? -1 : 1;
  return a.plate.localeCompare(b.plate);
}

/**
 * Машины для каждого заказа. У одной машины — один вариант (лучший:
 * сцепка или сама машина), чтобы «другие машины» были другими машинами.
 */
export function matchDesk(
  orders: MatchOrder[],
  rows: MatchRow[],
  points: FreePoint[],
  plates: Record<string, string>,
  comboNames: Record<string, string> = {},
): Record<string, OrderMatch> {
  const pointBy = new Map(points.map((p) => [p.vehicleId, p]));
  const rowsBy = new Map<string, MatchRow[]>();
  for (const row of rows) {
    const list = rowsBy.get(row.orderId);
    if (list) list.push(row);
    else rowsBy.set(row.orderId, [row]);
  }

  const result: Record<string, OrderMatch> = {};
  for (const order of orders) {
    const list = rowsBy.get(order.id) ?? [];
    const pickup = pickupLocal(order);
    const best = new Map<string, MatchChoice>();

    for (const row of list) {
      if (row.misfit) continue;
      const plate = plates[row.vehicleId];
      if (!plate) continue;
      const point = pointBy.get(row.vehicleId);
      const freeLocal = point ? localMinute(point.freeLocal) : null;
      const choice: MatchChoice = {
        value: row.comboId ? `c:${row.comboId}` : row.vehicleId,
        vehicleId: row.vehicleId,
        plate,
        comboName: row.comboId ? (comboNames[row.comboId] ?? plate) : null,
        source: point?.source ?? null,
        afterRef: point?.afterRef ?? null,
        freeLocal,
        inTime: !pickup || !freeLocal || freeLocal <= pickup,
        emptyKm: roadKm(row.lineKm),
      };
      const prev = best.get(row.vehicleId);
      if (!prev || compare(choice, prev) < 0) best.set(row.vehicleId, choice);
    }

    const choices = [...best.values()].sort(compare);
    let reason: OrderMatch['reason'] = null;
    if (!choices.length) {
      const seen = new Set(list.map((r) => r.misfit));
      reason = MISFIT_ORDER.find((m) => seen.has(m)) ?? 'NONE';
    }
    result[order.id] = { choices, reason };
  }
  return result;
}
