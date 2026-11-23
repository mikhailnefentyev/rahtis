/**
 * Правила страны о просрочке и изъятии (23.11.2026). Расчёты финского
 * закона о рассрочке (91/1966, 2 §) живут в calc.ts и здесь не меняются:
 * этот модуль только выбирает набор правил по стране сделки, чтобы для
 * другой страны можно было подключить свой набор, не трогая экраны и
 * ежедневное задание. Нет правил у страны — нет ни порогов на экране, ни
 * сигнала продавцу (и сама страна закрыта, см. countries.ts).
 */
import { remedyAllowed, thresholds, type Overdue, type Schedule, type Thresholds } from './calc.ts';
import { installmentCountryEntry, type InstallmentRulesId } from './countries.ts';

export type InstallmentRules = {
  id: InstallmentRulesId;
  /** Пороги, которые показываются сторонам вместе с расчётом. */
  thresholds: (schedule: Schedule) => Thresholds;
  /** Выполнен ли порог: продавец вправе требовать остаток или изымать. */
  remedyAllowed: (overdue: Overdue[], todayIso: string, priceGrossCents: number, remainingCents: number) => boolean;
};

export const INSTALLMENT_RULES: Record<InstallmentRulesId, InstallmentRules> = {
  FI_OSKL: { id: 'FI_OSKL', thresholds, remedyAllowed },
};

export function installmentRulesById(id: string | null | undefined): InstallmentRules | null {
  return id && Object.prototype.hasOwnProperty.call(INSTALLMENT_RULES, id) ? INSTALLMENT_RULES[id as InstallmentRulesId] : null;
}

/**
 * Правила страны сделки (страна продавца). Берутся из записи страны, даже
 * если раздел в ней потом закрыли: уже идущая сделка ведётся до конца.
 */
export function installmentRules(country: string | null | undefined): InstallmentRules | null {
  return installmentRulesById(installmentCountryEntry(country)?.rules);
}
