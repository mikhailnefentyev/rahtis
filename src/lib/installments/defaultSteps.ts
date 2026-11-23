/**
 * Шаги после порога просрочки (24.11.2026): что продавец обязан сделать по
 * праву страны, прежде чем требовать машину назад, и сроки этих шагов.
 *
 * Это записи и напоминания, а не действия: запись не двигает ни денег, ни
 * машины. Прекращение сделки — по-прежнему terminate_installment_deal
 * (страница сделки, «прекратить»). Записывает шаги продавец, покупатель видит
 * их на странице сделки и получает уведомление в кабинете. Письмо покупателю
 * (PDF, на языке договора) готовит платформа, подписывает и отправляет
 * продавец — так, как требует п. 11.2 договора.
 *
 * Шаги по странам (docs/equipment-sale/countries/<cc>.md, договоры
 * contractText/<cc>.ts, rules.ts):
 *   · Эстония — дополнительный срок не короче 14 дней (täiendav tähtaeg,
 *     VÕS § 114, договор п. 9.2), затем отказ от договора (taganemine, п. 9.3);
 *   · Латвия — письменное предупреждение со сроком не короче 14 дней
 *     (договор п. 9.1), затем отмена договора (atcelšana, Civillikums 2070. p.);
 *   · Литва — письменное требование с дополнительным сроком не короче 14 дней
 *     (п. 9.2), затем расторжение (nutraukimas, п. 9.2 п. 2);
 *   · Германия — срок не короче 14 дней с предупреждением (Nachfrist, п. 9.1
 *     Nr. 2), затем отказ от договора (Rücktritt, п. 9.2 Nr. 2);
 *   · Польша — дополнительный срок не короче 14 дней (dodatkowy termin, п. 9.1,
 *     KC 491 § 1), затем отказ от договора (odstąpienie, п. 9.3);
 *   · Румыния — уведомление со сроком 15 дней (п. 9.3), затем расторжение
 *     (rezoluțiune, п. 9.3 п. 2);
 *   · Финляндия, Швеция, Дания — дополнительного срока закон не требует
 *     (graceDays 0 в rules.ts): после порога один шаг — письменное
 *     уведомление о том, что продавец требует остаток или машину назад
 *     (FI п. 9.1–9.2, SE п. 9.1–9.2, DK п. 9.1–9.2). Покупатель и тогда может
 *     сохранить машину, погасив просрочку до изъятия (SE 8 §, DK § 37, FI п. 9.6).
 *
 * Срок шага (24.11.2026): по всем договорам уведомление считается полученным
 * на следующий рабочий день после отправки (п. 11.2), срок считается от
 * получения; если последний день срока — суббота или воскресенье, он
 * переносится на понедельник (так считают сроки гражданские кодексы всех
 * этих стран). Праздники страны платформа не знает — об этом сказано продавцу
 * рядом с датой. Число дней — graceDays набора правил (rules.ts), здесь оно не
 * повторяется.
 *
 * Можно ли быстрее (24.11.2026): следующий шаг доступен, только когда записан
 * предыдущий; если срок ещё не прошёл (или порог по данным платформы не
 * достигнут), продавец видит предупреждение и подтверждает, что делает шаг
 * раньше, — не запрет: в Эстонии и Германии отказ можно заявить заранее, в
 * том же письме, на случай, если срок пройдёт без оплаты (VÕS § 116 lg 5,
 * § 323 BGB). Без записанного срока последний шаг в странах со сроком не
 * записывается — набор правил требует срок (то же проверяет база).
 *
 * После записи отказа (WITHDRAWAL) ежедневное задание больше не шлёт
 * покупателю напоминаний, не выставляет новых документов на взносы и не
 * сигналит о пороге (payments.ts).
 *
 * Без зависимостей от приложения: читают сервер, страница сделки и тесты.
 */
import { installmentCountryEntry, type InstallmentRulesId } from './countries.ts';
import { INSTALLMENT_RULES } from './rules.ts';

export type DefaultStep = 'GRACE' | 'WITHDRAWAL';

/** Вид первого шага: дополнительный срок или (Латвия) письменное предупреждение со сроком. */
export type GraceKind = 'PERIOD' | 'WARNING';
/** Вид последнего шага: отказ от договора, расторжение (отмена) или (FI, SE, DK) уведомление об изъятии. */
export type FinalKind = 'WITHDRAWAL' | 'TERMINATION' | 'REPOSSESSION';

