/*
 * Правила стран о просрочке (23.11.2026): Эстония — пороги договора,
 * Латвия — два пропущенных срока платежа. Финские расчёты проверяет
 * calc.test.mjs. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, remedyAllowed, thresholds } from './calc.ts';
import { GRACE_DAYS, INSTALLMENT_RULES, LV_MISSED_DATES, installmentRules } from './rules.ts';

/* 65 000 без НДС, взнос 10 000, 24 месяца, без процентов. */
const schedule = (vatBps, months = 24) =>
  buildSchedule({
    priceCents: 6_500_000,
    vatMode: 'STANDARD',
    vatBps,
    downPaymentCents: 1_000_000,
    months,
    finalCents: null,
    annualRateBps: 0,
    handoverDate: '2026-12-01',
    firstDueDate: '2027-01-01',
  });

test('у каждой страны свой набор правил: Финляндия — закон, Эстония — договор, Латвия — закон', () => {
  assert.equal(installmentRules('FI').id, 'FI_OSKL');
  assert.equal(installmentRules('EE').id, 'EE_VOS');
  assert.equal(installmentRules('LV').id, 'LV_CL2070');
  assert.equal(installmentRules('ee').id, 'EE_VOS');
  assert.equal(INSTALLMENT_RULES.FI_OSKL.source, 'LAW');
  assert.equal(INSTALLMENT_RULES.EE_VOS.source, 'CONTRACT');
  assert.equal(INSTALLMENT_RULES.LV_CL2070.source, 'LAW');
  /* В Финляндии после порога шага с письменным сроком нет; в Эстонии и Латвии — не короче 14 дней. */
  assert.equal(INSTALLMENT_RULES.FI_OSKL.graceDays, 0);
  assert.equal(INSTALLMENT_RULES.EE_VOS.graceDays, 14);
  assert.equal(INSTALLMENT_RULES.LV_CL2070.graceDays, 14);
  assert.equal(GRACE_DAYS, 14);
  /* Финский набор — прежние функции calc.ts, без обёрток. */
  assert.equal(INSTALLMENT_RULES.FI_OSKL.thresholds, thresholds);
  assert.equal(INSTALLMENT_RULES.FI_OSKL.remedyAllowed, remedyAllowed);
});

test('Эстония: пороги договора — 1/10 и 1/20 цены с НДС 24 %', () => {
  const s = schedule(2400);
  assert.equal(s.installmentPriceCents, 8_060_000);
  const t = INSTALLMENT_RULES.EE_VOS.thresholds(s);
  assert.equal(t.tenthCents, 806_000);
  assert.equal(t.twentiethCents, 403_000);
  /* Взнос 2 291,67: одного мало для 1/10, двух хватает для 1/20. */
  assert.equal(t.installmentsNeeded, 2);
});

test('Эстония: порог договора — 14 дней и доля цены либо весь остаток', () => {
  const reached = INSTALLMENT_RULES.EE_VOS.remedyAllowed;
  const price = 8_060_000;
  const one = [{ dueDate: '2027-01-01', unpaidCents: 229_167 }];
  const two = [...one, { dueDate: '2027-02-01', unpaidCents: 229_167 }];
  /* Один взнос меньше 1/10 — порога нет и через месяц. */
  assert.equal(reached(one, '2027-01-31', price, 5_500_000), false);
  /* Два взноса, но второй просрочен меньше 14 дней — считается один. */
  assert.equal(reached(two, '2027-02-10', price, 5_500_000), false);
  /* Оба просрочены 14 дней и больше, вместе не меньше 1/20. */
  assert.equal(reached(two, '2027-02-15', price, 5_500_000), true);
  /* Ровно на 13-й день — ещё нет, на 14-й — да. */
  const big = [{ dueDate: '2027-01-01', unpaidCents: 806_000 }];
  assert.equal(reached(big, '2027-01-14', price, 5_500_000), false);
  assert.equal(reached(big, '2027-01-15', price, 5_500_000), true);
  /* Просрочен весь остаток долга — порог есть при любой сумме. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 100_000 }], '2027-01-15', price, 100_000), true);
  /* Уплаченное не считается. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 0 }], '2027-03-01', price, 5_500_000), false);
});

test('Латвия: порог — два пропущенных срока платежа, без дней и доли цены', () => {
  const t = INSTALLMENT_RULES.LV_CL2070.thresholds(schedule(2100));
  assert.equal(LV_MISSED_DATES, 2);
  assert.equal(t.installmentsNeeded, 2);
  /* Долей цены в латвийском правиле нет. */
  assert.equal(t.tenthCents, 0);
  assert.equal(t.twentiethCents, 0);

  const reached = INSTALLMENT_RULES.LV_CL2070.remedyAllowed;
  const price = 7_865_000;
  /* Один пропущенный срок — порога нет, сколько бы ни прошло времени и каким бы крупным ни был платёж. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 229_167 }], '2027-06-01', price, 5_500_000), false);
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 5_000_000 }], '2027-06-01', price, 5_000_000), false);
  /* Два пропущенных срока, оба не уплачены — порог есть уже на следующий день после второго. */
  const two = [
    { dueDate: '2027-01-01', unpaidCents: 229_167 },
    { dueDate: '2027-02-01', unpaidCents: 229_167 },
  ];
  assert.equal(reached(two, '2027-02-01', price, 5_500_000), false);
  assert.equal(reached(two, '2027-02-02', price, 5_500_000), true);
  /* Маленькие суммы порогу не мешают: доля цены не важна. */
  assert.equal(reached(two.map((o) => ({ ...o, unpaidCents: 100 })), '2027-02-02', price, 5_500_000), true);
  /* Один из двух уплачен — порога нет (осторожное толкование: оба одновременно не уплачены). */
  assert.equal(reached([two[0], { ...two[1], unpaidCents: 0 }], '2027-03-01', price, 5_500_000), false);
  assert.equal(reached([], '2027-03-01', price, 5_500_000), false);
});

test('Латвия и Финляндия расходятся: то, что в Финляндии порог, в Латвии — нет, и наоборот', () => {
  const price = 8_000_000;
  /* Один крупный взнос (больше 1/10), просрочен 20 дней. */
  const oneBig = [{ dueDate: '2027-01-01', unpaidCents: 900_000 }];
  assert.equal(INSTALLMENT_RULES.FI_OSKL.remedyAllowed(oneBig, '2027-01-21', price, 5_000_000), true);
  assert.equal(INSTALLMENT_RULES.LV_CL2070.remedyAllowed(oneBig, '2027-01-21', price, 5_000_000), false);
  /* Два мелких взноса, просрочены 2 дня. */
  const twoSmall = [
    { dueDate: '2027-01-01', unpaidCents: 10_000 },
    { dueDate: '2027-01-03', unpaidCents: 10_000 },
  ];
  assert.equal(INSTALLMENT_RULES.FI_OSKL.remedyAllowed(twoSmall, '2027-01-05', price, 5_000_000), false);
  assert.equal(INSTALLMENT_RULES.LV_CL2070.remedyAllowed(twoSmall, '2027-01-05', price, 5_000_000), true);
});
