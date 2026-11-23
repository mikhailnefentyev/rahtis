/*
 * Правила стран о просрочке (23.11.2026): Эстония — пороги договора,
 * Латвия — два пропущенных срока платежа; Литва и Германия — пороги договора
 * (больше 30 дней и 1/10, 1/20 цены; два взноса подряд и 10 % или 5 %). Финские расчёты проверяет
 * calc.test.mjs. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, remedyAllowed, thresholds } from './calc.ts';
import {
  DE_LONG_TERM_MONTHS,
  DK_DAYS_LATE,
  GRACE_DAYS,
  INSTALLMENT_RULES,
  LT_DAYS_LATE,
  LV_MISSED_DATES,
  PL_DAYS_LATE_ONE,
  PL_DAYS_LATE_TWO,
  PL_GRACE_DAYS,
  RO_DAYS_LATE,
  RO_GRACE_DAYS,
  SE_DAYS_LATE,
  deSharePercent,
  deThresholdCents,
  dkTotalPayableCents,
  installmentRules,
  roEighthCents,
  seCreditClaimCents,
} from './rules.ts';

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

/* ── Швеция и Дания (23.11.2026) ──────────────────────────────────────── */

/* 750 000 kr без НДС, взнос 150 000 kr, 24 месяца; rateBps — проценты годовых. */
const kronor = (rateBps = 0, months = 24, final = null) =>
  buildSchedule({
    priceCents: 75_000_000,
    vatMode: 'STANDARD',
    vatBps: 2500,
    downPaymentCents: 15_000_000,
    months,
    finalCents: final,
    annualRateBps: rateBps,
    handoverDate: '2026-12-01',
    firstDueDate: '2027-01-01',
  });

test('у Швеции и Дании свои наборы правил: закон, без письменного срока после порога', () => {
  assert.equal(installmentRules('SE').id, 'SE_AVBL');
  assert.equal(installmentRules('se').id, 'SE_AVBL');
  assert.equal(installmentRules('DK').id, 'DK_KAL');
  for (const id of ['SE_AVBL', 'DK_KAL']) {
    assert.equal(INSTALLMENT_RULES[id].source, 'LAW', id);
    assert.equal(INSTALLMENT_RULES[id].graceDays, 0, id);
  }
  assert.equal(SE_DAYS_LATE, 14);
  assert.equal(DK_DAYS_LATE, 30);
});

test('база порога: Финляндия и Эстония — цена с НДС, как было; Швеция — kreditfordran; Дания — вся сумма к уплате', () => {
  const s = kronor(650);
  assert.equal(s.installmentPriceCents, 93_750_000);
  assert.ok(s.interestTotalCents > 0);
  /* Финляндия и Эстония: то же число, которое вызывающий передавал до 23.11.2026. */
  assert.equal(INSTALLMENT_RULES.FI_OSKL.base(s), s.installmentPriceCents);
  assert.equal(INSTALLMENT_RULES.EE_VOS.base(s), s.installmentPriceCents);
  assert.equal(INSTALLMENT_RULES.LV_CL2070.base(s), s.installmentPriceCents);
  /* Швеция: часть цены в кредит (без НДС и без первого взноса) и все проценты — не цена. */
  assert.equal(seCreditClaimCents(s), 60_000_000 + s.interestTotalCents);
  assert.equal(INSTALLMENT_RULES.SE_AVBL.base(s), seCreditClaimCents(s));
  assert.equal(seCreditClaimCents(kronor(0)), 60_000_000);
  /* Дания: цена с НДС (в ней первый взнос) и все проценты. */
  assert.equal(dkTotalPayableCents(s), 93_750_000 + s.interestTotalCents);
  assert.equal(INSTALLMENT_RULES.DK_KAL.base(s), dkTotalPayableCents(s));
  assert.equal(dkTotalPayableCents(kronor(0)), 93_750_000);
});

