/**
 * Продажа техники в рассрочку (osamaksukauppa) — расчёты, 21.11.2026.
 *
 * Методика и источники: docs/equipment-sale/laskentamalli.md и
 * docs/equipment-sale/research/ (закон 91/1966 полностью, НДС, налог).
 * Главное:
 *   · весь НДС — в первом счёте вместе со взносом, машина передаётся
 *     после его оплаты (AVL 15 § 1 mom 1–2 k);
 *   · käteishinta и osamaksuhinta — с НДС, проценты отдельно, поэтому
 *     они равны и доля будущих взносов при tilitys равна 1 (OskL 3 §);
 *   · проценты — с даты передачи, факт. дни / 365, отдельно от взносов
 *     (veroton rahoituspalvelu, AVL 41 §);
 *   · изъятие и досрочное взыскание — только после порогов OskL 2 §;
 *   · tilitys — OskL 3–4 §, НДС на стоимость машины — по статусу
 *     покупателя (KVL 239/1997, KKO 2008:15);
 *   · налог продавца — в год передачи (EVL 19 §, 30 § / 33 § 3–4 mom).
 *
 * Все суммы — целые центы, ставки — базисные пункты (2550 = 25,5 %).
 * Это ориентир для сторон, а не налоговая или юридическая консультация.
 * Без зависимостей: модуль читают сервер, страница калькулятора и тесты.
 */

export type VatMode = 'STANDARD' | 'MARGIN' | 'EXEMPT' | 'NONE';

export type DealInput = {
  /** Цена машины и допоборудования без НДС. */
  priceCents: number;
  vatMode: VatMode;
  /** Ставка НДС страны продавца, б. п. (FI 2550). */
  vatBps: number;
  /** Первоначальный взнос без НДС (часть цены). */
  downPaymentCents: number;
  /** Число ежемесячных взносов. */
  months: number;
  /** Последний взнос; null — все взносы равные. */
  finalCents: number | null;
  /** Проценты годовых, б. п.; 0 — без процентов. */
  annualRateBps: number;
  /** Дата передачи машины (ISO). */
  handoverDate: string;
  /** Срок первого взноса (ISO); дальше — то же число каждого месяца. */
  firstDueDate: string;
};

export type Installment = {
  n: number;
  dueDate: string;
  /** Взнос в счёт цены (без НДС — НДС уже в первом счёте). */
  principalCents: number;
  /** Проценты за период, отдельной строкой. */
  interestCents: number;
};

export type Schedule = {
  vatCents: number;
  /** Первый счёт до передачи: взнос + весь НДС, без процентов. */
  firstInvoiceCents: number;
  /** Käteishinta = osamaksuhinta (с НДС), договор п. 4.1. */
  installmentPriceCents: number;
  installments: Installment[];
  interestTotalCents: number;
};

export type ScheduleError =
  | 'PRICE'
  | 'MONTHS'
  | 'DOWN_PAYMENT'
  | 'FINAL'
  | 'RATE'
  | 'DATES';

const DAY = 86_400_000;

function parseIso(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  return d.getUTCMonth() === Number(m[2]) - 1 ? t : NaN;
}

function toIso(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Та же дата через k месяцев; 31-е в коротком месяце — последний день. */
export function addMonths(iso: string, k: number): string {
  const t = parseIso(iso);
  const d = new Date(t);
  const day = d.getUTCDate();
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1);
  const f = new Date(first);
  const last = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  return toIso(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), Math.min(day, last)));
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  return Math.round((parseIso(toIsoDate) - parseIso(fromIso)) / DAY);
}

export function vatOf(priceCents: number, mode: VatMode, vatBps: number): number {
  return mode === 'STANDARD' ? Math.round((priceCents * vatBps) / 10_000) : 0;
}

