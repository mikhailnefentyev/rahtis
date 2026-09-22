/**
 * Справочный калькулятор оплаты водителя.
 *
 * СПРАВКА, А НЕ РАСЧЁТ ЗАРПЛАТЫ. Окончательную сумму определяют
 * работодатель, трудовой договор и TES. Модуль считает ровно то, что
 * перевозчик в нём настроил, и ничего сверх. Правила TES разобраны по
 * Kuorma-autoalan TES 2025–2028: сверхурочные за день или за 2-недельный
 * период, вечер и ночь суммой или процентом, праздники как воскресенье,
 * минимальная оплата короткого дня. Суточный отдых, командировочные,
 * ожидание и надбавки за груз сюда не входят.
 *
 * Одна функция на экран, PDF и таблицу — чтобы три вида одного отчёта
 * не разошлись.
 *
 * Модуль без импортов намеренно: тесты гоняются голым `node --test`, а
 * он не знает алиасов сборки. Поэтому и часовой пояс здесь параметр со
 * значением по умолчанию, а не импорт из config.
 */

export type PayModelCode = 'PER_KM' | 'TRIP_PERCENT' | 'FLAT_HOURLY' | 'TES';

export type Interval = { start: string; end: string | null };

export type ShiftInput = Interval & {
  id: string;
  breaks: Interval[];
  odometerStart: number | null;
  odometerEnd: number | null;
};

export type TripInput = {
  closedAt: string;
  distanceKm: number | null;
  stopsDone: number;
  payoutCents: number;
};

/** Табличная ставка категории водителя с даты. */
export type TesRate = { grade: string; validFrom: string; hourlyCents: number };

export type TesRules = {
  /** Ставка, если у водителя не выбрана категория или таблицы нет. */
  baseHourlyCents: number;
  dailyRegularMinutes: number;
  overtime1Minutes: number;
  overtime1Bps: number;
  overtime2Bps: number;
  eveningStart: string | null;
  eveningEnd: string | null;
  eveningCents: number;
  nightStart: string | null;
  nightEnd: string | null;
  nightCents: number;
  saturdayBps: number;
  sundayBps: number;
  /** DAY — сверх дневной нормы; PERIOD — сверх нормы 2-недельного периода (TES § 14.2). */
  overtimeBasis?: 'DAY' | 'PERIOD';
  periodRegularMinutes?: number;
  /** Понедельник, от которого отсчитываются 2-недельные периоды. */
  periodAnchor?: string;
  /** Вечер и ночь процентом от ставки часа — в добавок к сумме в центах. */
  eveningBps?: number;
  nightBps?: number;
  /** Праздники и выходные кануны Финляндии оплачиваются как воскресенье. */
  holidaysAsSunday?: boolean;
  /** Короткий рабочий день оплачивается как этот минимум (TES § 11.3: 285). */
  minPaidMinutes?: number;
  rates?: TesRate[];
};

export type PayProfileInput = {
  validFrom: string;
  model: PayModelCode;
  perKmCents: number | null;
  tripBps: number | null;
  hourlyCents: number | null;
  tes: TesRules | null;
  /** Категория и стаж водителя в таблице ставок набора. */
  tesGrade?: string | null;
};

/** Итог одного дня. День — местная дата начала смены (см. splitShift). */
export type WorkDay = {
  date: string;
  workMinutes: number;
  /** Оплачиваемые минуты: рабочие, поднятые до минимума короткого дня. */
  paidMinutes: number;
  breakMinutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  saturdayMinutes: number;
  /** Воскресенье, а при holidaysAsSunday — и праздники. */
  sundayMinutes: number;
  overtime1Minutes: number;
  overtime2Minutes: number;
  odometerKm: number;
  tripKm: number;
  stops: number;
  trips: number;
  payoutCents: number;
  /** Модель, по которой посчитан день. NULL — на эту дату ставки не было. */
  model: PayModelCode | null;
  amountCents: number | null;
  parts: PayParts;
};

export type PayParts = {
  baseCents: number;
  overtimeCents: number;
  eveningCents: number;
  nightCents: number;
  weekendCents: number;
};

