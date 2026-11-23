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
 *   · LT_CK6414 — Литва, Civilinis kodeksas 6.414 (lt.md): закон порогов не
 *     даёт (любая просрочка позволяет требовать всю цену или забрать вещь),
 *     поэтому пороги записаны в договор (п. 9.1) по рекомендации
 *     исследования: просрочка СТРОГО больше 30 дней («daugiau kaip 30
 *     dienų») и сумма НЕ МЕНЬШЕ 1/10 (один взнос) или 1/20 (два и больше)
 *     цены с НДС либо весь остаток. Затем письменное требование с
 *     дополнительным сроком не короче 14 дней (п. 9.2, CK 6.217 str. 3 d.),
 *     и только потом — требование всей цены или расторжение. Забрать машину
 *     самому нельзя (CK 1.139 str.): добровольная передача или суд и antstolis.
 *   · DE_BGB449 — Германия, BGB § 449 Abs. 2 и § 323 (de.md): порогов для
 *     сделок между компаниями нет; договор (п. 9.1) добровольно берёт
 *     образец § 498 BGB: просрочены минимум ДВА ВЗНОСА ПОДРЯД (целиком или
 *     частично), и просроченная сумма не меньше 10 % Gesamtbetrag (цена с
 *     НДС; при сроке больше трёх лет — 5 %), либо просрочен последний взнос
 *     или весь остаток. Просрочка (Verzug) — со дня после срока (§ 286 Abs. 2
 *     Nr. 1). Затем письменный срок не короче 14 дней с предупреждением, и
 *     только после него — требование остатка или отказ от договора
 *     (Rücktritt) и требование вернуть машину. Забрать самому нельзя
 *     (§ 858 BGB): добровольно или через суд и Gerichtsvollzieher.
 *   · PL_KC589 — Польша (pl.md): правила sprzedaż na raty (KC 583–588) для
 *     покупателя-предприятия не действуют (KC 587), порогов закон не даёт.
 *     Договорные пороги (п. 9.1) — как предлагает исследование: «co najmniej
 *     dwóch rat dłużej niż 14 dni» — хотя бы ДВА взноса просрочены СТРОГО
 *     больше 14 дней каждый, «albo jednej raty dłużej niż 30 dni» — или один
 *     взнос СТРОГО больше 30 дней. Доли цены нет: база (base) — цена с НДС, в
 *     правиле не участвует (как у Латвии). После порога — письменное
 *     требование с дополнительным сроком не короче 14 дней (KC 491 § 1), и
 *     только потом отказ от договора; забрать машину самому нельзя (KC 342):
 *     добровольно или komornik sądowy по исполнительному документу.
 *   · RO_CC1755 — Румыния (ro.md): Codul civil 1756 (одна неуплата не больше
 *     1/8 цены не даёт расторжения) диспозитивна, договор (п. 9.2) задаёт
 *     своё: (1) взнос просрочен НЕ МЕНЬШЕ 30 дней («cel puțin 30 de zile») и
 *     просрочено НЕ МЕНЬШЕ 1/8 цены с НДС («preț total» — цена с НДС, п. 4.1);
 *     (2) или просрочены два и больше взноса, старший — не меньше 30 дней;
 *     (3) или просрочен весь остаток. База — цена с НДС. В сумму доли (1)
 *     идут только взносы, просроченные 30 дней и больше: так порог наступает
 *     не раньше договорного (ошибка — только в пользу покупателя). Затем
 *     письменное уведомление со сроком 15 дней (п. 9.3); забрать машину —
 *     только executor judecătoresc или суд (осторожный вариант исследования).
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
   * remedyAllowed. Финляндия, Эстония и Литва — цена с НДС, Швеция —
   * kreditfordran, Дания — вся сумма к уплате; у Латвии и Польши доли нет,
   * сумма не используется. Германия — сразу сумма порога: 10 % (5 %) цены с
   * НДС. Румыния — цена с НДС, порог — 1/8 от неё (23.11.2026).
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
/** Эстония, VÕS § 114 и договор п. 9.2; Латвия, договор п. 9.1; Литва и Германия, договор п. 9.2 и 9.1: письменный срок не короче 14 дней. */
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
/** Литва, договор п. 9.1: просрочка больше 30 дней. */
export const LT_DAYS_LATE = 30;

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

/*
 * Строгость «больше» или «не меньше» — отдельно для дней и для доли
 * (23.11.2026): у Швеции обе строгие, у Дании обе нестрогие, а у Литвы
 * дни строгие («daugiau kaip 30 dienų»), доля нестрогая («ne mažiau kaip»).
 * Для Швеции и Дании результат прежний.
 */
