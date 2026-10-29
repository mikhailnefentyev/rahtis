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
