import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayText } from './langs.ts';

const quick = (code) => ({ OK: 'Selvä' })[code];

test('быстрый ответ — на языке читателя', () => {
  const r = displayText({ body: 'OK', quick_code: 'OK', source_lang: null, translations: {} }, 'fi', quick);
  assert.deepEqual(r, { text: 'Selvä', translated: false });
});

test('чужой язык — перевод, свой — оригинал', () => {
  const m = { body: 'Portti 3 on kiinni', quick_code: null, source_lang: 'fi', translations: { ru: 'Ворота 3 закрыты' } };
  assert.deepEqual(displayText(m, 'ru', quick), { text: 'Ворота 3 закрыты', translated: true });
  assert.deepEqual(displayText(m, 'fi', quick), { text: 'Portti 3 on kiinni', translated: false });
});

test('без перевода — оригинал', () => {
  const m = { body: 'Hei', quick_code: null, source_lang: null, translations: {} };
  assert.deepEqual(displayText(m, 'pl', quick), { text: 'Hei', translated: false });
});
