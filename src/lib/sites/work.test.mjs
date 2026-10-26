/*
 * Часы дня на объекте и сумма. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayEnd, dayMinutes, hoursLabel, material, siteAmountCents, wasteCodeLabel } from './work.ts';

const day = {
  arrivedAt: '2026-10-26T04:30:00.000Z', // 7:30 по Хельсинки
  endedAt: null,
  bufferMinutes: 30,
  unloads: ['2026-10-26T09:10:00.000Z', '2026-10-26T13:45:00.000Z', '2026-10-26T11:20:00.000Z'],
};

test('конец дня — последняя выгрузка + 30 минут', () => {
  assert.equal(dayEnd(day), '2026-10-26T14:15:00.000Z');
  assert.equal(dayMinutes(day), 585);
  assert.equal(hoursLabel(585), '9:45');
});

test('«закончил» позже запаса продлевает день, раньше — не съедает запас; без рейсов дня нет конца', () => {
  assert.equal(dayEnd({ ...day, endedAt: '2026-10-26T15:00:00.000Z' }), '2026-10-26T15:00:00.000Z');
  assert.equal(dayEnd({ ...day, endedAt: '2026-10-26T13:46:00.000Z' }), '2026-10-26T14:15:00.000Z');
  assert.equal(dayEnd({ ...day, unloads: [], endedAt: '2026-10-26T12:00:00.000Z' }), '2026-10-26T12:00:00.000Z');
  assert.equal(dayEnd({ ...day, unloads: [] }), null);
  assert.equal(dayMinutes({ ...day, unloads: [] }), null);
});

test('сумма: часы, рейсы, тонны', () => {
  const totals = { minutes: 585, loads: 12, netKg: 412_300 };
  assert.equal(siteAmountCents('HOUR', 9500, totals), 92_625);
  assert.equal(siteAmountCents('LOAD', 8000, totals), 96_000);
  assert.equal(siteAmountCents('TONNE', 250, totals), 103_075);
});

test('коды отходов', () => {
  assert.equal(wasteCodeLabel('170504'), '17 05 04');
  assert.equal(wasteCodeLabel('SORA'), 'SORA');
  assert.equal(material('170503')?.registry, true);
  assert.equal(material('170504')?.registry, false);
  assert.equal(material('SORA')?.waste, false);
});
