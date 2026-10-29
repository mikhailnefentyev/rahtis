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
  assert.equal(centsToInput(1_250_050), '12500.50');
  assert.equal(centsToInput(8_500_000), '85000');
});
