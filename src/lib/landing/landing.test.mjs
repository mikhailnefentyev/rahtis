import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTHWORKS, earthworksPath } from './earthworks.ts';
import { FORWARDERS, forwardersPath } from './forwarders.ts';
import { TRAILER_SWAP, trailerSwapPath } from './trailerSwap.ts';

const LOCALES = ['fi', 'en', 'sv', 'et', 'lv', 'lt', 'pl', 'de', 'ru'];
const PAGES = { EARTHWORKS, FORWARDERS, TRAILER_SWAP };

/* Каждый язык — полный текст, той же формы, что финский. */
test('посадочные: у каждого языка все ключи и та же длина списков', () => {
  for (const [name, copy] of Object.entries(PAGES)) {
    const fi = copy.fi;
    for (const locale of LOCALES) {
      const c = copy[locale];
      assert.ok(c, `${name}.${locale}`);
      assert.deepEqual(Object.keys(c).sort(), Object.keys(fi).sort(), `${name}.${locale}: ключи`);
      for (const [key, value] of Object.entries(c)) {
        if (typeof value === 'string') assert.ok(value.trim().length > 0, `${name}.${locale}.${key} пуст`);
        if (Array.isArray(value)) {
          assert.equal(value.length, fi[key].length, `${name}.${locale}.${key}: длина`);
          for (const item of value) {
            for (const v of typeof item === 'string' ? [item] : Object.values(item)) assert.ok(v.trim().length > 0, `${name}.${locale}.${key}`);
          }
        }
      }
    }
  }
});

test('посадочные: заголовок и описание для выдачи укладываются в длину', () => {
  for (const [name, copy] of Object.entries({ FORWARDERS, TRAILER_SWAP })) {
    for (const locale of LOCALES) {
      const c = copy[locale];
      assert.ok(c.metaTitle.length <= 60, `${name}.${locale}.metaTitle: ${c.metaTitle.length}`);
      assert.ok(c.metaDescription.length <= 155, `${name}.${locale}.metaDescription: ${c.metaDescription.length}`);
    }
  }
});

/* Цена подставляется из config.ts: число, написанное руками, разойдётся с ценой. */
test('посадочные: цена перевозчика — меткой, а не числом', () => {
  for (const locale of LOCALES) {
    const c = TRAILER_SWAP[locale];
    assert.ok(c.priceText.includes('{price}'), `${locale}.priceText`);
    const faqPrice = c.faq.at(-1).a;
    for (const tag of ['{price}', '{from}', '{discount}']) assert.ok(faqPrice.includes(tag), `${locale}: ${tag}`);
    for (const copy of [FORWARDERS[locale], c]) assert.equal(/14[.,]90/.test(JSON.stringify(copy)), false, `${locale}: цена руками`);
  }
});

test('посадочные: финский слаг у финского, английский у остальных', () => {
  assert.equal(forwardersPath('fi'), '/fi/huolitsijoille');
  assert.equal(forwardersPath('de'), '/de/forwarders');
  assert.equal(trailerSwapPath('fi'), '/fi/peravaunun-vaihto');
  assert.equal(trailerSwapPath('en'), '/en/trailer-swap');
  assert.equal(earthworksPath('fi'), '/fi/maansiirto');
});
