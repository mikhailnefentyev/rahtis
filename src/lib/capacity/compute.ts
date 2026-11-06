/*
 * Догрузы (6.11.2026): свободное место в машине по ходу рейса.
 *
 * Чистый модуль без базы и путей @/ — его гоняет node --test.
 *
 * Модель:
 *   · вместимость — сцепка из конструктора (машина + прицеп рейса), без
 *     неё — машина и прицеп по отдельности; неизвестная часть прицепа
 *     добавляет ноль (лучше недодать места, чем продать лишнее);
 *   · заказ занимает свои погрузочные метры и вес самой тяжёлой точки
 *     (как app.order_max_weight_kg) от первой погрузки до последней
 *     выгрузки. Промежуточная выгрузка места не освобождает: сколько
 *     снято — неизвестно;
 *   · время точки без часа — весь день (с 00:00 по 23:59): заказы одного
 *     дня без времени считаются едущими вместе;
 *   · перецеп, контейнер и самосвал занимают машину целиком;
 *   · «отрезок» (run) — непрерывная часть маршрута, где в машине есть
 *     груз; свободное место отрезка — наименьшее по его участкам.
 * Паллеты в RAHTIS не моделируются: их число перевозчик вписывает сам.
 */

export type Dims = { ldm: number | null; kg: number | null; pallets: number | null };

export type TripStopInput = {
  sequence: number;
  role: string;
  city: string;
  country: string | null;
  lat: number | null;
  lon: number | null;
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:MM или HH:MM:SS */
  time: string | null;
  weightKg: number | null;
  completed: boolean;
};

export type TripOrderInput = {
  id: string;
  ref: string;
  haulKind: string;
  ldm: number | null;
  pallets?: number | null;
  stops: TripStopInput[];
};

export type UnitInput = { ldm: number | null; payloadKg: number | null };

export type CapacityInput = {
  vehicleClass: string;
  vehicle: UnitInput;
  trailer?: UnitInput | null;
  combo?: UnitInput | null;
  pallets?: number | null;
};

export type Place = { city: string; country: string | null; lat: number | null; lon: number | null };

export type Leg = { from: Place; to: Place; onboard: Dims; free: Dims };

export type Proposal = {
  vehicleId: string;
  /** Первый заказ отрезка — ключ предложения вместе с машиной. */
  anchorOrderId: string;
  orderIds: string[];
  refs: string[];
  from: Place;
  to: Place;
  availableFrom: string;
  availableTo: string;
  capacity: Dims;
  onboard: Dims;
  free: Dims;
  legs: Leg[];
  /** Отрезок начался: машина прошла его первую точку. */
  started: boolean;
  /** Есть что показать: место выше порога, отрезок не начался и не в прошлом. */
  offerable: boolean;
};

const LOAD_ROLES = new Set(['PICKUP', 'EXTRA_LOAD']);
const UNLOAD_ROLES = new Set(['DELIVERY', 'EXTRA_UNLOAD']);
/** Груз едет в кузове перевозчика — только тогда в машине бывает место. */
export const GROUPAGE_HAULS = new Set(['VAN', 'TRUCK', 'SEMI']);

/** Меньше этого — не место, а щель: не предлагаем. */
export const MIN_FREE_LDM = 1;
export const MIN_FREE_KG = 500;
/** Полуприцеп до 8 м из 13,6 — частичная загрузка. */
export const PARTIAL_SEMI_LDM = 8;

/** Каботаж: регламент 1072/2009, ст. 8 (ред. 2020/1055). */
export const CABOTAGE = { maxOps: 3, days: 7, coolingDays: 4 } as const;

/** Координата для показа и поиска — сетка 0,1° (как у стола): точный адрес не вычисляется. */
export function coarse(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 10) / 10;
}

export function coarsePlace(place: Place): Place {
  return { ...place, lat: coarse(place.lat), lon: coarse(place.lon) };
}

const sum = (a: number | null, b: number | null): number | null => (a === null ? null : a + (b ?? 0));

