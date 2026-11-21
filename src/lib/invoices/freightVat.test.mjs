/*
 * НДС недельного счёта перевозчика: одна страна, ЕС — reverse charge, вне ЕС. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightVat as vat, OUTSIDE_EU_NOTE, OUTSIDE_EU_NOTE_EU, REVERSE_CHARGE_NOTE, REVERSE_CHARGE_NOTE_EU } from './freightVat.ts';
import { standardVatBps } from '../sites/invoice.ts';

const freightVat = (seller, buyer, buyerVat) => vat(seller, buyer, buyerVat, standardVatBps(seller));

test('одна страна — обычная ставка продавца', () => {
  assert.deepEqual(freightVat('FI', 'FI', null), { ok: true, vatBps: 2550, note: null });
  assert.deepEqual(freightVat('DE', 'DE', 'DE300536616'), { ok: true, vatBps: 1900, note: null });
  assert.deepEqual(freightVat('RO', 'RO', null), { ok: true, vatBps: 2100, note: null });
});

test('страна покупателя не указана — как у продавца', () => {
  assert.deepEqual(freightVat('FI', null, null), { ok: true, vatBps: 2550, note: null });
});

test('разные страны ЕС — 0 % и reverse charge, нужен номер НДС покупателя', () => {
  assert.deepEqual(freightVat('FI', 'DE', 'DE300536616'), { ok: true, vatBps: 0, note: REVERSE_CHARGE_NOTE });
  assert.deepEqual(freightVat('EE', 'FI', 'FI34297631'), { ok: true, vatBps: 0, note: REVERSE_CHARGE_NOTE_EU });
  assert.deepEqual(freightVat('FI', 'DE', null), { ok: false, reason: 'NO_BUYER_VAT' });
  assert.deepEqual(freightVat('FI', 'DE', '  '), { ok: false, reason: 'NO_BUYER_VAT' });
});

test('вне ЕС (Норвегия) — 0 % с пометкой', () => {
  assert.deepEqual(freightVat('FI', 'NO', null), { ok: true, vatBps: 0, note: OUTSIDE_EU_NOTE });
  assert.deepEqual(freightVat('NO', 'SE', 'SE556000000001'), { ok: true, vatBps: 0, note: OUTSIDE_EU_NOTE_EU });
});

test('нет ставки для страны продавца', () => {
  assert.deepEqual(freightVat('US', 'US', null), { ok: false, reason: 'NO_VAT_RATE' });
});

test('номер НДС покупателя должен быть его страны', () => {
  assert.deepEqual(freightVat('FI', 'DE', 'FI34297631'), { ok: false, reason: 'NO_BUYER_VAT' });
  assert.deepEqual(freightVat('FI', 'DE', 'de 300536616'), { ok: true, vatBps: 0, note: REVERSE_CHARGE_NOTE });
});

test('reverse charge без номера НДС продавца — отказ NO_SELLER_VAT', () => {
  assert.deepEqual(vat('EE', 'FI', 'FI34297631', 2400, null), { ok: false, reason: 'NO_SELLER_VAT' });
  assert.deepEqual(vat('LT', 'FI', 'FI34297631', 2100, '  '), { ok: false, reason: 'NO_SELLER_VAT' });
  assert.deepEqual(vat('EE', 'FI', 'FI34297631', 2400, 'EE100931558'), { ok: true, vatBps: 0, note: REVERSE_CHARGE_NOTE_EU });
  /* Одна страна — номер продавца не нужен для этой проверки. */
  assert.deepEqual(vat('EE', 'EE', null, 2400, null), { ok: true, vatBps: 2400, note: null });
});
