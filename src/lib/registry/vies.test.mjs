/*
 * Тесты разбора ответа VIES. Запуск: npm test.
 *
 * Ответы — по образцу настоящих ответов REST API VIES от 21.10.2026
 * (FI35929936 — Aivomaa Oy; EE100000000 — недействительный номер).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateVies as evaluate } from './viesVerdict.ts';
import { matchName } from './prh.ts';

const evaluateVies = (applied, vat, r) => evaluate(applied, vat, r, matchName);

test('действующий номер и то же название — OK', () => {
  const r = evaluateVies('Aivomaa Oy', 'FI35929936', { isValid: true, userError: 'VALID', name: 'Aivomaa Oy', address: 'Kankarepolku 5 B 335\n00770 HELSINKI' });
  assert.equal(r.verdict, 'OK');
  assert.equal(r.vat, true);
  assert.equal(r.officialName, 'Aivomaa Oy');
});

test('недействительный номер — NOT_FOUND', () => {
  const r = evaluateVies('Some Firma OÜ', 'EE100000000', { isValid: false, userError: 'INVALID', name: '---', address: '---' });
  assert.equal(r.verdict, 'NOT_FOUND');
  assert.equal(r.vat, false);
});

test('страна не отдаёт название (Германия) — ATTENTION, оператор сверяет сам', () => {
  const r = evaluateVies('Nord Transport GmbH', 'DE136695976', { isValid: true, userError: 'VALID', name: '---', address: '---' });
  assert.equal(r.verdict, 'ATTENTION');
  assert.equal(r.officialName, null);
  assert.match(r.issues[0], /nimi/);
});

test('другое название — ATTENTION с названием из реестра', () => {
  const r = evaluateVies('Baltic Haulage SIA', 'LV40003032949', { isValid: true, userError: 'VALID', name: 'AS "LATVENERGO"' });
  assert.equal(r.verdict, 'ATTENTION');
  assert.equal(r.nameMatch, 'DIFFERENT');
});

test('сервис страны недоступен — ERROR, а не «не найдено»', () => {
  const r = evaluateVies('Firma Sp. z o.o.', 'PL5260250995', { isValid: false, userError: 'MS_UNAVAILABLE' });
  assert.equal(r.verdict, 'ERROR');
});
