/*
 * Уведомление водителя: язык, адрес и даты. Запуск: npm test.
 *
 * Push водителю с языком телефона приходил по-фински и открывал /fi, а
 * срок документа читался как «2026-12-01». Проверяем правила из notice.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventValues, firstKnown, routeLocale } from './notice.ts';
import { DRIVER_LOCALES } from '../i18n/driverLocale.ts';
import { locales } from '../i18n/config.ts';

const push = (appLanguage, subscribed) => firstKnown([appLanguage, subscribed], DRIVER_LOCALES, 'fi');

test('язык push: выбор в профиле, потом язык подписки, потом финский', () => {
  assert.equal(push('ru', 'fi'), 'ru');
  assert.equal(push(null, 'pl'), 'pl', 'выбор пуст — язык телефона из подписки');
  assert.equal(push('', 'nb'), 'nb');
  assert.equal(push(undefined, 'da'), 'da');
  assert.equal(push(null, null), 'fi');
  assert.equal(push('xx', 'zz'), 'fi', 'незнакомые языки не проходят');
  assert.equal(push('xx', 'ro'), 'ro');
});

test('адрес по нажатию: язык сайта, для норвежского и датского — /en', () => {
  for (const language of DRIVER_LOCALES) {
    const route = routeLocale(language, locales, 'en');
    assert.ok(locales.includes(route), `${language} → /${route} — такого маршрута нет`);
  }
  assert.equal(routeLocale('ru', locales, 'en'), 'ru');
  assert.equal(routeLocale('fi', locales, 'en'), 'fi');
  assert.equal(routeLocale('nb', locales, 'en'), 'en');
  assert.equal(routeLocale('da', locales, 'en'), 'en');
});

const day = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}/${y}`;
};

test('дата в подстановке показывается датой читающего', () => {
  assert.deepEqual(eventValues({ type: 'ADR_BASIC', date: '2026-12-01' }, day), { type: 'ADR_BASIC', date: '1/12/2026' });
});

test('срок ТО: дата внутри when меняется, километры остаются', () => {
  assert.equal(eventValues({ when: '2026-12-01 / 120 000 km' }, day).when, '1/12/2026 / 120 000 km');
  assert.equal(eventValues({ when: '2026-12-01' }, day).when, '1/12/2026');
  assert.equal(eventValues({ when: '120 000 km' }, day).when, '120 000 km');
});

test('старые строки с финской датой читаются как были', () => {
  assert.equal(eventValues({ when: '1.12.2026 / 120 000 km' }, day).when, '1.12.2026 / 120 000 km');
  assert.equal(eventValues({ when: '20.11.2026' }, day).when, '20.11.2026');
});

test('номер рейса и прочие строки не трогаются', () => {
  const values = eventValues({ ref: 'RS-2026-0418', plate: 'ABC-123', minutes: 15, title: 'Öljy 2026-12-01' }, day);
  assert.deepEqual(values, { ref: 'RS-2026-0418', plate: 'ABC-123', minutes: 15, title: 'Öljy 2026-12-01' });
});

test('пустые и странные подстановки не роняют текст', () => {
  assert.deepEqual(eventValues(null, day), {});
  assert.deepEqual(eventValues('строка', day), {});
  assert.deepEqual(eventValues({ title: null, urgent: true, extra: { a: 1 } }, day), { title: '', urgent: 'yes' });
});

test('форматтер упал на негодной дате — остаётся записанное', () => {
  const broken = () => {
    throw new RangeError('Invalid time value');
  };
  assert.equal(eventValues({ date: '2026-13-45' }, broken).date, '2026-13-45');
  assert.equal(eventValues({ when: '2026-13-45 / 5 km' }, broken).when, '2026-13-45 / 5 km');
});
