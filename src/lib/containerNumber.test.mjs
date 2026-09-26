/*
 * Тесты проверки номера контейнера (ISO 6346). Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidContainerNumber } from './containerNumber.ts';

test('верные номера проходят', () => {
  assert.equal(isValidContainerNumber('MSCU1234566'), true);
  assert.equal(isValidContainerNumber('CSQU3054383'), true); // пример из стандарта
  assert.equal(isValidContainerNumber('mscu 123456-6'), true); // регистр и разделители не важны
});

test('неверная контрольная цифра не проходит', () => {
  assert.equal(isValidContainerNumber('MSCU1234567'), false); // прежний образец в подсказке формы
  assert.equal(isValidContainerNumber('CSQU3054384'), false);
});

test('неверный формат не проходит', () => {
  assert.equal(isValidContainerNumber('MSC1234566'), false);
  assert.equal(isValidContainerNumber('MSCX1234566'), false); // категория только U, J, Z
  assert.equal(isValidContainerNumber('ABC-123'), false);
});
