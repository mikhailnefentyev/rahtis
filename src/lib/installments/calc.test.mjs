/*
 * Рассрочка техники: график, пороги OskL 2 §, tilitys 3–4 §, налог продавца.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonths,
  adviseDownPayment,
  buildSchedule,
  buyerCheck,
  defaultScenario,
  effectiveHandover,
  lateDays,
  lateFrom,
  overduePayments,
  payoffCents,
  remedyAllowed,
  sellerTax,
  settlement,
  thresholds,
  valueAfter,
} from './calc.ts';

/** Пример из документов: DAF 24 000 €, взнос 4 800 €, 24 взноса. */
const DAF = {
  priceCents: 2_400_000,
  vatMode: 'STANDARD',
  vatBps: 2550,
  downPaymentCents: 480_000,
  months: 24,
  finalCents: null,
  annualRateBps: 0,
  handoverDate: '2026-12-01',
  firstDueDate: '2027-01-01',
};

test('месяцы: конец месяца не перескакивает', () => {
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(addMonths('2027-01-31', 2), '2027-03-31');
  assert.equal(addMonths('2027-12-15', 1), '2028-01-15');
});

test('график DAF: первый счёт с НДС, 24 взноса по 800 €', () => {
  const s = buildSchedule(DAF);
  assert.ok(!('error' in s));
  assert.equal(s.vatCents, 612_000);
  assert.equal(s.firstInvoiceCents, 1_092_000);
  assert.equal(s.installmentPriceCents, 3_012_000);
  assert.equal(s.installments.length, 24);
  assert.ok(s.installments.every((x) => x.principalCents === 80_000));
  assert.equal(s.installments[23].dueDate, '2028-12-01');
  assert.equal(s.interestTotalCents, 0);
});

test('остаток делится до цента, сумма взносов = цена − взнос', () => {
  const s = buildSchedule({ ...DAF, priceCents: 2_400_001, months: 7 });
  const sum = s.installments.reduce((a, x) => a + x.principalCents, 0);
  assert.equal(sum, 2_400_001 - 480_000);
});

test('маленький последний взнос', () => {
  const s = buildSchedule({ ...DAF, finalCents: 200_000 });
  assert.equal(s.installments[23].principalCents, 200_000);
  const sum = s.installments.reduce((a, x) => a + x.principalCents, 0);
  assert.equal(sum, 1_920_000);
});

test('проценты: с даты передачи, факт. дни / 365, на остаток', () => {
  const s = buildSchedule({ ...DAF, annualRateBps: 600 });
  // Первый период 1.12.2026–1.1.2027 = 31 день, остаток 19 200 €.
  assert.equal(s.installments[0].interestCents, Math.round((1_920_000 * 600 * 31) / 3_650_000));
  // Первый счёт без процентов.
  assert.equal(s.firstInvoiceCents, 1_092_000);
  assert.ok(s.installments[1].interestCents < s.installments[0].interestCents);
});

test('без НДС: маржинальная схема и освобождение', () => {
  for (const vatMode of ['MARGIN', 'EXEMPT', 'NONE']) {
    const s = buildSchedule({ ...DAF, vatMode });
    assert.equal(s.vatCents, 0);
    assert.equal(s.firstInvoiceCents, 480_000);
    assert.equal(s.installmentPriceCents, 2_400_000);
  }
});

test('ошибки ввода', () => {
  assert.deepEqual(buildSchedule({ ...DAF, downPaymentCents: 2_400_000 }), { error: 'DOWN_PAYMENT' });
  assert.deepEqual(buildSchedule({ ...DAF, months: 0 }), { error: 'MONTHS' });
  assert.deepEqual(buildSchedule({ ...DAF, firstDueDate: '2026-12-01' }), { error: 'DATES' });
  assert.deepEqual(buildSchedule({ ...DAF, finalCents: 1_920_000 }), { error: 'FINAL' });
  assert.deepEqual(buildSchedule({ ...DAF, handoverDate: '2026-02-30' }), { error: 'DATES' });
});

test('пороги 2 §: DAF — 3 012 € / 1 506 €, нужно два взноса', () => {
  const t = thresholds(buildSchedule(DAF));
  assert.equal(t.tenthCents, 301_200);
  assert.equal(t.twentiethCents, 150_600);
  assert.equal(t.installmentsNeeded, 2);
});

test('пороги 2 §: длинный срок — нужно больше взносов', () => {
  const t = thresholds(buildSchedule({ ...DAF, months: 60 }));
  // 19 200 / 60 = 320 € взнос; 1/20 от 30 120 = 1 506 € → 5 взносов.
  assert.equal(t.installmentsNeeded, 5);
});

