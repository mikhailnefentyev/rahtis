/*
 * Вход суточных из смен и правок дня. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowanceDayInputs, countryChoices, fullMonths, groupDaysBySet, normalizeMeals } from './allowanceDays.ts';

const dayOf = (iso) => iso.slice(0, 10);

test('длительность дня — от первой смены до конца последней, с перерывом между ними', () => {
  const rows = allowanceDayInputs({
    dates: ['2026-03-02'],
    shifts: [
      { start: '2026-03-02T05:00:00Z', end: '2026-03-02T09:00:00Z' },
      { start: '2026-03-02T11:00:00Z', end: '2026-03-02T18:30:00Z' },
    ],
    dayOf,
    facts: new Map(),
    auto: new Map([['2026-03-02', 'se']]),
    now: 0,
  });
  assert.equal(rows[0].spanMinutes, 13 * 60 + 30);
  assert.equal(rows[0].country, 'SE');
  assert.equal(rows[0].source, 'auto');
  assert.equal(rows[0].night, null);
});

test('правка перевозчика главнее точек рейсов; пустая правка — снова автоматически', () => {
  const rows = allowanceDayInputs({
    dates: ['2026-03-03', '2026-03-02'],
    shifts: [],
    dayOf,
    facts: new Map([
      ['2026-03-02', { country: 'DE', night: 'CAB', meals: 'DB' }],
      ['2026-03-03', { country: null, night: 'XX', meals: null }],
    ]),
    auto: new Map([
      ['2026-03-02', 'PL'],
      ['2026-03-03', 'PL'],
    ]),
    now: 0,
  });
  assert.deepEqual(
    rows.map((r) => [r.date, r.country, r.source, r.night, r.meals, r.spanMinutes]),
    [
      ['2026-03-02', 'DE', 'manual', 'CAB', 'BD', 0],
      ['2026-03-03', 'PL', 'auto', null, null, 0],
    ],
  );
});

test('открытая смена — до now; без страны — null', () => {
  const [row] = allowanceDayInputs({
    dates: ['2026-03-02'],
    shifts: [{ start: '2026-03-02T06:00:00Z', end: null }],
    dayOf,
    facts: new Map(),
    auto: new Map(),
    now: Date.parse('2026-03-02T08:00:00Z'),
  });
  assert.equal(row.spanMinutes, 120);
  assert.equal(row.country, null);
  assert.equal(row.source, null);
});

test('набор суточных дня — у профиля, действующего в этот день', () => {
  const groups = groupDaysBySet(['2026-03-01', '2026-03-10', '2026-03-20', '2026-02-27'], [
    { validFrom: '2026-03-15', setId: 'B' },
    { validFrom: '2026-03-01', setId: 'A' },
    { validFrom: '2026-03-05', setId: null },
  ]);
  assert.deepEqual([...groups.entries()], [
    ['A', ['2026-03-01']],
    ['B', ['2026-03-20']],
  ]);
});

test('полные месяцы периода', () => {
  assert.deepEqual(fullMonths('2026-01-01', '2026-03-31'), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(fullMonths('2026-01-02', '2026-03-30'), ['2026-02']);
  assert.deepEqual(fullMonths('2025-12-01', '2026-01-31'), ['2025-12', '2026-01']);
  assert.deepEqual(fullMonths('2026-03-01', '2026-03-15'), []);
});

test('питание и выбор стран', () => {
  assert.equal(normalizeMeals('dlb'), 'BLD');
  assert.equal(normalizeMeals(''), null);
  const { first, rest } = countryChoices('pl');
  assert.equal(first[0], 'PL');
  assert.ok(first.includes('DE'));
  assert.ok(!rest.includes('PL') && rest.includes('FI'));
});
