/*
 * Открытая страница «Техника на продажу в рассрочку» (23.11.2026): тексты
 * на десяти языках, адрес, отбор объявлений и разбор ответа базы.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EQUIPMENT_SALE,
  cleanListings,
  equipmentSaleCopy,
  equipmentSalePath,
  filterListings,
  listingFacets,
  listingQuery,
  parseListingFilter,
} from './equipmentSale.ts';

const LOCALES = ['fi', 'en', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru', 'ro'];

test('адрес: финский слаг у финского, общий — у остальных языков', () => {
  assert.equal(equipmentSalePath('fi'), '/kalusto-osamaksulla');
  for (const locale of LOCALES.filter((l) => l !== 'fi')) assert.equal(equipmentSalePath(locale), '/equipment-for-sale');
});

test('тексты: у каждого языка все ключи, три шага и ничего пустого', () => {
  const keys = Object.keys(EQUIPMENT_SALE.fi).sort();
  assert.deepEqual(Object.keys(EQUIPMENT_SALE).sort(), [...LOCALES].sort());
  for (const locale of LOCALES) {
    const c = EQUIPMENT_SALE[locale];
    assert.deepEqual(Object.keys(c).sort(), keys, locale);
    assert.equal(c.how.length, 3, locale);
    for (const [key, value] of Object.entries(c)) {
      if (typeof value === 'string') assert.ok(value.trim().length > 0, `${locale}.${key}`);
    }
    for (const step of c.how) assert.ok(step.title.trim() && step.text.trim(), locale);
    /* Без незаполненных подстановок: эти тексты выводятся как есть. */
    assert.ok(!/[{}]/.test(JSON.stringify(Object.values(c).filter((v) => typeof v === 'string'))), locale);
  }
  assert.equal(equipmentSaleCopy('xx'), EQUIPMENT_SALE.en);
});

test('тексты: заголовок и описание для выдачи укладываются в длину', () => {
  for (const locale of LOCALES) {
    const c = EQUIPMENT_SALE[locale];
    assert.ok(c.metaTitle.length <= 60, `${locale}.metaTitle: ${c.metaTitle.length}`);
    assert.ok(c.metaDescription.length <= 155, `${locale}.metaDescription: ${c.metaDescription.length}`);
  }
});

test('тексты: RAHTIS — не сторона сделки, на каждом языке; финская марка склоняется', () => {
  for (const locale of LOCALES) assert.ok(EQUIPMENT_SALE[locale].notParty.includes('RAHTIS'), locale);
  const fi = JSON.stringify(EQUIPMENT_SALE.fi);
  assert.ok(fi.includes('RAHTIKSEEN') && fi.includes('RAHTIKSESSA'));
  assert.ok(!/RAHTIS(iin|in|issa|ille)\b/.test(fi));
  /* Немецкий — на «Sie», польский — на «Ty», шведский — на «du». */
  assert.ok(/\bSie\b/.test(EQUIPMENT_SALE.de.emptyText));
  assert.ok(!/\b(du|dein|dich)\b/i.test(JSON.stringify(EQUIPMENT_SALE.de)));
  assert.ok(/\bdu\b/.test(EQUIPMENT_SALE.sv.lede));
  assert.ok(/Zaloguj się/.test(EQUIPMENT_SALE.pl.ctaOffer));
});

const row = (over = {}) => ({
  make: 'Volvo FH 500',
  vehicle_class: 'TRACTOR',
  odometer_km: 412000,
  price_cents: 6500000,
  currency: 'EUR',
  down_payment_cents: 1000000,
  months: 36,
  country: 'FI',
  published_on: '2026-11-23',
  ...over,
});

test('ответ базы: только строки объявлений; мусор и пустой ответ страницу не роняют', () => {
  assert.deepEqual(cleanListings(null), []);
  assert.deepEqual(cleanListings(undefined), []);
  assert.deepEqual(cleanListings({ message: 'function not found' }), []);
  assert.deepEqual(cleanListings([null, 'x', {}, { make: 'A' }]), []);
  assert.deepEqual(cleanListings([row()]), [row()]);
  /* Нет цены, срока или страны — строка не показывается. */
  assert.deepEqual(cleanListings([row({ price_cents: 0 }), row({ months: null }), row({ country: 'Finland' })]), []);
  /* Необязательное заполняется безопасно. */
  const loose = cleanListings([row({ odometer_km: null, currency: 'euro', down_payment_cents: undefined, published_on: null })])[0];
  assert.equal(loose.odometer_km, null);
  assert.equal(loose.currency, 'EUR');
  assert.equal(loose.down_payment_cents, 0);
  assert.equal(loose.published_on, null);
});

test('ответ базы: лишние поля (продавец, номер, идентификаторы) на страницу не проходят', () => {
  const [clean] = cleanListings([row({ id: 'u-1', seller_name: 'Oy Ab', plate: 'ABC-123', seller_company_id: 'c-1' })]);
  assert.deepEqual(Object.keys(clean).sort(), Object.keys(row()).sort());
});

test('отбор по стране и классу — только значениями, которые есть среди объявлений', () => {
  const rows = [row(), row({ vehicle_class: 'VAN', make: 'MB Sprinter' }), row({ country: 'SE', currency: 'SEK', vehicle_class: 'TIPPER' })];
  assert.deepEqual(listingFacets(rows), { countries: ['FI', 'SE'], classes: ['TIPPER', 'TRACTOR', 'VAN'] });
  assert.deepEqual(parseListingFilter(rows, {}), { country: null, vehicleClass: null });
  assert.deepEqual(parseListingFilter(rows, { country: 'se', class: 'tipper' }), { country: 'SE', vehicleClass: 'TIPPER' });
  assert.deepEqual(parseListingFilter(rows, { country: ['FI', 'SE'], class: 'VAN' }), { country: 'FI', vehicleClass: 'VAN' });
  /* Чужая строка из адреса не принимается. */
  assert.deepEqual(parseListingFilter(rows, { country: 'DE', class: '<script>' }), { country: null, vehicleClass: null });
  assert.equal(filterListings(rows, { country: null, vehicleClass: null }).length, 3);
  assert.equal(filterListings(rows, { country: 'FI', vehicleClass: null }).length, 2);
  assert.equal(filterListings(rows, { country: 'FI', vehicleClass: 'VAN' }).length, 1);
  assert.equal(filterListings(rows, { country: 'SE', vehicleClass: 'VAN' }).length, 0);
  assert.equal(filterListings([], { country: null, vehicleClass: null }).length, 0);
});

test('ссылки отбора: пустой отбор — без строки запроса', () => {
  assert.equal(listingQuery({ country: null, vehicleClass: null }), '');
  assert.equal(listingQuery({ country: 'FI', vehicleClass: null }), '?country=FI');
  assert.equal(listingQuery({ country: 'FI', vehicleClass: 'VAN' }), '?country=FI&class=VAN');
});