test('право изъятия: 14 дней и сумма', () => {
  const price = 3_012_000;
  const one = [{ dueDate: '2027-01-01', unpaidCents: 80_000 }];
  const two = [...one, { dueDate: '2027-02-01', unpaidCents: 80_000 }];
  // Один взнос 800 € < 3 012 € — нельзя.
  assert.equal(remedyAllowed(one, '2027-03-01', price, 1_920_000), false);
  // Два взноса 1 600 € ≥ 1 506 €, но второй просрочен < 14 дней — считается только первый.
  assert.equal(remedyAllowed(two, '2027-02-10', price, 1_920_000), false);
  // Оба просрочены ≥ 14 дней — можно.
  assert.equal(remedyAllowed(two, '2027-02-15', price, 1_920_000), true);
  // Весь остаток долга просрочен — можно при любой сумме.
  assert.equal(remedyAllowed([{ dueDate: '2028-12-01', unpaidCents: 80_000 }], '2028-12-15', price, 80_000), true);
});

test('tilitys: продавец платит излишек, покупатель — только разницу', () => {
  const base = {
    vatBps: 2550,
    overdueCents: 160_000,
    futureCents: 1_200_000,
    cashPriceCents: 3_012_000,
    installmentPriceCents: 3_012_000,
    accruedInterestCents: 0,
    costsCents: 50_000,
  };
  const high = settlement({ ...base, valueCents: 2_000_000, buyerVatRegistered: false });
  assert.equal(high.claimCents, 1_410_000);
  assert.equal(high.sellerPaysCents, 590_000);
  assert.equal(high.buyerPaysCents, 0);
  const low = settlement({ ...base, valueCents: 1_000_000, buyerVatRegistered: false });
  assert.equal(low.buyerPaysCents, 410_000);
  // Покупатель плательщик НДС: зачёт с НДС (KVL 239/1997).
  const vat = settlement({ ...base, valueCents: 1_000_000, buyerVatRegistered: true });
  assert.equal(vat.creditVatCents, 255_000);
  assert.equal(vat.creditCents, 1_255_000);
  assert.equal(vat.buyerPaysCents, 155_000);
});

test('tilitys: доля будущих взносов при käteishinta < osamaksuhinta', () => {
  const s = settlement({
    valueCents: 0,
    buyerVatRegistered: false,
    vatBps: 2550,
    overdueCents: 0,
    futureCents: 1_000_000,
    cashPriceCents: 900_000,
    installmentPriceCents: 1_000_000,
    accruedInterestCents: 0,
    costsCents: 0,
  });
  assert.equal(s.claimCents, 900_000);
});

test('досрочное погашение: остаток + проценты по день оплаты', () => {
  assert.equal(payoffCents(1_000_000, '2027-01-01', '2027-01-01', 600), 1_000_000);
  assert.equal(payoffCents(1_000_000, '2027-01-01', '2027-01-31', 600), 1_000_000 + Math.round((1_000_000 * 600 * 30) / 3_650_000));
});

test('налог продавца: пул меньше цены — разница облагается', () => {
  const t = sellerTax({ method: 'POOL', poolStartCents: 400_000, purchasesThisYearCents: 0, priceCents: 2_400_000, rateBps: 2000 });
  assert.equal(t.taxableCents, 2_000_000);
  assert.equal(t.taxCents, 400_000);
  assert.equal(t.poolEndCents, 0);
});

test('налог продавца: пул больше цены — налога нет, пул уменьшается', () => {
  const t = sellerTax({ method: 'POOL', poolStartCents: 9_000_000, purchasesThisYearCents: 0, priceCents: 2_400_000, rateBps: 2000 });
  assert.equal(t.taxCents, 0);
  assert.equal(t.poolEndCents, 6_600_000);
});

test('налог продавца: отдельная амортизация (EVL 33 §)', () => {
  const t = sellerTax({ method: 'ITEM', residualCents: 1_000_000, priceCents: 2_400_000, rateBps: 2000 });
  assert.equal(t.taxableCents, 1_400_000);
  assert.equal(t.taxCents, 280_000);
});

test('стоимость машины и рекомендация взноса', () => {
  assert.equal(valueAfter(2_400_000, 1500, 12), 2_040_000);
  const a = adviseDownPayment({
    priceCents: 2_400_000,
    depreciationBps: 1500,
    repossessionCostsCents: 100_000,
    sellerTaxCents: 400_000,
    installmentsBeforeTaxCents: 0,
  });
  assert.equal(a.marketCents, 480_000);
  assert.equal(a.taxGapCents, 400_000);
  assert.equal(a.recommendedCents, Math.max(a.protectionCents, 400_000, 480_000));
});

test('сценарий неплатежа: изъятие после порога, итог продавца', () => {
  const s = buildSchedule(DAF);
  const sc = defaultScenario(DAF, s, 6, 1500, 100_000);
  assert.equal(sc.paidMonths, 6);
  assert.equal(sc.buyerPaidCents, 480_000 + 6 * 80_000);
  // После 6 взносов нужно 2 просрочки, стоимость — через 8 месяцев.
  assert.equal(sc.valueCents, valueAfter(2_400_000, 1500, 8));
  assert.equal(sc.settlement.claimCents, 18 * 80_000 + 100_000);
  // Продавец не получает больше цены: излишек стоимости уходит покупателю.
  assert.ok(sc.sellerTotalCents <= 2_400_000);
});

