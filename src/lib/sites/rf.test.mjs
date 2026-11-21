import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finnishReference, paymentReference, rfReference } from './invoice.ts';

test('RF-ссылка из финской: пример Finanssiala 2348236 → RF332348236', () => {
  assert.equal(finnishReference('234823'), '2348236');
  assert.equal(rfReference('234823'), 'RF332348236');
});

test('ссылка по стране продавца: FI — viitenumero, остальные — RF', () => {
  assert.equal(paymentReference('2026-0009', 'FI'), finnishReference('2026-0009'));
  assert.match(paymentReference('2026-0009', 'RO'), /^RF\d{2}\d+$/);
});
