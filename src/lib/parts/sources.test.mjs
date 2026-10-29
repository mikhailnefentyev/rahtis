/*
 * Ссылки на поставщиков запчастей и шин по странам. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BREAKDOWN, PARTS_COUNTRIES, base64, normalTyreSize, parseTyreSize, partsCountry, partsSources, quoteRequestText } from './sources.ts';

const find = (list, id) => list.find((s) => s.id === id);

test('страна: известная — как есть, иначе Финляндия', () => {
  assert.equal(partsCountry('lt'), 'LT');
  assert.equal(partsCountry('DK'), 'FI');
  assert.equal(partsCountry(null), 'FI');
});

test('размер шины в любом написании', () => {
  assert.deepEqual(parseTyreSize('315/80R22.5'), { width: '315', profile: '80', rim: '22.5' });
  assert.equal(normalTyreSize('315/80 R 22,5'), '315/80R22.5');
  assert.equal(normalTyreSize('385/65r22.5'), '385/65R22.5');
  assert.equal(parseTyreSize('jarrulevy'), null);
});

test('Inter Cars в Прибалтике: запрос Base64 в пути', () => {
  assert.equal(base64('21620181'), 'MjE2MjAxODE=');
  const ee = partsSources({ query: '21620181', make: null, plate: null, country: 'EE' });
  assert.equal(find(ee, 'ic-ee').url, 'https://www.intercars24.ee/autoosad/search=MjE2MjAxODE=');
  const lv = partsSources({ query: '315/80 R22,5', make: null, plate: null, country: 'LV', mode: 'TYRES' });
  assert.equal(find(lv, 'ic-lv-t').url, 'https://www.ic24.lv/detalas/search=MzE1LzgwUjIyLjU=');
});

test('Oponeo: размер в адресе, без размера — раздел грузовых шин', () => {
  const ok = partsSources({ query: '315/80R22.5', make: null, plate: null, country: 'PL', mode: 'TYRES' });
  assert.equal(find(ok, 'oponeo').url, 'https://www.oponeo.pl/opony/ciezarowe/315-80-r22-5');
  const none = partsSources({ query: 'Michelin X Line', make: null, plate: null, country: 'PL', mode: 'TYRES' });
  assert.equal(find(none, 'oponeo').url, 'https://www.oponeo.pl/opony/ciezarowe');
});

test('у каждой страны есть запчасти, шины, Google и круглосуточный номер', () => {
  for (const country of PARTS_COUNTRIES) {
    const parts = partsSources({ query: '21620181', make: 'Volvo FH', plate: null, country });
    const tyres = partsSources({ query: '315/80R22.5', make: null, plate: null, country, mode: 'TYRES' });
    assert.ok(parts.length >= 4, country);
    assert.ok(tyres.length >= 2, country);
    assert.ok(find(parts, 'dealer-VOLVO'), country);
    assert.ok(!find(tyres, 'dealer-VOLVO'), country);
    assert.ok(BREAKDOWN[country].length >= 1, country);
    for (const s of [...parts, ...tyres]) assert.match(s.url, /^https:\/\//, `${country} ${s.id}`);
  }
});

test('Google — словом страны', () => {
  const de = partsSources({ query: '21620181', make: null, plate: null, country: 'DE' });
  assert.match(decodeURIComponent(find(de, 'web').url), /21620181 Ersatzteil/);
});

test('запрос цены на языке страны поставщика', () => {
  const pl = quoteRequestText({ query: '315/80 r22,5', make: null, plate: 'TST-101', company: 'Oy', note: '', country: 'PL', mode: 'TYRES' });
  assert.match(pl, /^Zapytanie ofertowe: 315\/80R22\.5/);
  assert.match(pl, /Pojazd: TST-101/);
  const fi = quoteRequestText({ query: '21620181', make: 'Volvo', plate: null, company: 'Oy', note: 'kiire' });
  assert.match(fi, /^Tarjouspyyntö: 21620181/);
});

test('Inter Cars в Финляндии — эстонский магазин с доставкой 1–2 дня', () => {
  const parts = partsSources({ query: '21620181', make: null, plate: null, country: 'FI' });
  const tyres = partsSources({ query: '315/80R22.5', make: null, plate: null, country: 'FI', mode: 'TYRES' });
  assert.equal(find(parts, 'ic-fi').url, 'https://www.intercars24.ee/autoosad/search=MjE2MjAxODE=');
  assert.equal(find(parts, 'ic-fi').deliveryDays, '1–2');
  assert.equal(find(tyres, 'ic-fi-t').url, 'https://www.intercars24.ee/autoosad/search=MzE1LzgwUjIyLjU=');
});

test('Швеция и Норвегия: поиск по номеру у главных поставщиков', () => {
  const se = partsSources({ query: '21620181', make: null, plate: null, country: 'SE' });
  const no = partsSources({ query: '21620181', make: null, plate: null, country: 'NO' });
  assert.equal(find(se, 'rydahls').url, 'https://www.rydahlsreservdelar.se/search?q=21620181');
  assert.equal(find(no, 'vdlparts').url, 'https://www.vdlparts.no/search?q=21620181');
  assert.match(quoteRequestText({ query: '21620181', make: null, plate: null, company: 'Oy', note: '', country: 'NO' }), /^Tilbudsforespørsel: 21620181/);
});
