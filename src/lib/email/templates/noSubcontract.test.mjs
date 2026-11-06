/*
 * Письмо о конце подряда. Запуск: npm test.
 *
 * Проверяем то, что типы не ловят: на каждом из девяти языков есть
 * тема и текст, в них цена машины и дата начала абонемента, а язык
 * компании выбирается так, как задумано.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTICE_LOCALES, noticeContent, noticeLocaleOf } from './noSubcontractText.ts';
import { renderEmail, renderText } from '../layout.ts';

const LINK = 'https://rahtis.eu/fi/carrier/subscription';

test('каждый язык: тема, текст и HTML с ценой и датой', () => {
  assert.equal(NOTICE_LOCALES.length, 9);

  for (const locale of NOTICE_LOCALES) {
    const c = noticeContent(locale, LINK);
    const text = renderText({ heading: c.heading, blocks: c.blocks, operatorEmail: 'admin@rahtis.eu', signature: c.signature, neverAsk: c.neverAsk });
    const html = renderEmail({ heading: c.heading, preheader: c.preheader, blocks: c.blocks, operatorEmail: 'admin@rahtis.eu', tagline: c.tagline, neverAsk: c.neverAsk });

    assert.ok(c.subject.trim().length > 10, `${locale}: тема`);
    assert.match(c.subject, /RAHTIS/, `${locale}: марка в теме`);
    for (const body of [text, html]) {
      assert.match(body, /14[.,]90/, `${locale}: цена`);
      assert.match(body, /2027/, `${locale}: дата`);
      assert.match(body, /Aivomaa Oy/, `${locale}: Aivomaa Oy`);
      assert.match(body, /3 %/, `${locale}: прежние 3 %`);
    }
    assert.ok(html.includes(LINK), `${locale}: ссылка`);
  }
});

test('язык компании', () => {
  assert.equal(noticeLocaleOf('fi', 'FI'), 'fi');
  assert.equal(noticeLocaleOf('en', 'FI'), 'en');
  assert.equal(noticeLocaleOf('en', 'EE'), 'et');
  assert.equal(noticeLocaleOf('en', 'EE', false), 'en');
  assert.equal(noticeLocaleOf('en', 'NO'), 'en');
  assert.equal(noticeLocaleOf('ru', 'FI'), 'ru');
  assert.equal(noticeLocaleOf(null, 'FI'), 'fi');
  assert.equal(noticeLocaleOf('', 'PL'), 'pl');
  assert.equal(noticeLocaleOf('xx', 'DK'), 'en');
});