test('Швеция: пороги — 1/10 и 1/20 kreditfordran, а не цены', () => {
  const s = kronor(0);
  const t = INSTALLMENT_RULES.SE_AVBL.thresholds(s);
  assert.equal(t.tenthCents, 6_000_000);
  assert.equal(t.twentiethCents, 3_000_000);
  /* Взнос 25 000 kr: один не больше 1/10 (60 000), два — 50 000 — больше 1/20 (30 000). */
  assert.equal(s.installments[0].principalCents, 2_500_000);
  assert.equal(t.installmentsNeeded, 2);
  /* База меньше финской: у финского правила на тех же числах 1/10 — от цены с НДС. */
  assert.equal(thresholds(s).tenthCents, 9_375_000);
  /* Доля не делится нацело — «больше 1/10» считается от целой части. */
  const odd = INSTALLMENT_RULES.SE_AVBL.thresholds({ ...s, installments: [{ n: 1, dueDate: '2027-01-01', principalCents: 1_005, interestCents: 0 }], interestTotalCents: 0 });
  assert.equal(odd.tenthCents, 100);
  assert.equal(odd.twentiethCents, 50);
});

test('Швеция: порог — строго больше 14 дней и строго больше доли kreditfordran либо весь остаток', () => {
  const reached = INSTALLMENT_RULES.SE_AVBL.remedyAllowed;
  const base = 60_000_000;
  const one = [{ dueDate: '2027-01-01', unpaidCents: 2_500_000 }];
  const two = [...one, { dueDate: '2027-02-01', unpaidCents: 2_500_000 }];
  /* Один взнос меньше 1/10 — порога нет и через месяц. */
  assert.equal(reached(one, '2027-01-31', base, 60_000_000), false);
  /* Два взноса: второй просрочен ровно 14 дней — ещё нет (нужно больше), на 15-й день — да. */
  assert.equal(reached(two, '2027-02-15', base, 60_000_000), false);
  assert.equal(reached(two, '2027-02-16', base, 60_000_000), true);
  /* Один взнос ровно 1/10 — не «больше»: порога нет; на эре больше — есть. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 6_000_000 }], '2027-03-01', base, 60_000_000), false);
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 6_000_001 }], '2027-03-01', base, 60_000_000), true);
  /* Два взноса ровно 1/20 вместе — не «больше»; на эре больше — порог. */
  const half = (cents) => [
    { dueDate: '2027-01-01', unpaidCents: cents },
    { dueDate: '2027-02-01', unpaidCents: 1_500_000 },
  ];
  assert.equal(reached(half(1_500_000), '2027-03-01', base, 60_000_000), false);
  assert.equal(reached(half(1_500_001), '2027-03-01', base, 60_000_000), true);
  /* Весь остаток, просроченный больше 14 дней, — порог при любой сумме; ровно 14 дней — нет. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 100_000 }], '2027-01-15', base, 100_000), false);
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 100_000 }], '2027-01-16', base, 100_000), true);
  /* Уплаченное не считается. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 0 }], '2027-06-01', base, 60_000_000), false);
  assert.equal(reached([], '2027-06-01', base, 60_000_000), false);
});

test('Швеция строже Финляндии по дням и доле, но база меньше: порог по сумме наступает раньше', () => {
  const s = kronor(0);
  const fi = INSTALLMENT_RULES.FI_OSKL;
  const se = INSTALLMENT_RULES.SE_AVBL;
  /* Один взнос 70 000 kr: меньше 1/10 цены с НДС (93 750), но больше 1/10 kreditfordran (60 000). */
  const one = [{ dueDate: '2027-01-01', unpaidCents: 7_000_000 }];
  assert.equal(fi.remedyAllowed(one, '2027-02-01', fi.base(s), 60_000_000), false);
  assert.equal(se.remedyAllowed(one, '2027-02-01', se.base(s), 60_000_000), true);
  /* Ровно 14 дней: в Финляндии уже порог (14 дней и больше), в Швеции — ещё нет. */
  const big = [{ dueDate: '2027-01-01', unpaidCents: 9_500_000 }];
  assert.equal(fi.remedyAllowed(big, '2027-01-15', fi.base(s), 60_000_000), true);
  assert.equal(se.remedyAllowed(big, '2027-01-15', se.base(s), 60_000_000), false);
});

