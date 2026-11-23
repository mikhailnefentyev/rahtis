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
 *   · SE_AVBL — Швеция, lag (1978:599) 7 §, императивно в пользу покупателя
 *     (docs/equipment-sale/countries/se.md): просрочка СТРОГО больше 14 дней
 *     и сумма СТРОГО больше 1/10 (один взнос) или 1/20 (два и больше взносов
 *     с разными сроками) всего kreditfordran либо весь остаток. База —
 *     kreditfordran: часть цены в кредит (без НДС и без первого взноса) плюс
 *     все проценты, а не цена. Письменного срока закон не требует, но
 *     покупатель снимает право на изъятие, погасив просрочку с пенями и
 *     расходами до фактического возврата (8 §) — это говорит текст страны.
 *     Изъятие — только через Kronofogden (handräckning).
 *   · DK_KAL — Дания, kreditaftaleloven § 29 (через § 49), императивно в
 *     пользу покупателя (dk.md): просрочка 30 дней и сумма не меньше 1/10
 *     (один взнос) или 1/20 (несколько взносов) всей суммы к уплате либо
 *     весь остаток. База — «det samlede beløb, der skal betales, inklusive
 *     udbetaling»: цена с НДС плюс все проценты. Изъятие — только через
 *     fogedretten; покупатель вправе погасить просрочку до изъятия (§ 37).
 *
 * База порога (23.11.2026). До Швеции и Дании доля считалась только от цены
 * с НДС, и вызывающий передавал её сам. Теперь базу даёт набор (base): у
 * Финляндии и Эстонии — та же цена с НДС, что и раньше, у Швеции и Дании —
 * своя. В просроченной сумме взносов проценты не учитываются, как и раньше:
 * при базе с процентами порог от этого наступает не раньше, чем по закону,
 * то есть ошибка возможна только в пользу покупателя.
 */
import { daysBetween, remedyAllowed, thresholds, type Overdue, type Schedule, type Thresholds } from './calc.ts';
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
   * От какой суммы считается доля просрочки (23.11.2026) — третий аргумент
   * remedyAllowed. Финляндия и Эстония — цена с НДС, Швеция — kreditfordran,
   * Дания — вся сумма к уплате; у Латвии доли нет, сумма не используется.
   */
  base: (schedule: Schedule) => number;
  /**
   * Выполнен ли порог. Что он даёт продавцу, зависит от страны: в Финляндии —
   * право требовать остаток или изымать, в Эстонии и Латвии — только право
   * начать следующий шаг (дополнительный срок, предупреждение). Тексты — по
   * стране (countryTexts/).
   */
  remedyAllowed: (overdue: Overdue[], todayIso: string, baseCents: number, remainingCents: number) => boolean;
};

/** Цена с НДС — база порога Финляндии и Эстонии (у Латвии это число в правиле не участвует). */
const priceGross = (schedule: Schedule) => schedule.installmentPriceCents;

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

/* ── Швеция и Дания: доля от своей базы ──────────────────────────────── */

/** Швеция, 7 § 1: просрочка строго больше 14 дней. */
export const SE_DAYS_LATE = 14;
/** Дания, § 29, stk. 1: сумма не уплачена 30 дней после срока. */
export const DK_DAYS_LATE = 30;

const principalSum = (schedule: Schedule) => schedule.installments.reduce((sum, x) => sum + x.principalCents, 0);

/**
 * Швеция: kreditfordran = kreditbelopp (цена без НДС минус первый взнос — то
 * есть сумма взносов графика) + kreditkostnad (все проценты). НДС в базу не
 * входит: он целиком уплачен первым счётом (se.md, открытый вопрос 6 —
 * расчёт базы юристом не подтверждён; так он записан и в договоре, п. 4.1).
 */
export function seCreditClaimCents(schedule: Schedule): number {
  return principalSum(schedule) + schedule.interestTotalCents;
}

/**
 * Дания: вся сумма к уплате, включая первый взнос, — цена с НДС плюс все
 * проценты (dk.md, repossessionThresholdsNote; входит ли НДС, юристом не
 * подтверждено — открытый вопрос 5; так база записана и в договоре, п. 4.1).
 */
export function dkTotalPayableCents(schedule: Schedule): number {
  return schedule.installmentPriceCents + schedule.interestTotalCents;
}

