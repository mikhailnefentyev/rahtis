/*
 * Документ на рейс по стране объекта. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE_COUNTRIES, wasteDocFor } from './wasteDocs.ts';

test('Финляндия, Дания — печатаем сами', () => {
  assert.equal(wasteDocFor('FI', false, '2026-10-26').mode, 'PRINT');
  assert.equal(wasteDocFor('FI', true, '2026-10-26').title, 'Siirtoasiakirja');
  assert.equal(wasteDocFor('DK', true, '2026-10-26').mode, 'PRINT');
});

test('Польша, Литва, Латвия — только госсистема, даже для чистого грунта', () => {
  for (const c of ['PL', 'LT', 'LV']) {
    const doc = wasteDocFor(c, false, '2026-10-26');
    assert.equal(doc.mode, 'STATE', c);
    assert.ok(doc.state?.name, c);
  }
  assert.equal(wasteDocFor('PL', false, '2026-10-26').state.name, 'BDO');
});

test('Германия и Норвегия: госсистема только для опасного', () => {
  assert.equal(wasteDocFor('DE', false, '2026-10-26').mode, 'PRINT');
  assert.equal(wasteDocFor('DE', true, '2026-10-26').state.name, 'eANV (ZKS-Abfall)');
  assert.equal(wasteDocFor('NO', false, '2026-10-26').mode, 'PRINT');
  assert.equal(wasteDocFor('NO', true, '2026-10-26').mode, 'STATE');
});

test('Швеция: документ печатаем; для опасного — напоминание про Avfallsregistret', () => {
  assert.equal(wasteDocFor('SE', true, '2026-10-26').mode, 'PRINT');
  assert.match(wasteDocFor('SE', true, '2026-10-26').note.local, /avfallsregister/);
  assert.doesNotMatch(wasteDocFor('SE', false, '2026-10-26').note.local, /avfallsregister/);
});

test('Эстония: обычный грунт — до 2027 без saatekiri, с 01.01.2027 только PISTRIK', () => {
  assert.equal(wasteDocFor('EE', false, '2026-12-31').mode, 'PRINT');
  assert.equal(wasteDocFor('EE', false, '2027-01-01').mode, 'STATE');
  assert.equal(wasteDocFor('EE', true, '2026-10-26').mode, 'STATE');
});

test('у каждой страны есть подписи всех строк', () => {
  for (const c of SITE_COUNTRIES) {
    const { labels } = wasteDocFor(c, false, '2026-10-26');
    for (const [k, v] of Object.entries(labels)) assert.ok(v && v.length > 1, `${c}.${k}`);
  }
});