test('Дания: пороги — 1/10 и 1/20 всей суммы к уплате, включая первый взнос и проценты', () => {
  const s = kronor(0);
  const t = INSTALLMENT_RULES.DK_KAL.thresholds(s);
  assert.equal(t.tenthCents, 9_375_000);
  assert.equal(t.twentiethCents, 4_687_500);
  /* Взнос 25 000 kr: два — 50 000 — уже не меньше 1/20 (46 875). */
  assert.equal(t.installmentsNeeded, 2);
  /* С процентами база растёт на сумму процентов. */
  const withRate = kronor(650);
  const tr = INSTALLMENT_RULES.DK_KAL.thresholds(withRate);
  assert.equal(tr.tenthCents, Math.ceil((93_750_000 + withRate.interestTotalCents) / 10));
  assert.ok(tr.tenthCents > t.tenthCents);
  /* Крупный последний платёж: один взнос даёт 1/10. */
  const balloon = kronor(0, 2, 40_000_000);
  assert.equal(INSTALLMENT_RULES.DK_KAL.thresholds(balloon).installmentsNeeded, 1);
});

test('Дания: порог — 30 дней и не меньше доли всей суммы к уплате либо весь остаток', () => {
  const reached = INSTALLMENT_RULES.DK_KAL.remedyAllowed;
  const base = 93_750_000;
  const one = [{ dueDate: '2027-01-01', unpaidCents: 2_500_000 }];
  const two = [...one, { dueDate: '2027-02-01', unpaidCents: 2_500_000 }];
  /* Один взнос меньше 1/10 — порога нет. */
  assert.equal(reached(one, '2027-03-15', base, 60_000_000), false);
  /* Два взноса: второй просрочен 29 дней — считается один; 30 дней — оба, вместе не меньше 1/20. */
  assert.equal(reached(two, '2027-03-02', base, 60_000_000), false);
  assert.equal(reached(two, '2027-03-03', base, 60_000_000), true);
  /* 14 дней, как в Финляндии и Швеции, в Дании мало. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 20_000_000 }], '2027-01-20', base, 60_000_000), false);
  /* Ровно 1/10 — уже порог («не меньше»), на эре меньше — нет. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 9_375_000 }], '2027-01-31', base, 60_000_000), true);
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 9_374_999 }], '2027-01-31', base, 60_000_000), false);
  /* Ровно 30 дней — порог, 29 — нет. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 9_375_000 }], '2027-01-30', base, 60_000_000), false);
  /* Весь остаток, просроченный 30 дней, — порог при любой сумме. */
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 100_000 }], '2027-01-30', base, 100_000), false);
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 100_000 }], '2027-01-31', base, 100_000), true);
  assert.equal(reached([{ dueDate: '2027-01-01', unpaidCents: 0 }], '2027-06-01', base, 60_000_000), false);
});

test('финские и эстонские расчёты от новой базы не изменились', () => {
  const s = schedule(2550);
  const overdue = [
    { dueDate: '2027-01-01', unpaidCents: 229_167 },
    { dueDate: '2027-02-01', unpaidCents: 229_167 },
  ];
  for (const id of ['FI_OSKL', 'EE_VOS']) {
    const rules = INSTALLMENT_RULES[id];
    for (const today of ['2027-02-10', '2027-02-14', '2027-02-15', '2027-03-01']) {
      assert.equal(rules.remedyAllowed(overdue, today, rules.base(s), 5_500_000), remedyAllowed(overdue, today, s.installmentPriceCents, 5_500_000), `${id} ${today}`);
    }
    assert.deepEqual(rules.thresholds(s), thresholds(s), id);
  }
});

/* ── Литва и Германия (23.11.2026): пороги договора ───────────────────── */

test('у Литвы и Германии договорные пороги и письменный срок 14 дней после них', () => {
  assert.equal(installmentRules('LT').id, 'LT_CK6414');
  assert.equal(installmentRules('de').id, 'DE_BGB449');
  for (const id of ['LT_CK6414', 'DE_BGB449']) {
    assert.equal(INSTALLMENT_RULES[id].source, 'CONTRACT', id);
    assert.equal(INSTALLMENT_RULES[id].graceDays, 14, id);
  }
  assert.equal(LT_DAYS_LATE, 30);
});

