import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWaitMinutes } from './waiting.ts';

test('минуты до часа — минутами', () => {
  assert.equal(formatWaitMinutes(0), '0 min');
  assert.equal(formatWaitMinutes(25), '25 min');
});

test('от часа — часы и остаток', () => {
  assert.equal(formatWaitMinutes(60), '1 h');
  assert.equal(formatWaitMinutes(100), '1 h 40 min');
  assert.equal(formatWaitMinutes(125.4), '2 h 5 min');
});
