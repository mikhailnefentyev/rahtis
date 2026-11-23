/**
 * Правила страны о просрочке и изъятии (23.11.2026). Расчёты финского
 * закона о рассрочке (91/1966, 2 §) живут в calc.ts и здесь не меняются:
 * этот модуль только выбирает набор правил по стране сделки, чтобы для
 * другой страны можно было подключить свой набор, не трогая экраны и
 * ежедневное задание. Нет правил у страны — нет ни порогов на экране, ни
 * сигнала продавцу (и сама страна закрыта, см. countries.ts).
 *
 * Наборы (23.11.2026):
 *   · FI_OSKL — пороги закона: 14 дней и 1/10 цены (один взнос) или 1/20
 *     (два и больше) либо весь остаток. После порога продавец вправе
 *     требовать остаток или изымать (через ulosottomies).
 *   · EE_VOS — в эстонском законе порогов нет (docs/equipment-sale/
 *     countries/ee.md): те же числа записаны в договор (п. 9.1) как
 *     договорные. Порог сам по себе ничего не разрешает: после него продавец
 *     даёт письменный дополнительный срок не короче 14 дней (VÕS § 114),
 *     и только после его истечения — отказ от договора (§ 116, § 233 lg 2).
 *     Забрать машину самому нельзя (AÕS § 40): добровольная передача или суд.
 *   · LV_CL2070 — порог закона, императивный (Civillikums 2070. p.): два
 *     пропущенных срока платежа; ни дней, ни доли цены закон не знает.
 *     Толкование «два срока» не подтверждено практикой (lv.md, открытый
 *     вопрос 1), поэтому взят осторожный вариант договора (п. 9.1): два
 *     платежа просрочены одновременно и оба не уплачены. Затем — письменное
 *     предупреждение на 14 дней (договор), и только потом требование
 *     отменить договор. Самому забирать машину нельзя (Civillikums 1732. p.).
 */
import { remedyAllowed, thresholds, type Overdue, type Schedule, type Thresholds } from './calc.ts';
import { installmentCountryEntry, type InstallmentRulesId } from './countries.ts';

export type InstallmentRules = {
  id: InstallmentRulesId;
  /** Откуда порог: из закона страны или из договора сторон (в Эстонии закон порогов не задаёт). */
  source: 'LAW' | 'CONTRACT';
  /**
   * Сколько дней письменного срока продавец обязан дать покупателю после
   * порога, прежде чем отказаться от договора; 0 — такого шага нет.
   */
  graceDays: number;
  /** Пороги, которые показываются сторонам вместе с расчётом. */
  thresholds: (schedule: Schedule) => Thresholds;
  /**
   * Выполнен ли порог. Что он даёт продавцу, зависит от страны: в Финляндии —
   * право требовать остаток или изымать, в Эстонии и Латвии — только право
   * начать следующий шаг (дополнительный срок, предупреждение). Тексты — по
   * стране (countryTexts/).
   */
  remedyAllowed: (overdue: Overdue[], todayIso: string, priceGrossCents: number, remainingCents: number) => boolean;
};

/** Эстония, договор п. 9.1: просрочка не короче 14 дней. */
export const EE_DAYS_LATE = 14;
/** Эстония, VÕS § 114 и договор п. 9.2; Латвия, договор п. 9.1: письменный срок не короче 14 дней. */
export const GRACE_DAYS = 14;
/** Латвия, Civillikums 2070. p.: два пропущенных срока платежа. */
export const LV_MISSED_DATES = 2;

/*
 * Эстония: числа договора (п. 9.1) совпадают с финским законом — 1/10 и
 * 1/20 цены с НДС, 14 дней, весь остаток, — поэтому считаются теми же
 * функциями calc.ts. Набор свой: источник порога — договор, и после него
 * обязателен дополнительный срок.
 */
function eeThresholds(schedule: Schedule): Thresholds {
  return thresholds(schedule);
}

function eeThresholdReached(overdue: Overdue[], todayIso: string, priceGrossCents: number, remainingCents: number): boolean {
  return remedyAllowed(overdue, todayIso, priceGrossCents, remainingCents);
}

/*
 * Латвия: доли цены в правиле нет. На экране показывается только число
 * платежей (два), суммы 1/10 и 1/20 — нули и в тексте не используются.
 * Если по графику взнос всего один, порог недостижим: остаётся взыскание.
 */
function lvThresholds(): Thresholds {
  return { tenthCents: 0, twentiethCents: 0, installmentsNeeded: LV_MISSED_DATES };
}

/**
 * Латвия: два и больше взносов, срок которых прошёл и которые не уплачены.
 * overdue — уже просроченные взносы (calc.ts overduePayments: счёт отправлен,
 * срок прошёл); здесь отсекаются уплаченные и те, чей день ещё не прошёл.
 * Одна просрочка, даже крупного последнего платежа, порога не даёт.
 */
function lvThresholdReached(overdue: Overdue[], todayIso: string): boolean {
  return overdue.filter((o) => o.unpaidCents > 0 && o.dueDate < todayIso).length >= LV_MISSED_DATES;
}

export const INSTALLMENT_RULES: Record<InstallmentRulesId, InstallmentRules> = {
  FI_OSKL: { id: 'FI_OSKL', source: 'LAW', graceDays: 0, thresholds, remedyAllowed },
  EE_VOS: { id: 'EE_VOS', source: 'CONTRACT', graceDays: GRACE_DAYS, thresholds: eeThresholds, remedyAllowed: eeThresholdReached },
  LV_CL2070: { id: 'LV_CL2070', source: 'LAW', graceDays: GRACE_DAYS, thresholds: lvThresholds, remedyAllowed: lvThresholdReached },
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