test('Литва: пороги — 1/10 и 1/20 цены с НДС 21 %, база — цена с НДС', () => {
  const s = schedule(2100);
  assert.equal(s.installmentPriceCents, 7_865_000);
  assert.equal(INSTALLMENT_RULES.LT_CK6414.base(s), 7_865_000);
  /* Пороги и число взносов — те же, что у Финляндии и Эстонии при той же цене (доля «не меньше»). */
  assert.deepEqual(INSTALLMENT_RULES.LT_CK6414.thresholds(s), thresholds(s));
  assert.deepEqual(INSTALLMENT_RULES.LT_CK6414.thresholds(s), { tenthCents: 786_500, twentiethCents: 393_250, installmentsNeeded: 2 });
});

test('Литва: порог — строго больше 30 дней и не меньше доли цены либо весь остаток', () => {
  const s = schedule(2100);
  const rules = INSTALLMENT_RULES.LT_CK6414;
  const base = rules.base(s);
  const remaining = 5_500_000;
  const inst = s.installments[0].principalCents;
  /* Два взноса, вместе больше 1/20: ровно 30 дней — ещё нет, 31 — да. */
  const two = (due1, due2) => [
    { dueDate: due1, unpaidCents: inst },
    { dueDate: due2, unpaidCents: inst },
  ];
  assert.equal(rules.remedyAllowed(two('2027-01-01', '2027-02-01'), '2027-03-03', base, remaining), false); /* второй — 30 дней */
  assert.equal(rules.remedyAllowed(two('2027-01-01', '2027-02-01'), '2027-03-04', base, remaining), true);
  /* Один взнос меньше 1/10 цены — порога нет, сколько бы дней ни прошло. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: inst }], '2027-12-31', base, remaining), false);
  /* Один крупный взнос, ровно 1/10 цены, 31 день — порог («не меньше»). */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 786_500 }], '2027-02-01', base, remaining), true);
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 786_499 }], '2027-02-01', base, remaining), false);
  /* Весь остаток, 31 день — порог при любой сумме. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 100 }], '2027-02-01', base, 100), true);
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 100 }], '2027-01-31', base, 100), false);
  /* Уплаченное не считается. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 0 }], '2027-12-31', base, remaining), false);
});

test('Германия: порог — 10 % цены с НДС, при сроке больше трёх лет — 5 %; число взносов — не меньше двух', () => {
  assert.equal(deSharePercent(36), 10);
  assert.equal(deSharePercent(37), 5);
  assert.equal(DE_LONG_TERM_MONTHS, 36);
  const s = schedule(1900);
  assert.equal(s.installmentPriceCents, 7_735_000);
  assert.equal(deThresholdCents(s), 773_500);
  assert.equal(INSTALLMENT_RULES.DE_BGB449.base(s), 773_500);
  /* Доля одна: обе строки порога — 10 %. Взносы по 2 291,67 €: три — 6 875 €, четыре — 9 166,68 €. */
  assert.deepEqual(INSTALLMENT_RULES.DE_BGB449.thresholds(s), { tenthCents: 773_500, twentiethCents: 773_500, installmentsNeeded: 4 });
  const long = schedule(1900, 48);
  assert.equal(deThresholdCents(long), 386_750);
  assert.equal(INSTALLMENT_RULES.DE_BGB449.thresholds(long).installmentsNeeded, 4);
  /* Даже если один взнос больше доли, договор требует двух подряд. */
  const big = buildSchedule({
    priceCents: 6_500_000,
    vatMode: 'STANDARD',
    vatBps: 1900,
    downPaymentCents: 1_000_000,
    months: 2,
    finalCents: null,
    annualRateBps: 0,
    handoverDate: '2026-12-01',
    firstDueDate: '2027-01-01',
  });
  assert.equal(INSTALLMENT_RULES.DE_BGB449.thresholds(big).installmentsNeeded, 2);
});

