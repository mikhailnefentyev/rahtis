import test from 'node:test';
import assert from 'node:assert/strict';
import { bankMarkDays, daysAgo, ibanHoldActive, maskEmail, maskIban } from './changes.ts';

test('маски: счёт — четыре последних знака, почта — буква и домен', () => {
  assert.equal(maskIban('FI21 1234 5600 0007 85'), '•••• 0785');
  assert.equal(maskIban(''), null);
  assert.equal(maskIban(null), null);
  assert.equal(maskEmail('laskut@firma.fi'), 'l•••@firma.fi');
  assert.equal(maskEmail('@firma.fi'), '•••');
  assert.equal(maskEmail(null), null);
});

test('дней назад: целые сутки, не меньше нуля', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  assert.equal(daysAgo('2026-11-06T08:00:00Z', now), 0);
  assert.equal(daysAgo('2026-11-04T11:00:00Z', now), 2);
  assert.equal(daysAgo('2026-11-07T08:00:00Z', now), 0);
});

test('отметка у контрагента — 30 дней', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  assert.equal(bankMarkDays('2026-10-08T12:00:00Z', now), 29);
  assert.equal(bankMarkDays('2026-10-07T12:00:00Z', now), null);
  assert.equal(bankMarkDays(null, now), null);
});

test('48 часов после смены IBAN', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  assert.equal(ibanHoldActive('2026-11-04T12:30:00Z', now), true);
  assert.equal(ibanHoldActive('2026-11-04T11:30:00Z', now), false);
  assert.equal(ibanHoldActive(null, now), false);
});
