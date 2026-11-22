/*
 * Выборка страницами и `.in()` по частям. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunks, fetchAll, fetchIn } from './paging.ts';

const table = Array.from({ length: 2500 }, (_, i) => i);
const page = (from, to) => Promise.resolve({ data: table.slice(from, to + 1), error: null });

test('страницы: все строки, а не первая тысяча', async () => {
  const { data, error } = await fetchAll(page);
  assert.equal(error, null);
  assert.equal(data.length, 2500);
  assert.equal(data[2499], 2499);
});

test('страницы: ровно полная последняя страница и пустая выборка', async () => {
  const exact = await fetchAll((from, to) => Promise.resolve({ data: table.slice(0, 2000).slice(from, to + 1), error: null }));
  assert.equal(exact.data.length, 2000);
  const empty = await fetchAll(() => Promise.resolve({ data: null, error: null }));
  assert.deepEqual(empty, { data: [], error: null });
});

test('страницы: ошибка второй страницы — ошибка всей выборки', async () => {
  const { data, error } = await fetchAll((from, to) =>
    Promise.resolve(from === 0 ? { data: table.slice(from, to + 1), error: null } : { data: null, error: { message: 'timeout' } }),
  );
  assert.equal(error.message, 'timeout');
  assert.equal(data.length, 0);
});

test('страницы: предохранитель от бесконечной выборки', async () => {
  const { error } = await fetchAll(() => Promise.resolve({ data: [1, 2], error: null }), 2, 3);
  assert.ok(error);
});

test('список по частям', async () => {
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunks([], 2), []);
  const calls = [];
  const all = await fetchIn(
    [1, 2, 3, 4, 5],
    (part) => {
      calls.push(part.length);
      return Promise.resolve({ data: part.map((x) => x * 10), error: null });
    },
    2,
  );
  assert.deepEqual(all.data, [10, 20, 30, 40, 50]);
  assert.deepEqual(calls, [2, 2, 1]);
  const failed = await fetchIn(
    [1, 2, 3],
    (part) => Promise.resolve(part[0] === 3 ? { data: null, error: { message: 'x' } } : { data: part, error: null }),
    2,
  );
  assert.equal(failed.error.message, 'x');
  assert.equal(failed.data.length, 0);
});
