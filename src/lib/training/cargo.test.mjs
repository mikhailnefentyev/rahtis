/*
 * Тесты расчёта крепления груза (практика «Закрепи груз»). Запуск: npm test.
 *
 * Случаи — из задания на модуль (docs/training, п. 7а): вперёд / вбок / назад.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcCargoSecuring } from './cargo.ts';

const base = { position: 'gap', base: 'wood', angle: 90, edges: true, labels: 'ok', straps: 6 };
const calc = (patch) => calcCargoSecuring({ ...base, ...patch });
const triple = (r) => [r.forward, r.sideways, r.backward];
const errors = (r) => r.findings.filter((f) => f.level === 'error').map((f) => f.code);

test('зазор, дерево, 30° → 20 / 3 / 3', () => {
  assert.deepEqual(triple(calc({ angle: 30 })), [20, 3, 3]);
});

test('зазор, дерево, 90° → 10 / 2 / 2', () => {
  assert.deepEqual(triple(calc({ angle: 90 })), [10, 2, 2]);
});

test('зазор, коврик, 90° → 5 / 0 / 0', () => {
  assert.deepEqual(triple(calc({ base: 'mat' })), [5, 0, 0]);
});

test('вплотную, дерево, 90° → борт / 2 / 2', () => {
  assert.deepEqual(triple(calc({ position: 'blocked' })), [null, 2, 2]);
});

test('вплотную, коврик, любой угол → борт / 0 / 0', () => {
  for (const angle of [30, 45, 60, 90]) {
    assert.deepEqual(triple(calc({ position: 'blocked', base: 'mat', angle })), [null, 0, 0], `угол ${angle}°`);
  }
});

test('ремень без этикетки — ошибка, даже когда ремней хватает', () => {
  const r = calc({ position: 'blocked', base: 'mat', straps: 4, labels: 'missing' });
  assert.equal(r.required, 0);
  assert.deepEqual(errors(r), ['unlabelled']);
});

test('0 ремней при расчёте 0 — ошибка: без крепления ехать нельзя', () => {
  const r = calc({ position: 'blocked', base: 'mat', straps: 0 });
  assert.deepEqual(errors(r), ['no_straps']);
});

test('ремней меньше расчёта — ошибка с самым трудным направлением', () => {
  const r = calc({ angle: 30, straps: 12 });
  const tooFew = r.findings.find((f) => f.code === 'too_few');
  assert.deepEqual([tooFew.required, tooFew.used, tooFew.direction], [20, 12, 'forward']);
});

test('всё верно — первой строкой «ok», предупреждений нет', () => {
  const r = calc({ position: 'blocked', straps: 2 });
  assert.deepEqual(
    r.findings.map((f) => f.code),
    ['ok'],
  );
});

test('зазор, пологий ремень и без уголков — три предупреждения', () => {
  const r = calc({ angle: 30, edges: false, straps: 20 });
  assert.deepEqual(
    r.findings.filter((f) => f.level === 'warn').map((f) => f.code),
    ['gap', 'shallow_angle', 'no_edges'],
  );
});