/** Вместимость машины на рейсе. */
export function vehicleCapacity(input: CapacityInput): Dims {
  const pallets = input.pallets ?? null;
  if (input.combo && (input.combo.ldm !== null || input.combo.payloadKg !== null)) {
    return { ldm: input.combo.ldm, kg: input.combo.payloadKg, pallets };
  }
  const trailer = input.trailer ?? null;
  if (input.vehicleClass === 'TRACTOR') {
    /* Тягач без полуприцепа рейса места не имеет. */
    return trailer ? { ldm: trailer.ldm, kg: trailer.payloadKg, pallets } : { ldm: null, kg: null, pallets };
  }
  if (trailer) {
    return {
      ldm: sum(input.vehicle.ldm, trailer.ldm),
      kg: sum(input.vehicle.payloadKg, trailer.payloadKg),
      pallets,
    };
  }
  return { ldm: input.vehicle.ldm, kg: input.vehicle.payloadKg, pallets };
}

/** Частичная загрузка: фургон и грузовик — всегда, фура — до 8 погрузочных метров. */
export function isPartialLoad(haulKind: string, ldm: number | null): boolean {
  if (haulKind === 'VAN' || haulKind === 'TRUCK') return true;
  return haulKind === 'SEMI' && ldm !== null && ldm <= PARTIAL_SEMI_LDM;
}

/** Груз помещается: по каждому измерению, где известны обе величины. */
export function fits(load: Dims, free: Dims): boolean {
  const ok = (need: number | null, room: number | null) => need === null || room === null || need <= room + 1e-9;
  return ok(load.ldm, free.ldm) && ok(load.kg, free.kg) && ok(load.pallets, free.pallets);
}

/** Каботаж: погрузка и выгрузка в одной стране, а перевозчик из другой. */
export function isCabotage(carrierCountry: string | null, fromCountry: string | null, toCountry: string | null): boolean {
  return Boolean(carrierCountry && fromCountry && toCountry && fromCountry === toCountry && fromCountry !== carrierCountry);
}

/** Сколько каботажных операций осталось в окне (информационно; решает перевозчик). */
export function cabotageLeft(opsLast7Days: number): number {
  return Math.max(CABOTAGE.maxOps - opsLast7Days, 0);
}

type Span = {
  order: TripOrderInput;
  start: string;
  end: string;
  startStop: TripStopInput | null;
  endStop: TripStopInput | null;
  load: Dims;
  full: boolean;
  started: boolean;
};

const stamp = (stop: TripStopInput, edge: 'start' | 'end'): string | null => {
  if (!stop.date) return null;
  const time = stop.time ? stop.time.slice(0, 5) : edge === 'start' ? '00:00' : '23:59';
  return `${stop.date} ${time}`;
};

/** Интервал заказа: от первой погрузки до последней выгрузки. Без дат — весь горизонт. */
function spanOf(order: TripOrderInput): Span {
  const stops = [...order.stops].sort((a, b) => a.sequence - b.sequence);
  const loads = stops.filter((s) => LOAD_ROLES.has(s.role));
  const unloads = stops.filter((s) => UNLOAD_ROLES.has(s.role));
  const startStop = loads[0] ?? stops[0] ?? null;
  const endStop = unloads[unloads.length - 1] ?? stops[stops.length - 1] ?? null;
  /* Дата не указана у точки — берём ближайшую известную того же заказа. */
  const dated = stops.filter((s) => s.date);
  const startKey = startStop ? (stamp(startStop, 'start') ?? (dated[0] ? stamp(dated[0], 'start') : null)) : null;
  const endKey = endStop ? (stamp(endStop, 'end') ?? (dated.length ? stamp(dated[dated.length - 1], 'end') : null)) : null;
  const weights = stops.map((s) => s.weightKg ?? 0);
  const full = !GROUPAGE_HAULS.has(order.haulKind) || order.ldm === null;
  return {
    order,
    start: startKey ?? '0000-00-00 00:00',
    end: endKey && startKey && endKey >= startKey ? endKey : '9999-12-31 23:59',
    startStop,
    endStop,
    load: { ldm: order.ldm, kg: weights.length ? Math.max(...weights) : 0, pallets: order.pallets ?? 0 },
    full,
    started: stops.some((s) => s.completed),
  };
}

