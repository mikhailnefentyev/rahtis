/*
 * Сумма из формы заказа: разделители тысяч и дроби. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoneyCents } from './amount.ts';

test('целые и дробь через запятую или точку', () => {
  assert.equal(parseMoneyCents('1200'), 120_000);
  assert.equal(parseMoneyCents('1 200'), 120_000);
  assert.equal(parseMoneyCents('1200,50'), 120_050);
  assert.equal(parseMoneyCents('1200.50'), 120_050);
  assert.equal(parseMoneyCents('0,5'), 50);
  assert.equal(parseMoneyCents('0.05'), 5);
  assert.equal(parseMoneyCents('1 200,5'), 120_050);
});

test('разделитель тысяч рядом с дробью', () => {
  assert.equal(parseMoneyCents('1.200,50'), 120_050);
  assert.equal(parseMoneyCents('1,200.50'), 120_050);
  assert.equal(parseMoneyCents('1.200.000'), 120_000_000);
  assert.equal(parseMoneyCents('12.345.678,9'), 1_234_567_890);
  assert.equal(parseMoneyCents("1'200.50"), 120_050);
});

test('«1.200» — не угадываем: ни 1,20, ни 1200', () => {
  assert.equal(parseMoneyCents('1.200'), null);
  assert.equal(parseMoneyCents('1,200'), null);
  assert.equal(parseMoneyCents('12.3456'), null);
  assert.equal(parseMoneyCents('1.20,50'), null);
  assert.equal(parseMoneyCents('1.2.3'), null);
  assert.equal(parseMoneyCents('1,200,50'), null);
});

test('знак валюты не мешает, не число и не больше нуля — null', () => {
  assert.equal(parseMoneyCents('480 €'), 48_000);
  assert.equal(parseMoneyCents('1200 zł'), 120_000);
  assert.equal(parseMoneyCents('5000 kr.'), 500_000);
  assert.equal(parseMoneyCents('€ 1.200,00'), 120_000);
  assert.equal(parseMoneyCents('1200,-'), 120_000);
  assert.equal(parseMoneyCents(''), null);
  assert.equal(parseMoneyCents('abc'), null);
  assert.equal(parseMoneyCents('0'), null);
  assert.equal(parseMoneyCents('-50'), null);
  assert.equal(parseMoneyCents('− 50'), null);
  assert.equal(parseMoneyCents(',50'), null);
  assert.equal(parseMoneyCents('1200-1500'), null);
  assert.equal(parseMoneyCents(null), null);
});
