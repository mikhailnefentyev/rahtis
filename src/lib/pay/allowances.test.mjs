/*
 * Суточные по странам. Запуск: npm test.
 * Цифры — из docs/pay/research-driver-pay-countries.md (2026).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAllowances, wageWarnings } from './allowances.ts';

const day = (date, country, spanHours = 13, extra = {}) => ({ date, country, spanMinutes: spanHours * 60, ...extra });

test('PL внутренние: 45 zł, неполный день 8–12 ч — половина, обед −50 %, ночлег без счёта 67,50 zł', () => {
  const set = { rule: 'PL_DOMESTIC', country: 'PL', currency: 'PLN', params: { day_cents: 4500, lodging_cents: 6750 }, rates: [] };
  const r = computeAllowances({
    set,
    currency: 'PLN',
    days: [
      day('2026-03-02', 'PL', 13, { night: 'HOTEL' }),
      day('2026-03-03', 'PL', 10),
      day('2026-03-04', 'PL', 6),
      day('2026-03-05', 'PL', 13, { meals: 'L', night: 'CAB' }),
      day('2026-03-06', 'DE', 13),
    ],
  });
  assert.deepEqual(
    r.days.map((d) => [d.allowanceCents, d.lodgingCents]),
    [[4500, 6750], [2250, 0], [0, 0], [2250, 0], [0, 0]],
  );
  assert.equal(r.totals.allowanceCents, 9000);
  assert.equal(r.totals.lodgingCents, 6750);
});

test('PL международные: надбавка — зарплата, без налога до 20 € (⅓ при ≤ 8 ч), льгота ZUS 60 € в день', () => {
  const set = {
    rule: 'PL_INTERNATIONAL',
    country: 'PL',
    currency: 'PLN',
    params: { day_cents: 6250, day_currency: 'EUR', pit_relief_cents: 2000, zus_relief_cents: 6000 },
    rates: [],
  };
  const fx = (c, from, to) => (from === 'EUR' && to === 'PLN' ? Math.round(c * 4.3) : null);
  const r = computeAllowances({
    set,
    currency: 'PLN',
    fx,
    days: [day('2026-03-02', 'DE', 14), day('2026-03-03', 'DE', 7), day('2026-03-04', 'PL', 10)],
  });
  const [full, third, home] = r.days;
  assert.equal(full.kind, 'WAGE');
  assert.equal(full.allowanceCents, 6250);
  assert.equal(full.taxFreeCents, 2000);
  assert.equal(full.taxableCents, 4250);
  assert.equal(third.taxFreeCents, 667);
  assert.equal(home.allowanceCents, 0);
  assert.ok(r.warnings.some((w) => w.code === 'PL_INTL_IS_WAGE'));
  assert.deepEqual(r.warnings.find((w) => w.code === 'PL_ZUS_RELIEF'), { code: 'PL_ZUS_RELIEF', days: 2, eurCents: 12000 });
  assert.equal(r.totals.currency, 'PLN');
  assert.equal(r.totals.allowanceCents, Math.round(6250 * 4.3) + Math.round(2083 * 4.3));
});

test('EE: 75 € первые 15 дней поездки, потом 40 €; новая поездка — снова 75', () => {
  const set = { rule: 'EE_ABROAD', country: 'EE', currency: 'EUR', params: { first_days: 15, first_cents: 7500, later_cents: 4000 }, rates: [] };
  const days = [];
  for (let d = 1; d <= 17; d += 1) days.push(day(`2026-03-${String(d).padStart(2, '0')}`, 'FI'));
  days.push(day('2026-03-18', 'EE'));
  days.push(day('2026-03-19', 'LV'));
  const r = computeAllowances({ set, currency: 'EUR', days });
  assert.equal(r.days[0].allowanceCents, 7500);
  assert.equal(r.days[14].allowanceCents, 7500);
  assert.equal(r.days[15].allowanceCents, 4000);
  /* Новая поездка, но 15 «первых» дней месяца уже использованы. */
  assert.equal(r.days[18].allowanceCents, 4000);
  assert.deepEqual(r.warnings.find((w) => w.code === 'EE_LATER_RATE'), { code: 'EE_LATER_RATE', days: 3 });
});