const placeOf = (stop: TripStopInput | null): Place => ({
  city: stop?.city ?? '',
  country: stop?.country ?? null,
  lat: stop?.lat ?? null,
  lon: stop?.lon ?? null,
});

/** Сумма грузов заказов; «целиком» — вся вместимость. */
function onboardOf(spans: Span[], capacity: Dims): Dims {
  const full = spans.some((s) => s.full);
  const add = (pick: (d: Dims) => number | null, cap: number | null) =>
    full ? cap : spans.reduce((total, s) => total + (pick(s.load) ?? 0), 0);
  return {
    ldm: add((d) => d.ldm, capacity.ldm ?? Number.POSITIVE_INFINITY),
    kg: add((d) => d.kg, capacity.kg ?? Number.POSITIVE_INFINITY),
    pallets: add((d) => d.pallets, capacity.pallets ?? Number.POSITIVE_INFINITY),
  };
}

/** Свободно = вместимость − груз; неизвестная вместимость — неизвестно. Вниз: до 0,1 м и 100 кг. */
export function freeOf(capacity: Dims, onboard: Dims): Dims {
  const room = (cap: number | null, used: number | null, step: number) =>
    cap === null ? null : Math.max(Math.floor(((cap - (used ?? 0)) / step) + 1e-9) * step, 0);
  return {
    ldm: capacity.ldm === null ? null : Math.round(room(capacity.ldm, onboard.ldm, 0.1)! * 10) / 10,
    kg: room(capacity.kg, onboard.kg, 100),
    pallets: room(capacity.pallets, onboard.pallets, 1),
  };
}

const minDims = (a: Dims, b: Dims): Dims => ({
  ldm: a.ldm === null ? b.ldm : b.ldm === null ? a.ldm : Math.min(a.ldm, b.ldm),
  kg: a.kg === null ? b.kg : b.kg === null ? a.kg : Math.min(a.kg, b.kg),
  pallets: a.pallets === null ? b.pallets : b.pallets === null ? a.pallets : Math.min(a.pallets, b.pallets),
});

/** Место стоит показывать: хоть одно измерение известно и все известные выше порога. */
export function worthOffering(free: Dims): boolean {
  if (free.ldm === null && free.kg === null) return false;
  return (free.ldm === null || free.ldm >= MIN_FREE_LDM) && (free.kg === null || free.kg >= MIN_FREE_KG);
}

/**
 * Предложения по одной машине: заказы рейса → отрезки с грузом →
 * свободное место по участкам и наименьшее на отрезке.
 */