export type DefaultStepPlan = {
  rules: InstallmentRulesId;
  /** Первый шаг; null — в стране его нет (Финляндия, Швеция, Дания). */
  grace: null | {
    kind: GraceKind;
    /** Дней срока — graceDays набора правил. */
    days: number;
    /** Пункт договора и термин права страны на её языке — для текстов и письма. */
    clause: string;
    term: string;
    law: string;
  };
  final: {
    kind: FinalKind;
    clause: string;
    term: string;
    law: string;
    /** Пункт договора о возврате машины и его срок, дней; null — срока в договоре нет. */
    returnClause: string;
    returnDays: number | null;
  };
};

type PlanShape = Omit<DefaultStepPlan, 'rules' | 'grace'> & { grace: null | Omit<NonNullable<DefaultStepPlan['grace']>, 'days'> };

/*
 * Пункты и термины — из текстов договоров (contractText/<cc>.ts, ContractPdf.tsx)
 * версии 2026-11-23. Меняется текст договора — сверить пункты здесь.
 */
const PLANS: Record<InstallmentRulesId, PlanShape> = {
  FI_OSKL: {
    grace: null,
    final: { kind: 'REPOSSESSION', clause: '9.1–9.2, 9.4', term: 'takaisinotto', law: 'osamaksukauppalaki 2 §', returnClause: '9.7', returnDays: null },
  },
  EE_VOS: {
    grace: { kind: 'PERIOD', clause: '9.2', term: 'täiendav tähtaeg', law: 'VÕS § 114' },
    final: { kind: 'WITHDRAWAL', clause: '9.3', term: 'lepingust taganemine', law: 'VÕS § 116, § 233 lg 2', returnClause: '9.5', returnDays: 7 },
  },
  LV_CL2070: {
    grace: { kind: 'WARNING', clause: '9.1', term: 'rakstveida brīdinājums', law: 'Civillikums 2070. p.' },
    final: { kind: 'TERMINATION', clause: '9.1', term: 'līguma atcelšana', law: 'Civillikums 2070. p.', returnClause: '9.4', returnDays: 5 },
  },
  SE_AVBL: {
    grace: null,
    final: { kind: 'REPOSSESSION', clause: '9.1–9.2, 9.5', term: 'återtagande', law: 'avbetalningsköplagen 7 §', returnClause: '9.7', returnDays: null },
  },
  DK_KAL: {
    grace: null,
    final: { kind: 'REPOSSESSION', clause: '9.1–9.2, 9.5', term: 'tilbagetagelse', law: 'kreditaftaleloven § 29', returnClause: '9.5', returnDays: null },
  },
  LT_CK6414: {
    grace: { kind: 'PERIOD', clause: '9.2', term: 'papildomas terminas', law: 'CK 6.209 str.' },
    final: { kind: 'TERMINATION', clause: '9.2', term: 'sutarties nutraukimas', law: 'CK 6.217 str. 5 d., 6.218 str. 1 d.', returnClause: '9.5', returnDays: 5 },
  },
  DE_BGB449: {
    grace: { kind: 'PERIOD', clause: '9.1', term: 'Nachfrist', law: '§ 323 Abs. 1 BGB' },
    final: { kind: 'WITHDRAWAL', clause: '9.2', term: 'Rücktritt', law: '§ 323, § 449 Abs. 2 BGB', returnClause: '9.4', returnDays: null },
  },
  PL_KC589: {
    grace: { kind: 'PERIOD', clause: '9.1', term: 'dodatkowy termin', law: 'art. 491 § 1 KC' },
    final: { kind: 'WITHDRAWAL', clause: '9.3', term: 'odstąpienie od umowy', law: 'art. 491 § 1 KC', returnClause: '9.3', returnDays: 7 },
  },
  RO_CC1755: {
    grace: { kind: 'PERIOD', clause: '9.3', term: 'notificare cu termen de plată', law: 'art. 1.522 Cod civil' },
    final: { kind: 'TERMINATION', clause: '9.3', term: 'rezoluțiune', law: 'art. 1.552 Cod civil', returnClause: '9.5', returnDays: 5 },
  },
};

