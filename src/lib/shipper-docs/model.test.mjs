import test from 'node:test';
import assert from 'node:assert/strict';
import { docNameFor, freshUntil, isShipperDocKind, markState, needsIssuedOn } from './model.ts';

test('документы заказчика: срок налоговой справки', () => {
  assert.equal(freshUntil('TAX_DEBT_CERTIFICATE', '2026-11-01', null), '2027-01-30');
  assert.equal(freshUntil('TAX_DEBT_CERTIFICATE', '2026-11-01', '2026-12-01'), '2026-12-01');
  assert.equal(freshUntil('TAX_DEBT_CERTIFICATE', null, null), null);
});

test('документы заказчика: свежесть выписки — 12 месяцев', () => {
  assert.equal(freshUntil('REGISTER_EXTRACT', '2026-11-01', null), '2027-11-01');
  assert.equal(freshUntil('REGISTER_EXTRACT', '2024-02-29', null), '2025-02-28');
  assert.equal(freshUntil('REGISTER_EXTRACT', '2026-11-01', '2027-03-01'), '2027-03-01');
  assert.equal(freshUntil('REGISTER_EXTRACT', '2026-11-01', '2030-01-01'), '2027-11-01');
  assert.equal(freshUntil('REGISTER_EXTRACT', 'мусор', null), null);
});

test('документы заказчика: НДС и право подписи бессрочны без даты', () => {
  assert.equal(freshUntil('VAT_CERTIFICATE', '2020-01-01', null), null);
  assert.equal(freshUntil('SIGNATORY_AUTHORITY', null, '2027-06-30'), '2027-06-30');
});

test('документы заказчика: отметка и вид', () => {
  assert.equal(markState(null, '2026-11-06'), 'ok');
  assert.equal(markState('2026-11-06', '2026-11-06'), 'ok');
  assert.equal(markState('2026-11-05', '2026-11-06'), 'expired');
  assert.ok(isShipperDocKind('VAT_CERTIFICATE'));
  assert.ok(!isShipperDocKind('INSURANCE'));
  assert.ok(needsIssuedOn('REGISTER_EXTRACT'));
  assert.ok(!needsIssuedOn('SIGNATORY_AUTHORITY'));
});

test('документы заказчика: названия по стране', () => {
  assert.equal(docNameFor('fi', 'REGISTER_EXTRACT'), 'Kaupparekisteriote (PRH)');
  assert.equal(docNameFor('XX', 'REGISTER_EXTRACT'), null);
  assert.equal(docNameFor(null, 'TAX_DEBT_CERTIFICATE'), null);
  assert.equal(docNameFor('FI', 'SIGNATORY_AUTHORITY'), null);
});
