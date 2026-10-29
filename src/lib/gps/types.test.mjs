/*
 * Общие помощники разбора ответов провайдеров GPS. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coord, iso, normalizePlate, pct, refuelFromLevels, stateFromSpeed } from './types.ts';

test('время: ISO, секунды и миллисекунды Unix', () => {
  assert.equal(iso('2026-10-29T12:00:00Z'), '2026-10-29T12:00:00.000Z');
  assert.equal(iso(1793275200), '2026-10-29T12:00:00.000Z');
  assert.equal(iso(1793275200000), '2026-10-29T12:00:00.000Z');
  assert.equal(iso(''), null);
  assert.equal(iso('мусор'), null);
});

test('координаты: ноль-ноль и вне диапазона — нет точки', () => {
  assert.deepEqual(coord('60.17', 24.94), { lat: 60.17, lon: 24.94 });
  assert.equal(coord(0, 0), null);
  assert.equal(coord(95, 10), null);
});

test('проценты только 0–100', () => {
  assert.equal(pct(55.55), 55.6);
  assert.equal(pct(120), null);
});

test('состояние по скорости и зажиганию', () => {
  assert.equal(stateFromSpeed(60, true), 'MOVING');
  assert.equal(stateFromSpeed(0, true), 'STOPPED');
  assert.equal(stateFromSpeed(0, false), 'PARKED');
  assert.equal(stateFromSpeed(null, null), null);
});

test('заправка по скачку уровня: литры, проценты с баком, шум и езда', () => {
  const before = { litres: 120, pct: null, at: '2026-10-29T10:00:00Z' };
  assert.equal(refuelFromLevels(before, { litres: 480, pct: null, at: '2026-10-29T10:20:00Z', tankL: 600, moving: false }), 360);
  /* 15 % бака в 600 л — 90 л: прибавка 50 л — шум. */
  assert.equal(refuelFromLevels(before, { litres: 170, pct: null, at: '2026-10-29T10:20:00Z', tankL: 600, moving: false }), null);
  /* Едет — не заправка. */
  assert.equal(refuelFromLevels(before, { litres: 480, pct: null, at: '2026-10-29T10:20:00Z', tankL: 600, moving: true }), null);
  /* Только проценты: 20 % → 80 % бака 500 л = 300 л. */
  assert.equal(
    refuelFromLevels({ litres: null, pct: 20, at: '2026-10-29T10:00:00Z' }, { litres: null, pct: 80, at: '2026-10-29T10:30:00Z', tankL: 500, moving: false }),
    300,
  );
  /* Та же точка ещё раз — не заправка. */
  assert.equal(refuelFromLevels(before, { litres: 480, pct: null, at: before.at, tankL: 600, moving: false }), null);
});

test('номер для сравнения', () => {
  assert.equal(normalizePlate('tst-101 '), 'TST101');
});
