/**
 * Смена реквизитов и контактов компании (20261106170000_trust_quick_wins):
 * маски значений, «изменено N дней назад» и задержка счетов после смены
 * счёта. Без импортов из приложения: читают сервер, клиент и тесты.
 */

export const SENSITIVE_FIELDS = ['IBAN', 'CONTACT_EMAIL', 'BILLING_EMAIL', 'OWNER'] as const;
export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

export function isSensitiveField(value: unknown): value is SensitiveField {
  return typeof value === 'string' && (SENSITIVE_FIELDS as readonly string[]).includes(value);
}

/** Отметка у контрагента держится 30 дней. */
export const BANK_MARK_DAYS = 30;
/** Счета объекта не уходят сами 48 часов после смены IBAN. */
export const IBAN_HOLD_HOURS = 48;

/** Последние четыре знака счёта — то же правило, что app.mask_iban. */
export function maskIban(iban: string | null | undefined): string | null {
  const clean = (iban ?? '').replace(/\s/g, '');
  return clean ? `•••• ${clean.slice(-4)}` : null;
}

/** Первая буква и домен — то же правило, что app.mask_email. */
export function maskEmail(email: string | null | undefined): string | null {
  const value = (email ?? '').trim();
  if (!value) return null;
  const at = value.indexOf('@');
  if (at < 1) return '•••';
  return `${value.slice(0, 1)}•••${value.slice(at)}`;
}

/** Целых суток с момента (0 — сегодня, меньше суток). */
export function daysAgo(at: string, now: Date = new Date()): number {
  const diff = now.getTime() - Date.parse(at);
  return Math.max(0, Math.floor(diff / 86_400_000));
}

/** Показывать ли отметку «счёт изменён»: не старше 30 дней. */
export function bankMarkDays(at: string | null | undefined, now: Date = new Date()): number | null {
  if (!at) return null;
  const days = daysAgo(at, now);
  return days < BANK_MARK_DAYS ? days : null;
}

/** IBAN сменили меньше 48 часов назад — счёт объекта сам не уходит. */
export function ibanHoldActive(at: string | null | undefined, now: Date = new Date()): boolean {
  if (!at) return false;
  return now.getTime() - Date.parse(at) < IBAN_HOLD_HOURS * 3_600_000;
}
