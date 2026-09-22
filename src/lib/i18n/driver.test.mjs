/*
 * Язык приложения водителя. Запуск: npm test.
 *
 * Телефон присылает Accept-Language в свободной форме: с регионом,
 * с весами, иногда макроязыком («no» вместо «nb»). Проверяем, что из
 * этого получается язык, который у нас переведён, и что чужой язык
 * не выдаёт себя за свой.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchDriverLocale, DRIVER_LOCALES, DRIVER_LOCALE_NAMES } from './driverLocale.ts';

test('язык телефона подбирается по Accept-Language', () => {
  assert.equal(matchDriverLocale('et-EE,et;q=0.9,en;q=0.8'), 'et');
  assert.equal(matchDriverLocale('ru-RU,ru;q=0.9'), 'ru');
  assert.equal(matchDriverLocale('sv-SE,sv;q=0.9,fi;q=0.8'), 'sv');
  assert.equal(matchDriverLocale('da-DK,da;q=0.9'), 'da');
  assert.equal(matchDriverLocale('lv-LV'), 'lv');
  assert.equal(matchDriverLocale('lt-LT'), 'lt');
  assert.equal(matchDriverLocale('pl-PL,pl;q=0.9'), 'pl');
});

test('норвежские варианты сводятся к букмолу', () => {
  for (const header of ['nb-NO', 'nn-NO', 'no', 'no-NO,nb;q=0.9']) {
    assert.equal(matchDriverLocale(header), 'nb', header);
  }
});

test('вес учитывается: первым берётся язык с наибольшим q', () => {
  assert.equal(matchDriverLocale('de-DE,de;q=0.9,pl;q=0.8'), 'pl');
  assert.equal(matchDriverLocale('en;q=0.5,et;q=0.9'), 'et');
});

test('непереведённый язык не подменяется соседним', () => {
  for (const header of ['de-DE,de;q=0.9', 'es-ES', 'zh-CN', '', null, undefined]) {
    assert.equal(matchDriverLocale(header), null, String(header));
  }
});

test('у каждого языка есть название на самом себе', () => {
  for (const locale of DRIVER_LOCALES) {
    assert.ok(DRIVER_LOCALE_NAMES[locale], locale);
  }
});
