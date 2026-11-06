/**
 * Напоминания об оплате счетов перевозчика (freight_invoices и счета
 * объектов): расписание и разбор формы «счёт отправлен». Без импортов
 * из приложения: читают сервер, клиент и тесты.
 *
 * Расписание: напоминание 1 — на следующий день после срока, 2 — через
 * 7 дней после срока, на 14-й день — подсказка перевозчику о взыскании
 * (и заготовка отметки «не оплачен»). Счёт, просроченный больше чем на
 * 60 дней, писем не получает: такой долг — уже не напоминание.
 */

export const REMINDER_1_DAY = 1;
export const REMINDER_2_DAY = 7;
export const COLLECTION_DAY = 14;
export const REMINDER_STALE_DAY = 60;
export const DEFAULT_TERM_DAYS = 14;

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Дней от a до b (обе — даты YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

export type ReminderState = {
  dueOn: string;
  paid: boolean;
  reminder1: boolean;
  reminder2: boolean;
  collectionHint: boolean;
};

export type ReminderAction = { email: 1 | 2 | null; collection: boolean };

/**
 * Что сделать сегодня. Пропущенный первый шаг не догоняется отдельно:
 * если пора второе письмо, уходит только оно (и первое считается
 * отправленным) — два письма в один день выглядели бы как спам.
 */
export function reminderAction(state: ReminderState, today: string): ReminderAction {
  if (state.paid) return { email: null, collection: false };
  const late = daysBetween(state.dueOn, today);
  let email: 1 | 2 | null = null;
  if (late <= REMINDER_STALE_DAY) {
    if (late >= REMINDER_2_DAY && !state.reminder2) email = 2;
    else if (late >= REMINDER_1_DAY && !state.reminder1 && !state.reminder2) email = 1;
  }
  return { email, collection: late >= COLLECTION_DAY && !state.collectionHint };
}

export type InvoiceStatus = 'PAID' | 'PAID_UNCONFIRMED' | 'OVERDUE' | 'OPEN';

export function invoiceStatus(
  row: { dueOn: string; paidAt: string | null; paidSide?: string | null; confirmed?: boolean },
  today: string,
): InvoiceStatus {
  if (row.paidAt) return row.paidSide === 'SHIPPER' && !row.confirmed ? 'PAID_UNCONFIRMED' : 'PAID';
  return daysBetween(row.dueOn, today) > 0 ? 'OVERDUE' : 'OPEN';
}

export type ParsedInvoice =
  | {
      ok: true;
      number: string;
      amountCents: number;
      currency: string;
      issuedOn: string;
      dueOn: string;
      sendTo: string;
    }
  | { ok: false; error: 'number' | 'amount' | 'currency' | 'dates' | 'email' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Сумма из формы: «1 234,50» или «1234.5» → центы. */
export function parseAmountCents(raw: unknown): number | null {
  const text = String(raw ?? '').replace(/[\s ]/g, '').replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return cents > 0 ? cents : null;
}

export function parseFreightInvoice(form: {
  number: unknown;
  amount: unknown;
  currency: unknown;
  issuedOn: unknown;
  dueOn: unknown;
  sendTo: unknown;
}): ParsedInvoice {
  const number = String(form.number ?? '').trim();
  if (number.length < 1 || number.length > 40) return { ok: false, error: 'number' };
  const amountCents = parseAmountCents(form.amount);
  if (amountCents === null) return { ok: false, error: 'amount' };
  const currency = String(form.currency ?? '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'currency' };
  const issuedOn = String(form.issuedOn ?? '').trim();
  const dueOn = String(form.dueOn ?? '').trim();
  if (!DATE.test(issuedOn) || !DATE.test(dueOn)) return { ok: false, error: 'dates' };
  const term = daysBetween(issuedOn, dueOn);
  if (Number.isNaN(term) || term < 0 || term > 365) return { ok: false, error: 'dates' };
  const sendTo = String(form.sendTo ?? '').trim().toLowerCase();
  if (sendTo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendTo)) return { ok: false, error: 'email' };
  return { ok: true, number, amountCents, currency, issuedOn, dueOn, sendTo };
}
