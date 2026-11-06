/*
 * Договорённость с водителем против законной схемы. Запуск: npm test.
 * Цифры — docs/pay/research-real-practice.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreedDays, compareAgreement } from './agreed.ts';

const d = (date, country, worked = true, away = true, trips = 0) => ({ date, country, worked, away, trips });

test('за день «на руки»: все дни в рейсе, только рабочие, только за границей', () => {
  const days = [d('2026-03-02', 'DE'), d('2026-03-07', 'DE', false, true), d('2026-03-09', 'PL', true, false)];
  const route = agreedDays({ model: 'DAY_NET', currency: 'PLN', dayCents: 45000, dayBasis: 'ROUTE' }, days, 'PL');
  assert.deepEqual(route.map((x) => x.cents), [45000, 45000, 45000]);
  const work = agreedDays({ model: 'DAY_NET', currency: 'PLN', dayCents: 45000, dayBasis: 'WORK' }, days, 'PL');
  assert.deepEqual(work.map((x) => x.cents), [45000, 0, 45000]);
  const abroad = agreedDays(
    { model: 'DAY_NET', currency: 'PLN', dayCents: 45000, dayBasis: 'ABROAD', homeDayCents: 30000 },
    days,
    'PL',
  );
  assert.deepEqual(abroad.map((x) => [x.cents, x.basis]), [[45000, 'DAY'], [45000, 'DAY'], [30000, 'HOME']]);
});

test('ставки по странам и за рейс', () => {
  const days = [d('2026-03-02', 'NL'), d('2026-03-03', 'DE'), d('2026-03-04', 'LT', true, false, 1)];
  const byCountry = agreedDays({ model: 'DAY_NET', currency: 'EUR', dayCents: 9000, countryDayCents: { NL: 12000 } }, days, 'LT');
  assert.deepEqual(byCountry.map((x) => x.cents), [12000, 9000, 9000]);
  const trip = agreedDays({ model: 'PER_TRIP', currency: 'EUR', tripCents: 200000 }, days, 'LV');
  assert.equal(trip.reduce((s, x) => s + x.cents, 0), 200000);
});

test('LT: 22 дня по 125 € — оклад 1,65 МЗП и суточные покрывают часть, разрыв — облагаемая зарплата', () => {
  const days = [];
  for (let i = 2; i <= 23; i += 1) days.push(d(`2026-03-${String(i).padStart(2, '0')}`, 'DE'));
  const r = compareAgreement({
    agreement: { model: 'DAY_NET', currency: 'EUR', dayCents: 12500, dayBasis: 'ROUTE' },
    days,
    country: 'LT',
    months: 1,
    minMonthlyCents: 115300,
    baseMonthlyCents: 190245,
    /* 22 × 62 € норма Германии. */
    taxFreeCents: 136400,
  });
  assert.equal(r.agreedNetCents, 275000);
  assert.equal(r.legal.baseNetCents, Math.round(190245 / 1.65));
  assert.equal(r.legal.gapNetCents, 275000 - Math.round(190245 / 1.65) - 136400);
  assert.equal(r.legal.gapEmployerCents, Math.round(r.legal.gapNetCents * 1.68));
  assert.equal(r.warnings[0].code, 'GAP');
});

test('договорённость укладывается в законную схему — разрыва нет; порог для водителя из третьей страны', () => {
  const r = compareAgreement({
    agreement: { model: 'MONTHLY_NET', currency: 'EUR', monthlyCents: 150000 },
    days: [],
    country: 'LV',
    months: 1,
    minMonthlyCents: 78000,
    taxFreeCents: 110000,
    thirdCountryDriver: true,
  });
  assert.equal(r.legal.gapNetCents, 0);
  assert.deepEqual(r.warnings.map((w) => w.code), ['THIRD_COUNTRY_FLOOR']);
});

test('страна без коэффициентов — только сумма договорённости', () => {
  const r = compareAgreement({
    agreement: { model: 'DAY_NET', currency: 'SEK', dayCents: 100000 },
    days: [d('2026-03-02', 'SE')],
    country: 'SE',
    months: 1,
    minMonthlyCents: null,
    taxFreeCents: 0,
  });
  assert.equal(r.agreedNetCents, 100000);
  assert.equal(r.legal, null);
  assert.deepEqual(r.warnings, [{ code: 'NO_FACTORS', country: 'SE' }]);
});