type ShareRule = {
  /** Сколько дней должно пройти от срока. */
  days: number;
  /** true — дней «больше» (Швеция, Литва), false — «не меньше» (Дания). */
  strictDays: boolean;
  /** true — доля «больше» (Швеция), false — «не меньше» (Дания, Литва). */
  strictShare: boolean;
};

const SE_RULE: ShareRule = { days: SE_DAYS_LATE, strictDays: true, strictShare: true };
const DK_RULE: ShareRule = { days: DK_DAYS_LATE, strictDays: false, strictShare: false };
const LT_RULE: ShareRule = { days: LT_DAYS_LATE, strictDays: true, strictShare: false };

/** Доля базы: «больше 1/10» — целая часть (суммы целые), «не меньше 1/10» — с округлением вверх. */
const shareOf = (base: number, parts: number, rule: ShareRule) => (rule.strictShare ? Math.floor(base / parts) : Math.ceil(base / parts));

/** Сумма взносов достигает доли: один взнос — 1/10, два и больше — 1/20. */
function shareReached(sum: number, count: number, base: number, rule: ShareRule): boolean {
  const parts = count === 1 ? 10 : 20;
  return rule.strictShare ? sum * parts > base : sum * parts >= base;
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
    return rule.strictDays ? days > rule.days : days >= rule.days;
  });
  if (late.length === 0) return false;
  const sum = late.reduce((s, o) => s + o.unpaidCents, 0);
  if (sum >= remainingCents) return true;
  return shareReached(sum, late.length, base, rule);
}

/* ── Польша: два взноса больше 14 дней или один больше 30 дней ────────── */

/** Польша, договор п. 9.1: два взноса — просрочка строго больше 14 дней. */
export const PL_DAYS_LATE_TWO = 14;
/** Польша, договор п. 9.1: один взнос — просрочка строго больше 30 дней. */
export const PL_DAYS_LATE_ONE = 30;
/** Польша, договор п. 9.1 и KC 491 § 1: дополнительный срок не короче 14 дней. */
export const PL_GRACE_DAYS = 14;

/*
 * Доли цены в польском правиле нет: суммы 1/10 и 1/20 — нули, в тексте
 * страны не используются. Число взносов на экране — два: один взнос даёт
 * порог только через 30 дней, это сказано словами (countryTexts/pl.ts).
 */
function plThresholds(schedule: Schedule): Thresholds {
  return { tenthCents: 0, twentiethCents: 0, installmentsNeeded: Math.min(2, schedule.installments.length) };
}

function plThresholdReached(overdue: Overdue[], todayIso: string): boolean {
  const unpaid = overdue.filter((o) => o.unpaidCents > 0);
  const over14 = unpaid.filter((o) => daysBetween(o.dueDate, todayIso) > PL_DAYS_LATE_TWO).length;
  return over14 >= 2 || unpaid.some((o) => daysBetween(o.dueDate, todayIso) > PL_DAYS_LATE_ONE);
}

/* ── Румыния: 1/8 цены и 30 дней, два взноса или весь остаток ──────────── */

/** Румыния, договор п. 9.2: просрочка не меньше 30 дней. */
export const RO_DAYS_LATE = 30;
/** Румыния, договор п. 9.3: срок уведомления — 15 дней. */
export const RO_GRACE_DAYS = 15;

/** Одна восьмая цены с НДС, «cel puțin» — с округлением вверх. */
export function roEighthCents(schedule: Schedule): number {
  return Math.ceil(schedule.installmentPriceCents / 8);
}

/** Сколько взносов надо просрочить: один, если первый взнос сам не меньше 1/8 цены (или он единственный), иначе два. */
function roThresholds(schedule: Schedule): Thresholds {
  const eighth = roEighthCents(schedule);
  const list = schedule.installments;
  const needed = list.length <= 1 || list[0].principalCents >= eighth ? 1 : 2;
  /* Доля у Румынии одна (1/8): обе строки порога показывают её. */
  return { tenthCents: eighth, twentiethCents: eighth, installmentsNeeded: needed };
}

/**
 * base — цена с НДС (п. 4.1 «preț total»). Взносы без номера и без срока не
 * нужны: «старший» — по сроку, он есть у каждого просроченного взноса.
 */
function roThresholdReached(overdue: Overdue[], todayIso: string, priceGrossCents: number, remainingCents: number): boolean {
  const late = overdue.filter((o) => o.unpaidCents > 0 && daysBetween(o.dueDate, todayIso) >= 1);
  if (late.length === 0) return false;
  const sum = late.reduce((s, o) => s + o.unpaidCents, 0);
  /* (3) просрочен весь остаток. */
  if (sum >= remainingCents) return true;
  const old = late.filter((o) => daysBetween(o.dueDate, todayIso) >= RO_DAYS_LATE);
  if (old.length === 0) return false;
  /* (2) два и больше просроченных взноса, старший — 30 дней и больше. */
  if (late.length >= 2) return true;
  /* (1) взнос просрочен 30 дней и больше, и это не меньше 1/8 цены. */
  return old.reduce((s, o) => s + o.unpaidCents, 0) * 8 >= priceGrossCents;
}

