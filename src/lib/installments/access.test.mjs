/*
 * Рассрочка техники: кому открыт раздел и какую машину можно выставить.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installmentsAvailable, vehicleSellable } from './access.ts';

test('раздел рассрочки — только финской компании', () => {
  assert.equal(installmentsAvailable('FI'), true);
  for (const country of ['EE', 'SE', 'PL', 'RO', '', null, undefined]) {
    assert.equal(installmentsAvailable(country), false);
  }
});

test('на продажу — своя машина: не купленная в рассрочку до выплаты и не проданная', () => {
  assert.equal(vehicleSellable(null), true);
  assert.equal(vehicleSellable(undefined), true);
  assert.equal(vehicleSellable('OWNED'), true);
  assert.equal(vehicleSellable('HELD'), false);
  assert.equal(vehicleSellable('SOLD'), false);
});