test('Германия: порог — два взноса подряд в просрочке и не меньше доли либо весь остаток', () => {
  const s = schedule(1900);
  const rules = INSTALLMENT_RULES.DE_BGB449;
  const share = rules.base(s);
  const inst = s.installments[0].principalCents;
  const remaining = 5_500_000;
  const late = (ns, due = '2027-01-01') => ns.map((n) => ({ dueDate: due, unpaidCents: inst, n }));
  /* Четыре взноса подряд, со дня после срока — порог. */
  assert.equal(rules.remedyAllowed(late([1, 2, 3, 4]), '2027-01-02', share, remaining), true);
  /* В день срока просрочки ещё нет (§ 286 Abs. 2 Nr. 1 — со следующего дня). */
  assert.equal(rules.remedyAllowed(late([1, 2, 3, 4]), '2027-01-01', share, remaining), false);
  /* Три взноса — меньше 10 %. */
  assert.equal(rules.remedyAllowed(late([1, 2, 3]), '2027-06-01', share, remaining), false);
  /* Сумма достаточна, но взносы не подряд — порога нет. */
  assert.equal(rules.remedyAllowed(late([1, 3, 5, 7]), '2027-09-01', share, remaining), false);
  /* Без номера взноса пара «подряд» не засчитывается: порог не раньше договорного. */
  assert.equal(rules.remedyAllowed([1, 2, 3, 4].map(() => ({ dueDate: '2027-01-01', unpaidCents: inst })), '2027-06-01', share, remaining), false);
  /* Один крупный взнос больше доли — тоже нет: нужно два подряд. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 900_000, n: 1 }], '2027-06-01', share, remaining), false);
  /* Последний взнос (весь остаток) в просрочке — порог. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2028-12-01', unpaidCents: inst, n: 24 }], '2028-12-02', share, inst), true);
  /* Частично уплаченные взносы считаются («ganz oder teilweise»). */
  assert.equal(
    rules.remedyAllowed(
      [
        { dueDate: '2027-01-01', unpaidCents: 400_000, n: 1 },
        { dueDate: '2027-02-01', unpaidCents: 373_500, n: 2 },
      ],
      '2027-02-02',
      share,
      remaining,
    ),
    true,
  );
});

test('Литва и Германия не меняют пороги других стран', () => {
  const s = schedule(2500);
  assert.deepEqual(INSTALLMENT_RULES.SE_AVBL.thresholds(s), { tenthCents: 550_000, twentiethCents: 275_000, installmentsNeeded: 2 });
  assert.equal(INSTALLMENT_RULES.DK_KAL.thresholds(s).tenthCents, Math.ceil(dkTotalPayableCents(s) / 10));
  assert.equal(INSTALLMENT_RULES.FI_OSKL.remedyAllowed, remedyAllowed);
});

/* ── Польша и Румыния (23.11.2026) ──────────────────────────────────── */

test('Польша: правила договора — без доли цены, база — цена с НДС 23 %, срок 14 дней', () => {
  const s = schedule(2300);
  const rules = installmentRules('PL');
  assert.equal(rules.id, 'PL_KC589');
  assert.equal(rules.source, 'CONTRACT');
  assert.equal(rules.graceDays, 14);
  assert.equal(PL_GRACE_DAYS, 14);
  assert.equal(PL_DAYS_LATE_TWO, 14);
  assert.equal(PL_DAYS_LATE_ONE, 30);
  assert.equal(s.installmentPriceCents, 7_995_000);
  assert.equal(rules.base(s), 7_995_000);
  assert.deepEqual(rules.thresholds(s), { tenthCents: 0, twentiethCents: 0, installmentsNeeded: 2 });
  /* Один взнос в графике — порог даёт только он сам. */
  assert.equal(rules.thresholds(schedule(2300, 1)).installmentsNeeded, 1);
});

