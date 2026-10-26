/*
 * Счета по объектам: номер для платежа, строки, ALV, расписание. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finnishReference, invoiceDue, invoiceLines, invoiceTotals, isoWeek } from './invoice.ts';

test('viitenumero: контрольная цифра по весам 7-3-1', () => {
  // Известные примеры: 1232 (основа 123), 12345672 (основа 1234567).
  assert.equal(finnishReference('123'), '1232');
  assert.equal(finnishReference('1234567'), '12345672');
  assert.equal(finnishReference('2026-0007'), finnishReference('20260007'));
});

const days = [
  { day: '2026-10-26', driver: 'Matti', plate: 'ABC-123', minutes: 585, loads: 12, netKg: 412_300 },
  { day: '2026-10-27', driver: 'Matti', plate: 'ABC-123', minutes: 480, loads: 10, netKg: 350_000 },
];

test('строки: часы, рейсы, тонны', () => {
  const hours = invoiceLines('HOUR', 9500, days);
  assert.equal(hours[0].quantity, 9.75);
  assert.equal(hours[0].amountCents, 92_625);
  assert.equal(invoiceLines('LOAD', 8000, days)[1].amountCents, 80_000);
  const t = invoiceLines('TONNE', 250, days);
  assert.equal(t[0].quantity, 412.3);
  assert.equal(t[0].amountCents, 103_075);
});

test('ALV: Финляндия 25,5 %, иностранный клиент — обратное начисление', () => {
  const lines = invoiceLines('HOUR', 10000, days);
  const fi = invoiceTotals(lines, 2550);
  assert.equal(fi.netCents, 177_500);
  assert.equal(fi.vatCents, 45_263);
  assert.equal(fi.totalCents, 222_763);
  const se = invoiceTotals(lines, 0);
  assert.equal(se.vatCents, 0);
  assert.equal(se.reverseCharge, true);
});

test('расписание: еженедельно и по чётным неделям', () => {
  assert.equal(isoWeek('2026-10-26'), 44);
  assert.equal(invoiceDue('WEEKLY', '2026-10-26'), true);
  assert.equal(invoiceDue('BIWEEKLY', '2026-10-26'), true);
  assert.equal(invoiceDue('BIWEEKLY', '2026-11-02'), false);
  assert.equal(invoiceDue('MANUAL', '2026-10-26'), false);
});