/** График платежей. Ошибка — какое поле неверно. */
export function buildSchedule(input: DealInput): Schedule | { error: ScheduleError } {
  const { priceCents, downPaymentCents, months, finalCents, annualRateBps } = input;
  if (!Number.isInteger(priceCents) || priceCents <= 0) return { error: 'PRICE' };
  if (!Number.isInteger(months) || months < 1 || months > 120) return { error: 'MONTHS' };
  if (!Number.isInteger(downPaymentCents) || downPaymentCents < 0 || downPaymentCents >= priceCents) {
    return { error: 'DOWN_PAYMENT' };
  }
  if (!Number.isInteger(annualRateBps) || annualRateBps < 0 || annualRateBps > 5000) return { error: 'RATE' };
  const handover = parseIso(input.handoverDate);
  const firstDue = parseIso(input.firstDueDate);
  if (Number.isNaN(handover) || Number.isNaN(firstDue) || firstDue <= handover) return { error: 'DATES' };

  const rest = priceCents - downPaymentCents;
  let last: number;
  let regular: number[];
  if (months === 1) {
    /* Как в базе (app.installment_terms_ok): при одном взносе отдельного последнего нет — расчёт и сохранение сходятся (22.11.2026). */
    if (finalCents != null) return { error: 'FINAL' };
    last = rest;
    regular = [];
  } else {
    if (finalCents != null && (!Number.isInteger(finalCents) || finalCents <= 0 || finalCents >= rest)) {
      return { error: 'FINAL' };
    }
    if (finalCents == null) {
      const base = Math.floor(rest / months);
      const extra = rest - base * months;
      const all = Array.from({ length: months }, (_, i) => base + (i < extra ? 1 : 0));
      last = all.pop()!;
      regular = all;
    } else {
      const pool = rest - finalCents;
      const base = Math.floor(pool / (months - 1));
      if (base <= 0) return { error: 'FINAL' };
      const extra = pool - base * (months - 1);
      regular = Array.from({ length: months - 1 }, (_, i) => base + (i < extra ? 1 : 0));
      last = finalCents;
    }
  }
  const principals = [...regular, last];

  const installments: Installment[] = [];
  let outstanding = rest;
  let from = input.handoverDate;
  for (let i = 0; i < principals.length; i++) {
    const dueDate = addMonths(input.firstDueDate, i);
    const days = daysBetween(from, dueDate);
    const interestCents = Math.round((outstanding * annualRateBps * days) / (10_000 * 365));
    installments.push({ n: i + 1, dueDate, principalCents: principals[i], interestCents });
    outstanding -= principals[i];
    from = dueDate;
  }

  const vatCents = vatOf(priceCents, input.vatMode, input.vatBps);
  return {
    vatCents,
    firstInvoiceCents: downPaymentCents + vatCents,
    installmentPriceCents: priceCents + vatCents,
    installments,
    interestTotalCents: installments.reduce((s, x) => s + x.interestCents, 0),
  };
}

// ── Пороги OskL 2 § ──────────────────────────────────────────────────

export type Thresholds = {
  /** 1/10 osamaksuhinta — при одном просроченном взносе. */
  tenthCents: number;
  /** 1/20 — при двух и более. */
  twentiethCents: number;
  /** Сколько первых взносов подряд надо просрочить, чтобы порог был достигнут. */
  installmentsNeeded: number;
};

export function thresholds(schedule: Schedule): Thresholds {
  return {
    tenthCents: Math.ceil(schedule.installmentPriceCents / 10),
    twentiethCents: Math.ceil(schedule.installmentPriceCents / 20),
    installmentsNeeded: thresholdsFrom(schedule, 0),
  };
}

export type Overdue = { dueDate: string; unpaidCents: number };

/**
 * Можно ли изымать или требовать досрочно (OskL 2 § 1 mom): сумма,
 * не оплаченная 14 дней и больше от срока, ≥ 1/10 (один взнос),
 * ≥ 1/20 (два и больше) или весь остаток долга.
 */
export function remedyAllowed(
  overdue: Overdue[],
  todayIso: string,
  installmentPriceCents: number,
  remainingDebtCents: number,
): boolean {
  const late = overdue.filter((o) => o.unpaidCents > 0 && daysBetween(o.dueDate, todayIso) >= 14);
  if (late.length === 0) return false;
  const sum = late.reduce((s, o) => s + o.unpaidCents, 0);
  if (sum >= remainingDebtCents) return true;
  return late.length === 1 ? sum * 10 >= installmentPriceCents : sum * 20 >= installmentPriceCents;
}

/**
 * Просрочка взноса — одно правило для страницы сделки и ежедневного
 * задания (22.11.2026). Считается от большего из двух дней: срока взноса
 * и дня, когда счёт ушёл покупателю (оба — ISO-дни по Хельсинки). Счёт
 * не отправлен — просрочки нет: покупателю не по чему платить.
 */
export type PaymentState = {
  dueDate: string;
  paid: boolean;
  /** День отправки счёта покупателю; null — счёта нет или он не дошёл. */
  invoiceSentDay: string | null;
};

/** С какого дня взнос считается неоплаченным; null — ещё не с чего считать. */
export function lateFrom(p: PaymentState): string | null {
  if (p.paid || !p.invoiceSentDay) return null;
  return p.invoiceSentDay > p.dueDate ? p.invoiceSentDay : p.dueDate;
}

/** Дней просрочки на сегодня; 0 — не просрочен. */
export function lateDays(p: PaymentState, todayIso: string): number {
  const from = lateFrom(p);
  return from ? Math.max(0, daysBetween(from, todayIso)) : 0;
}

