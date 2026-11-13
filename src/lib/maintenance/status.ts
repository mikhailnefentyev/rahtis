/**
 * Обслуживание парка: виды пунктов, интервалы по умолчанию, статус
 * срока («что наступит раньше» — дата или пробег) и ступени напоминаний.
 *
 * Один модуль без зависимостей: его читают тесты (node --test), а Node
 * без сборки не разрешает импорт соседнего .ts без расширения.
 */

/* ── Виды ───────────────────────────────────────────────────────── */

/**
 * Пункты плана. Тот же список стоит ограничением в базе
 * (maintenance_items_kind) — добавлять в обоих местах.
 */
export const MAINTENANCE_KINDS = [
  'SERVICE',
  'INSPECTION',
  'TACHOGRAPH',
  'TYRES',
  'BRAKES',
  'AC',
  'REEFER',
  'LIFT',
  'ADR',
  'FIRE',
  'OTHER',
] as const;

export type MaintenanceKind = (typeof MAINTENANCE_KINDS)[number];

/** В книжке есть ещё разовый ремонт — он не пункт плана. */
export type RecordKind = MaintenanceKind | 'REPAIR';

export function isMaintenanceKind(value: unknown): value is MaintenanceKind {
  return typeof value === 'string' && (MAINTENANCE_KINDS as readonly string[]).includes(value);
}

/** Что из пунктов бывает у прицепа: без двигателя, тахографа и кондиционера. */
export const TRAILER_KINDS: readonly MaintenanceKind[] = ['INSPECTION', 'TYRES', 'BRAKES', 'REEFER', 'LIFT', 'ADR', 'FIRE', 'SERVICE', 'OTHER'];

/**
 * Интервал по умолчанию — только там, где он задан правилом, а не маркой:
 * katsastus N2/N3 и O3/O4 ежегодно (2014/45/EU), тахограф не реже раза в
 * 2 года (165/2014 ст. 23), ADR-допуск машины ежегодно (ADR 9.1.3),
 * огнетушители и подъёмники — ежегодный осмотр. Интервал ТО у Volvo,
 * Scania и MAN разный — его вводит перевозчик по сервисной программе.
 */
export const DEFAULT_MONTHS: Partial<Record<MaintenanceKind, number>> = {
  INSPECTION: 12,
  TACHOGRAPH: 24,
  ADR: 12,
  FIRE: 12,
  LIFT: 12,
  AC: 12,
  REEFER: 12,
};

/** Дефекты: где и насколько серьёзно. Те же списки — ограничения vehicle_defects. */
export const DEFECT_AREAS = [
  'BRAKES',
  'TYRES',
  'LIGHTS',
  'ENGINE',
  'LEAK',
  'ELECTRICAL',
  'COUPLING',
  'HYDRAULICS',
  'BODY',
  'TACHOGRAPH',
  'OTHER',
] as const;

export type DefectArea = (typeof DEFECT_AREAS)[number];
export type DefectSeverity = 'CAN_DRIVE' | 'UNSAFE';

/* ── Сроки ──────────────────────────────────────────────────────── */

/** За сколько до срока пункт становится «скоро». */
export const SOON_DAYS = 30;
export const SOON_KM = 2000;

export type DueState = 'OVERDUE' | 'SOON' | 'OK' | 'NONE';

export type DueInput = {
  next_due_on: string | null;
  next_due_km: number | null;
};

export type DueStatus = {
  state: DueState;
  /** Дней до срока по дате; отрицательное — просрочено. */
  daysLeft: number | null;
  /** Километров до срока по пробегу; отрицательное — перебег. */
  kmLeft: number | null;
};

const DAY = 86_400_000;

/** Дней между двумя датами YYYY-MM-DD (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/**
 * Статус пункта на сегодня при известном пробеге машины. Срок — что
 * наступит раньше: просрочка по любому из двух — просрочено.
 */
