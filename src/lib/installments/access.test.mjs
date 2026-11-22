/*
 * Рассрочка техники: кому открыт раздел и какую машину можно выставить.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEAL_STATUSES,
  TERMINATION_REASONS,
  dealBadgeTone,
  dealBilled,
  dealHasContract,
  installmentsAvailable,
  isTerminationReason,
  vatModeAllowedForNew,
  vehicleSellable,
} from './access.ts';

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

test('ежедневное задание ведёт только сделку в рассрочке — прекращённую не трогает', () => {
  assert.equal(dealBilled('ACTIVE'), true);
  for (const status of ['TERMINATED', 'PAID_OFF', 'CANCELLED', 'AGREED', 'NEGOTIATING', '', null, undefined]) {
    assert.equal(dealBilled(status), false, String(status));
  }
});

test('прекращённая сделка: статус в общем списке, договор доступен, значок — красный', () => {
  assert.ok(DEAL_STATUSES.includes('TERMINATED'));
  for (const status of ['AGREED', 'ACTIVE', 'PAID_OFF', 'TERMINATED']) assert.equal(dealHasContract(status), true, status);
  for (const status of ['NEGOTIATING', 'CANCELLED', null]) assert.equal(dealHasContract(status), false, String(status));
  assert.equal(dealBadgeTone('TERMINATED'), 'danger');
  assert.equal(dealBadgeTone('ACTIVE'), 'ok');
  assert.equal(dealBadgeTone('CANCELLED'), 'neutral');
  /* У каждого статуса есть цвет. */
  for (const status of DEAL_STATUSES) assert.ok(['ok', 'warn', 'info', 'danger', 'neutral'].includes(dealBadgeTone(status)));
});

test('причина прекращения — только две, как в базе', () => {
  assert.deepEqual([...TERMINATION_REASONS], ['REPOSSESSED', 'AGREEMENT']);
  assert.equal(isTerminationReason('REPOSSESSED'), true);
  assert.equal(isTerminationReason('AGREEMENT'), true);
  for (const value of ['repossessed', 'CANCELLED', '', null, undefined, 1]) assert.equal(isTerminationReason(value), false);
});

test('новое объявление и предложение — только с обычным НДС', () => {
  assert.equal(vatModeAllowedForNew('STANDARD'), true);
  for (const mode of ['MARGIN', 'EXEMPT', 'NONE', '', null, undefined]) assert.equal(vatModeAllowedForNew(mode), false);
});
