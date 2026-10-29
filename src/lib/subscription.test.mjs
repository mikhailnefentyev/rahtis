/*
 * Абонемент лесенкой и год вперёд (тот же расчёт — app.subscription_ladder_cents). Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annualPlanCents, subscriptionLadderCents } from './config.ts';

test('лесенка: каждая ступень платит свою цену', () => {
  assert.equal(subscriptionLadderCents(0), 0);
  assert.equal(subscriptionLadderCents(1), 2990);
  assert.equal(subscriptionLadderCents(9), 26910);
  assert.equal(subscriptionLadderCents(10), 29700);
  assert.equal(subscriptionLadderCents(20), 57400);
  assert.equal(subscriptionLadderCents(50), 134900);
  assert.equal(subscriptionLadderCents(100), 254400);
});

test('следующая машина всегда добавляет к сумме — провалов нет', () => {
  for (let n = 1; n < 200; n += 1) assert.ok(subscriptionLadderCents(n + 1) > subscriptionLadderCents(n), String(n));
});

test('год вперёд: 12 месяцев минус 10 %', () => {
  assert.equal(annualPlanCents(1), 32292);
  assert.equal(annualPlanCents(10), 320760);
});