test('проверка покупателя', () => {
  assert.deepEqual(buyerCheck({ revenueCents: 1_500_000, costsCents: 1_300_000, paymentCents: 80_000, thinBps: 1500 }), {
    marginCents: 120_000,
    negative: false,
    thin: true,
  });
  assert.equal(buyerCheck({ revenueCents: 1_000_000, costsCents: 1_000_000, paymentCents: 80_000, thinBps: 1500 }).negative, true);
});

/* Исправления по ревью 22.11.2026. */

test('один взнос: отдельного последнего нет — как в базе (installment_terms_ok)', () => {
  const one = { ...DAF, months: 1 };
  const s = buildSchedule(one);
  assert.equal(s.installments.length, 1);
  assert.equal(s.installments[0].principalCents, 1_920_000);
  // Раньше «последний = весь остаток» проходил расчёт, а сохранение база отклоняла.
  assert.deepEqual(buildSchedule({ ...one, finalCents: 1_920_000 }), { error: 'FINAL' });
  assert.deepEqual(buildSchedule({ ...one, finalCents: 500_000 }), { error: 'FINAL' });
});

test('просрочка: от срока или дня отправки счёта, что позже', () => {
  const due = '2027-01-01';
  // Счёт ушёл заранее — считаем от срока.
  assert.equal(lateFrom({ dueDate: due, paid: false, invoiceSentDay: '2026-12-18' }), due);
  assert.equal(lateDays({ dueDate: due, paid: false, invoiceSentDay: '2026-12-18' }, '2027-01-08'), 7);
  // Счёт ушёл после срока — от дня отправки.
  assert.equal(lateFrom({ dueDate: due, paid: false, invoiceSentDay: '2027-01-05' }), '2027-01-05');
  assert.equal(lateDays({ dueDate: due, paid: false, invoiceSentDay: '2027-01-05' }, '2027-01-08'), 3);
  // В день срока и до него просрочки нет.
  assert.equal(lateDays({ dueDate: due, paid: false, invoiceSentDay: '2026-12-18' }, due), 0);
  assert.equal(lateDays({ dueDate: due, paid: false, invoiceSentDay: '2026-12-18' }, '2026-12-25'), 0);
});

test('просрочка: без отправленного счёта и у оплаченного взноса её нет', () => {
  assert.equal(lateFrom({ dueDate: '2027-01-01', paid: false, invoiceSentDay: null }), null);
  assert.equal(lateDays({ dueDate: '2027-01-01', paid: false, invoiceSentDay: null }, '2027-03-01'), 0);
  assert.equal(lateDays({ dueDate: '2027-01-01', paid: true, invoiceSentDay: '2026-12-18' }, '2027-03-01'), 0);
});

test('просроченные взносы: один список для страницы и задания, порядок и поля сохраняются', () => {
  const rows = [
    { n: 1, dueDate: '2027-01-01', paid: true, invoiceSentDay: '2026-12-18' },
    { n: 2, dueDate: '2027-02-01', paid: false, invoiceSentDay: '2027-01-18' },
    { n: 3, dueDate: '2027-03-01', paid: false, invoiceSentDay: '2027-03-10' },
    { n: 4, dueDate: '2027-04-01', paid: false, invoiceSentDay: null },
  ];
  const overdue = overduePayments(rows, '2027-03-20');
  assert.deepEqual(
    overdue.map((r) => [r.n, r.lateFrom, r.lateDays]),
    [
      [2, '2027-02-01', 47],
      [3, '2027-03-10', 10],
    ],
  );
  // Порог OskL 2 § считает 14 дней от начала просрочки: у взноса 3 их ещё нет.
  const allowed = (today) =>
    remedyAllowed(overduePayments(rows, today).map((r) => ({ dueDate: r.lateFrom, unpaidCents: 80_000 })), today, 3_012_000, 1_760_000);
  assert.equal(allowed('2027-03-20'), false);
  assert.equal(allowed('2027-03-24'), true);
});

test('проценты идут с фактической передачи, если она позже согласованной', () => {
  assert.equal(effectiveHandover('2026-12-01', null), '2026-12-01');
  assert.equal(effectiveHandover('2026-12-01', '2026-11-28'), '2026-12-01');
  assert.equal(effectiveHandover('2026-12-01', '2026-12-01'), '2026-12-01');
  assert.equal(effectiveHandover('2026-12-01', '2026-12-11'), '2026-12-11');
  // Досрочное погашение до первого оплаченного взноса: проценты за 20 дней, а не за 30.
  const from = effectiveHandover('2026-12-01', '2026-12-11');
  assert.equal(payoffCents(1_000_000, from, '2026-12-31', 600), 1_000_000 + Math.round((1_000_000 * 600 * 20) / 3_650_000));
});
