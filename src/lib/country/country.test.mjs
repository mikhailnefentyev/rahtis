/*
 * Тесты пакетов стран. Запуск: npm test.
 *
 * Номера — настоящие номера известных компаний (открытые реестры): если
 * алгоритм контрольной цифры написан с ошибкой, настоящая компания не
 * сможет подать заявку, и тест это поймает раньше неё.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADDRESS_COUNTRIES, businessIdLabel, businessIdLabelByShape, checkBusinessId, COUNTRY_CODES, COUNTRY_PACKS, COUNTRY_TZ, countryPack, normalizeIntlPhone, phonePrefixForLocale, stopTimeZone, vatNumberFor } from './index.ts';

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
  RO: ['14399840', 'RO 14399840', '1590082', '160796'], // Dante International (eMAG), OMV Petrom, Automobile Dacia
};

/*
 * Последнее определение функции базы среди миграций: функции
 * переопределяются (create or replace), и сверять надо с действующей.
 */
async function latestSql(marker) {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../../../supabase/migrations/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let found = null;
  for (const f of files) {
    const sql = readFileSync(new URL(f, dir), 'utf8');
    const at = sql.lastIndexOf(marker);
    if (at < 0) continue;
    /* До конца тела функции ($$;), а не дальше: соседняя функция с теми же when-ветками сбила бы сверку. */
    const end = sql.indexOf('$$;', sql.indexOf('$$', at) + 2);
    found = sql.slice(at, end < 0 ? undefined : end);
  }
  return found;
}

test('настоящие номера компаний проходят проверку', () => {
  for (const [country, ids] of Object.entries(REAL)) {
    for (const id of ids) assert.ok(checkBusinessId(country, id).valid, `${country} ${id}`);
  }
});

test('номер с ошибкой в одной цифре не проходит', () => {
  const broken = { FI: '3592993-5', SE: '556012-5791', NO: '923609017', DK: '22756215', EE: '10238428', PL: '5260250994', DE: '136695977', RO: '14399841' };
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
  assert.equal(checkBusinessId('RO', 'RO 14399840').normalized, '14399840');
});

test('номер плательщика НДС: выводится из номера компании или берётся введённый', () => {
  assert.equal(vatNumberFor('FI', '3592993-6', null), 'FI35929936');
  assert.equal(vatNumberFor('SE', '556012-5790', null), 'SE556012579001');
  assert.equal(vatNumberFor('PL', '5260250995', null), 'PL5260250995');
  assert.equal(vatNumberFor('DE', '136695976', null), 'DE136695976');
  assert.equal(vatNumberFor('RO', '14399840', null), 'RO14399840');
  assert.equal(vatNumberFor('EE', '10238429', 'ee 100 366 327'), 'EE100366327');
  assert.equal(vatNumberFor('EE', '10238429', '100366327'), 'EE100366327');
  assert.equal(vatNumberFor('LT', '110053842', ''), null);
});

test('часовой пояс точки: по стране, пустая и неизвестная — финское время', () => {
  assert.equal(stopTimeZone('DE'), 'Europe/Berlin');
  assert.equal(stopTimeZone('pl'), 'Europe/Warsaw');
  assert.equal(stopTimeZone('RO'), 'Europe/Bucharest');
  /* Страны вне пакетов — по полной таблице, не Хельсинки (аудит 2.8). */
  assert.equal(stopTimeZone('NL'), 'Europe/Amsterdam');
  assert.equal(stopTimeZone('hu'), 'Europe/Budapest');
  assert.equal(stopTimeZone('GB'), 'Europe/London');
  assert.equal(stopTimeZone(null), 'Europe/Helsinki');
  assert.equal(stopTimeZone('US'), 'Europe/Helsinki');
  assert.equal(countryPack('LV').currency, 'EUR');
});

test('индекс в адресе распознаётся по стране', () => {
  const cases = { FI: '00770 Helsinki', SE: '411 04 Göteborg', NO: '0150 Oslo', DK: '2100 København', EE: '10111 Tallinn', LV: 'LV-1010 Rīga', LT: 'LT-01100 Vilnius', PL: '81-336 Gdynia', DE: '23570 Lübeck', RO: '900900 Constanța' };
  for (const [country, address] of Object.entries(cases)) assert.match(address, COUNTRY_PACKS[country].postcode, country);
});