export function defaultStepPlanById(id: InstallmentRulesId): DefaultStepPlan {
  const plan = PLANS[id];
  const days = INSTALLMENT_RULES[id].graceDays;
  return {
    rules: id,
    final: plan.final,
    /* Первый шаг есть ровно там, где набор правил требует письменный срок. */
    grace: days > 0 && plan.grace ? { ...plan.grace, days } : null,
  };
}

/** Шаги страны сделки (страны продавца); null — у страны нет правил. */
export function defaultStepPlan(country: string | null | undefined): DefaultStepPlan | null {
  const id = installmentCountryEntry(country)?.rules;
  return id ? defaultStepPlanById(id) : null;
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 0 — воскресенье, 6 — суббота. */
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

/** Ближайший рабочий день (понедельник — пятница) не раньше данного. */
function workingDayFrom(iso: string): string {
  let day = iso;
  while (weekday(day) === 0 || weekday(day) === 6) day = addDays(day, 1);
  return day;
}

/** День, когда уведомление считается полученным: следующий рабочий день после отправки (п. 11.2 договоров). */
export function noticeReceivedOn(sentOn: string): string {
  return workingDayFrom(addDays(sentOn, 1));
}

/**
 * Последний день срока для оплаты по письму, отправленному sentOn: день
 * получения плюс дни срока страны; выходной — переносится на понедельник.
 * null — у страны нет первого шага.
 */
export function graceDeadline(plan: DefaultStepPlan, sentOn: string): string | null {
  if (!plan.grace) return null;
  return workingDayFrom(addDays(noticeReceivedOn(sentOn), plan.grace.days));
}

export type StepRecord = { step: DefaultStep; given_on: string; deadline: string | null; created_at?: string | null };

export type StepState = {
  plan: DefaultStepPlan;
  /** Последний записанный срок (их может быть несколько: покупатель погасил, потом снова просрочил). */
  grace: StepRecord | null;
  withdrawal: StepRecord | null;
  /** Можно ли записать первый шаг сейчас и с каким предупреждением. */
  canGrace: boolean;
  graceWarning: 'GRACE_RUNNING' | 'NO_THRESHOLD' | null;
  /** Можно ли записать последний шаг сейчас и с каким предупреждением. */
  canWithdraw: boolean;
  withdrawWarning: 'DEADLINE_NOT_PASSED' | 'NO_THRESHOLD' | null;
  /** Срок последнего записанного первого шага прошёл. */
  gracePassed: boolean;
};

const byDate = (a: StepRecord, b: StepRecord) =>
  a.given_on === b.given_on ? String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) : a.given_on.localeCompare(b.given_on);

/**
 * Что продавец может записать сегодня (24.11.2026). thresholdReached — порог
 * по данным платформы (то же правило, что у страницы и задания): платежи вне
 * платформы она не видит, поэтому без порога — предупреждение, а не запрет.
 */
export function defaultStepState(plan: DefaultStepPlan, steps: StepRecord[], today: string, thresholdReached: boolean): StepState {
  const sorted = [...steps].sort(byDate);
  const grace = sorted.filter((s) => s.step === 'GRACE').pop() ?? null;
  const withdrawal = sorted.find((s) => s.step === 'WITHDRAWAL') ?? null;
  const gracePassed = Boolean(grace?.deadline && grace.deadline < today);
  const canGrace = plan.grace !== null && withdrawal === null;
  const canWithdraw = withdrawal === null && (plan.grace === null || grace !== null);
  return {
    plan,
    grace,
    withdrawal,
    canGrace,
    graceWarning: !canGrace ? null : grace && !gracePassed ? 'GRACE_RUNNING' : !thresholdReached ? 'NO_THRESHOLD' : null,
    canWithdraw,
    withdrawWarning: !canWithdraw ? null : grace && !gracePassed ? 'DEADLINE_NOT_PASSED' : !thresholdReached ? 'NO_THRESHOLD' : null,
    gracePassed,
  };
}

/** Записан ли отказ от договора: после него задание не шлёт напоминаний (payments.ts). */
export function withdrawalDeclared(steps: { step: string }[] | null | undefined): boolean {
  return (steps ?? []).some((s) => s.step === 'WITHDRAWAL');
}
