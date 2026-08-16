/**
 * Конфигурация платформы RAHTIS.
 *
 * Всё, что бизнес может захотеть поменять без правки логики, живёт здесь.
 * Денежные величины в системе — целые центы (integer), никогда не float.
 */

export const APP = {
  name: 'RAHTIS',
  /** Оператор платформы — принципал-посредник (ТЗ §1). */
  operator: {
    legalName: 'Aivomaa Oy',
    country: 'FI',
  },
  /** Операции ведутся в финском времени независимо от локали интерфейса. */
  timeZone: 'Europe/Helsinki',
  currency: 'EUR',
} as const;

/**
 * Комиссия оператора в базисных пунктах: 300 bps = 3%.
 *
 * Хранится в bps, а не в долях, чтобы не тащить float в расчёты денег.
 * В будущем комиссия станет гибкой по клиентам и типам заказов — тогда это
 * значение станет дефолтом, а действующая ставка будет приходить из БД.
 *
 * ВАЖНО: при закрытии рейса действующая ставка фиксируется в самой записи рейса.
 * Отчёты и счета считают по зафиксированной ставке, а не по текущей — иначе
 * изменение комиссии перепишет задним числом уже выставленные счета.
 */
export const COMMISSION_BPS = 300;

/** Комиссия оператора с суммы в центах. */
export function commissionCents(rateCents: number, bps: number = COMMISSION_BPS): number {
  return Math.round((rateCents * bps) / 10_000);
}

/** Выплата перевозчику: ставка заказчика за вычетом комиссии. */
export function payoutCents(rateCents: number, bps: number = COMMISSION_BPS): number {
  return rateCents - commissionCents(rateCents, bps);
}

/**
 * Матчинг (ТЗ §6).
 * Таймауты обеспечивает серверный планировщик по полю deadline_at,
 * клиент лишь отображает обратный отсчёт.
 */
export const MATCHING = {
  /** Откликов на заказ — не больше трёх, «первые трое». */
  maxOffersPerOrder: 3,
  /** 15 минут на каждое решение: выбор заказчика и подтверждение водителя. */
  decisionTimeoutMinutes: 15,
} as const;

/** Регионы запуска. Этап 1 — Финляндия; список переедет в БД на этапе 4. */
export const REGIONS = ['Hanko', 'Helsinki', 'Turku', 'Tampere', 'Kotka', 'Vaasa'] as const;
export type Region = (typeof REGIONS)[number];
