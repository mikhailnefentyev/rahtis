/*
 * Доходность машин. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixedCosts, vehicleEconomics } from './profit.ts';

const fin = (over) => ({
  purchase_price_cents: null,
  purchased_on: null,
  financing: 'CASH',
  monthly_payment_cents: null,
  payments_until: null,
  useful_life_months: 60,
  residual_cents: null,
  insurance_cents_year: null,
  kasko_cents_year: null,
  tax_cents_year: null,
  other_fixed_cents_month: null,
  ...over,
});

test('купленная сразу: (цена − остаточная) ÷ срок, только в месяцы срока', () => {
  const f = fin({ purchase_price_cents: 9_000_000, residual_cents: 3_000_000, useful_life_months: 60, purchased_on: '2026-01-15' });
  assert.equal(fixedCosts(f, '2026-01').depreciation, 100_000);
  assert.equal(fixedCosts(f, '2025-12').depreciation, 0);
  assert.equal(fixedCosts(f, '2030-12').depreciation, 100_000);
  assert.equal(fixedCosts(f, '2031-01').depreciation, 0);
});

test('лизинг: платёж в месяцы платежей, износа нет', () => {
  const f = fin({ financing: 'LEASING', purchase_price_cents: 12_000_000, monthly_payment_cents: 250_000, purchased_on: '2026-03-01', payments_until: '2026-10-31' });
  assert.equal(fixedCosts(f, '2026-10').financing, 250_000);
  assert.equal(fixedCosts(f, '2026-10').depreciation, 0);
  assert.equal(fixedCosts(f, '2026-11').financing, 0);
  assert.equal(fixedCosts(f, '2026-02').financing, 0);
});

test('страховка, каско и налог — годовые ÷ 12', () => {
  const f = fin({ insurance_cents_year: 240_000, kasko_cents_year: 360_000, tax_cents_year: 120_000, other_fixed_cents_month: 5_000 });
  const c = fixedCosts(f, '2026-10');
  assert.equal(c.insurance, 50_000);
  assert.equal(c.tax, 10_000);
  assert.equal(c.fixed, 5_000);
});

test('машина за месяц: доходы, расходы, налоги работодателя, абонемент, маржа', () => {
  const { vehicles, fleet } = vehicleEconomics({
    months: ['2026-10'],
    vehicles: [{ id: 'A', plate: 'TST-101' }, { id: 'B', plate: 'TST-202' }],
    revenue: [
      { vehicleId: 'A', month: '2026-10', cents: 800_000, kind: 'PLATFORM' },
      { vehicleId: 'A', month: '2026-10', cents: 200_000, kind: 'OWN' },
    ],
    fuel: [{ vehicleId: 'A', month: '2026-10', cents: 300_000 }],
    pay: [{ vehicleId: 'A', month: '2026-10', cents: 200_000 }],
    journal: [{ vehicleId: 'A', month: '2026-10', cents: 40_000 }],
    finance: new Map([['A', fin({ financing: 'LOAN', monthly_payment_cents: 150_000 })]]),
    employerCostBps: 2500,
    subscriptionUnitCents: 2990,
  });
  const a = vehicles[0].months[0];
  assert.equal(a.revenue.total, 1_000_000);
  assert.equal(a.costs.driver, 250_000);
  assert.equal(a.costs.financing, 150_000);
  assert.equal(a.costs.rahtis, 2990);
  assert.equal(a.costs.total, 300_000 + 250_000 + 150_000 + 40_000 + 2990);
  assert.equal(a.profit, 1_000_000 - a.costs.total);
  assert.equal(a.marginPct, 25.7);
  /* Машина без работы: абонемента нет, маржи нет. */
  const b = vehicles[1].months[0];
  assert.equal(b.costs.rahtis, 0);
  assert.equal(b.marginPct, null);
  assert.equal(fleet[0].profit, a.profit + b.profit);
});

test('окупаемость купленной сразу: прибыль до износа против цены', () => {
  const { vehicles } = vehicleEconomics({
    months: ['2026-09', '2026-10'],
    vehicles: [{ id: 'A', plate: 'X' }],
    revenue: [
      { vehicleId: 'A', month: '2026-09', cents: 1_000_000, kind: 'PLATFORM' },
      { vehicleId: 'A', month: '2026-10', cents: 1_000_000, kind: 'PLATFORM' },
    ],
    fuel: [],
    pay: [],
    journal: [],
    finance: new Map([['A', fin({ purchase_price_cents: 10_000_000, useful_life_months: 60, purchased_on: '2026-09-01' })]]),
    employerCostBps: 0,
    subscriptionUnitCents: null,
  });
  /* 2 × 10 000 € до износа из 100 000 € — 20 %. */
  assert.equal(vehicles[0].paybackPct, 20);
});

