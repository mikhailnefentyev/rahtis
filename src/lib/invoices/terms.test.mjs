/*
 * Когда выставлять счёт по согласованной периодичности. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invoiceCutoff, isoWeekOf, isPaymentTerm, isSchedule } from './terms.ts';

test('неделя ISO', () => {
  assert.equal(isoWeekOf('2026-11-16'), 47);
  assert.equal(isoWeekOf('2026-11-23'), 48);
  assert.equal(isoWeekOf('2027-01-01'), 53);
  assert.equal(isoWeekOf('2026-01-01'), 1);
});

test('сразу после рейса — каждый день за вчера и раньше', () => {
  assert.equal(invoiceCutoff('PER_TRIP', '2026-11-18'), '2026-11-18');
  assert.equal(invoiceCutoff('PER_TRIP', '2026-11-22'), '2026-11-22');
});

test('раз в неделю — только по понедельникам', () => {
  assert.equal(invoiceCutoff('WEEKLY', '2026-11-23'), '2026-11-23');
  assert.equal(invoiceCutoff('WEEKLY', '2026-11-24'), null);
  assert.equal(invoiceCutoff('WEEKLY', '2026-11-22'), null);
});

test('раз в две недели — понедельники чётных недель', () => {
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-23'), '2026-11-23'); // неделя 48
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-16'), null); // неделя 47
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-25'), null);
});

test('раз в месяц — первого числа', () => {
  assert.equal(invoiceCutoff('MONTHLY', '2026-12-01'), '2026-12-01');
  assert.equal(invoiceCutoff('MONTHLY', '2026-12-02'), null);
});

test('проверка значений', () => {
  assert.ok(isSchedule('MONTHLY'));
  assert.ok(!isSchedule('DAILY'));
  assert.ok(isPaymentTerm(30));
  assert.ok(!isPaymentTerm(10));
});
