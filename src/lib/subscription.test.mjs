/*
 * Абонемент с 3.11.2026: первая машина бесплатно, каждая следующая 14,90 €;
 * год вперёд −10 % (тот же расчёт — app.subscription_ladder_cents). Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annualPlanCents, billedVehicles, subscriptionLadderCents } from './config.ts';

test('первая машина бесплатно, следующие по 14,90 €', () => {
  assert.equal(subscriptionLadderCents(0), 0);
  assert.equal(subscriptionLadderCents(1), 0);
  assert.equal(subscriptionLadderCents(2), 1490);
  assert.equal(subscriptionLadderCents(3), 2980);
  assert.equal(subscriptionLadderCents(10), 13410);
  assert.equal(subscriptionLadderCents(100), 147510);
  assert.equal(billedVehicles(1), 0);
  assert.equal(billedVehicles(5), 4);
});

test('со второй машины каждая следующая добавляет к сумме', () => {
  for (let n = 1; n < 200; n += 1) assert.ok(subscriptionLadderCents(n + 1) > subscriptionLadderCents(n), String(n));
});

test('год вперёд: 12 месяцев минус 10 %', () => {
  assert.equal(annualPlanCents(1), 0);
  assert.equal(annualPlanCents(3), 32184);
  assert.equal(annualPlanCents(10), 144828);
});

/* 6.11.2026: подряда нет; переведённым с подряда подписка начисляется с 1.1.2027. */
import { annualPlanStart, subscriptionMonthCharged } from './config.ts';

test('переведённым с подряда — сбор с января 2027', () => {
  assert.equal(subscriptionMonthCharged('2026-11-01', '2027-01-01'), false);
  assert.equal(subscriptionMonthCharged('2026-12-01', '2027-01-01'), false);
  assert.equal(subscriptionMonthCharged('2027-01-01', '2027-01-01'), true);
  assert.equal(subscriptionMonthCharged('2027-02-01', '2027-01-01'), true);
});

test('новым перевозчикам — по общему правилу', () => {
  assert.equal(subscriptionMonthCharged('2026-11-01', null), true);
  assert.equal(subscriptionMonthCharged('2026-11-01', undefined), true);
});

test('год вперёд не раньше начала начислений', () => {
  assert.equal(annualPlanStart('2026-12-01', '2027-01-01'), '2027-01-01');
  assert.equal(annualPlanStart('2027-03-01', '2027-01-01'), '2027-03-01');
  assert.equal(annualPlanStart('2026-12-01', null), '2026-12-01');
});
