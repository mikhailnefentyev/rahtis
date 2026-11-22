/*
 * Когда выставлять счёт по согласованной периодичности. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { biweeklyDue, invoiceCutoff, isoWeekOf, isPaymentTerm, isSchedule, mondayOfWeek } from './terms.ts';

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

test('раз в неделю — до понедельника этой недели, в любой день', () => {
  assert.equal(invoiceCutoff('WEEKLY', '2026-11-23'), '2026-11-23');
  // Запуск понедельника не удался — во вторник граница та же.
  assert.equal(invoiceCutoff('WEEKLY', '2026-11-24'), '2026-11-23');
  assert.equal(invoiceCutoff('WEEKLY', '2026-11-22'), '2026-11-16');
});

test('раз в две недели — до понедельника своей недели', () => {
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-23'), '2026-11-23'); // неделя 48
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-25'), '2026-11-23');
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-16'), '2026-11-09'); // неделя 47 — не своя
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-29'), '2026-11-23');
  assert.equal(invoiceCutoff('BIWEEKLY', '2026-11-30'), '2026-11-23');
});

test('раз в две недели — в 2026 году как по чётным неделям ISO, через год без скачка', () => {
  for (let d = new Date('2026-01-05T12:00:00Z'); d.getUTCFullYear() === 2026; d.setUTCDate(d.getUTCDate() + 7)) {
    const iso = d.toISOString().slice(0, 10);
    assert.equal(biweeklyDue(iso), isoWeekOf(iso) % 2 === 0, iso);
  }
  // 53 недели в 2026 году: после 21.12 следующий счёт 4.1.2027, а не 11.1.
  assert.equal(biweeklyDue('2026-12-21'), true);
  assert.equal(biweeklyDue('2026-12-28'), false);
  assert.equal(biweeklyDue('2027-01-04'), true);
  assert.equal(biweeklyDue('2027-01-11'), false);
  assert.equal(biweeklyDue('2025-12-22'), true);
  assert.equal(mondayOfWeek('2027-01-03'), '2026-12-28');
});

test('раз в месяц — до первого числа этого месяца', () => {
  assert.equal(invoiceCutoff('MONTHLY', '2026-12-01'), '2026-12-01');
  assert.equal(invoiceCutoff('MONTHLY', '2026-12-02'), '2026-12-01');
  assert.equal(invoiceCutoff('MONTHLY', '2027-01-31'), '2027-01-01');
});

test('проверка значений', () => {
  assert.ok(isSchedule('MONTHLY'));
  assert.ok(!isSchedule('DAILY'));
  assert.ok(isPaymentTerm(30));
  assert.ok(!isPaymentTerm(10));
});