type ShareRule = {
  /** Сколько дней должно пройти от срока. */
  days: number;
  /** true — «больше» (Швеция: и дней, и доли), false — «не меньше» (Дания). */
  strict: boolean;
};

const SE_RULE: ShareRule = { days: SE_DAYS_LATE, strict: true };
const DK_RULE: ShareRule = { days: DK_DAYS_LATE, strict: false };

/** Доля базы: «больше 1/10» — целая часть (суммы целые), «не меньше 1/10» — с округлением вверх. */
const shareOf = (base: number, parts: number, rule: ShareRule) => (rule.strict ? Math.floor(base / parts) : Math.ceil(base / parts));

/** Сумма взносов достигает доли: один взнос — 1/10, два и больше — 1/20. */
function shareReached(sum: number, count: number, base: number, rule: ShareRule): boolean {
  const parts = count === 1 ? 10 : 20;
  return rule.strict ? sum * parts > base : sum * parts >= base;
}

/** Сколько первых взносов подряд надо просрочить, чтобы доля была достигнута (или просрочен весь остаток). */
function neededInstalments(schedule: Schedule, base: number, rule: ShareRule): number {
  const list = schedule.installments.map((x) => x.principalCents);
  const total = list.reduce((sum, x) => sum + x, 0);
  let sum = 0;
  for (let k = 1; k <= list.length; k++) {
    sum += list[k - 1];
    if (shareReached(sum, k, base, rule) || sum >= total) return k;
  }
  return list.length;
}

function shareThresholds(schedule: Schedule, base: number, rule: ShareRule): Thresholds {
  return {
    tenthCents: shareOf(base, 10, rule),
    twentiethCents: shareOf(base, 20, rule),
    installmentsNeeded: neededInstalments(schedule, base, rule),
  };
}

/**
 * Порог доли: считаются только взносы, не уплаченные нужное число дней.
 * Весь остаток долга, просроченный этот срок, — порог при любой сумме.
 * Взносы графика идут с разными сроками (раз в месяц), поэтому «два и
 * больше» здесь всегда «с разными сроками», как требует шведский закон.
 */
function shareThresholdReached(overdue: Overdue[], todayIso: string, base: number, remainingCents: number, rule: ShareRule): boolean {
  const late = overdue.filter((o) => {
    if (o.unpaidCents <= 0) return false;
    const days = daysBetween(o.dueDate, todayIso);
    return rule.strict ? days > rule.days : days >= rule.days;
  });
  if (late.length === 0) return false;
  const sum = late.reduce((s, o) => s + o.unpaidCents, 0);
  if (sum >= remainingCents) return true;
  return shareReached(sum, late.length, base, rule);
}

export const INSTALLMENT_RULES: Record<InstallmentRulesId, InstallmentRules> = {
  FI_OSKL: { id: 'FI_OSKL', source: 'LAW', graceDays: 0, thresholds, base: priceGross, remedyAllowed },
  EE_VOS: { id: 'EE_VOS', source: 'CONTRACT', graceDays: GRACE_DAYS, thresholds: eeThresholds, base: priceGross, remedyAllowed: eeThresholdReached },
  LV_CL2070: { id: 'LV_CL2070', source: 'LAW', graceDays: GRACE_DAYS, thresholds: lvThresholds, base: priceGross, remedyAllowed: lvThresholdReached },
  SE_AVBL: {
    id: 'SE_AVBL',
    source: 'LAW',
    graceDays: 0,
    thresholds: (schedule) => shareThresholds(schedule, seCreditClaimCents(schedule), SE_RULE),
    base: seCreditClaimCents,
    remedyAllowed: (overdue, todayIso, base, remaining) => shareThresholdReached(overdue, todayIso, base, remaining, SE_RULE),
  },
  DK_KAL: {
    id: 'DK_KAL',
    source: 'LAW',
    graceDays: 0,
    thresholds: (schedule) => shareThresholds(schedule, dkTotalPayableCents(schedule), DK_RULE),
    base: dkTotalPayableCents,
    remedyAllowed: (overdue, todayIso, base, remaining) => shareThresholdReached(overdue, todayIso, base, remaining, DK_RULE),
  },
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
