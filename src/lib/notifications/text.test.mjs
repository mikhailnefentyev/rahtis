/*
 * Уведомления кабинета по коду: у каждого кода notify() есть фраза во всех
 * десяти словарях, и она собирается из тех подстановок, что пишет код. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import IntlMessageFormat from 'intl-messageformat';
import { notificationText } from './text.ts';
import { fi } from '../i18n/dictionaries/fi.ts';
import { en } from '../i18n/dictionaries/en.ts';
import { sv } from '../i18n/dictionaries/sv.ts';
import { et } from '../i18n/dictionaries/et.ts';
import { lv } from '../i18n/dictionaries/lv.ts';
import { lt } from '../i18n/dictionaries/lt.ts';
import { pl } from '../i18n/dictionaries/pl.ts';
import { de } from '../i18n/dictionaries/de.ts';
import { ru } from '../i18n/dictionaries/ru.ts';
import { ro } from '../i18n/dictionaries/ro.ts';

const dictionaries = { fi, en, sv, et, lv, lt, pl, de, ru, ro };

/* Тот же порядок, что в message.ts, но падает громко: тест должен видеть забытую подстановку. */
function i18nOf(t) {
  const m = (key, values) => {
    const out = new IntlMessageFormat(t.msg[key], t.meta.intl).format(values);
    return Array.isArray(out) ? out.join('') : String(out);
  };
  const f = {
    date: (v) => `D(${String(v).slice(0, 10)})`,
    eur: (c) => `EUR(${c})`,
    money: (c, cur) => `${cur}(${c})`,
    percent: (x) => `P(${x})`,
    number: (n) => `N(${n})`,
  };
  return { locale: 'x', t, m, f };
}

/* Подстановки — ровно такие, какие пишут вызовы notify() (src/lib/**). */
const CASES = {
  'billing.invoiced': { ref: 'RS-2026-0001', amountCents: 45000 },
  'billing.settled': { ref: 'RS-2026-0001', amountCents: 45000 },
  'driver.certificate_expiring': { driver: 'Matti M.', type: 'ADR_BASIC', date: '2026-12-01' },
  'verification.expiring': { item: 'TAX', date: '2026-12-01', source: 'PRH' },
  'forwarder.insurance_expiring': { date: '2026-12-01', owner: 'yes' },
  'company.docs_unlocked': {},
  'company.document_approved': { document: 'FORWARDER_INSURANCE', owner: 'no', shipper: 'no', note: '—' },
  'company.document_rejected': { document: 'FORWARDER_LICENSE', owner: 'no', shipper: 'no', note: 'unreadable' },
  'invoice.terms_proposed': { name: 'Oy Ab', schedule: 'WEEKLY', days: 14 },
  'invoice.terms_accepted': { name: 'Oy Ab' },
  'invoice.terms_rejected': { name: 'Oy Ab' },
  'installment.offer': { plate: 'ABC-123', name: 'Oy Ab' },
  'installment.counter': { plate: 'ABC-123', name: 'Oy Ab' },
  'installment.agreed': { plate: 'ABC-123', number: 'OM-2026-1' },
  'installment.cancelled': { plate: 'ABC-123', name: 'Oy Ab' },
  'installment.withdrawn': { plate: 'ABC-123' },
  'installment.handover': { plate: 'ABC-123' },
  'installment.paid_off': { plate: 'ABC-123' },
  'installment.overdue': { plate: 'ABC-123', n: 3, date: '2026-11-01', days: 1 },
  'installment.threshold': { plate: 'ABC-123' },
  'installment.terminated': { plate: 'ABC-123' },
  'installment.no_iban': { plate: 'ABC-123', n: 3 },
  /* Пишет база: public.announce_equipment_listing (миграция 20261128100000). */
  'installment.new_listing': { make: 'Volvo FH 500', vehicleClass: 'TRACTOR', priceCents: 6500000, currency: 'SEK', months: 36, country: 'SE' },
  'maintenance.defect': { plate: 'ABC-123', area: 'BRAKES', who: 'Matti', text: 'Jarru vetää', orders: [] },
  'maintenance.defect_unsafe': { plate: 'ABC-123', area: 'BRAKES', who: 'Matti', text: 'x', orders: [{ ref: 'RS-1', day: '2026-11-22' }] },
  'maintenance.due': {
    count: 2,
    items: [
      { plate: 'ABC-123', kind: 'INSPECTION', title: null, dueOn: '2026-12-01', dueKm: null, daysLeft: 10, kmLeft: null },
      { plate: 'XYZ-9', kind: 'OTHER', title: 'Renkaat', dueOn: null, dueKm: 500000, daysLeft: null, kmLeft: 1200 },
    ],
  },
  'maintenance.overdue': { count: 1, items: [{ plate: 'ABC-123', kind: 'INSPECTION', dueOn: '2026-11-01', daysLeft: -3 }] },
  'maintenance.inspection_blocked': { plates: 'ABC-123, XYZ-9', orders: [{ ref: 'RS-1', day: '2026-11-22' }] },
  'report.weekly': { role: 'carrier', week: 47, number: '', from: '2026-11-16', to: '2026-11-22', count: 2, amountCents: 90000 },
  'report.period': { role: 'shipper', week: 47, number: 'R-12', from: '2026-11-01', to: '2026-11-15', count: 1, amountCents: 1000 },
  'report.subscription': { number: 'S-1', month: '11/2026', annual: 'no', count: 2, unitCents: 1490, vatBps: 2550 },
};