/** Просроченные взносы с днём начала и длиной просрочки — в исходном порядке. */
export function overduePayments<T extends PaymentState>(rows: T[], todayIso: string): (T & { lateFrom: string; lateDays: number })[] {
  const out: (T & { lateFrom: string; lateDays: number })[] = [];
  for (const row of rows) {
    const from = lateFrom(row);
    const days = lateDays(row, todayIso);
    if (from && days > 0) out.push({ ...row, lateFrom: from, lateDays: days });
  }
  return out;
}

/**
 * День, с которого идут проценты: согласованная дата передачи или
 * фактическая, если машину передали позже (ISO-дни по Хельсинки). То же
 * правило у графика (payments.ts) и у суммы досрочного погашения.
 */
export function effectiveHandover(agreedIso: string, handedOverDay: string | null): string {
  return handedOverDay && handedOverDay > agreedIso ? handedOverDay : agreedIso;
}

// ── Tilitys OskL 3–4 § ───────────────────────────────────────────────

export type SettlementInput = {
  /** Стоимость машины без НДС на дату изъятия (3 § 1 mom). */
  valueCents: number;
  /** Покупатель плательщик НДС и машина в вычитаемом использовании. */
  buyerVatRegistered: boolean;
  vatBps: number;
  /** Просроченные взносы. */
  overdueCents: number;
  /** Ещё не наступившие взносы. */
  futureCents: number;
  /** Käteishinta и osamaksuhinta — для доли будущих взносов (3 § 2 mom 2 k). */
  cashPriceCents: number;
  installmentPriceCents: number;
  /** Проценты, начисленные по дату изъятия и не оплаченные. */
  accruedInterestCents: number;
  /** Расходы на изъятие (3 § 2 mom 4 k). */
  costsCents: number;
};

export type Settlement = {
  /** Зачёт покупателю: стоимость, с НДС если покупатель его выставляет. */
  creditCents: number;
  /** НДС в зачёте (покупатель выставляет, продавец вычитает). */
  creditVatCents: number;
  /** Требование продавца. */
  claimCents: number;
  /** Продавец платит покупателю до получения машины (4 § 1 mom). */
  sellerPaysCents: number;
  /** Покупатель доплачивает, не больше разницы (4 § 2 mom). */
  buyerPaysCents: number;
};

export function settlement(s: SettlementInput): Settlement {
  const creditVatCents = s.buyerVatRegistered ? Math.round((s.valueCents * s.vatBps) / 10_000) : 0;
  const creditCents = s.valueCents + creditVatCents;
  const share = s.installmentPriceCents > 0 ? Math.min(1, s.cashPriceCents / s.installmentPriceCents) : 1;
  const claimCents =
    s.overdueCents + Math.round(s.futureCents * share) + s.accruedInterestCents + s.costsCents;
  return {
    creditCents,
    creditVatCents,
    claimCents,
    sellerPaysCents: Math.max(0, creditCents - claimCents),
    buyerPaysCents: Math.max(0, claimCents - creditCents),
  };
}

/** Досрочное погашение (OskL 5 § 3 mom): остаток цены + проценты по день оплаты. */
export function payoffCents(remainingPrincipalCents: number, lastPaidDate: string, payDate: string, annualRateBps: number): number {
  const days = Math.max(0, daysBetween(lastPaidDate, payDate));
  return remainingPrincipalCents + Math.round((remainingPrincipalCents * annualRateBps * days) / (10_000 * 365));
}

// ── Стоимость машины, налог продавца, взнос ──────────────────────────

/** Оценка стоимости через m месяцев при падении d б. п. в год. */
export function valueAfter(priceCents: number, depreciationBps: number, months: number): number {
  return Math.round(priceCents * Math.pow(1 - depreciationBps / 10_000, months / 12));
}

export type SellerTaxInput =
  | {
      /** EVL 30 §: машина в пуле. */
      method: 'POOL';
      poolStartCents: number;
      purchasesThisYearCents: number;
      priceCents: number;
      rateBps: number;
    }
  | {
      /** EVL 33 § 3–4 mom: машина амортизировалась отдельно. */
      method: 'ITEM';
      residualCents: number;
      priceCents: number;
      rateBps: number;
    };

export type SellerTax = { taxableCents: number; taxCents: number; poolEndCents: number | null };

/** Налог продавца в год передачи. Цена — без НДС и процентов. */
export function sellerTax(t: SellerTaxInput): SellerTax {
  if (t.method === 'POOL') {
    const m = t.poolStartCents + t.purchasesThisYearCents - t.priceCents;
    const taxableCents = m < 0 ? -m : 0;
    return { taxableCents, taxCents: Math.round((taxableCents * t.rateBps) / 10_000), poolEndCents: Math.max(0, m) };
  }
  const taxableCents = Math.max(0, t.priceCents - t.residualCents);
  return { taxableCents, taxCents: Math.round((taxableCents * t.rateBps) / 10_000), poolEndCents: null };
}

