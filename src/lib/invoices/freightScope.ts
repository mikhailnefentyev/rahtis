/**
 * Какие рейсы вообще идут в автоматический счёт перевозчика (22.11.2026).
 *
 * Два решения владельца:
 *
 *   · Включение недельных счетов не выставляет историю. Перевозчик на три
 *     месяца выключал настройку и выставлял счета из своей бухгалтерии;
 *     включил снова — и получил бы счета за все рейсы с первой недели
 *     схемы, уже выставленные им самим. База запоминает момент включения
 *     (companies.weekly_invoicing_from), и в счёт идут только рейсы,
 *     закрытые в этот момент или позже. У тех, кто настройку не
 *     переключал, отметки нет — действует общая граница START.
 *
 *   · Свой клиент перевозчика (companies.client_of) получает счёт от
 *     RAHTIS, только если перевозчик сам это подтвердил для этого клиента
 *     (companies.auto_invoice). Своих клиентов перевозчик часто уже
 *     выставляет из бухгалтерии — без подтверждения клиент получил бы
 *     второй счёт за те же рейсы.
 *
 * Без импортов из приложения: модуль читают сервер и тесты.
 */

export type FreightScopeSkip = 'BEFORE_INVOICING_FROM' | 'OWN_CLIENT_OFF';

export type ScopeCarrier = { weekly_invoicing_from: string | null };
export type ScopeShipper = { client_of: string | null; auto_invoice: boolean | null };

/** Свой клиент перевозчика, которому автоматические счета не подтверждены. */
export function ownClientOff(shipper: ScopeShipper | null | undefined): boolean {
  return Boolean(shipper?.client_of) && shipper?.auto_invoice !== true;
}

/**
 * Почему рейс не идёт в автоматический счёт; null — идёт.
 *
 * closedAt — момент закрытия рейса (orders.closed_at), тот же, по которому
 * рейсы отбираются в счёт. Сравнение — по моменту, а не по дню: рейс,
 * закрытый утром в день включения, до включения, остаётся перевозчику.
 * Отметка, которую не удалось прочитать как время, рейс не пропускает в
 * счёт: лучше не выставить, чем выставить историю.
 */
export function freightScope(
  closedAt: string,
  carrier: ScopeCarrier | null | undefined,
  shipper: ScopeShipper | null | undefined,
): FreightScopeSkip | null {
  const from = carrier?.weekly_invoicing_from;
  if (from) {
    const closed = Date.parse(closedAt);
    const since = Date.parse(from);
    if (!Number.isFinite(closed) || !Number.isFinite(since) || closed < since) return 'BEFORE_INVOICING_FROM';
  }
  if (ownClientOff(shipper)) return 'OWN_CLIENT_OFF';
  return null;
}