test('суммы из формы', async () => {
  const { eurosToCents, centsToInput } = await import('./money.ts');
  assert.equal(eurosToCents('12 500,50'), 1_250_050);
  assert.equal(eurosToCents('85000 €'), 8_500_000);
  assert.equal(eurosToCents(''), null);
  assert.equal(eurosToCents('abc'), undefined);
  /* Любой знак валюты отбрасывается: валюта — отдельным полем. */
  assert.equal(eurosToCents('4 200,50 zł'), 420_050);
  assert.equal(eurosToCents('950 kr'), 95_000);
  assert.equal(eurosToCents('950 kr.'), 95_000);
  assert.equal(eurosToCents('1200 PLN'), 120_000);
  assert.equal(centsToInput(1_250_050), '12500.50');
  assert.equal(centsToInput(8_500_000), '85000');
});


test('карточка в другой валюте: постоянные расходы и окупаемость — по курсу месяца', () => {
  /* Карточка в евро, компания в злотых: 1 € = 4 zł в сентябре, 5 zł в октябре. */
  const rates = { '2026-09': 4, '2026-10': 5 };
  const { vehicles } = vehicleEconomics({
    months: ['2026-09', '2026-10'],
    vehicles: [{ id: 'A', plate: 'X' }],
    revenue: [{ vehicleId: 'A', month: '2026-10', cents: 4_000_000, kind: 'OWN' }],
    fuel: [],
    pay: [],
    journal: [],
    finance: new Map([['A', fin({ currency: 'EUR', purchase_price_cents: 6_000_000, useful_life_months: 60, purchased_on: '2026-09-01', insurance_cents_year: 120_000 })]]),
    employerCostBps: 0,
    subscriptionUnitCents: null,
    financeRate: (_v, m) => rates[m] ?? null,
  });
  const [sep, oct] = vehicles[0].months;
  assert.equal(sep.costs.depreciation, 400_000);
  assert.equal(oct.costs.depreciation, 500_000);
  assert.equal(oct.costs.insurance, 50_000);
  /* Цена — по курсу месяца покупки: 60 000 € × 4 = 240 000 zł. */
  const earned = sep.profit + sep.costs.depreciation + oct.profit + oct.costs.depreciation;
  assert.equal(vehicles[0].paybackPct, Math.round((earned / 24_000_000) * 1000) / 10);
});

test('курса нет — постоянные расходы месяца не считаются', () => {
  const { vehicles } = vehicleEconomics({
    months: ['2026-10'],
    vehicles: [{ id: 'A', plate: 'X' }],
    revenue: [],
    fuel: [],
    pay: [],
    journal: [],
    finance: new Map([['A', fin({ currency: 'SEK', other_fixed_cents_month: 100_000 })]]),
    employerCostBps: 0,
    subscriptionUnitCents: null,
    financeRate: () => null,
  });
  assert.equal(vehicles[0].months[0].costs.total, 0);
});

test('пересчёт строк в валюту компании по курсу дня', async () => {
  const { fxHistory } = await import('../money/currency.ts');
  const { companyConverter } = await import('./convert.ts');
  const fx = fxHistory([
    { day: '2026-10-01', currency: 'PLN', per_eur: 4 },
    { day: '2026-10-15', currency: 'PLN', per_eur: 5 },
    { day: '2026-10-01', currency: 'SEK', per_eur: 10 },
  ]);
  const conv = companyConverter(fx, 'PLN');
  assert.equal(conv.cents(10_000, 'EUR', '2026-10-10'), 40_000);
  assert.equal(conv.cents(10_000, 'EUR', '2026-10-20'), 50_000);
  assert.equal(conv.cents(10_000, 'PLN', '2026-10-20'), 10_000);
  /* 100 kr → 10 € → 40 zł. */
  assert.equal(conv.cents(10_000, 'SEK', '2026-10-05'), 4_000);
  assert.equal(conv.cents(10_000, null, '2026-10-05'), 40_000);
  assert.equal(conv.rate('EUR', '2026-10-20'), 5);
  assert.equal(conv.missing, 0);
  /* Курса NOK нет — строка пропускается и считается. */
  assert.equal(conv.cents(10_000, 'NOK', '2026-10-05'), null);
  assert.equal(conv.rate('NOK', '2026-10-05'), null);
  assert.equal(conv.missing, 2);
});

test('суточные и ночлег — к затратам на водителя, но без взносов работодателя', () => {
  const { vehicles } = vehicleEconomics({
    months: ['2026-10'],
    vehicles: [{ id: 'A', plate: 'TST-101' }],
    revenue: [],
    fuel: [],
    pay: [{ vehicleId: 'A', month: '2026-10', cents: 200_000 }],
    allowances: [
      { vehicleId: 'A', month: '2026-10', cents: 30_000 },
      { vehicleId: 'A', month: '2026-10', cents: 6_750 },
    ],
    journal: [],
    finance: new Map(),
    employerCostBps: 2500,
    subscriptionUnitCents: null,
  });
  assert.equal(vehicles[0].months[0].costs.driver, 250_000 + 36_750);
});
