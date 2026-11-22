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
 *   · WEEKLY — за рейсы, закрытые до понедельника этой недели;
 *   · BIWEEKLY — до понедельника «своей» недели (через одну, счёт недель
 *     от BIWEEKLY_ANCHOR);
 *   · MONTHLY — до 1-го числа этого месяца.
 *
 * Граница — последняя наступившая, в любой день (22.11.2026): запуск в
 * понедельник не удался или не успел — счёт уйдёт на следующее утро, а не
 * через неделю или месяц. Повтор безопасен: рейс, попавший в счёт,
 * закреплён за ним (orders.carrier_invoice_id) и в выборку не вернётся.
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
 * Понедельник, от которого считаются «свои» недели BIWEEKLY (22.11.2026).
 *
 * Прежде брали чётность номера недели ISO, а в 2026 году 53 недели: после
 * счёта 21.12.2026 (неделя 52) следующий вышел бы 11.01.2027 (неделя 2) —
 * через три недели. Теперь — чётность числа недель от 5.1.2026 (неделя 2):
 * в 2026 году расписание то же, дальше ровно через одну неделю.
 * То же число — в sites/invoice.ts.
 */
export const BIWEEKLY_ANCHOR = '2026-01-05';

const DAY_MS = 86_400_000;
const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);
const isoOf = (d: Date) => d.toISOString().slice(0, 10);

/** Понедельник недели, в которую входит дата. */
export function mondayOfWeek(dateIso: string): string {
  const d = noon(dateIso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return isoOf(d);
}

/** Выставляется ли счёт «раз в две недели» в неделю этого понедельника. */
export function biweeklyDue(mondayIso: string): boolean {
  const weeks = Math.round((noon(mondayIso).getTime() - noon(BIWEEKLY_ANCHOR).getTime()) / (7 * DAY_MS));
  return Math.abs(weeks) % 2 === 0;
}

/**
 * Дата (по Хельсинки), до которой (не включая) закрытые рейсы идут в счёт
 * по этой периодичности: последняя наступившая граница. Запуск идёт
 * каждое утро; в обычный день всё до границы уже в счетах, и выставлять
 * нечего.
 */
export function invoiceCutoff(schedule: InvoiceSchedule, todayIso: string): string {
  const monday = mondayOfWeek(todayIso);
  switch (schedule) {
    case 'PER_TRIP':
      return todayIso;
    case 'WEEKLY':
      return monday;
    case 'BIWEEKLY': {
      if (biweeklyDue(monday)) return monday;
      const previous = noon(monday);
      previous.setUTCDate(previous.getUTCDate() - 7);
      return isoOf(previous);
    }
    case 'MONTHLY':
      return `${todayIso.slice(0, 7)}-01`;
  }
}