/* ── Германия: два взноса подряд и доля Gesamtbetrag ──────────────────── */

/** Германия, договор п. 9.1 (образец § 498 BGB): срок больше трёх лет — 5 %, иначе 10 %. */
export const DE_LONG_TERM_MONTHS = 36;

/** Доля Gesamtbetrag в процентах по сроку договора (числу взносов графика). */
export function deSharePercent(months: number): number {
  return months > DE_LONG_TERM_MONTHS ? 5 : 10;
}

/**
 * Германия: порог в деньгах — 10 % (5 %) Gesamtbetrag, то есть цены с НДС
 * (проценты в Gesamtbetrag не входят, договор п. 4.1). «Не меньше» — с
 * округлением вверх. Это и есть база правила (base): в remedyAllowed срок
 * договора не передаётся, поэтому доля считается здесь, по графику. Если
 * график не построился, вызывающий подставляет цену с НДС — порог тогда
 * выше договорного, то есть ошибка только в пользу покупателя.
 */
export function deThresholdCents(schedule: Schedule): number {
  return Math.ceil((schedule.installmentPriceCents * deSharePercent(schedule.installments.length)) / 100);
}

/** Сколько первых взносов подряд (не меньше двух) нужно просрочить, чтобы набрать долю; один взнос — весь остаток. */
function deNeeded(schedule: Schedule, share: number): number {
  const list = schedule.installments.map((x) => x.principalCents);
  if (list.length <= 1) return list.length;
  let sum = 0;
  for (let k = 1; k <= list.length; k++) {
    sum += list[k - 1];
    if (k >= 2 && sum >= share) return k;
  }
  return list.length;
}

function deThresholds(schedule: Schedule): Thresholds {
  const share = deThresholdCents(schedule);
  /* Доля у Германии одна (10 % или 5 %): обе строки порога показывают её. */
  return { tenthCents: share, twentiethCents: share, installmentsNeeded: deNeeded(schedule, share) };
}

/**
 * Германия, договор п. 9.1: просрочены (со дня после срока) хотя бы два
 * взноса подряд по номеру графика и вся просрочка не меньше доли (base),
 * либо просрочен весь остаток (сюда же — последний взнос: когда просрочен
 * он, просрочено всё неуплаченное). Взнос без номера (n) в пару «подряд»
 * не входит — так порог наступает не раньше договорного.
 */
function deThresholdReached(overdue: Overdue[], todayIso: string, shareCents: number, remainingCents: number): boolean {
  const late = overdue.filter((o) => o.unpaidCents > 0 && daysBetween(o.dueDate, todayIso) >= 1);
  if (late.length === 0) return false;
  const sum = late.reduce((s, o) => s + o.unpaidCents, 0);
  if (sum >= remainingCents) return true;
  const numbers = new Set(late.map((o) => o.n).filter((n): n is number => Number.isInteger(n)));
  const consecutive = [...numbers].some((n) => numbers.has(n + 1));
  return consecutive && sum >= shareCents;
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
  /* Литва: база — цена с НДС («Kaina» договора, п. 4.1 и 9.1), как у Финляндии и Эстонии. */
  LT_CK6414: {
    id: 'LT_CK6414',
    source: 'CONTRACT',
    graceDays: GRACE_DAYS,
    thresholds: (schedule) => shareThresholds(schedule, priceGross(schedule), LT_RULE),
    base: priceGross,
    remedyAllowed: (overdue, todayIso, base, remaining) => shareThresholdReached(overdue, todayIso, base, remaining, LT_RULE),
  },
  DE_BGB449: {
    id: 'DE_BGB449',
    source: 'CONTRACT',
    graceDays: GRACE_DAYS,
    thresholds: deThresholds,
    base: deThresholdCents,
    remedyAllowed: deThresholdReached,
  },
  /* Польша: доли цены нет, base не используется (цена с НДС — как у Латвии). */
  PL_KC589: {
    id: 'PL_KC589',
    source: 'CONTRACT',
    graceDays: PL_GRACE_DAYS,
    thresholds: plThresholds,
    base: priceGross,
    remedyAllowed: plThresholdReached,
  },
  /* Румыния: база — цена с НДС (1/8 от неё). */
  RO_CC1755: {
    id: 'RO_CC1755',
    source: 'CONTRACT',
    graceDays: RO_GRACE_DAYS,
    thresholds: roThresholds,
    base: priceGross,
    remedyAllowed: roThresholdReached,
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
