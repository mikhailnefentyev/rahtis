/*
 * Тесты интервального повторения тренажёра. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerCard, buildRound, dueCount, freshness, mergeProgress, newerThan } from './leitner.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-27T09:00:00Z');
const keys = Array.from({ length: 19 }, (_, i) => `tacho.q${i + 1}`);
const fixed = () => 0;

test('верный ответ двигает по коробкам 1/3/7/16/35 дней', () => {
  let card;
  const intervals = [];
  for (let i = 0; i < 6; i++) {
    card = answerCard(card, true, NOW);
    intervals.push((card.due - NOW) / DAY);
  }
  /* Первая коробка — 0 дней: только что выученное проверяется в следующем раунде. */
  assert.deepEqual(intervals, [1, 3, 7, 16, 35, 35]);
  assert.equal(card.right, 6);
});

test('ошибка возвращает в первую коробку и сразу к повтору', () => {
  const learned = answerCard(answerCard(undefined, true, NOW), true, NOW);
  const card = answerCard(learned, false, NOW);
  assert.equal(card.box, 1);
  assert.equal(card.due, NOW);
  assert.equal(card.wrong, 1);
  assert.equal(dueCount(['k'], { k: card }, NOW), 1);
});

test('первый раунд — восемь новых вопросов', () => {
  const round = buildRound(keys, {}, NOW, fixed);
  assert.equal(round.length, 8);
  assert.deepEqual(round, keys.slice(0, 8));
});

test('ошибки прошлого раунда возвращаются в следующем, верные — нет', () => {
  const progress = {};
  const first = buildRound(keys, progress, NOW, fixed);
  first.forEach((key, i) => {
    progress[key] = answerCard(undefined, i % 2 === 0, NOW);
  });

  const second = buildRound(keys, progress, NOW + 60_000, fixed);
  const wrong = first.filter((_, i) => i % 2 !== 0);
  const right = first.filter((_, i) => i % 2 === 0);

  for (const key of wrong) assert.ok(second.includes(key), `${key} должна вернуться`);
  for (const key of right) assert.ok(!second.includes(key), `${key} ждёт интервала`);
  assert.equal(second.length, 8);
});

test('верная карточка возвращается, когда подошёл интервал', () => {
  const progress = { [keys[0]]: answerCard(undefined, true, NOW) };
  assert.equal(dueCount(keys, progress, NOW + DAY - 1), 0);
  assert.equal(dueCount(keys, progress, NOW + DAY), 1);
});

test('всё выучено и новых нет — раунд из шести, а не пустой', () => {
  const few = keys.slice(0, 7);
  const progress = Object.fromEntries(few.map((key) => [key, answerCard(undefined, true, NOW)]));
  assert.equal(buildRound(few, progress, NOW, fixed).length, 6);
});

test('свежесть: 0 без ответов, растёт с коробкой и тает без повторения', () => {
  assert.equal(freshness(keys, {}, NOW), 0);

  let card;
  for (let i = 0; i < 5; i++) card = answerCard(card, true, NOW);
  const one = ['k'];
  assert.equal(freshness(one, { k: card }, NOW), 100);

  const later = freshness(one, { k: card }, card.due + 20 * DAY);
  assert.ok(later < 100 && later >= 30, `свежесть через 20 дней после срока: ${later}`);
  assert.equal(freshness(one, { k: card }, card.due + 400 * DAY), 30);
});

test('слияние устройств: побеждает более поздний ответ', () => {
  const old = answerCard(undefined, true, NOW);
  const recent = answerCard(undefined, false, NOW + 1000);
  const merged = mergeProgress({ a: old, b: recent }, { a: recent, b: old, c: old });
  assert.deepEqual(merged, { a: recent, b: recent, c: old });
  assert.deepEqual(newerThan({ a: old, b: recent }, { a: recent, b: old }), { b: recent });
});
