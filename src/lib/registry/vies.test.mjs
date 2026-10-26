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

test('формы компаний других стран не делают название «чужим» (прогон 26.10.2026)', () => {
  const same = [
    ['ORLEN S.A.', 'ORLEN SPÓŁKA AKCYJNA', 'PL7740001454'],
    ['Latvenergo AS', 'Akciju sabiedrība "Latvenergo"', 'LV40003032949'],
    ['Volvo AB', 'Aktiebolaget Volvo', 'SE556012579001'],
    ['A.P. Møller - Mærsk A/S', 'A.P. MØLLER - MÆRSK A/S', 'DK22756214'],
    ['Eesti Energia AS', 'Eesti Energia AS (Representative of VAT Group)', 'EE100366327'],
    ['Baltic Cargo UAB', 'UAB "BALTIC CARGO"', 'LT100000000000'],
    ['Trans-Pol Sp. z o.o.', 'TRANS-POL SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', 'PL5260250995'],
    ['Põhja Vedu OÜ', 'OSAÜHING PÕHJA VEDU', 'EE100000001'],
  ];
  for (const [applied, registered, vat] of same) {
    const r = evaluateVies(applied, vat, { isValid: true, userError: 'VALID', name: registered });
    assert.equal(r.nameMatch, 'EXACT', `${applied} ~ ${registered}`);
    assert.equal(r.verdict, 'OK');
  }
});

test('неверный формат номера — NOT_FOUND, а не «реестр молчит»', () => {
  const r = evaluateVies('Firma', 'PL123', { isValid: false, userError: 'INVALID_INPUT' });
  assert.equal(r.verdict, 'NOT_FOUND');
});
