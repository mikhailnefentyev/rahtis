/**
 * Топливо: виды и единицы, расход по заправкам, строки месячного отчёта.
 *
 * Один модуль без зависимостей: его читают тесты (node --test), а Node
 * без сборки не разрешает импорт соседнего .ts без расширения.
 */

/* ── Виды топлива ───────────────────────────────────────────────── */

/**
 * Виды топлива и единицы. Тот же список стоит ограничением в базе
 * (fuel_entries_product) — добавлять в обоих местах.
 *
 * Газ (LNG, LBG, CNG, CBG) продаётся в килограммах, остальное — в литрах.
 * Без зависимостей: модуль читают тесты (node --test).
 */

export const FUEL_PRODUCTS = ['DIESEL', 'HVO', 'ADBLUE', 'PETROL', 'LNG', 'LBG', 'CNG', 'CBG', 'OTHER'] as const;

export type FuelProduct = (typeof FUEL_PRODUCTS)[number];

/** Чем машина едет: жидкое топливо, газ. AdBlue и «прочее» в расход не входят. */
export type FuelGroup = 'LIQUID' | 'GAS' | null;

const GAS: readonly string[] = ['LNG', 'LBG', 'CNG', 'CBG'];
const LIQUID: readonly string[] = ['DIESEL', 'HVO', 'PETROL'];

export function isFuelProduct(value: unknown): value is FuelProduct {
  return typeof value === 'string' && (FUEL_PRODUCTS as readonly string[]).includes(value);
}

export function fuelUnit(product: string): 'kg' | 'l' {
  return GAS.includes(product) ? 'kg' : 'l';
}

export function fuelGroup(product: string): FuelGroup {
  if (LIQUID.includes(product)) return 'LIQUID';
  if (GAS.includes(product)) return 'GAS';
  return null;
}

/** Предел одной строки: больше двух тонн за заправку не бывает (ограничение базы). */
export const FUEL_MAX_QUANTITY = 2000;

/* ── Расход ─────────────────────────────────────────────────────── */

/**
 * Расход топлива по заправкам.
 *
 * Метод полного бака: между двумя полными заправками машина сожгла
 * столько, сколько залили во второй и во всех промежуточных, а проехала
 * разницу одометра. Интервал относится к месяцу закрывающей заправки.
 * Строки без одометра (часто — из отчёта заправщика) не открывают и не
 * закрывают интервал, но их литры входят в тот, внутри которого они лежат.
 *
 * Жидкое топливо и газ считаются отдельно (л/100 км и кг/100 км). AdBlue —
 * в процентах от дизеля за месяц, в расход не входит.
 *
 * Что не похоже на правду, не портит среднее, а помечается: одометр
 * меньше прошлого, интервал длиннее 5000 км или расход вне 8–80 на 100 км.
 *
 * Без зависимостей: модуль читают тесты (node --test).
 */

export type FuelRow = {
  id: string;
  vehicle_id: string;
  filled_at: string;
  product: string;
  quantity: number;
  amount_cents: number | null;
  odometer_km: number | null;
  full_tank: boolean;
};

export type FuelFlag = 'ODOMETER_BACK' | 'OUTLIER';

export type MonthStat = {
  /** YYYY-MM по Хельсинки. */
  month: string;
  liquidL: number;
  gasKg: number;
  adblueL: number;
  amountCents: number;
  /** Километры интервалов, закрытых в этом месяце (жидкое и газ вместе — у машины одна дорога). */
  km: number;
  /** л/100 км жидкого топлива; null — интервала в месяце нет. */
  l100: number | null;
  kg100: number | null;
  /** AdBlue, % от жидкого топлива. */
  adbluePct: number | null;
  /** Стоимость топлива на километр, центы: расход × средняя цена единицы в месяце. */
  centsPerKm: number | null;
};

export type FuelStats = {
  byVehicle: Map<string, MonthStat[]>;
  fleet: MonthStat[];
  flags: Map<string, FuelFlag>;
};

const ZONE = 'Europe/Helsinki';
const monthFormat = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit' });

export function monthOf(iso: string): string {
  return monthFormat.format(new Date(iso)).slice(0, 7);
}

type Acc = {
  liquidL: number;
  gasKg: number;
  adblueL: number;
  amountCents: number;
  /* Цена: сумма и объём строк, у которых сумма известна, по группе. */
  liquidPaid: number;
  liquidPaidQty: number;
  gasPaid: number;
  gasPaidQty: number;
  liquidIntervalL: number;
  liquidIntervalKm: number;
  gasIntervalKg: number;
  gasIntervalKm: number;
  km: number;
};

const emptyAcc = (): Acc => ({
  liquidL: 0,
  gasKg: 0,
  adblueL: 0,
  amountCents: 0,
  liquidPaid: 0,
  liquidPaidQty: 0,
  gasPaid: 0,
  gasPaidQty: 0,
  liquidIntervalL: 0,
  liquidIntervalKm: 0,
  gasIntervalKg: 0,
  gasIntervalKm: 0,
  km: 0,
});

