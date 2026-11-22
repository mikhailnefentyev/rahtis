/*
 * Ячейки CSV: формулы и чужие разделители. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvFile, csvNumber, csvText } from './csv.ts';

test('обычный текст — в кавычках, кавычки внутри удваиваются', () => {
  assert.equal(csvText('Neste Kerava'), '"Neste Kerava"');
  assert.equal(csvText('a"b'), '"a""b"');
  assert.equal(csvText(null), '""');
});

test('формула в начале получает апостроф — и после пробелов, и широкая', () => {
  assert.equal(csvText('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvText('+1'), `"'+1"`);
  assert.equal(csvText('-1'), `"'-1"`);
  assert.equal(csvText('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(csvText(' \t=1+1'), `"' \t=1+1"`);
  assert.equal(csvText('＝1'), `"'＝1"`);
});

test('запятая не разбивает ячейку: значение целиком в кавычках', () => {
  assert.equal(csvText('Neste, =1+1'), '"Neste, =1+1"');
});

test('числа без апострофа: отрицательная сумма остаётся числом', () => {
  assert.equal(csvNumber('-12.50'), '"-12.50"');
  assert.equal(csvNumber(405.2), '"405.2"');
  assert.equal(csvNumber(null), '""');
});

test('файл: BOM, «;» и CRLF', () => {
  assert.equal(csvFile([['"a"', '"b"'], ['"1"', '"2"']]), '﻿"a";"b"\r\n"1";"2"\r\n');
});

test('csvDecimal: запятая для всех языков, кроме английского', async () => {
  const { csvDecimal } = await import('./csv.ts');
  for (const locale of ['fi', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru', 'ro']) {
    assert.equal(csvDecimal(25.5, locale), '"25,5"');
    assert.equal(csvDecimal(480, locale, 2), '"480,00"');
  }
  assert.equal(csvDecimal(25.5, 'en'), '"25.5"');
  assert.equal(csvDecimal(480, 'en', 2), '"480.00"');
});

test('csvDecimal: отрицательные, целые, округление, без разделителя тысяч', async () => {
  const { csvDecimal } = await import('./csv.ts');
  assert.equal(csvDecimal(-12.5, 'fi', 2), '"-12,50"');
  assert.equal(csvDecimal(-12.5, 'en', 2), '"-12.50"');
  assert.equal(csvDecimal(405200, 'fi'), '"405200"');
  assert.equal(csvDecimal(0, 'fi'), '"0"');
  assert.equal(csvDecimal(0, 'fi', 2), '"0,00"');
  assert.equal(csvDecimal(1234567.891, 'fi', 2), '"1234567,89"');
  assert.equal(csvDecimal(1234567.891, 'en', 2), '"1234567.89"');
  assert.equal(csvDecimal(12.345, 'de', 1), '"12,3"');
  assert.equal(csvDecimal('7.25', 'fi', 2), '"7,25"');
});

test('csvDecimal: пусто и не число — пустая ячейка', async () => {
  const { csvDecimal } = await import('./csv.ts');
  assert.equal(csvDecimal(null, 'fi', 2), '""');
  assert.equal(csvDecimal(undefined, 'en'), '""');
  assert.equal(csvDecimal('', 'fi'), '""');
  assert.equal(csvDecimal(Number.NaN, 'fi', 2), '""');
  assert.equal(csvDecimal('abc', 'fi'), '""');
});
