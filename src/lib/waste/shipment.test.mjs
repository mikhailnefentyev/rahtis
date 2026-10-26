/*
 * Правила перевозки отходов обычным рейсом. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nationalSystem, normalizeEwc, suggestedBasel, wasteIssues } from './shipment.ts';

test('код отхода: пробелы и звёздочка', () => {
  assert.equal(normalizeEwc('15 01 01'), '150101');
  assert.equal(normalizeEwc('17 05 03*'), '170503*');
  assert.equal(normalizeEwc('1501'), null);
});

test('базельский код для частой упаковки', () => {
  assert.equal(suggestedBasel('150101'), 'B3020');
  assert.equal(suggestedBasel('150102'), 'EU3011');
  assert.equal(suggestedBasel('150106'), null);
});

test('Приложение VII: смешанная упаковка и опасное — нужна нотификация', () => {
  assert.deepEqual(wasteIssues('ANNEX_VII', '150101', ['PL', 'DE']), []);
  assert.ok(wasteIssues('ANNEX_VII', '150106', ['PL', 'DE']).includes('MIXED_NEEDS_NOTIFICATION'));
  assert.ok(wasteIssues('ANNEX_VII', '170503*', ['PL', 'DE']).includes('HAZARDOUS_NEEDS_NOTIFICATION'));
  assert.ok(wasteIssues('ANNEX_VII', '150102', ['PL', 'DE']).includes('PLASTIC_MUST_BE_CLEAN'));
});

test('Приложение VII внутри одной страны и «внутренняя» через границу — ошибка процедуры', () => {
  assert.ok(wasteIssues('ANNEX_VII', '150101', ['DE', 'DE']).includes('NOT_CROSS_BORDER'));
  assert.ok(wasteIssues('DOMESTIC', '150101', ['PL', 'DE']).includes('CROSS_BORDER_NOT_DOMESTIC'));
  assert.deepEqual(wasteIssues('REUSE', null, ['PL', 'DE']), []);
});

test('национальные системы: Польша на всё, Германия только опасное, Эстония с 2027 на всё', () => {
  assert.equal(nationalSystem('PL', '2026-10-26').scope, 'ALL');
  assert.equal(nationalSystem('DE', '2026-10-26').scope, 'HAZARDOUS');
  assert.equal(nationalSystem('EE', '2026-12-31').scope, 'HAZARDOUS');
  assert.equal(nationalSystem('EE', '2027-01-01').scope, 'ALL');
  assert.equal(nationalSystem('DK', '2026-10-26').scope, 'NONE');
});
