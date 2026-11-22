/*
 * Какие рейсы идут в автоматический счёт перевозчика: граница включения
 * недельных счетов и свои клиенты. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freightScope, ownClientOff } from './freightScope.ts';

const platform = { client_of: null, auto_invoice: false };
const never = { weekly_invoicing_from: null };

test('настройку не переключали — рейс идёт в счёт', () => {
  assert.equal(freightScope('2026-11-18T09:00:00Z', never, platform), null);
  assert.equal(freightScope('2026-11-18T09:00:00Z', undefined, undefined), null);
});

test('рейс закрыт до включения недельных счетов — не выставляется', () => {
  const carrier = { weekly_invoicing_from: '2027-02-20T10:00:00Z' };
  assert.equal(freightScope('2026-11-18T09:00:00Z', carrier, platform), 'BEFORE_INVOICING_FROM');
  // В день включения, но раньше него.
  assert.equal(freightScope('2027-02-20T09:59:59Z', carrier, platform), 'BEFORE_INVOICING_FROM');
});

test('рейс закрыт в момент включения или позже — выставляется', () => {
  const carrier = { weekly_invoicing_from: '2027-02-20T10:00:00Z' };
  assert.equal(freightScope('2027-02-20T10:00:00Z', carrier, platform), null);
  assert.equal(freightScope('2027-02-21T06:00:00Z', carrier, platform), null);
});

test('момент включения сравнивается как время, а не как строка', () => {
  // База отдаёт время со смещением и микросекундами.
  const carrier = { weekly_invoicing_from: '2027-02-20T12:00:00.123456+02:00' };
  assert.equal(freightScope('2027-02-20T10:00:00Z', carrier, platform), 'BEFORE_INVOICING_FROM');
  assert.equal(freightScope('2027-02-20T10:00:01+00:00', carrier, platform), null);
});

test('нечитаемое время — рейс в счёт не идёт', () => {
  assert.equal(freightScope('вчера', { weekly_invoicing_from: '2027-02-20T10:00:00Z' }, platform), 'BEFORE_INVOICING_FROM');
  assert.equal(freightScope('2027-02-21T06:00:00Z', { weekly_invoicing_from: 'не время' }, platform), 'BEFORE_INVOICING_FROM');
});

test('свой клиент без подтверждения — счёт не выставляется', () => {
  assert.equal(freightScope('2026-11-18T09:00:00Z', never, { client_of: 'c1', auto_invoice: false }), 'OWN_CLIENT_OFF');
  assert.equal(freightScope('2026-11-18T09:00:00Z', never, { client_of: 'c1', auto_invoice: null }), 'OWN_CLIENT_OFF');
});

test('свой клиент с подтверждением — как любой заказчик', () => {
  assert.equal(freightScope('2026-11-18T09:00:00Z', never, { client_of: 'c1', auto_invoice: true }), null);
});

test('заказчик платформы — отметка клиента значения не имеет', () => {
  assert.equal(ownClientOff({ client_of: null, auto_invoice: false }), false);
  assert.equal(ownClientOff(undefined), false);
  assert.equal(ownClientOff({ client_of: 'c1', auto_invoice: true }), false);
  assert.equal(ownClientOff({ client_of: 'c1', auto_invoice: false }), true);
});

test('граница включения проверяется раньше отметки клиента', () => {
  const carrier = { weekly_invoicing_from: '2027-02-20T10:00:00Z' };
  assert.equal(freightScope('2026-11-18T09:00:00Z', carrier, { client_of: 'c1', auto_invoice: false }), 'BEFORE_INVOICING_FROM');
});
