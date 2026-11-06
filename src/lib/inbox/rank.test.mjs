/*
 * «Требует вашего действия»: порядок пунктов, отложенные, сроки. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareItems, daysUntil, expiresWithin, rankItems, urgencyByDue } from './rank.ts';

const item = (key, urgency, at = null, extra = {}) => ({ key, kind: 'x', urgency, at, href: '#', ...extra });
const now = new Date('2026-11-06T10:00:00Z');

test('сначала срочность, внутри уровня — раньше срок; без срока — в конце уровня', () => {
  const ranked = rankItems(
    [item('c', 2, '2026-11-01'), item('a', 0, '2026-11-10'), item('b', 0, '2026-11-02'), item('d', 0, null), item('e', 1, null)],
    [],
    now,
  );
  assert.deepEqual(ranked.items.map((i) => i.key), ['b', 'a', 'd', 'e', 'c']);
  assert.equal(ranked.total, 5);
});

test('отложенные до будущего скрыты, просроченная отсрочка — нет; дубли ключей выкинуты', () => {
  const ranked = rankItems(
    [item('a', 1), item('b', 1), item('a', 0), item('c', 1)],
    [
      { key: 'b', until: '2026-11-07T00:00:00Z' },
      { key: 'c', until: '2026-11-05T00:00:00Z' },
    ],
    now,
  );
  assert.deepEqual(ranked.items.map((i) => i.key), ['a', 'c']);
  assert.equal(ranked.items[0].urgency, 1, 'первый с ключом остаётся');
});

test('limit режет список, total считает всё', () => {
  const many = Array.from({ length: 30 }, (_, i) => item(`k${String(i).padStart(2, '0')}`, 3));
  const ranked = rankItems(many, [], now, 20);
  assert.equal(ranked.items.length, 20);
  assert.equal(ranked.total, 30);
  assert.equal(rankItems(many, [], now, 0).items.length, 0);
});

test('порядок устойчив при равных', () => {
  assert.equal(compareItems(item('a', 1, '2026-11-06'), item('b', 1, '2026-11-06')) < 0, true);
  assert.equal(compareItems(item('a', 1), item('a', 1)), 0);
});

test('дни до даты — по Хельсинки', () => {
  assert.equal(daysUntil('2026-11-06', now), 0);
  assert.equal(daysUntil('2026-11-09', now), 3);
  assert.equal(daysUntil('2026-11-01T08:00:00Z', now), -5);
  /* 23:30 UTC 6.11 — в Хельсинки уже 7.11. */
  assert.equal(daysUntil('2026-11-07', new Date('2026-11-06T23:30:00Z')), 0);
});

test('срочность по сроку: прошёл — 0, сегодня-завтра — 1, в окне — 2, дальше — 3', () => {
  assert.equal(urgencyByDue('2026-11-05', now), 0);
  assert.equal(urgencyByDue('2026-11-06', now), 1);
  assert.equal(urgencyByDue('2026-11-07', now), 1);
  assert.equal(urgencyByDue('2026-11-12', now), 2);
  assert.equal(urgencyByDue('2026-11-20', now), 3);
  assert.equal(urgencyByDue('2026-11-20', now, 30), 2);
  assert.equal(urgencyByDue(null, now), 3);
});

test('истекает в окне', () => {
  assert.equal(expiresWithin('2026-12-01', 30, now), true);
  assert.equal(expiresWithin('2026-12-10', 30, now), false);
  assert.equal(expiresWithin('2026-10-01', 30, now), true);
  assert.equal(expiresWithin(null, 30, now), false);
});
