/*
 * Договорённость в отчёте: строки базы, отрезки профилей, доля месяцев,
 * дни и раскладка по дням. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agreedDayInputs,
  agreementOf,
  countryRates,
  isAgreedModel,
  monthsIn,
  profileSegments,
  spreadCents,
} from './agreedPeriods.ts';

test('строка профиля → договорённость', () => {
  assert.equal(agreementOf({ model: 'TES' }, 'EUR'), null);
  const a = agreementOf(
    {
      model: 'DAY_NET',
      currency: 'PLN',
      agreed_day_cents: 45000,
      agreed_day_basis: 'BOGUS',
      agreed_country_day_cents: { nl: 50000, XX1: 3, DE: -1, FR: 'x' },
    },
    'EUR',
  );
  assert.equal(a.currency, 'PLN');
  assert.equal(a.dayBasis, 'ROUTE');
  assert.deepEqual(a.countryDayCents, { NL: 50000 });
  assert.equal(agreementOf({ model: 'MONTHLY_NET', agreed_monthly_cents: 300000 }, 'EUR').currency, 'EUR');
  assert.equal(countryRates([1, 2]), null);
  assert.ok(isAgreedModel('PER_TRIP'));
  assert.ok(!isAgreedModel('FLAT_HOURLY'));
});

test('отрезки профилей внутри периода', () => {
  const segs = profileSegments(
    [{ validFrom: '2026-03-10' }, { validFrom: '2026-01-01' }, { validFrom: '2026-05-01' }],
    '2026-03-01',
    '2026-03-31',
  );
  assert.deepEqual(segs, [
    { index: 1, from: '2026-03-01', to: '2026-03-09' },
    { index: 0, from: '2026-03-10', to: '2026-03-31' },
  ]);
  assert.deepEqual(profileSegments([{ validFrom: '2026-04-01' }], '2026-03-01', '2026-03-31'), []);
});

test('доля месяцев', () => {
  assert.equal(monthsIn('2026-03-01', '2026-03-31'), 1);
  assert.equal(monthsIn('2026-02-01', '2026-03-31'), 2);
  assert.equal(monthsIn('2026-03-17', '2026-03-31'), Math.round((15 / 31) * 10000) / 10000);
  assert.equal(monthsIn('2026-03-31', '2026-03-01'), 0);
});

test('дни договорённости: смена, ночь не дома, заграница', () => {
  const nights = { '2026-03-07': 'CAB', '2026-03-09': 'HOME' };
  const countries = { '2026-03-02': 'de', '2026-03-07': 'DE', '2026-03-09': 'PL' };
  const days = agreedDayInputs({
    days: [
      { date: '2026-03-02', workMinutes: 600, trips: 1 },
      { date: '2026-03-07', workMinutes: 0, trips: 0 },
      { date: '2026-03-09', workMinutes: 300, trips: 0 },
    ],
    country: (d) => countries[d] ?? null,
    night: (d) => nights[d] ?? null,
    home: 'pl',
  });
  assert.deepEqual(
    days.map((d) => [d.country, d.worked, d.away, d.trips]),
    [
      ['DE', true, true, 1],
      ['DE', false, true, 0],
      ['PL', true, false, 0],
    ],
  );
});

test('раскладка по дням без потери цента', () => {
  const out = spreadCents(1000, [
    { date: 'a', weight: 1 },
    { date: 'b', weight: 1 },
    { date: 'c', weight: 1 },
  ]);
  assert.equal(out.a + out.b + out.c, 1000);
  const zero = spreadCents(10, [
    { date: 'a', weight: 0 },
    { date: 'b', weight: 0 },
  ]);
  assert.equal(zero.a + zero.b, 10);
  assert.deepEqual(spreadCents(5, []), {});
  assert.deepEqual(spreadCents(900, [{ date: 'a', weight: 2 }, { date: 'b', weight: 1 }]), { a: 600, b: 300 });
});
