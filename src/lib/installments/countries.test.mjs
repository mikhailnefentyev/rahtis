/*
 * Страны раздела «Продажа техники в рассрочку» (23.11.2026): реестр,
 * сверка с пакетами стран и со списком открытых стран в базе.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { COUNTRY_PACKS } from '../country/index.ts';
import {
  INSTALLMENT_COUNTRIES,
  installmentCountry,
  installmentCountryOpen,
  installmentCurrency,
  installmentMoney,
  openInstallmentCountries,
  sameInstallmentCountry,
} from './countries.ts';
import { INSTALLMENT_RULES, installmentRules, installmentRulesById } from './rules.ts';
import { remedyAllowed, thresholds } from './calc.ts';

test('у каждой страны платформы есть запись в реестре рассрочки — новая страна требует решения', () => {
  assert.deepEqual(Object.keys(INSTALLMENT_COUNTRIES).sort(), Object.keys(COUNTRY_PACKS).sort());
});

test('открыты Финляндия, Эстония, Латвия, Швеция, Дания, Литва и Германия (23.11.2026); остальные страны закрыты, пока нет правил и договора', () => {
  assert.deepEqual(openInstallmentCountries().sort(), ['DE', 'DK', 'EE', 'FI', 'LT', 'LV', 'SE']);
  for (const country of ['FI', 'fi', 'EE', 'ee', 'LV', 'lv', 'SE', 'se', 'DK', 'dk', 'LT', 'lt', 'DE', 'de']) assert.equal(installmentCountryOpen(country), true, country);
  for (const country of ['NO', 'PL', 'RO', 'XX', '', null, undefined]) {
    assert.equal(installmentCountryOpen(country), false, String(country));
    assert.equal(installmentCountry(country), null, String(country));
  }
});

test('валюта и ставка НДС открытой страны — из пакета страны, без своих чисел', () => {
  for (const code of openInstallmentCountries()) {
    const c = installmentCountry(code);
    assert.equal(c.currency, COUNTRY_PACKS[code].currency);
    assert.equal(c.vatStandardBps, COUNTRY_PACKS[code].vatStandardBps);
    assert.ok(INSTALLMENT_RULES[c.rules], `${code}: правила ${c.rules}`);
    assert.ok(c.contract && c.contractLanguage);
    assert.equal(typeof c.vatOnFirstInvoice, 'boolean');
  }
  assert.equal(installmentCountry('FI').vatStandardBps, 2550);
  assert.equal(installmentCountry('FI').currency, 'EUR');
  assert.equal(installmentCountry('FI').vatOnFirstInvoice, true);
});

test('страну нельзя открыть наполовину: без правил, договора или решения об НДС она закрыта', () => {
  /* Норвегия закрыта (23.11.2026) — на ней и проверяется «открыть наполовину». */
  const saved = INSTALLMENT_COUNTRIES.NO;
  try {
    INSTALLMENT_COUNTRIES.NO = { open: true, rules: null, contract: null, contractLanguage: null, vatOnFirstInvoice: null };
    assert.equal(installmentCountryOpen('NO'), false);
    INSTALLMENT_COUNTRIES.NO = { open: true, rules: 'FI_OSKL', contract: 'FI_OSAMAKSU', contractLanguage: 'no', vatOnFirstInvoice: null };
    assert.equal(installmentCountryOpen('NO'), false);
    INSTALLMENT_COUNTRIES.NO = { open: true, rules: 'FI_OSKL', contract: 'FI_OSAMAKSU', contractLanguage: 'no', vatOnFirstInvoice: true };
    /* Полная запись — открыта, со своей валютой и ставкой из пакета. */
    assert.equal(installmentCountry('NO').currency, 'NOK');
    assert.equal(installmentCountry('NO').vatStandardBps, COUNTRY_PACKS.NO.vatStandardBps);
    assert.equal(sameInstallmentCountry('NO', 'NO'), true);
    assert.equal(sameInstallmentCountry('NO', 'FI'), false);
  } finally {
    INSTALLMENT_COUNTRIES.NO = saved;
  }
});

test('страна, не принимающая заявки (enabled в пакете), закрыта и для рассрочки', () => {
  const saved = COUNTRY_PACKS.FI.enabled;
  try {
    COUNTRY_PACKS.FI.enabled = false;
    assert.equal(installmentCountryOpen('FI'), false);
  } finally {
    COUNTRY_PACKS.FI.enabled = saved;
  }
  assert.equal(installmentCountryOpen('FI'), true);
});

test('сделка — только внутри одной открытой страны', () => {
  assert.equal(sameInstallmentCountry('FI', 'FI'), true);
  assert.equal(sameInstallmentCountry('FI', 'fi'), true);
  assert.equal(sameInstallmentCountry('FI', 'SE'), false);
  assert.equal(sameInstallmentCountry('SE', 'DK'), false);
  /* Швеция и Дания открыты (23.11.2026): сделка внутри страны возможна; Норвегия закрыта. */
  assert.equal(sameInstallmentCountry('SE', 'se'), true);
  assert.equal(sameInstallmentCountry('DK', 'DK'), true);
  assert.equal(sameInstallmentCountry('NO', 'NO'), false);
  assert.equal(sameInstallmentCountry(null, null), false);
  assert.equal(sameInstallmentCountry('FI', null), false);
});