export type DownPaymentAdvice = {
  /** Падение стоимости за 6 месяцев + расходы на изъятие. */
  protectionCents: number;
  /** Налог продавца минус взносы, полученные до его уплаты. */
  taxGapCents: number;
  /** Рыночный ориентир — 20 % цены. */
  marketCents: number;
  recommendedCents: number;
};

export function adviseDownPayment(a: {
  priceCents: number;
  depreciationBps: number;
  repossessionCostsCents: number;
  sellerTaxCents: number;
  installmentsBeforeTaxCents: number;
}): DownPaymentAdvice {
  const protectionCents = a.priceCents - valueAfter(a.priceCents, a.depreciationBps, 6) + a.repossessionCostsCents;
  const taxGapCents = Math.max(0, a.sellerTaxCents - a.installmentsBeforeTaxCents);
  const marketCents = Math.round(a.priceCents * 0.2);
  const recommended = Math.max(protectionCents, taxGapCents, marketCents);
  return {
    protectionCents,
    taxGapCents,
    marketCents,
    recommendedCents: Math.min(recommended, a.priceCents - 1),
  };
}

// ── Сценарий «покупатель перестал платить» ───────────────────────────

export type DefaultScenario = {
  /** Месяц, после которого перестал платить. */
  paidMonths: number;
  /** Всего уплачено без НДС: взнос + взносы + проценты. */
  buyerPaidCents: number;
  valueCents: number;
  settlement: Settlement;
  /** Итог продавца без НДС: получено + стоимость машины ± расчёт − расходы. */
  sellerTotalCents: number;
};

/**
 * Покупатель оплатил первые m взносов и перестал; продавец изымает,
 * как только просрочка достигла порога 2 § (плюс 14 дней — не
 * учитываются в стоимости). НДС в зачёте нейтрален: покупатель его
 * перечисляет, продавец вычитает, поэтому итоги — без НДС.
 */
export function defaultScenario(
  input: DealInput,
  schedule: Schedule,
  paidMonths: number,
  depreciationBps: number,
  costsCents: number,
): DefaultScenario {
  const list = schedule.installments;
  const m = Math.min(Math.max(0, paidMonths), list.length);
  const after = list.slice(m);
  const needed = thresholdsFrom(schedule, m);
  const overdue = after.slice(0, needed);
  const future = after.slice(needed);
  const overdueCents = overdue.reduce((s, x) => s + x.principalCents, 0);
  const futureCents = future.reduce((s, x) => s + x.principalCents, 0);
  const accruedInterestCents = overdue.reduce((s, x) => s + x.interestCents, 0);
  const valueCents = valueAfter(input.priceCents, depreciationBps, m + needed);
  const st = settlement({
    valueCents,
    buyerVatRegistered: false,
    vatBps: input.vatBps,
    overdueCents,
    futureCents,
    cashPriceCents: schedule.installmentPriceCents,
    installmentPriceCents: schedule.installmentPriceCents,
    accruedInterestCents,
    costsCents,
  });
  const paid = list.slice(0, m);
  const buyerPaidCents =
    input.downPaymentCents + paid.reduce((s, x) => s + x.principalCents + x.interestCents, 0);
  return {
    paidMonths: m,
    buyerPaidCents,
    valueCents,
    settlement: st,
    sellerTotalCents: buyerPaidCents + valueCents - st.sellerPaysCents + st.buyerPaysCents - costsCents,
  };
}

/** Сколько взносов подряд, начиная с (m+1)-го, нужно просрочить для порога 2 §. */
function thresholdsFrom(schedule: Schedule, m: number): number {
  const tenth = schedule.installmentPriceCents / 10;
  const twentieth = schedule.installmentPriceCents / 20;
  const after = schedule.installments.slice(m).map((x) => x.principalCents);
  const total = after.reduce((s, x) => s + x, 0);
  let sum = 0;
  for (let k = 1; k <= after.length; k++) {
    sum += after[k - 1];
    if ((k === 1 && sum >= tenth) || (k >= 2 && sum >= twentieth) || sum >= total) return k;
  }
  return after.length;
}

// ── Проверка для покупателя ──────────────────────────────────────────

export type BuyerCheck = {
  marginCents: number;
  /** Нет запаса: выручка не покрывает расходы и платёж. */
  negative: boolean;
  /** Малый запас: меньше порога от выручки. */
  thin: boolean;
};

export function buyerCheck(a: {
  revenueCents: number;
  costsCents: number;
  paymentCents: number;
  thinBps: number;
}): BuyerCheck {
  const marginCents = a.revenueCents - a.costsCents - a.paymentCents;
  return {
    marginCents,
    negative: marginCents <= 0,
    thin: marginCents > 0 && marginCents * 10_000 < a.revenueCents * a.thinBps,
  };
}
