/*
 * Память счётчика меню «Требует действия»: срок жизни и потолок. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTtlMemo, inboxTotalKey } from './memo.ts';

test('значение живёт ровно ttl, потом пропадает', () => {
  const memo = createTtlMemo(60_000, 10);
  memo.set('a', 3, 1_000);
  assert.equal(memo.get('a', 1_000), 3);
  assert.equal(memo.get('a', 60_999), 3);
  assert.equal(memo.get('a', 61_000), undefined);
  assert.equal(memo.get('a', 1_000), undefined, 'устаревшее удалено');
});

test('новая запись обновляет срок и значение', () => {
  const memo = createTtlMemo(60_000, 10);
  memo.set('a', 3, 0);
  memo.set('a', 5, 50_000);
  assert.equal(memo.get('a', 100_000), 5);
  memo.delete('a');
  assert.equal(memo.get('a', 100_000), undefined);
});

test('при переполнении уходят самые старые', () => {
  const memo = createTtlMemo(60_000, 2);
  memo.set('a', 1, 0);
  memo.set('b', 2, 1);
  memo.set('a', 3, 2);
  memo.set('c', 4, 3);
  assert.equal(memo.get('b', 3), undefined);
  assert.equal(memo.get('a', 3), 3);
  assert.equal(memo.get('c', 3), 4);
});

test('ключ различает кабинет', () => {
  assert.notEqual(inboxTotalKey('u1', 'CARRIER'), inboxTotalKey('u1', 'SHIPPER'));
});