export function proposalsForVehicle(
  vehicleId: string,
  capacity: Dims,
  orders: TripOrderInput[],
  today: string,
): Proposal[] {
  const spans = orders.map(spanOf).sort((a, b) => (a.start === b.start ? a.order.id.localeCompare(b.order.id) : a.start < b.start ? -1 : 1));

  /* Отрезки: пересекающиеся интервалы (закрытые — касание считается пересечением). */
  const runs: Span[][] = [];
  let current: Span[] = [];
  let currentEnd = '';
  for (const span of spans) {
    if (current.length && span.start <= currentEnd) {
      current.push(span);
      if (span.end > currentEnd) currentEnd = span.end;
    } else {
      if (current.length) runs.push(current);
      current = [span];
      currentEnd = span.end;
    }
  }
  if (current.length) runs.push(current);

  return runs.map((run) => {
    /* Точки участков: начала и концы заказов по времени. */
    const points = [
      ...run.map((s) => ({ key: s.start, place: placeOf(s.startStop) })),
      ...run.map((s) => ({ key: s.end, place: placeOf(s.endStop) })),
    ].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    const legs: Leg[] = [];
    for (let i = 0; i + 1 < points.length; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (a.key === b.key && a.place.city === b.place.city) continue;
      const aboard = run.filter((s) => s.start <= a.key && s.end >= b.key);
      const onboard = onboardOf(aboard, capacity);
      legs.push({ from: a.place, to: b.place, onboard, free: freeOf(capacity, onboard) });
    }

    /* Наибольшая загрузка — в одной из точек начала (интервалы закрытые). */
    let peak: Dims = { ldm: 0, kg: 0, pallets: 0 };
    for (const s of run) {
      const at = onboardOf(run.filter((o) => o.start <= s.start && o.end >= s.start), capacity);
      peak = {
        ldm: Math.max(peak.ldm ?? 0, at.ldm ?? 0),
        kg: Math.max(peak.kg ?? 0, at.kg ?? 0),
        pallets: Math.max(peak.pallets ?? 0, at.pallets ?? 0),
      };
    }
    const free = legs.reduce((acc, leg) => minDims(acc, leg.free), freeOf(capacity, peak));

    const first = run[0];
    const last = run.reduce((a, b) => (b.end > a.end ? b : a));
    const availableFrom = first.start.slice(0, 10);
    const availableTo = last.end.slice(0, 10);
    /* Любая пройденная точка отрезка — машина уже в пути, предлагать поздно. */
    const started = run.some((s) => s.started);
    const dated = !availableFrom.startsWith('0000') && !availableTo.startsWith('9999');

    return {
      vehicleId,
      anchorOrderId: first.order.id,
      orderIds: run.map((s) => s.order.id),
      refs: run.map((s) => s.order.ref),
      from: placeOf(first.startStop),
      to: placeOf(last.endStop),
      availableFrom: dated ? availableFrom : today,
      availableTo: dated ? availableTo : today,
      capacity,
      onboard: peak,
      free,
      legs,
      started,
      offerable: dated && !started && availableFrom >= today && worthOffering(free),
    };
  });
}

/** Коротко для строки: «6 ldm · 9 t». Метры и тонны пишутся одинаково на всех языках платформы. */
export function spaceLabel(free: Dims, locale: string): string {
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const parts: string[] = [];
  if (free.ldm !== null) parts.push(`${n.format(free.ldm)} ldm`);
  if (free.kg !== null) parts.push(`${n.format(free.kg / 1000)} t`);
  return parts.join(' · ');
}

/** Режим публикации: своя строка машины, иначе компании, иначе «спрашивать». */
export type PublishMode = 'ASK' | 'AUTO' | 'NEVER';

export function effectiveMode(
  settings: readonly { vehicleId: string | null; mode: string }[],
  vehicleId: string,
): PublishMode {
  const own = settings.find((s) => s.vehicleId === vehicleId);
  const company = settings.find((s) => s.vehicleId === null);
  const mode = own?.mode ?? company?.mode ?? 'ASK';
  return mode === 'AUTO' || mode === 'NEVER' ? mode : 'ASK';
}

/** Поправка перевозчика: в разумных пределах, не больше вместимости. */
export function correctFree(computed: Dims, capacity: Dims, input: Partial<Dims>): Dims {
  const clamp = (value: number | null | undefined, fallback: number | null, cap: number | null, max: number, step: number) => {
    if (value === undefined) return fallback;
    if (value === null || !Number.isFinite(value) || value < 0) return fallback;
    const top = Math.min(cap ?? max, max);
    return Math.round(Math.min(value, top) / step) * step;
  };
  return {
    ldm: (() => {
      const v = clamp(input.ldm, computed.ldm, capacity.ldm, 20, 0.1);
      return v === null ? null : Math.round(v * 10) / 10;
    })(),
    kg: clamp(input.kg, computed.kg, capacity.kg, 60000, 1),
    pallets: clamp(input.pallets, computed.pallets, capacity.pallets, 66, 1),
  };
}