export function dueStatus(item: DueInput, today: string, odometerKm: number | null): DueStatus {
  const daysLeft = item.next_due_on ? daysBetween(today, item.next_due_on) : null;
  const kmLeft = item.next_due_km != null && odometerKm != null ? item.next_due_km - odometerKm : null;

  if (daysLeft == null && kmLeft == null) {
    return { state: 'NONE', daysLeft, kmLeft };
  }
  if ((daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft <= 0)) {
    return { state: 'OVERDUE', daysLeft, kmLeft };
  }
  if ((daysLeft != null && daysLeft <= SOON_DAYS) || (kmLeft != null && kmLeft <= SOON_KM)) {
    return { state: 'SOON', daysLeft, kmLeft };
  }
  return { state: 'OK', daysLeft, kmLeft };
}

const RANK: Record<DueState, number> = { OVERDUE: 0, SOON: 1, OK: 2, NONE: 3 };

/** Сначала просроченное, потом ближайшее. */
export function compareDue(a: DueStatus, b: DueStatus): number {
  if (RANK[a.state] !== RANK[b.state]) return RANK[a.state] - RANK[b.state];
  const urgency = (s: DueStatus) =>
    Math.min(s.daysLeft ?? Number.POSITIVE_INFINITY, s.kmLeft != null ? s.kmLeft / 100 : Number.POSITIVE_INFINITY);
  return urgency(a) - urgency(b);
}

/** Худшее состояние из нескольких пунктов — для значка машины в парке. */
export function worstState(states: DueState[]): DueState {
  return states.reduce<DueState>((worst, s) => (RANK[s] < RANK[worst] ? s : worst), 'NONE');
}

/* ── Следующий срок ─────────────────────────────────────────────── */

/** Дата + месяцы; конец месяца не перескакивает (31.1 + 1 мес. = 28/29.2), как в Postgres. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

/**
 * Следующий срок по последнему разу и интервалу — для новой строки
 * плана, когда перевозчик знает, когда делал, но не считал, когда снова.
 */
export function nextDue(input: {
  lastDoneOn: string | null;
  lastDoneKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
}): { on: string | null; km: number | null } {
  return {
    on: input.lastDoneOn && input.intervalMonths ? addMonths(input.lastDoneOn, input.intervalMonths) : null,
    km: input.lastDoneKm != null && input.intervalKm ? input.lastDoneKm + input.intervalKm : null,
  };
}

/* ── Напоминания ────────────────────────────────────────────────── */

export type ReminderStage = 'D30' | 'D7' | 'D1' | 'K2000' | 'K500' | 'OVERDUE';

/**
 * Какие ступени уже наступили. Из каждого ряда (дни, км) — только самая
 * поздняя: пункт, внесённый за пять дней до срока, получает одно «D7», а
 * не «D30» и «D7» сразу. Просрочка — отдельная ступень, одна на срок.
 */
export function reachedStages(status: DueStatus): ReminderStage[] {
  if (status.state === 'OVERDUE') return ['OVERDUE'];
  const stages: ReminderStage[] = [];
  const d = status.daysLeft;
  if (d != null) {
    if (d <= 1) stages.push('D1');
    else if (d <= 7) stages.push('D7');
    else if (d <= 30) stages.push('D30');
  }
  const k = status.kmLeft;
  if (k != null) {
    if (k <= 500) stages.push('K500');
    else if (k <= 2000) stages.push('K2000');
  }
  return stages;
}

/** Ступени, о которых водителю есть смысл знать сразу: близко или прошло. */
export const DRIVER_STAGES: readonly ReminderStage[] = ['D7', 'D1', 'K500', 'OVERDUE'];

/** Ключ срока для журнала: сделали — срок другой, ступени начинаются заново. */
export function dueKey(item: DueInput): string {
  return `${item.next_due_on ?? ''}|${item.next_due_km ?? ''}`;
}
