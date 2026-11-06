/**
 * Полис экспедитора: пороги, разбор сумм и причина закрытого прямого режима.
 *
 * Без импортов из приложения: модуль читают и сервер, и клиент, и тесты
 * (node --test). Сама проверка живёт в базе (app.forwarder_direct_allowed);
 * здесь только то, чем интерфейс объясняет её ответ.
 */

/** 250 000 € на страховой случай и 500 000 € в год (решение 6.11.2026); в центах, как в базе. */
export const FORWARDER_MIN_EVENT_CENTS = 25_000_000;
export const FORWARDER_MIN_YEAR_CENTS = 50_000_000;

export const FORWARDER_TERMS = ['NSAB2015', 'ADSP2017', 'PSYM', 'OTHER'] as const;
export type ForwarderTerms = (typeof FORWARDER_TERMS)[number];

export function isForwarderTerms(value: unknown): value is ForwarderTerms {
  return typeof value === 'string' && (FORWARDER_TERMS as readonly string[]).includes(value);
}

/**
 * Сумма полиса из поля формы в центах: «250 000», «250000,00», «1.250.000».
 * Пусто, мусор и ноль — null. Дробная часть — только два знака после
 * последней запятой или точки; иначе разделители считаются тысячными.
 */
export function parseAmountCents(raw: string | null | undefined): number | null {
  const value = String(raw ?? '').replace(/[\s  ']/g, '');
  if (!/^\d[\d.,]*$/.test(value)) return null;
  const decimals = /[.,](\d{1,2})$/.exec(value);
  const whole = (decimals ? value.slice(0, decimals.index) : value).replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const cents = Number(whole) * 100 + (decimals ? Number(decimals[1].padEnd(2, '0')) : 0);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Ответ public.forwarder_status — то, что нужно интерфейсу. */
export type ForwarderStatus = {
  applies: boolean;
  allowed: boolean;
  in_grace: boolean;
  grace_until: string | null;
  policy_until: string | null;
  needs_license: boolean;
  license_ok: boolean;
};

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Почему прямой режим закрыт — одно слово для текста в форме заказа.
 * null — открыт (или правило к компании не относится).
 */
export type DirectBlock = 'PENDING' | 'REJECTED' | 'LICENSE' | 'MISSING';

export function directBlockReason(
  status: ForwarderStatus | null,
  latestInsurance: ReviewStatus | null,
): DirectBlock | null {
  if (!status || status.allowed || !status.applies) return null;
  if (status.policy_until && status.needs_license && !status.license_ok) return 'LICENSE';
  if (latestInsurance === 'PENDING') return 'PENDING';
  if (latestInsurance === 'REJECTED') return 'REJECTED';
  return 'MISSING';
}

/** Ниже ли порога суммы полиса в евро (для подсказки оператору; база сравнивает сама). */
export function belowThreshold(eventCentsEur: number | null, yearCentsEur: number | null): boolean {
  return (eventCentsEur ?? 0) < FORWARDER_MIN_EVENT_CENTS || (yearCentsEur ?? 0) < FORWARDER_MIN_YEAR_CENTS;
}