for (const [lang, t] of Object.entries(dictionaries)) {
  test(`${lang}: каждый код notify() переводится, тело — тоже`, () => {
    const i18n = i18nOf(t);
    for (const [code, params] of Object.entries(CASES)) {
      /* Напоминание о сроке документа водителя пишется без тела. */
      const bodyless = code === 'driver.certificate_expiring';
      const row = { code, params, title: 'FALLBACK', body: bodyless ? null : 'FALLBACK BODY' };
      const { title, body } = notificationText(row, i18n);
      assert.notEqual(title, 'FALLBACK', `${lang} ${code}: заголовок не собран`);
      assert.ok(!/[{}]/.test(title), `${lang} ${code}: ${title}`);
      if (bodyless) assert.equal(body, null);
      else assert.ok(body && body !== 'FALLBACK BODY', `${lang} ${code}: тело не собрано`);
      if (body) assert.ok(!/[{}]/.test(body), `${lang} ${code}: ${body}`);
    }
  });
}

test('подстановки без языка: дата, сумма, процент, подпись перечня', () => {
  const i18n = i18nOf(fi);
  const r = notificationText({ code: 'report.subscription', params: CASES['report.subscription'], title: null, body: null }, i18n);
  assert.match(r.body, /EUR\(1490\)/);
  assert.match(r.body, /P\(0\.255\)/);
  const d = notificationText({ code: 'driver.certificate_expiring', params: CASES['driver.certificate_expiring'], title: null, body: null }, i18n);
  assert.equal(d.title, `Matti M.: ${fi.certificates.types.ADR_BASIC} — D(2026-12-01)`);
});

test('без кода и с неизвестным кодом — запасной текст', () => {
  const i18n = i18nOf(fi);
  assert.deepEqual(notificationText({ code: null, params: {}, title: 'Viesti', body: 'Teksti' }, i18n), { title: 'Viesti', body: 'Teksti' });
  assert.deepEqual(notificationText({ code: 'no.such', params: {}, title: 'T', body: 'B' }, i18n), { title: 'T', body: 'B' });
});

test('новая техника в рассрочку: цена — в валюте объявления, класс — словом читающего', () => {
  const row = {
    code: 'installment.new_listing',
    params: { make: 'Volvo FH 500', vehicleClass: 'TRACTOR', priceCents: 6500000, currency: 'SEK', months: 36, country: 'SE' },
    title: null,
    body: null,
  };
  const out = notificationText(row, i18nOf(fi));
  assert.ok(out.title.includes('Volvo FH 500'), out.title);
  /* Не евро: сумма не пересчитывается и печатается в своей валюте. */
  assert.ok(out.body.includes('SEK(6500000)'), out.body);
  assert.ok(!out.body.includes('EUR('), out.body);
  assert.ok(out.body.includes(fi.vehicleClass.TRACTOR), out.body);
  assert.ok(out.body.includes('36'), out.body);
});