test('часовые пояса в базе (app.stop_timezone) совпадают с пакетами и полной таблицей', async () => {
  const sql = await latestSql('function app.stop_timezone');
  const inDb = Object.fromEntries([...sql.matchAll(/when '([A-Z]{2})' then '([^']+)'/g)].map((m) => [m[1], m[2]]));
  for (const pack of Object.values(COUNTRY_PACKS)) {
    if (pack.code === 'FI') continue; // FI — ветка else
    assert.equal(inDb[pack.code], pack.timeZone, pack.code);
  }
  for (const [code, zone] of Object.entries(COUNTRY_TZ)) {
    if (code === 'FI') continue;
    assert.equal(inDb[code], zone, code);
  }
  assert.match(sql, /else 'Europe\/Helsinki'/);
});

test('пакеты и полная таблица поясов не расходятся; страны заявок ищутся в адресах', () => {
  for (const code of COUNTRY_CODES) {
    assert.equal(COUNTRY_TZ[code], COUNTRY_PACKS[code].timeZone, code);
    assert.ok(ADDRESS_COUNTRIES.includes(code), code);
  }
  for (const code of ADDRESS_COUNTRIES) assert.ok(COUNTRY_TZ[code], `пояс для ${code}`);
  for (const zone of Object.values(COUNTRY_TZ)) {
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: zone }), zone);
  }
});

test('номер любой страны в виде хранения проходит проверку базы (app.business_id_ok)', async () => {
  const sql = await latestSql('function app.business_id_ok');
  const [, fi] = /p_country = 'FI' and p_business_id ~ '([^']+)'/.exec(sql);
  const [, other] = /p_country <> 'FI' and p_business_id ~ '([^']+)'/.exec(sql);
  for (const [country, ids] of Object.entries(REAL)) {
    for (const id of ids) {
      const { normalized } = checkBusinessId(country, id);
      assert.match(normalized, new RegExp(country === 'FI' ? fi : other), `${country} ${id} → ${normalized}`);
    }
  }
});

test('подпись номера: финской компании — из словаря, остальным — название номера в их стране', () => {
  assert.equal(businessIdLabel('FI', 'Business ID (Y-tunnus)'), 'Business ID (Y-tunnus)');
  assert.equal(businessIdLabel(null, 'Y-tunnus'), 'Y-tunnus');
  assert.equal(businessIdLabel('PL', 'Y-tunnus'), 'NIP');
  assert.equal(businessIdLabel('se', 'Y-tunnus'), 'Organisationsnummer');
  assert.equal(businessIdLabel('NO', 'Y-tunnus'), 'Organisasjonsnummer');
});

test('подпись номера по его виду: финский 1234567-8 — Y-tunnus, остальные — общая подпись', () => {
  assert.equal(businessIdLabelByShape('3592993-6', 'Business ID'), 'Y-tunnus');
  for (const [country, ids] of Object.entries(REAL)) {
    if (country === 'FI') continue;
    for (const id of ids) assert.equal(businessIdLabelByShape(checkBusinessId(country, id).normalized, 'Business ID'), 'Business ID', `${country} ${id}`);
  }
});

test('вход водителя по коду: код страны по языку, национальный «0» убирается', () => {
  assert.equal(phonePrefixForLocale('ro'), '+40');
  assert.equal(phonePrefixForLocale('pl'), '+48');
  assert.equal(phonePrefixForLocale('sv'), '+46');
  assert.equal(phonePrefixForLocale('nb'), '+47');
  assert.equal(phonePrefixForLocale('fi'), '+358');
  assert.equal(phonePrefixForLocale('en'), '+358');
  assert.equal(normalizeIntlPhone('+40 0722 123 456'), '+40722123456');
  assert.equal(normalizeIntlPhone('+3580401234567'), '+358401234567');
  assert.equal(normalizeIntlPhone('00358 40 123 4567'), '+358401234567');
  assert.equal(normalizeIntlPhone('+48 (601) 234-567'), '+48601234567');
  /* Код вне пакетов — как введён (у Италии «0» — часть номера). */
  assert.equal(normalizeIntlPhone('+39 06 1234567'), '+39061234567');
});
