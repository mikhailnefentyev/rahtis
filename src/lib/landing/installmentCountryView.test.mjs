/*
 * Открытая страница калькулятора по стране расчёта (24.11.2026): новые слова
 * на десяти языках, числа из реестра, тексты страны из кабинета, Финляндия —
 * как была. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INSTALLMENT_COUNTRY_LANDING } from './installmentCountryCopy.ts';
import { installmentCountryOptions, installmentCountryView } from './installmentCountryView.ts';
import { openInstallmentCountries } from '../installments/countries.ts';
import { LAW_TEXTS } from '../installments/countryTexts/index.ts';
import { SELLER_INVOICE_TEXTS } from '../installments/countryTexts/sellerInvoices.ts';

const LOCALES = ['fi', 'en', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru', 'ro'];

/* Основной (финский) текст страницы — заглушка той же формы. */
const base = {
  lede: 'FI lede',
  disclaimer: 'FI sources 91/1966',
  f: { vatModes: { STANDARD: 'FI 25,5 %' }, rateHint: 'FI rate' },
  r: { firstInvoice: 'First invoice', firstInvoiceHint: 'FI hint', thresholdsTitle: 'FI law', thresholdsText: 'FI {tenth}', scenarioText: 'FI 3–4 §' },
  how: [1, 2, 3, 4, 5].map((n) => ({ title: `T${n}`, text: `FI ${n}` })),
  faq: [{ q: 'FI q', a: 'FI a' }],
};

const leaves = (o) => (typeof o === 'string' ? [o] : Object.values(o).flatMap(leaves));

test('новые слова: все десять языков, те же ключи, ничего пустого', () => {
  assert.deepEqual(Object.keys(INSTALLMENT_COUNTRY_LANDING).sort(), [...LOCALES].sort());
  const shape = JSON.stringify(Object.keys(INSTALLMENT_COUNTRY_LANDING.en).sort());
  for (const l of LOCALES) {
    const c = INSTALLMENT_COUNTRY_LANDING[l];
    assert.equal(JSON.stringify(Object.keys(c).sort()), shape, l);
    for (const s of leaves(c)) assert.ok(s.trim(), l);
    assert.ok(c.thresholdsTitle.includes('{country}'), l);
    assert.ok(c.rateMax.includes('{max}'), l);
    assert.ok(c.firstInvoiceHint.includes('{down}') && c.firstInvoiceHint.includes('{vat}'), l);
  }
});

test('Финляндия — основной текст страницы без изменений', () => {
  const v = installmentCountryView(base, 'fi', 'FI', 'vat fixed');
  assert.equal(v.calc.fi, true);
  assert.equal(v.calc.currency, 'EUR');
  assert.equal(v.calc.vatBps, 2550);
  assert.equal(v.lede, base.lede);
  assert.equal(v.disclaimer, base.disclaimer);
  assert.equal(v.how, base.how);
  assert.equal(v.faq, base.faq);
  assert.equal(v.calc.thresholdsText, base.r.thresholdsText);
  assert.equal(v.calc.taxNote, undefined);
});

test('другие страны: валюта, НДС и правила из реестра, тексты страны из кабинета', () => {
  for (const code of openInstallmentCountries().filter((c) => c !== 'FI')) {
    for (const l of LOCALES) {
      const v = installmentCountryView(base, l, code, 'vat fixed');
      const law = LAW_TEXTS[code][l];
      assert.equal(v.calc.fi, false, code);
      assert.equal(v.calc.code, code);
      assert.ok(v.calc.vatBps > 0 && v.calc.vatBps !== 2550, `${code} vat`);
      assert.equal(v.calc.thresholdsText, law.thresholdsText);
      assert.ok(v.calc.taxNote);
      assert.ok(!v.disclaimer.includes('91/1966'), code);
      assert.ok(!v.calc.thresholdsTitle.includes('{country}'), code);
      assert.equal(v.how.length, 5);
      /* JSON-LD строится из этого же списка: ответы непустые, факты — из текстов страны. */
      assert.ok(v.faq.every((f) => f.q.trim() && f.a.trim()), code);
      assert.ok(v.faq.some((f) => f.a === law.nextSteps) && v.faq.some((f) => f.a === law.afterPaid), code);
      /* Четвёртый шаг (ежемесячные платежи) — общий, из основного текста. */
      for (const s of [v.lede, ...v.how.filter((_, i) => i !== 3).map((h) => h.text), v.calc.scenarioText]) assert.ok(!s.startsWith('FI '), code);
    }
  }
});

test('Швеция: процентов нет; Польша: предел 7 %; Польша и Румыния: счета у продавца', () => {
  const se = installmentCountryView(base, 'sv', 'SE', 'vat fixed').calc;
  assert.equal(se.rateFixed, true);
  assert.equal(se.rateHint, LAW_TEXTS.SE.sv.rateHint);
  assert.equal(se.currency, 'SEK');

  const pl = installmentCountryView(base, 'pl', 'PL', 'vat fixed').calc;
  assert.equal(pl.maxRateBps, 700);
  assert.ok(pl.rateMaxError && pl.rateMaxError.includes('7'));
  assert.equal(pl.firstInvoiceLabel, SELLER_INVOICE_TEXTS.pl.firstPaymentLabel);
  assert.equal(pl.note, LAW_TEXTS.PL.pl.listingNote);
  assert.ok(pl.vatHint.includes('KSeF'));

  const ro = installmentCountryView(base, 'en', 'RO', 'vat fixed').calc;
  assert.ok(ro.vatHint.includes('RO e-Factura'));
  assert.equal(ro.note, LAW_TEXTS.RO.en.listingNote);

  const lt = installmentCountryView(base, 'lt', 'LT', 'vat fixed').calc;
  assert.equal(lt.firstInvoiceLabel, SELLER_INVOICE_TEXTS.lt.firstPaymentLabel);
  assert.equal(lt.vatHint, undefined);

  const ee = installmentCountryView(base, 'et', 'EE', 'vat fixed').calc;
  assert.equal(ee.firstInvoiceLabel, 'First invoice');
  assert.equal(ee.vatHint, 'vat fixed');
  assert.equal(ee.rateMaxError, undefined);
  assert.equal(ee.rateFixed, false);

  const de = installmentCountryView(base, 'de', 'DE', 'vat fixed');
  assert.ok(de.disclaimer.includes(LAW_TEXTS.DE.de.legalNoticeExtra));
});

test('выбор страны: все открытые страны с названием на языке страницы', () => {
  const open = openInstallmentCountries();
  for (const l of LOCALES) {
    const o = installmentCountryOptions(l);
    assert.deepEqual(o.map((x) => x.code), open);
    assert.ok(o.every((x) => x.label.trim()), l);
  }
});
