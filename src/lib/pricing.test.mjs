import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipperFeeBps } from './config.ts';

const total = (rate) => Math.round((rate * shipperFeeBps(rate)) / 10_000) + Math.round((rate * 300) / 10_000);

test('обычный рейс — 5 % заказчику', () => {
  assert.equal(shipperFeeBps(50_000), 500);
  assert.equal(total(50_000), 4_000);
});

test('короткий рейс добирается до минимума 15 € вместе с перевозчиком', () => {
  assert.equal(shipperFeeBps(12_000), 950);
  assert.equal(total(12_000), 1_500);
  assert.ok(total(6_000) >= 1_500);
  assert.ok(total(18_750) >= 1_500);
});

test('без цены — базовая ставка', () => {
  assert.equal(shipperFeeBps(0), 500);
});
