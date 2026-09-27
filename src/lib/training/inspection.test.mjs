/*
 * Тесты практики «Löydä viat». Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFECTS, ROUND_DEFECTS, pickDefects, scoreInspection, severityOf } from './inspection.ts';

test('раунд: четыре разные неисправности, хотя бы одна «ехать нельзя»', () => {
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < 200; i++) {
    const round = pickDefects(random);
    assert.equal(round.length, ROUND_DEFECTS);
    assert.equal(new Set(round).size, ROUND_DEFECTS);
    assert.ok(round.some((id) => severityOf(id) === 'stop'));
  }
});

test('раунд без «stop» после перемешивания получает её', () => {
  /* random() → 0 оставляет порядок, где первые — «stop»; поэтому берём мешалку, выносящую «fix» вперёд. */
  const fixFirst = () => 0.999;
  const round = pickDefects(fixFirst);
  assert.ok(round.some((id) => severityOf(id) === 'stop'));
});

test('счёт: найденные, пропущенные, ложные тревоги', () => {
  const s = scoreInspection(['tread', 'mirror', 'plate', 'airHose'], ['tread', 'plate', 'oilLeak']);
  assert.deepEqual(s.found, ['tread', 'plate']);
  assert.deepEqual(s.missed, ['mirror', 'airHose']);
  assert.deepEqual(s.falseAlarms, ['oilLeak']);
  assert.equal(s.missedStop, true);
});

test('всё найдено — пропусков и ложных тревог нет', () => {
  const round = ['tread', 'mirror', 'plate', 'airHose'];
  const s = scoreInspection(round, round);
  assert.equal(s.missed.length + s.falseAlarms.length, 0);
  assert.equal(s.missedStop, false);
});

test('каталог — 12 мест с уникальными id', () => {
  assert.equal(new Set(DEFECTS.map((d) => d.id)).size, 12);
});
