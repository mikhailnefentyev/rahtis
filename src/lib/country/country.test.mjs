/*
 * Тесты пакетов стран. Запуск: npm test.
 *
 * Номера — настоящие номера известных компаний (открытые реестры): если
 * алгоритм контрольной цифры написан с ошибкой, настоящая компания не
 * сможет подать заявку, и тест это поймает раньше неё.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBusinessId, COUNTRY_PACKS, countryPack, stopTimeZone, vatNumberFor } from './index.ts';

const REAL = {
  FI: ['3592993-6', '0112038-9'], // Aivomaa Oy, Nokia Oyj
  SE: ['556012-5790', '5560125790'], // AB Volvo (с дефисом и без)
  NO: ['923609016'], // Equinor ASA
  DK: ['22756214'], // A.P. Møller - Mærsk A/S
  EE: ['10238429'], // AS Tallink Grupp
  LV: ['40003032949'], // AS Latvenergo
  LT: ['110053842'], // AB Lietuvos geležinkeliai
  PL: ['5260250995', '526-025-09-95'], // номер из белого списка Минфина; с дефисами тоже
  DE: ['136695976', 'DE 136 695 976'], // USt-IdNr. из примеров VIES
};

test('настоящие номера компаний проходят проверку', () => {
  for (const [country, ids] of Object.entries(REAL)) {
    for (const id of ids) assert.ok(checkBusinessId(country, id).valid, `${country} ${id}`);
  }
});

test('номер с ошибкой в одной цифре не проходит', () => {
  const broken = { FI: '3592993-5', SE: '556012-5791', NO: '923609017', DK: '22756215', EE: '10238428', PL: '5260250994', DE: '136695977' };
  for (const [country, id] of Object.entries(broken)) assert.equal(checkBusinessId(country, id).valid, false, `${country} ${id}`);
});

test('примеры в подсказках формы — верные номера', () => {
  for (const pack of Object.values(COUNTRY_PACKS)) {
    if (pack.code === 'FI') continue; // у финского в подсказке маска 1234567-8, не номер
    assert.ok(checkBusinessId(pack.code, pack.businessId.example).valid, `${pack.code} ${pack.businessId.example}`);
  }
});

test('номер приводится к виду хранения', () => {
  assert.equal(checkBusinessId('FI', '35929936').normalized, '3592993-6');
  assert.equal(checkBusinessId('SE', '5560125790').normalized, '556012-5790');
  assert.equal(checkBusinessId('PL', '526-025-09-95').normalized, '5260250995');
  assert.equal(checkBusinessId('DE', 'DE136695976').normalized, '136695976');
});

test('номер плательщика НДС: выводится из номера компании или берётся введённый', () => {
  assert.equal(vatNumberFor('FI', '3592993-6', null), 'FI35929936');
  assert.equal(vatNumberFor('SE', '556012-5790', null), 'SE556012579001');
  assert.equal(vatNumberFor('PL', '5260250995', null), 'PL5260250995');
  assert.equal(vatNumberFor('DE', '136695976', null), 'DE136695976');
  assert.equal(vatNumberFor('EE', '10238429', 'ee 100 366 327'), 'EE100366327');
  assert.equal(vatNumberFor('EE', '10238429', '100366327'), 'EE100366327');
  assert.equal(vatNumberFor('LT', '110053842', ''), null);
});

test('часовой пояс точки: по стране, пустая и неизвестная — финское время', () => {
  assert.equal(stopTimeZone('DE'), 'Europe/Berlin');
  assert.equal(stopTimeZone('pl'), 'Europe/Warsaw');
  assert.equal(stopTimeZone(null), 'Europe/Helsinki');
  assert.equal(stopTimeZone('US'), 'Europe/Helsinki');
  assert.equal(countryPack('LV').currency, 'EUR');
});

test('индекс в адресе распознаётся по стране', () => {
  const cases = { FI: '00770 Helsinki', SE: '411 04 Göteborg', NO: '0150 Oslo', DK: '2100 København', EE: '10111 Tallinn', LV: 'LV-1010 Rīga', LT: 'LT-01100 Vilnius', PL: '81-336 Gdynia', DE: '23570 Lübeck' };
  for (const [country, address] of Object.entries(cases)) assert.match(address, COUNTRY_PACKS[country].postcode, country);
});

test('часовые пояса в базе (app.stop_timezone) совпадают с пакетами', async () => {
  const { readFileSync } = await import('node:fs');
  const sql = readFileSync(new URL('../../../supabase/migrations/20261021120000_country_packs.sql', import.meta.url), 'utf8');
  const inDb = Object.fromEntries([...sql.matchAll(/when '([A-Z]{2})' then '([^']+)'/g)].map((m) => [m[1], m[2]]));
  for (const pack of Object.values(COUNTRY_PACKS)) {
    if (pack.code === 'FI') continue; // FI — ветка else
    assert.equal(inDb[pack.code], pack.timeZone, pack.code);
  }
});