test('LV: ставка по стране, потолок 70 % от (зарплата + суточные) — излишек облагается', () => {
  const set = {
    rule: 'LV_TRIP',
    country: 'LV',
    currency: 'EUR',
    params: { cap_bps: 7000 },
    rates: [{ country: 'DE', currency: 'EUR', dayCents: 5000 }],
  };
  const days = [];
  for (let d = 1; d <= 22; d += 1) days.push(day(`2026-03-${String(d).padStart(2, '0')}`, 'DE'));
  days.push(day('2026-03-23', 'FR'));
  /* Зарплата 400 € → суточные не больше 400 × 0,7 / 0,3 = 933,33 €; начислено 22 × 50 = 1 100 €. */
  const r = computeAllowances({ set, currency: 'EUR', days, wageByMonth: { '2026-03': 40000 } });
  assert.equal(r.totals.allowanceCents, 110000);
  const cap = r.warnings.find((w) => w.code === 'LV_CAP');
  assert.equal(cap.excessCents, 110000 - 93333);
  assert.equal(r.totals.taxableCents, 110000 - 93333);
  assert.deepEqual(r.warnings.find((w) => w.code === 'NO_RATE'), { code: 'NO_RATE', countries: ['FR'] });
});

test('LT: оклад ≥ 1,65 МЗП — всё без налога; ниже — без налога только до 50 % зарплаты', () => {
  const set = {
    rule: 'LT_ABROAD',
    country: 'LT',
    currency: 'EUR',
    params: { coef_bps: 16500, mma_cents: 115300, half_bps: 5000 },
    rates: [{ country: 'DE', currency: 'EUR', dayCents: 6000 }],
  };
  const days = [];
  for (let d = 2; d <= 21; d += 1) days.push(day(`2026-03-${String(d).padStart(2, '0')}`, 'DE'));
  const rich = computeAllowances({ set, currency: 'EUR', days, wageByMonth: { '2026-03': 200000 }, baseMonthlyCents: 200000 });
  assert.equal(rich.totals.taxableCents, 0);
  const poor = computeAllowances({ set, currency: 'EUR', days, wageByMonth: { '2026-03': 115300 }, baseMonthlyCents: 115300 });
  assert.equal(poor.totals.allowanceCents, 120000);
  assert.equal(poor.totals.taxFreeCents, 57650);
  assert.equal(poor.totals.taxableCents, 120000 - 57650);
});

test('неизвестная страна дня — предупреждение; внутренний день — только с ночёвкой вне дома', () => {
  const set = { rule: 'GENERIC', country: 'SE', currency: 'SEK', params: {}, rates: [{ country: 'SE', currency: 'SEK', dayCents: 30000 }] };
  const r = computeAllowances({ set, currency: 'SEK', days: [day('2026-03-02', null), day('2026-03-03', 'SE', 13, { night: 'CAB' }), day('2026-03-04', 'SE', 9)] });
  assert.equal(r.totals.allowanceCents, 30000);
  assert.deepEqual(r.warnings, [{ code: 'NO_COUNTRY', days: 1 }]);
});

test('проверки оплаты: только за км, серый шаблон, ниже минимума', () => {
  const w = wageWarnings({
    model: 'PER_KM',
    country: 'PL',
    legality: 'GREY',
    minMonthlyCents: 480600,
    currency: 'PLN',
    wageByMonth: { '2026-03': 400000, '2026-04': 500000 },
  });
  assert.deepEqual(w.map((x) => x.code), ['OUTPUT_PAY', 'LEGALITY', 'BELOW_MINIMUM']);
  assert.equal(w[2].month, '2026-03');
});
