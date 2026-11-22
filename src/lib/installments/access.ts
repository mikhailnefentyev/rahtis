/**
 * Раздел «Продажа техники в рассрочку» — только для финских компаний
 * (22.11.2026): договор по финскому закону о рассрочке и финскому НДС.
 * Пункт меню у остальных скрыт (CabinetShell), а по прямой ссылке
 * каталог и формы открывались и кончались общей ошибкой. Страницы
 * раздела сверяются с этим правилом; сделку её стороны видят всегда.
 * Без зависимостей: читают страницы и тесты.
 */
export function installmentsAvailable(country: string | null | undefined): boolean {
  return country === 'FI';
}

/** Машину можно выставить на продажу: не купленная в рассрочку до выплаты и не проданная (как app.vehicle_sellable). */
export function vehicleSellable(installmentRole: string | null | undefined): boolean {
  return installmentRole == null || installmentRole === 'OWNED';
}

/**
 * Статусы сделки в одном месте (22.11.2026): TERMINATED — продавец записал
 * прекращение сделки в рассрочке (забрал машину или стороны договорились).
 */
export const DEAL_STATUSES = ['NEGOTIATING', 'AGREED', 'ACTIVE', 'PAID_OFF', 'CANCELLED', 'TERMINATED'] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

/** Причины прекращения — те же, что принимает terminate_installment_deal. */
export const TERMINATION_REASONS = ['REPOSSESSED', 'AGREEMENT'] as const;
export type TerminationReason = (typeof TERMINATION_REASONS)[number];

export function isTerminationReason(value: unknown): value is TerminationReason {
  return typeof value === 'string' && (TERMINATION_REASONS as readonly string[]).includes(value);
}

/**
 * Ведёт ли ежедневное задание сделку: счета взносов, напоминания и сигнал
 * о пороге — только пока сделка в рассрочке. Прекращённую (TERMINATED),
 * выплаченную и отменённую задание не трогает.
 */
export function dealBilled(status: string | null | undefined): boolean {
  return status === 'ACTIVE';
}

/** Договор и счета доступны сторонам и после выплаты, и после прекращения сделки. */
export function dealHasContract(status: string | null | undefined): boolean {
  return status === 'AGREED' || status === 'ACTIVE' || status === 'PAID_OFF' || status === 'TERMINATED';
}

/** Цвет значка статуса сделки — один для списка и страницы сделки. */
export function dealBadgeTone(status: string | null | undefined): 'ok' | 'warn' | 'info' | 'danger' | 'neutral' {
  if (status === 'AGREED' || status === 'ACTIVE') return 'ok';
  if (status === 'NEGOTIATING') return 'warn';
  if (status === 'PAID_OFF') return 'info';
  if (status === 'TERMINATED') return 'danger';
  return 'neutral';
}

/** В кабинете сделка всегда с обычным НДС (решение 22.11.2026); другие режимы — только у старых строк. */
export const CABINET_VAT_MODE = 'STANDARD';

export function vatModeAllowedForNew(mode: string | null | undefined): boolean {
  return mode === CABINET_VAT_MODE;
}
