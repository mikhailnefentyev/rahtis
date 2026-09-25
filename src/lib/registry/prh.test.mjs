/*
 * Тесты сверки с реестром PRH. Запуск: npm test.
 *
 * Ответы — урезанные настоящие ответы API от 25.09.2026 (Aivomaa Oy),
 * с правками там, где нужен другой исход.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, matchName, normalizeName } from './prh.ts';

const text = (description) => [{ languageCode: '1', description }];

const aivomaa = () => ({
  names: [{ name: 'Aivomaa Oy', type: '1', endDate: null }],
  companyForms: [{ descriptions: text('Osakeyhtiö'), endDate: null }],
  companySituations: [],
  registrationDate: '2026-01-20',
  status: '2',
  registeredEntries: [
    { register: '1', type: '0', endDate: '2026-01-20', descriptions: text('Rekisteröimätön') },
    { register: '1', type: '1', endDate: null, descriptions: text('Rekisterissä') },
    { register: '4', type: '1', endDate: null, descriptions: text('Rekisterissä') },
    { register: '5', type: '55', endDate: null, descriptions: text('Rekisterissä') },
    { register: '6', type: '80', endDate: null, descriptions: text('Liiketoiminnasta arvonlisäverovelvollinen') },
    { register: '7', type: '41', endDate: null, descriptions: text('Rekisterissä') },
  ],
});

test('название сравнивается без формы и знаков, но с ä и ö', () => {
  assert.equal(normalizeName('AIVOMAA OY.'), 'aivomaa');
  assert.equal(matchName('Aivomaa', ['Aivomaa Oy']), 'EXACT');
  assert.equal(matchName('Aivomaa Logistics', ['Aivomaa Oy']), 'SIMILAR');
  assert.equal(matchName('Mäkelä Oy', ['Makela Oy']), 'DIFFERENT');
});

test('всё совпало — OK, без замечаний', () => {
  const r = evaluate('Aivomaa Oy', [aivomaa()], new Date('2026-09-25T10:00:00Z'));
  assert.equal(r.verdict, 'OK');
  assert.deepEqual(r.issues, []);
  assert.equal(r.officialName, 'Aivomaa Oy');
  assert.equal(r.form, 'Osakeyhtiö');
  assert.equal(r.tradeRegister, true);
  assert.equal(r.prepayment, true);
  assert.equal(r.vat, true);
});

test('не найдено — NOT_FOUND с подсказкой про toiminimi', () => {
  const r = evaluate('Tommi Uusitalo', []);
  assert.equal(r.verdict, 'NOT_FOUND');
  assert.match(r.issues[0], /Toiminimet/);
});

test('чужое название — ATTENTION с именем из реестра', () => {
  const r = evaluate('Kuljetus Virtanen Oy', [aivomaa()]);
  assert.equal(r.verdict, 'ATTENTION');
  assert.equal(r.nameMatch, 'DIFFERENT');
  assert.match(r.issues[0], /Aivomaa Oy/);
});

test('ликвидация и выход из ennakkoperintä и ALV — все замечания', () => {
  const c = aivomaa();
  c.companySituations = [{ type: 'SELTILA', endDate: null }];
  c.registeredEntries = c.registeredEntries.map((e) =>
    e.register === '5' || e.register === '6' ? { ...e, endDate: '2026-06-01' } : e,
  );
  const r = evaluate('Aivomaa Oy', [c]);
  assert.equal(r.verdict, 'ATTENTION');
  assert.deepEqual(r.situations, ['Selvitystilassa']);
  assert.equal(r.prepayment, false);
  assert.equal(r.vat, false);
  assert.equal(r.issues.length, 3);
});

test('закрытая запись «Rekisteröimätön» не отменяет действующую', () => {
  const r = evaluate('Aivomaa Oy', [aivomaa()]);
  assert.equal(r.tradeRegister, true);
});
