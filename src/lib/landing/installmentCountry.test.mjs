/*
 * Страна расчёта на открытой странице калькулятора (24.11.2026): по языку
 * страницы и по ?country=. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOCALE_COUNTRY, defaultInstallmentCountry, pickInstallmentCountry } from './installmentCountry.ts';
import { openInstallmentCountries } from '../installments/countries.ts';

const OPEN = ['FI', 'EE', 'LV', 'SE', 'DK', 'LT', 'DE', 'PL', 'RO'];
const LOCALES = ['fi', 'en', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru', 'ro'];

test('по умолчанию — страна языка страницы, у ru и en — Финляндия', () => {
  const expected = { fi: 'FI', sv: 'SE', et: 'EE', lv: 'LV', lt: 'LT', pl: 'PL', de: 'DE', ro: 'RO', ru: 'FI', en: 'FI' };
  for (const l of LOCALES) assert.equal(defaultInstallmentCountry(l, OPEN), expected[l], l);
  assert.deepEqual(Object.keys(LOCALE_COUNTRY).sort(), [...LOCALES].sort());
});

test('закрытая страна языка — Финляндия; закрыта и Финляндия — первая открытая', () => {
  assert.equal(defaultInstallmentCountry('pl', ['FI', 'EE']), 'FI');
  assert.equal(defaultInstallmentCountry('pl', ['EE', 'LV']), 'EE');
  assert.equal(defaultInstallmentCountry('xx', OPEN), 'FI');
});

test('?country= открытой страны выбирает её, регистр не важен', () => {
  assert.equal(pickInstallmentCountry('fi', 'DK', OPEN), 'DK');
  assert.equal(pickInstallmentCountry('de', 'se', OPEN), 'SE');
  assert.equal(pickInstallmentCountry('en', ['ro', 'pl'], OPEN), 'RO');
  assert.equal(pickInstallmentCountry('ru', ' lv ', OPEN), 'LV');
});

test('неизвестная, закрытая или пустая страна — страна по умолчанию', () => {
  assert.equal(pickInstallmentCountry('sv', 'NO', OPEN), 'SE');
  assert.equal(pickInstallmentCountry('sv', 'ZZ', OPEN), 'SE');
  assert.equal(pickInstallmentCountry('et', '', OPEN), 'EE');
  assert.equal(pickInstallmentCountry('et', undefined, OPEN), 'EE');
  assert.equal(pickInstallmentCountry('lt', 'FIN', OPEN), 'LT');
  assert.equal(pickInstallmentCountry('pl', [], OPEN), 'PL');
});

test('с реестром: все языки сайта получают открытую страну', () => {
  const open = openInstallmentCountries();
  for (const l of LOCALES) assert.ok(open.includes(defaultInstallmentCountry(l, open)), l);
  assert.equal(pickInstallmentCountry('fi', 'DK', open), open.includes('DK') ? 'DK' : 'FI');
});
