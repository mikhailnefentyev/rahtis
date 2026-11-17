/**
 * Когда перевозчик выставляет счёт заказчику (17.11.2026).
 *
 * Периодичность и срок оплаты согласуют стороны (invoice_agreements);
 * пока не согласовали — раз в неделю и 14 дней. Задание идёт каждое
 * утро и по каждой паре спрашивает: пора ли сегодня, и если да — за
 * рейсы, закрытые до какой даты (не включая её).
 *
 *   · PER_TRIP — каждый день, за рейсы, закрытые до сегодня: счёт
 *     уходит наутро после рейса, по одному на рейс;
 *   · WEEKLY — по понедельникам, за прошлую неделю и раньше;
 *   · BIWEEKLY — по понедельникам чётных недель ISO;
 *   · MONTHLY — 1-го числа, за прошлый месяц и раньше.
 *
 * Без импортов из приложения: модуль читают сервер и тесты.
 */

export const SCHEDULES = ['PER_TRIP', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
export type InvoiceSchedule = (typeof SCHEDULES)[number];

export const PAYMENT_TERMS = [7, 14, 21, 30, 45, 60] as const;

export const DEFAULT_SCHEDULE: InvoiceSchedule = 'WEEKLY';
export const DEFAULT_TERM_DAYS = 14;

export function isSchedule(value: unknown): value is InvoiceSchedule {
  return (SCHEDULES as readonly unknown[]).includes(value);
}

export function isPaymentTerm(value: unknown): value is (typeof PAYMENT_TERMS)[number] {
  return (PAYMENT_TERMS as readonly unknown[]).includes(value);
}

/** Номер недели ISO 8601 для даты `ГГГГ-ММ-ДД`. */
export function isoWeekOf(dateIso: string): number {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/**
 * Пора ли сегодня (дата по Хельсинки) выставлять счёт по этой
 * периодичности. Да — дата, до которой (не включая) закрытые рейсы идут
 * в счёт; нет — null.
 */
export function invoiceCutoff(schedule: InvoiceSchedule, todayIso: string): string | null {
  const monday = new Date(`${todayIso}T12:00:00Z`).getUTCDay() === 1;
  switch (schedule) {
    case 'PER_TRIP':
      return todayIso;
    case 'WEEKLY':
      return monday ? todayIso : null;
    case 'BIWEEKLY':
      return monday && isoWeekOf(todayIso) % 2 === 0 ? todayIso : null;
    case 'MONTHLY':
      return todayIso.endsWith('-01') ? todayIso : null;
  }
}
