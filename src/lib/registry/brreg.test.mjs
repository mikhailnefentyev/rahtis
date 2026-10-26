/*
 * Тесты разбора ответа Enhetsregisteret (Норвегия). Запуск: npm test.
 * Ответ — урезанный настоящий ответ API от 26.10.2026 (923609016, Equinor ASA).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBrreg as evaluate } from './brregVerdict.ts';
import { matchName } from './prh.ts';

const run = (applied, enhet) => evaluate(applied, '923609016', enhet, matchName);
const equinor = () => ({
  navn: 'EQUINOR ASA',
  organisasjonsform: { kode: 'ASA', beskrivelse: 'Allmennaksjeselskap' },
  registreringsdatoEnhetsregisteret: '1995-03-12',
  registrertIForetaksregisteret: true,
  registrertIMvaregisteret: true,
  konkurs: false,
  underAvvikling: false,
  underTvangsavviklingEllerTvangsopplosning: false,
});

test('действующая компания в MVA, то же название — OK', () => {
  const r = run('Equinor ASA', equinor());
  assert.equal(r.verdict, 'OK');
  assert.equal(r.nameMatch, 'EXACT');
  assert.equal(r.vat, true);
  assert.equal(r.form, 'Allmennaksjeselskap');
});

test('нет в реестре или удалена — NOT_FOUND', () => {
  assert.equal(run('Equinor ASA', null).verdict, 'NOT_FOUND');
  assert.equal(run('Equinor ASA', { ...equinor(), slettedato: '2024-01-01' }).verdict, 'NOT_FOUND');
});

test('банкротство, не в MVA, другое название — все замечания', () => {
  const r = run('Nordic Haul AS', { ...equinor(), konkurs: true, registrertIMvaregisteret: false });
  assert.equal(r.verdict, 'ATTENTION');
  assert.equal(r.nameMatch, 'DIFFERENT');
  assert.deepEqual(r.situations, ['Konkurssissa']);
  assert.equal(r.issues.length, 3);
});
