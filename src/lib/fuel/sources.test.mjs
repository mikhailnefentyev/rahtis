/*
 * Три источника заправок: отчёт, водитель, спутник. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceSeries, sourceSpread } from './fuel.ts';

const row = (over) => ({
  product: 'DIESEL',
  qty_report: null,
  qty_driver: null,
  qty_telematics: null,
  ...over,
});

test('нарастающий итог по дням у каждого источника отдельно', () => {
  const { days, lines, unit } = sourceSeries(
    [
      row({ filled_at: '2026-10-03T06:42:00+03:00', qty_report: 412.35, qty_driver: 410 }),
      row({ filled_at: '2026-10-09T18:15:00+03:00', qty_report: 398.1 }),
      row({ filled_at: '2026-10-09T18:15:00+03:00', product: 'ADBLUE', qty_report: 38 }),
    ],
    '2026-10',
  );
  assert.equal(days.length, 31);
  assert.equal(unit, 'l');
  assert.equal(lines.IMPORT[1], 0);
  assert.equal(lines.IMPORT[2], 412.4);
  assert.equal(lines.IMPORT[8], 810.5);
  assert.equal(lines.IMPORT[30], 810.5);
  /* Водитель внёс только первую заправку — линия отстаёт, AdBlue не считается. */
  assert.equal(lines.DRIVER[30], 410);
  assert.equal(lines.TELEMATICS, null);
});

test('день — по Хельсинки: заправка в 01:30 по Хельсинки ложится на свой день', () => {
  const { lines } = sourceSeries([row({ filled_at: '2026-10-04T22:30:00Z', qty_driver: 100 })], '2026-10');
  assert.equal(lines.DRIVER[3], 0);
  assert.equal(lines.DRIVER[4], 100);
});

test('текущий месяц обрезается сегодняшним днём', () => {
  const { days } = sourceSeries([], '2026-10', '2026-10-29');
  assert.equal(days.length, 29);
  assert.equal(days.at(-1), '2026-10-29');
});

test('газовый парк — линии в килограммах', () => {
  const { unit, lines } = sourceSeries([row({ filled_at: '2026-10-05T08:00:00Z', product: 'LNG', qty_telematics: 160 })], '2026-10');
  assert.equal(unit, 'kg');
  assert.equal(lines.TELEMATICS.at(-1), 160);
});

test('расхождение одной заправки', () => {
  assert.equal(sourceSpread(row({ qty_report: 400 })), null);
  assert.equal(sourceSpread(row({ qty_report: 400, qty_driver: 400 })), 0);
  assert.equal(sourceSpread(row({ qty_report: 400, qty_telematics: 360 })), 0.1);
});