test('Польша: порог — два взноса строго больше 14 дней или один строго больше 30 дней; суммы не важны', () => {
  const rules = INSTALLMENT_RULES.PL_KC589;
  const base = 7_995_000;
  const remaining = 5_500_000;
  const small = 100;
  const two = [
    { dueDate: '2027-01-20', unpaidCents: small },
    { dueDate: '2027-02-01', unpaidCents: small },
  ];
  /* Второй взнос — ровно 14 дней (первый — 26, меньше 30): ещё нет; 15 — да. Сумма любая, даже крошечная. */
  assert.equal(rules.remedyAllowed(two, '2027-02-15', base, remaining), false);
  assert.equal(rules.remedyAllowed(two, '2027-02-16', base, remaining), true);
  /* Один взнос: 30 дней — нет, 31 — да (и это при сумме меньше любой доли). */
  const one = [{ dueDate: '2027-01-01', unpaidCents: small }];
  assert.equal(rules.remedyAllowed(one, '2027-01-31', base, remaining), false);
  assert.equal(rules.remedyAllowed(one, '2027-02-01', base, remaining), true);
  /* Весь остаток сам по себе порога не даёт: дни те же (договор п. 9.1 о нём не говорит). */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: remaining }], '2027-01-20', base, remaining), false);
  /* Уплаченное не считается. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 0 }, { dueDate: '2027-01-02', unpaidCents: 0 }], '2027-12-31', base, remaining), false);
  assert.equal(rules.remedyAllowed([], '2027-12-31', base, remaining), false);
});

test('Румыния: правила договора — 1/8 цены с НДС 21 %, база — цена с НДС, срок 15 дней', () => {
  const s = schedule(2100);
  const rules = installmentRules('ro');
  assert.equal(rules.id, 'RO_CC1755');
  assert.equal(rules.source, 'CONTRACT');
  assert.equal(rules.graceDays, 15);
  assert.equal(RO_GRACE_DAYS, 15);
  assert.equal(RO_DAYS_LATE, 30);
  assert.equal(s.installmentPriceCents, 7_865_000);
  assert.equal(rules.base(s), 7_865_000);
  assert.equal(roEighthCents(s), 983_125);
  /* Первый взнос меньше 1/8 — нужно два взноса (правило 2). */
  assert.deepEqual(rules.thresholds(s), { tenthCents: 983_125, twentiethCents: 983_125, installmentsNeeded: 2 });
  /* Один взнос в графике — он и есть весь остаток. */
  assert.equal(rules.thresholds(schedule(2100, 1)).installmentsNeeded, 1);
  /* Короткий график: взнос сам не меньше 1/8 — достаточно одного. */
  assert.equal(rules.thresholds(schedule(2100, 4)).installmentsNeeded, 1);
});

test('Румыния: порог — 30 дней и 1/8 цены, или два взноса со старшим 30 дней, или весь остаток', () => {
  const rules = INSTALLMENT_RULES.RO_CC1755;
  const base = 7_865_000;
  const remaining = 5_500_000;
  /* (1) один взнос: ровно 1/8 цены и 30 дней — да; 29 дней — нет; на цент меньше 1/8 — нет. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 983_125 }], '2027-01-31', base, remaining), true);
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 983_125 }], '2027-01-30', base, remaining), false);
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 983_124 }], '2027-12-31', base, remaining), false);
  /* (2) два взноса: старший 30 дней — да, 29 — нет; сумма не важна. */
  const two = [
    { dueDate: '2027-01-01', unpaidCents: 100 },
    { dueDate: '2027-01-25', unpaidCents: 100 },
  ];
  assert.equal(rules.remedyAllowed(two, '2027-01-30', base, remaining), false);
  assert.equal(rules.remedyAllowed(two, '2027-01-31', base, remaining), true);
  /* Второй ещё не просрочен (день срока) — он не считается, остаётся правило (1). */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 100 }, { dueDate: '2027-01-31', unpaidCents: 100 }], '2027-01-31', base, remaining), false);
  /* (3) весь остаток просрочен — со следующего дня после срока. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 100 }], '2027-01-02', base, 100), true);
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 100 }], '2027-01-01', base, 100), false);
  /* Уплаченное не считается. */
  assert.equal(rules.remedyAllowed([{ dueDate: '2027-01-01', unpaidCents: 0 }], '2027-12-31', base, remaining), false);
});

test('Польша и Румыния не меняют пороги других стран', () => {
  const s = schedule(2500);
  assert.deepEqual(INSTALLMENT_RULES.SE_AVBL.thresholds(s), { tenthCents: 550_000, twentiethCents: 275_000, installmentsNeeded: 2 });
  assert.equal(INSTALLMENT_RULES.FI_OSKL.remedyAllowed, remedyAllowed);
  assert.equal(INSTALLMENT_RULES.FI_OSKL.thresholds, thresholds);
  assert.equal(installmentRules('NO'), null);
  assert.deepEqual(Object.keys(INSTALLMENT_RULES).sort(), ['DE_BGB449', 'DK_KAL', 'EE_VOS', 'FI_OSKL', 'LT_CK6414', 'LV_CL2070', 'PL_KC589', 'RO_CC1755', 'SE_AVBL']);
});
