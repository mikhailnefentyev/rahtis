/*
 * Топливо без НДС в доходности. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuelNetCents, fuelVatCountry } from './fuelVat.ts';

test('сумма без НДС: итог чека × 10000 / (10000 + ставка), до цента', () => {
  assert.equal(fuelNetCents(12550, 2550), 10000);
  assert.equal(fuelNetCents(10000, 2550), 7968); // 7968,13
  assert.equal(fuelNetCents(10000, 2500), 8000);
  assert.equal(fuelNetCents(10000, 1900), 8403); // 8403,36
  assert.equal(fuelNetCents(10000, 2300), 8130); // 8130,08
  assert.equal(fuelNetCents(1, 2550), 1);
  assert.equal(fuelNetCents(0, 2550), 0);
});

test('ставка неизвестна — итог чека не меняется', () => {
  assert.equal(fuelNetCents(10000, null), 10000);
  assert.equal(fuelNetCents(10000, undefined), 10000);
  assert.equal(fuelNetCents(10000, 0), 10000);
});

test('страна: валюта чека вне евро говорит, где куплено топливо', () => {
  assert.equal(fuelVatCountry('SEK', 'FI'), 'SE');
  assert.equal(fuelVatCountry('NOK', 'FI'), 'NO');
  assert.equal(fuelVatCountry('DKK', 'DE'), 'DK');
  assert.equal(fuelVatCountry('PLN', 'LT'), 'PL');
  assert.equal(fuelVatCountry('RON', null), 'RO');
  assert.equal(fuelVatCountry('sek', 'FI'), 'SE');
});

test('страна: чек в евро или без валюты — страна компании', () => {
  assert.equal(fuelVatCountry('EUR', 'FI'), 'FI');
  assert.equal(fuelVatCountry('EUR', 'ee'), 'EE');
  assert.equal(fuelVatCountry('EUR', 'PL'), 'PL');
  assert.equal(fuelVatCountry(null, 'DE'), 'DE');
  assert.equal(fuelVatCountry('EUR', null), null);
  assert.equal(fuelVatCountry(undefined, ''), null);
});