test('валюта страны — из пакета; суммы печатаются в валюте объявления без пересчёта', () => {
  assert.equal(installmentCurrency('FI'), 'EUR');
  assert.equal(installmentCurrency('SE'), 'SEK');
  assert.equal(installmentCurrency('PL'), 'PLN');
  assert.equal(installmentCurrency('XX'), 'EUR');
  assert.equal(installmentCurrency(null), 'EUR');
  const digits = (s) => s.replace(/[^0-9,.]/g, '');
  /* Число то же, меняется только знак валюты. */
  assert.equal(digits(installmentMoney('en', 'EUR')(6500000)), '65,000');
  assert.equal(digits(installmentMoney('en', 'SEK')(6500000)), '65,000');
  assert.ok(installmentMoney('en', 'EUR')(100).includes('€'));
  assert.ok(/SEK|kr/.test(installmentMoney('en', 'SEK')(100)));
  assert.ok(/PLN|zł/.test(installmentMoney('pl', 'PLN')(100)));
  /* Дробная сумма — с копейками, в каталоге (whole) — без. */
  assert.equal(digits(installmentMoney('en', 'EUR')(79167)), '791.67');
  assert.equal(digits(installmentMoney('en', 'EUR', true)(79167)), '792');
  /* Мусор вместо валюты — евро, а не падение страницы. */
  assert.ok(installmentMoney('en', 'euro')(100).includes('€'));
  assert.ok(installmentMoney('en', null)(100).includes('€'));
});

test('правила Финляндии — расчёты закона о рассрочке из calc.ts, без изменений', () => {
  const rules = installmentRules('FI');
  assert.equal(rules.id, 'FI_OSKL');
  assert.equal(rules.thresholds, thresholds);
  assert.equal(rules.remedyAllowed, remedyAllowed);
  assert.equal(installmentRulesById('FI_OSKL'), rules);
  /* У закрытой страны правил нет: ни порогов на экране, ни сигнала продавцу. */
  for (const country of ['NO', 'PL', 'XX', '', null, undefined]) assert.equal(installmentRules(country), null, String(country));
  assert.equal(installmentRulesById('toString'), null);
  assert.equal(installmentRulesById(null), null);
});

/*
 * Последнее определение функции базы среди миграций: функции
 * переопределяются (create or replace), и сверять надо с действующей.
 */
function latestSql(marker) {
  const dir = new URL('../../../supabase/migrations/', import.meta.url);
  let found = null;
  for (const f of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(f, dir), 'utf8');
    const at = sql.lastIndexOf(marker);
    if (at < 0) continue;
    const end = sql.indexOf('$$;', sql.indexOf('$$', at) + 2);
    found = sql.slice(at, end < 0 ? undefined : end);
  }
  return found;
}

test('список открытых стран в базе (app.installment_country_open) совпадает с реестром', () => {
  const sql = latestSql('create or replace function app.installment_country_open(');
  assert.ok(sql, 'функция app.installment_country_open не найдена в миграциях');
  const list = /\bin\s*\(([^)]*)\)/.exec(sql.slice(sql.indexOf('$$')));
  assert.ok(list, 'в теле функции нет списка стран');
  const inDb = [...list[1].matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort();
  assert.deepEqual(inDb, openInstallmentCountries().sort());
});

test('проверки сторон и каталог в базе идут через app.installment_country_open, без буквального FI', () => {
  for (const marker of [
    'create or replace function app.installment_seller_ok(',
    'create or replace function app.installment_company_ok(',
    'create function public.equipment_catalog(',
    'create or replace function public.public_equipment_listings(',
  ]) {
    const sql = latestSql(marker);
    assert.ok(sql, marker);
    assert.ok(sql.includes('app.installment_country_open('), marker);
    assert.ok(!/=\s*'FI'/.test(sql), marker);
  }
});

test('открытая функция объявлений не отдаёт продавца, номер машины и идентификаторы', () => {
  const sql = latestSql('create or replace function public.public_equipment_listings(');
  const head = sql.slice(0, sql.indexOf('$$'));
  for (const banned of ['uuid', 'plate', 'seller', 'name', 'city', 'description', 'email', 'phone']) {
    assert.ok(!new RegExp(`\\b${banned}`, 'i').test(head.replace(/public_equipment_listings/g, '')), `в ответе есть «${banned}»`);
  }
  assert.ok(/security definer/.test(head) && /set search_path = ''/.test(head));
  assert.ok(sql.includes("l.status = 'PUBLISHED'") && sql.includes('not s.is_test') && sql.includes("s.status = 'ACTIVE'"));
});