function accOf(map: Map<string, Acc>, month: string): Acc {
  let acc = map.get(month);
  if (!acc) {
    acc = emptyAcc();
    map.set(month, acc);
  }
  return acc;
}

const MIN_PER_100 = 8;
const MAX_PER_100 = 80;
const MAX_INTERVAL_KM = 5000;

/** Интервалы одной машины по одной группе топлива. */
function intervals(
  rows: FuelRow[],
  group: Exclude<FuelGroup, null>,
  months: Map<string, Acc>,
  flags: Map<string, FuelFlag>,
): void {
  const own = rows.filter((row) => fuelGroup(row.product) === group);
  let open: FuelRow | null = null;
  let poured = 0;

  for (const row of own) {
    if (open === null) {
      if (row.full_tank && row.odometer_km != null) open = row;
      continue;
    }

    poured += row.quantity;
    if (!row.full_tank || row.odometer_km == null) continue;

    const km = row.odometer_km - (open.odometer_km ?? 0);
    const per100 = km > 0 ? (poured / km) * 100 : Infinity;

    if (km <= 0) {
      flags.set(row.id, 'ODOMETER_BACK');
    } else if (km > MAX_INTERVAL_KM || per100 < MIN_PER_100 || per100 > MAX_PER_100) {
      flags.set(row.id, 'OUTLIER');
    } else {
      const acc = accOf(months, monthOf(row.filled_at));
      if (group === 'LIQUID') {
        acc.liquidIntervalL += poured;
        acc.liquidIntervalKm += km;
      } else {
        acc.gasIntervalKg += poured;
        acc.gasIntervalKm += km;
      }
    }

    open = row;
    poured = 0;
  }
}

function finish(month: string, acc: Acc): MonthStat {
  const round1 = (value: number) => Math.round(value * 10) / 10;
  const l100 = acc.liquidIntervalKm > 0 ? round1((acc.liquidIntervalL / acc.liquidIntervalKm) * 100) : null;
  const kg100 = acc.gasIntervalKm > 0 ? round1((acc.gasIntervalKg / acc.gasIntervalKm) * 100) : null;

  /* Цена за километр: по каждой группе расход × средняя цена её единицы. */
  let centsPerKm: number | null = null;
  if (l100 != null && acc.liquidPaidQty > 0) {
    centsPerKm = (centsPerKm ?? 0) + (l100 / 100) * (acc.liquidPaid / acc.liquidPaidQty);
  }
  if (kg100 != null && acc.gasPaidQty > 0) {
    centsPerKm = (centsPerKm ?? 0) + (kg100 / 100) * (acc.gasPaid / acc.gasPaidQty);
  }

  return {
    month,
    liquidL: round1(acc.liquidL),
    gasKg: round1(acc.gasKg),
    adblueL: round1(acc.adblueL),
    amountCents: Math.round(acc.amountCents),
    km: Math.round(Math.max(acc.liquidIntervalKm, acc.gasIntervalKm)),
    l100,
    kg100,
    adbluePct: acc.liquidL > 0 && acc.adblueL > 0 ? round1((acc.adblueL / acc.liquidL) * 100) : null,
    centsPerKm: centsPerKm == null ? null : round1(centsPerKm),
  };
}

function sumInto(target: Acc, source: Acc): void {
  for (const key of Object.keys(source) as (keyof Acc)[]) target[key] += source[key];
}

/** Помесячно по машинам и по парку. Месяцы — по возрастанию, только те, где что-то было. */
export function fuelStats(rows: FuelRow[]): FuelStats {
  const flags = new Map<string, FuelFlag>();
  const perVehicle = new Map<string, Map<string, Acc>>();

  const sorted = [...rows].sort((a, b) => a.filled_at.localeCompare(b.filled_at));
  const byVehicle = new Map<string, FuelRow[]>();
  for (const row of sorted) {
    const list = byVehicle.get(row.vehicle_id) ?? [];
    list.push(row);
    byVehicle.set(row.vehicle_id, list);
  }

  for (const [vehicle, list] of byVehicle) {
    const months = new Map<string, Acc>();
    perVehicle.set(vehicle, months);

    let lastOdometer: number | null = null;
    for (const row of list) {
      const acc = accOf(months, monthOf(row.filled_at));
      const group = fuelGroup(row.product);
      const amount = row.amount_cents ?? 0;
      acc.amountCents += amount;
      if (group === 'LIQUID') {
        acc.liquidL += row.quantity;
        if (row.amount_cents != null) {
          acc.liquidPaid += amount;
          acc.liquidPaidQty += row.quantity;
        }
      } else if (group === 'GAS') {
        acc.gasKg += row.quantity;
        if (row.amount_cents != null) {
          acc.gasPaid += amount;
          acc.gasPaidQty += row.quantity;
        }
      } else if (row.product === 'ADBLUE') {
        acc.adblueL += row.quantity;
      }

      /* Одометр меньше прошлого — у любой строки, не только у закрывающей интервал. */
      if (row.odometer_km != null) {
        if (lastOdometer != null && row.odometer_km < lastOdometer) flags.set(row.id, 'ODOMETER_BACK');
        else lastOdometer = row.odometer_km;
      }
    }

    intervals(list, 'LIQUID', months, flags);
    intervals(list, 'GAS', months, flags);
  }

  const fleetAcc = new Map<string, Acc>();
  const result = new Map<string, MonthStat[]>();
  for (const [vehicle, months] of perVehicle) {
    const stats: MonthStat[] = [];
    for (const month of [...months.keys()].sort()) {
      const acc = months.get(month)!;
      sumInto(accOf(fleetAcc, month), acc);
      stats.push(finish(month, acc));
    }
    result.set(vehicle, stats);
  }

  const fleet = [...fleetAcc.keys()].sort().map((month) => finish(month, fleetAcc.get(month)!));
  return { byVehicle: result, fleet, flags };
}

