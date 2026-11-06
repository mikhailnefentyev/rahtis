import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from './policy.ts';

const { belowThreshold, parseAmountCents } = policy;

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

test('полис экспедитора — отметка, а не допуск: причины «закрыто» больше нет', () => {
  assert.equal('directBlockReason' in policy, false);
});
