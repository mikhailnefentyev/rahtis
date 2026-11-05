/*
 * Строки месячного отчёта заправщика после разбора. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReport, parseDate, parseNumber, reportCurrency } from './fuel.ts';

const vehicles = [
  { id: 'v1', plate: 'ABC-123' },
  { id: 'v2', plate: 'XYZ-9' },
];
const cards = [{ card_ref: '7002501234567', vehicle_id: 'v2' }];

test('числа в финском и английском виде', () => {
  assert.equal(parseNumber('1 234,56'), 1234.56);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.equal(parseNumber('1,234.56'), 1234.56);
  assert.equal(parseNumber('312,4 €'), 312.4);
  assert.equal(parseNumber('abc'), null);
});

test('даты: ISO и финская запись, несуществующая отбрасывается', () => {
  assert.equal(parseDate('2026-10-05'), '2026-10-05');
  assert.equal(parseDate('5.10.2026'), '2026-10-05');
  assert.equal(parseDate('05.10.26'), '2026-10-05');
  assert.equal(parseDate('31.02.2026'), null);
});

test('машина по номеру без дефиса, потом по запомненной карте', () => {
  const rows = normalizeReport(
    [
      { date: '2026-10-05', time: '7:05', plate: 'abc123', product: 'diesel', quantity: '312,40', amount_gross: '561,50' },
      { date: '2026-10-04', card: '7002 5012 3456 7', product: 'ADBLUE', quantity: 40 },
      { date: '2026-10-06', plate: 'ZZZ-1', product: 'HVO', quantity: 100 },
    ],
    vehicles,
    cards,
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].vehicle_id, 'v2');
  assert.equal(rows[0].card_ref, '7002501234567');
  assert.equal(rows[1].vehicle_id, 'v1');
  assert.equal(rows[1].time, '07:05');
  assert.equal(rows[1].quantity, 312.4);
  assert.equal(rows[1].amount_cents, 56150);
  assert.equal(rows[2].vehicle_id, null);
});

test('непонятный продукт, объём или дата — строки нет', () => {
  const rows = normalizeReport(
    [
      { date: '2026-10-05', product: 'COFFEE', quantity: 1 },
      { date: '2026-10-05', product: 'DIESEL', quantity: 0 },
      { date: '2026-10-05', product: 'DIESEL', quantity: 5000 },
      { date: 'вчера', product: 'DIESEL', quantity: 100 },
    ],
    vehicles,
    cards,
  );
  assert.equal(rows.length, 0);
});

test('валюта строки: из разбора; пустая — валюта компании; чужая — без суммы', () => {
  const rows = normalizeReport(
    [
      { date: '2026-10-05', plate: 'ABC-123', product: 'DIESEL', quantity: 300, amount_gross: 540, currency: 'eur' },
      { date: '2026-10-06', plate: 'ABC-123', product: 'DIESEL', quantity: 300, amount_gross: '2 350,00 zł', currency: null },
      { date: '2026-10-07', plate: 'ABC-123', product: 'DIESEL', quantity: 300, amount_gross: 6100, currency: 'CHF' },
    ],
    vehicles,
    cards,
    'PLN',
  );
  assert.deepEqual(
    rows.map((r) => [r.currency, r.amount_cents]),
    [
      ['EUR', 54000],
      ['PLN', 235000],
      ['PLN', null],
    ],
  );
  assert.equal(reportCurrency(' sek ', 'EUR'), 'SEK');
  assert.equal(reportCurrency(undefined, 'NOK'), 'NOK');
});

test('числа со знаком валюты', () => {
  assert.equal(parseNumber('1 450,50 kr'), 1450.5);
  assert.equal(parseNumber('1 450,50 kr.'), 1450.5);
  assert.equal(parseNumber('PLN 890'), 890);
  assert.equal(parseNumber('890 zł'), 890);
});