/** Последние n месяцев до месяца `last` включительно: YYYY-MM по возрастанию. */
export function monthsBack(last: string, n: number): string[] {
  const [year, month] = last.split('-').map(Number);
  const out: string[] = [];
  for (let back = n - 1; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1));
    out.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/* ── Месячный отчёт заправщика ──────────────────────────────────── */

/**
 * Строки месячного отчёта заправщика: от ответа разбора (n8n + OpenAI) к
 * строкам проверки.
 *
 * Разбору не верим на слово: каждое поле проверяется здесь, а строка с
 * непонятным продуктом, датой или объёмом отбрасывается. Машина ищется
 * по номеру (без пробелов и дефисов), потом по запомненной карте.
 *
 * Без зависимостей с алиасами: модуль читают тесты (node --test).
 */

export type RawReportRow = Record<string, unknown>;

export type ImportRow = {
  /** YYYY-MM-DD и HH:MM по местному времени отчёта; время может быть неизвестно. */
  date: string;
  time: string | null;
  plate: string | null;
  card_ref: string | null;
  station: string | null;
  product: FuelProduct;
  quantity: number;
  amount_cents: number | null;
  odometer_km: number | null;
  /** Машина, найденная по номеру или карте; null — выберет перевозчик. */
  vehicle_id: string | null;
};

export type VehicleRef = { id: string; plate: string };

export const plateKey = (plate: string): string => plate.toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g, '');
export const cardKey = (card: string): string => card.replace(/\s/g, '');

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const out = String(value).trim().slice(0, max);
  return out.length > 0 ? out : null;
};

/** Число из «1 234,56», «1234.56» или числа. */
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let s = value.replace(/[\s €]/g, '');
  if (s.includes(',') && s.includes('.')) {
    /* Последний разделитель — дробный: «1.234,56» и «1,234.56». */
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Дата: YYYY-MM-DD, DD.MM.YYYY или DD.MM.YY. */
export function parseDate(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(s);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(year, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (y < 2020 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseTime(value: unknown): string | null {
  const m = typeof value === 'string' ? /^(\d{1,2})[:.](\d{2})/.exec(value.trim()) : null;
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Строки разбора → строки проверки. Порядок — по дате и времени. */
export function normalizeReport(
  raw: unknown,
  vehicles: VehicleRef[],
  cards: { card_ref: string; vehicle_id: string }[],
): ImportRow[] {
  if (!Array.isArray(raw)) return [];
  const byPlate = new Map(vehicles.map((v) => [plateKey(v.plate), v.id]));
  const byCard = new Map(cards.map((c) => [cardKey(c.card_ref), c.vehicle_id]));

  const rows: ImportRow[] = [];
  for (const item of raw.slice(0, 1000) as RawReportRow[]) {
    if (!item || typeof item !== 'object') continue;
    const product = typeof item.product === 'string' ? item.product.toUpperCase() : '';
    const quantity = parseNumber(item.quantity);
    const date = parseDate(item.date);
    if (!isFuelProduct(product) || quantity == null || quantity <= 0 || quantity > FUEL_MAX_QUANTITY || !date) continue;

    const amount = parseNumber(item.amount_gross);
    const odometer = parseNumber(item.odometer);
    const plate = text(item.plate, 16);
    const card = text(item.card, 40);
    const cardRef = card ? cardKey(card) : null;

    rows.push({
      date,
      time: parseTime(item.time),
      plate: plate ? plate.toUpperCase() : null,
      card_ref: cardRef && /^[A-Za-z0-9*-]{3,40}$/.test(cardRef) ? cardRef : null,
      station: text(item.station, 120),
      product,
      quantity: Math.round(quantity * 100) / 100,
      amount_cents: amount != null && amount >= 0 && amount < 100000 ? Math.round(amount * 100) : null,
      odometer_km: odometer != null && odometer > 0 && odometer < 5000000 ? Math.round(odometer) : null,
      vehicle_id: (plate && byPlate.get(plateKey(plate))) || (cardRef && byCard.get(cardRef)) || null,
    });
  }

  return rows.sort((a, b) => `${a.date} ${a.time ?? '12:00'}`.localeCompare(`${b.date} ${b.time ?? '12:00'}`));
}
