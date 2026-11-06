import test from 'node:test';
import assert from 'node:assert/strict';
import { belowThreshold, directBlockReason, parseAmountCents } from './policy.ts';

test('полис экспедитора: суммы из поля формы', () => {
  assert.equal(parseAmountCents('250 000'), 25_000_000);
  assert.equal(parseAmountCents('250000,00'), 25_000_000);
  assert.equal(parseAmountCents('1.250.000'), 125_000_000);
  assert.equal(parseAmountCents('1 250 000,5'), 125_000_050);
  assert.equal(parseAmountCents("500'000"), 50_000_000);
  assert.equal(parseAmountCents(''), null);
  assert.equal(parseAmountCents('0'), null);
  assert.equal(parseAmountCents('abc'), null);
  assert.equal(parseAmountCents('-5'), null);
});

test('полис экспедитора: порог', () => {
  assert.equal(belowThreshold(25_000_000, 50_000_000), false);
  assert.equal(belowThreshold(24_999_999, 50_000_000), true);
  assert.equal(belowThreshold(25_000_000, null), true);
});

test('полис экспедитора: причина закрытого прямого режима', () => {
  const base = { applies: true, allowed: false, in_grace: false, grace_until: null, policy_until: null, needs_license: false, license_ok: false };
  assert.equal(directBlockReason(null, null), null);
  assert.equal(directBlockReason({ ...base, allowed: true }, null), null);
  assert.equal(directBlockReason({ ...base, applies: false }, null), null);
  assert.equal(directBlockReason(base, null), 'MISSING');
  assert.equal(directBlockReason(base, 'PENDING'), 'PENDING');
  assert.equal(directBlockReason(base, 'REJECTED'), 'REJECTED');
  assert.equal(directBlockReason({ ...base, policy_until: '2027-01-01', needs_license: true }, 'APPROVED'), 'LICENSE');
});