export type DriverSummary = {
  days: WorkDay[];
  totals: Omit<WorkDay, 'date' | 'model' | 'amountCents' | 'parts'> & {
    amountCents: number;
    /** Есть дни с работой, но без ставки — сумма тогда неполная. */
    missingRate: boolean;
    parts: PayParts;
  };
};

const MINUTE = 60_000;
const DEFAULT_TZ = 'Europe/Helsinki';

/* ── Местное время ──────────────────────────────────────────────── */

type Local = { date: string; minuteOfDay: number; weekday: number };

/**
 * Местная дата, минута суток и день недели для момента времени.
 *
 * Смещение пояса запрашивается раз в час по UTC и кэшируется: у
 * Хельсинки смещение всегда в целых часах, а форматтер Intl — самая
 * дорогая часть расчёта. Месяц смен одного водителя — это десятки тысяч
 * минут, и без кэша отчёт по парку заметно подтормаживал бы.
 */
function localClock(timeZone: string) {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const offsets = new Map<number, number>();

  function offsetMinutes(ms: number): number {
    const hour = Math.floor(ms / 3_600_000);
    const cached = offsets.get(hour);
    if (cached !== undefined) return cached;

    const parts = Object.fromEntries(
      format.formatToParts(new Date(hour * 3_600_000)).map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const offset = Math.round((asUtc - hour * 3_600_000) / MINUTE);
    offsets.set(hour, offset);
    return offset;
  }

  return (ms: number): Local => {
    const local = new Date(ms + offsetMinutes(ms) * MINUTE);
    return {
      date: local.toISOString().slice(0, 10),
      minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
      weekday: local.getUTCDay(),
    };
  };
}

function toMinuteOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Попадает ли минута суток в окно; окно через полночь (22–06) поддерживается. */
function inWindow(minute: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const a = toMinuteOfDay(start);
  const b = toMinuteOfDay(end);
  return a <= b ? minute >= a && minute < b : minute >= a || minute < b;
}

/* ── Праздники Финляндии ────────────────────────────────────────── */

const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Пасхальное воскресенье: григорианский алгоритм (Meeus/Jones/Butcher). */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Первая суббота начиная с даты (Иванов день, День всех святых). */
function saturdayFrom(year: number, month: number, from: number): string {
  const d = new Date(Date.UTC(year, month - 1, from));
  d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

const holidayCache = new Map<number, Set<string>>();

/**
 * Дни, которые TES оплачивает как воскресенье.
 *
 * § 14.5: церковные праздники, День независимости и 1 мая. § 11.4:
 * канун Пасхи, Иванов вечер и Сочельник — выходные, и работа в них
 * оплачивается по § 10.2 тоже +100 %. Воскресенья сюда не входят: они
 * узнаются по дню недели.
 */
export function finnishHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const e = easter(year);
  const midsummer = saturdayFrom(year, 6, 20);
  const y = String(year);
  const set = new Set([
    `${y}-01-01`, // uudenvuodenpäivä
    `${y}-01-06`, // loppiainen
    addDays(e, -2), // pitkäperjantai
    addDays(e, -1), // pääsiäislauantai (§ 11.4)
    addDays(e, 1), // 2. pääsiäispäivä
    `${y}-05-01`, // vappu
    addDays(e, 39), // helatorstai
    addDays(midsummer, -1), // juhannusaatto (§ 11.4)
    midsummer, // juhannuspäivä
    saturdayFrom(year, 10, 31), // pyhäinpäivä
    `${y}-12-06`, // itsenäisyyspäivä
    `${y}-12-24`, // jouluaatto (§ 11.4)
    `${y}-12-25`, // joulupäivä
    `${y}-12-26`, // tapaninpäivä
  ]);
  holidayCache.set(year, set);
  return set;
}

const isHoliday = (date: string) => finnishHolidays(Number(date.slice(0, 4))).has(date);

/* ── Смена → минуты ─────────────────────────────────────────────── */

type ShiftSlice = {
  date: string;
  workMinutes: number;
  breakMinutes: number;
  eveningMinutes: number;
  nightMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
};

/**
 * Раскладывает смену по минутам.
 *
 * Вся смена относится к местной дате своего начала: ночная смена с 22:00
 * до 06:00 — это одна рабочая смена одного дня, и сверхурочные по TES
 * считаются от её начала, а не от полуночи. Вечер, ночь и выходной при
 * этом определяются по каждой минуте — суббота, начавшаяся посреди
 * пятничной смены, остаётся субботой.
 *
 * Незакрытая смена считается до `now`: водитель ещё работает, и справка
 * должна показывать отработанное к этой минуте, а не ноль.
 */
export function splitShift(
  shift: ShiftInput,
  rules: Pick<TesRules, 'eveningStart' | 'eveningEnd' | 'nightStart' | 'nightEnd' | 'holidaysAsSunday'> | null,
  now: number,
  timeZone: string = DEFAULT_TZ,
): ShiftSlice {
  const clock = localClock(timeZone);
  const start = Date.parse(shift.start);
  const end = shift.end ? Date.parse(shift.end) : now;

  const breaks = shift.breaks.map((b) => [
    Date.parse(b.start),
    b.end ? Date.parse(b.end) : now,
  ]);
  const onBreak = (ms: number) => breaks.some(([a, b]) => ms >= a && ms < b);

  const slice: ShiftSlice = {
    date: clock(start).date,
    workMinutes: 0,
    breakMinutes: 0,
    eveningMinutes: 0,
    nightMinutes: 0,
    saturdayMinutes: 0,
    sundayMinutes: 0,
  };

  for (let ms = start; ms + MINUTE <= end; ms += MINUTE) {
    if (onBreak(ms)) {
      slice.breakMinutes += 1;
      continue;
    }

    const local = clock(ms);
    slice.workMinutes += 1;

    if (rules) {
      /* Ночь важнее вечера: окна могут пересекаться, а доплата за час одна. */
      if (inWindow(local.minuteOfDay, rules.nightStart, rules.nightEnd)) slice.nightMinutes += 1;
      else if (inWindow(local.minuteOfDay, rules.eveningStart, rules.eveningEnd)) {
        slice.eveningMinutes += 1;
      }
    }

    /* Праздник, выпавший на субботу (Иванов день), — праздник, а не суббота. */
    if (local.weekday === 0 || (rules?.holidaysAsSunday && isHoliday(local.date))) slice.sundayMinutes += 1;
    else if (local.weekday === 6) slice.saturdayMinutes += 1;
  }

  return slice;
}

/* ── Ставка на дату ─────────────────────────────────────────────── */

export function profileOn(profiles: PayProfileInput[], date: string): PayProfileInput | null {
  let best: PayProfileInput | null = null;
  for (const p of profiles) {
    if (p.validFrom <= date && (!best || p.validFrom > best.validFrom)) best = p;
  }
  return best;
}

/* ── Деньги дня ─────────────────────────────────────────────────── */

const emptyParts = (): PayParts => ({
  baseCents: 0,
  overtimeCents: 0,
  eveningCents: 0,
  nightCents: 0,
  weekendCents: 0,
});

/** Минуты × ставка за час, в центах. */
const perHour = (minutes: number, cents: number) => Math.round((minutes * cents) / 60);
/** Минуты × ставка за час × надбавка в б.п. */
const bonus = (minutes: number, cents: number, bps: number) =>
  Math.round((minutes * cents * bps) / 60 / 10_000);

/**
 * Километры дня для оплаты за км.
 *
 * Одометр — то, что машина действительно проехала, включая работу вне
 * платформы и холостой пробег. Если водитель его вёл, он и берётся.
 * Иначе — пробег закрытых рейсов: меньше правды, но это то, что есть.
 * Складывать одно с другим нельзя — рейсы платформы внутри одометра уже
 * посчитаны.
 */
export function payableKm(day: Pick<WorkDay, 'odometerKm' | 'tripKm'>): number {
  return day.odometerKm > 0 ? day.odometerKm : day.tripKm;
}

/** Ставка часа на дату: по категории водителя из таблицы набора, иначе базовая. */
export function tesBaseOn(profile: PayProfileInput, date: string): number {
  const rules = profile.tes;
  if (!rules) return 0;
  let best: TesRate | null = null;
  for (const rate of rules.rates ?? []) {
    if (rate.grade !== profile.tesGrade || rate.validFrom > date) continue;
    if (!best || rate.validFrom > best.validFrom) best = rate;
  }
  return best?.hourlyCents ?? rules.baseHourlyCents;
}

function payDay(day: WorkDay, profile: PayProfileInput | null): WorkDay {
  const parts = emptyParts();

  if (!profile) return { ...day, model: null, amountCents: null, parts };

  switch (profile.model) {
    case 'FLAT_HOURLY':
      parts.baseCents = perHour(day.workMinutes, profile.hourlyCents ?? 0);
      break;

    case 'PER_KM':
      parts.baseCents = payableKm(day) * (profile.perKmCents ?? 0);
      break;

    case 'TRIP_PERCENT':
      parts.baseCents = Math.round((day.payoutCents * (profile.tripBps ?? 0)) / 10_000);
      break;

    case 'TES': {
      const r = profile.tes;
      if (!r) return { ...day, model: profile.model, amountCents: null, parts };

      const base = tesBaseOn(profile, day.date);
      parts.baseCents = perHour(day.paidMinutes, base);
      parts.overtimeCents =
        bonus(day.overtime1Minutes, base, r.overtime1Bps) + bonus(day.overtime2Minutes, base, r.overtime2Bps);
      parts.eveningCents =
        perHour(day.eveningMinutes, r.eveningCents) + bonus(day.eveningMinutes, base, r.eveningBps ?? 0);
      parts.nightCents = perHour(day.nightMinutes, r.nightCents) + bonus(day.nightMinutes, base, r.nightBps ?? 0);
      parts.weekendCents =
        bonus(day.saturdayMinutes, base, r.saturdayBps) + bonus(day.sundayMinutes, base, r.sundayBps);
      break;
    }
  }

  const amountCents =
    parts.baseCents + parts.overtimeCents + parts.eveningCents + parts.nightCents + parts.weekendCents;

  return { ...day, model: profile.model, amountCents, parts };
}

/* ── Сводка по водителю ─────────────────────────────────────────── */

/**
 * Дни водителя за период с деньгами по действовавшей в каждый день
 * ставке.
 *
 * Сверхурочные делятся здесь, по сумме минут дня, а не в splitShift:
 * две смены одного дня (утро и вечер) вместе могут перейти дневную
 * норму, хотя каждая по отдельности в неё укладывается.
 */
export function summarizeDriver(input: {
  shifts: ShiftInput[];
  trips: TripInput[];
  profiles: PayProfileInput[];
  now: number;
  timeZone?: string;
}): DriverSummary {
  const tz = input.timeZone ?? DEFAULT_TZ;
  const clock = localClock(tz);
  const days = new Map<string, WorkDay>();

  const dayOf = (date: string): WorkDay => {
    let day = days.get(date);
    if (!day) {
      day = {
        date,
        workMinutes: 0,
        paidMinutes: 0,
        breakMinutes: 0,
        eveningMinutes: 0,
        nightMinutes: 0,
        saturdayMinutes: 0,
        sundayMinutes: 0,
        overtime1Minutes: 0,
        overtime2Minutes: 0,
        odometerKm: 0,
        tripKm: 0,
        stops: 0,
        trips: 0,
        payoutCents: 0,
        model: null,
        amountCents: null,
        parts: emptyParts(),
      };
      days.set(date, day);
    }
    return day;
  };

  for (const shift of input.shifts) {
    const date = clock(Date.parse(shift.start)).date;
    const rules = profileOn(input.profiles, date)?.tes ?? null;
    const slice = splitShift(shift, rules, input.now, tz);
    const day = dayOf(slice.date);

    day.workMinutes += slice.workMinutes;
    day.breakMinutes += slice.breakMinutes;
    day.eveningMinutes += slice.eveningMinutes;
    day.nightMinutes += slice.nightMinutes;
    day.saturdayMinutes += slice.saturdayMinutes;
    day.sundayMinutes += slice.sundayMinutes;

    if (shift.odometerStart != null && shift.odometerEnd != null) {
      day.odometerKm += shift.odometerEnd - shift.odometerStart;
    }
  }

  for (const trip of input.trips) {
    const day = dayOf(clock(Date.parse(trip.closedAt)).date);
    day.tripKm += trip.distanceKm ?? 0;
    day.stops += trip.stopsDone;
    day.trips += 1;
    day.payoutCents += trip.payoutCents;
  }

  const result: WorkDay[] = [];

  /*
   * Нарастающие итоги 2-недельных периодов: сколько минут в периоде уже
   * отработано и сколько из них ушло в первую ступень сверхурочных.
   * Сверхурочные достаются тому дню, в который норма периода перейдена, —
   * сумма дня у водителя растёт вместе с периодом, а не всплывает задним
   * числом в его последний день.
   */
  const periods = new Map<string, { worked: number; step1: number }>();

  for (const day of [...days.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    const profile = profileOn(input.profiles, day.date);
    const tes = profile?.model === 'TES' ? profile.tes : null;

    day.paidMinutes = day.workMinutes;

    if (tes) {
      /* § 11.3: короткий день оплачивается и считается рабочим временем как минимум. */
      const min = tes.minPaidMinutes ?? 0;
      if (day.workMinutes > 0 && day.workMinutes < min) day.paidMinutes = min;

      if (tes.overtimeBasis === 'PERIOD') {
        const anchor = tes.periodAnchor ?? '2026-01-05';
        const index = Math.floor((Date.parse(day.date) - Date.parse(anchor)) / (14 * 86_400_000));
        const key = `${anchor}:${index}`;
        const period = periods.get(key) ?? { worked: 0, step1: 0 };
        const limit = tes.periodRegularMinutes ?? 4800;

        const before = period.worked;
        period.worked += day.paidMinutes;
        const over = Math.max(0, period.worked - Math.max(before, limit));

        day.overtime1Minutes = Math.min(over, Math.max(0, tes.overtime1Minutes - period.step1));
        day.overtime2Minutes = over - day.overtime1Minutes;
        period.step1 += day.overtime1Minutes;
        periods.set(key, period);
      } else {
        const over = Math.max(0, day.paidMinutes - tes.dailyRegularMinutes);
        day.overtime1Minutes = Math.min(over, tes.overtime1Minutes);
        day.overtime2Minutes = over - day.overtime1Minutes;
      }
    }

    result.push(payDay(day, profile));
  }

  return { days: result, totals: totalsOf(result) };
}

/**
 * Итоги по дням. Отдельно, потому что отчёт за период считает их заново
 * по обрезанному списку дней: смена, выбранная из базы с запасом, не
 * должна попасть в сумму чужого периода.
 */
export function totalsOf(days: WorkDay[]): DriverSummary['totals'] {
  const totals: DriverSummary['totals'] = {
    workMinutes: 0,
    paidMinutes: 0,
    breakMinutes: 0,
    eveningMinutes: 0,
    nightMinutes: 0,
    saturdayMinutes: 0,
    sundayMinutes: 0,
    overtime1Minutes: 0,
    overtime2Minutes: 0,
    odometerKm: 0,
    tripKm: 0,
    stops: 0,
    trips: 0,
    payoutCents: 0,
    amountCents: 0,
    missingRate: false,
    parts: emptyParts(),
  };

  for (const day of days) {
    totals.workMinutes += day.workMinutes;
    totals.paidMinutes += day.paidMinutes;
    totals.breakMinutes += day.breakMinutes;
    totals.eveningMinutes += day.eveningMinutes;
    totals.nightMinutes += day.nightMinutes;
    totals.saturdayMinutes += day.saturdayMinutes;
    totals.sundayMinutes += day.sundayMinutes;
    totals.overtime1Minutes += day.overtime1Minutes;
    totals.overtime2Minutes += day.overtime2Minutes;
    totals.odometerKm += day.odometerKm;
    totals.tripKm += day.tripKm;
    totals.stops += day.stops;
    totals.trips += day.trips;
    totals.payoutCents += day.payoutCents;

    if (day.amountCents == null) {
      if (day.workMinutes > 0 || day.trips > 0) totals.missingRate = true;
    } else {
      totals.amountCents += day.amountCents;
      totals.parts.baseCents += day.parts.baseCents;
      totals.parts.overtimeCents += day.parts.overtimeCents;
      totals.parts.eveningCents += day.parts.eveningCents;
      totals.parts.nightCents += day.parts.nightCents;
      totals.parts.weekendCents += day.parts.weekendCents;
    }
  }

  return totals;
}
