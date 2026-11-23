/*
 * Шаги после порога просрочки (24.11.2026): последний день срока по стране,
 * что можно записать и с каким предупреждением, тексты на всех языках и
 * письма на языке договора каждой страны. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locales } from '../i18n/config.ts';
import { INSTALLMENT_COUNTRIES, openInstallmentCountries } from './countries.ts';
import { contractPlainText } from './contractText/blocks.ts';
import { noticeLetter, noticeLetterExists } from './contractText/noticeLetters.ts';
import { DEFAULT_STEPS_TEXTS } from './countryTexts/defaultSteps.ts';
import { defaultStepPlan, defaultStepState, graceDeadline, noticeReceivedOn, withdrawalDeclared } from './defaultSteps.ts';
import { INSTALLMENT_RULES } from './rules.ts';

const MIGRATION = new URL('../../../supabase/migrations/20261203100000_installment_versions_default_steps.sql', import.meta.url);

test('письмо получено на следующий рабочий день после отправки', () => {
  assert.equal(noticeReceivedOn('2026-12-01'), '2026-12-02'); // вт → ср
  assert.equal(noticeReceivedOn('2026-12-04'), '2026-12-07'); // пт → пн
  assert.equal(noticeReceivedOn('2026-12-05'), '2026-12-07'); // сб → пн
});

test('последний день срока по стране: 14 дней (EE, LV, LT, DE, PL), 15 (RO), у FI, SE, DK срока нет', () => {
  const at = (cc, sent) => graceDeadline(defaultStepPlan(cc), sent);
  /* Отправлено во вторник 01.12.2026: получено 02.12, +14 = 16.12 (среда). */
  for (const cc of ['EE', 'LV', 'LT', 'DE', 'PL']) assert.equal(at(cc, '2026-12-01'), '2026-12-16', cc);
  assert.equal(at('RO', '2026-12-01'), '2026-12-17');
  /* Отправлено в четверг 03.12: получено 04.12 (пт), +14 = 18.12 (пт). */
  assert.equal(at('EE', '2026-12-03'), '2026-12-18');
  /* Отправлено в пятницу 04.12: получено 07.12 (пн), +14 = 21.12 (пн). */
  assert.equal(at('DE', '2026-12-04'), '2026-12-21');
  /* Румыния, отправлено в среду 02.12: получено 03.12, +15 = 18.12 (пт). */
  assert.equal(at('RO', '2026-12-02'), '2026-12-18');
  /* Отправлено в среду 09.12: получено 10.12, +14 = 24.12 (чт). */
  assert.equal(at('PL', '2026-12-09'), '2026-12-24');
  /* Конец срока в субботу — на понедельник: отправлено в среду 26.11.2026, получено 27.11, +15 = 12.12 (сб) → 14.12 (пн). */
  assert.equal(at('RO', '2026-11-26'), '2026-12-14');
  for (const cc of ['FI', 'SE', 'DK']) assert.equal(at(cc, '2026-12-01'), null, cc);
  /* Число дней — из набора правил, не повторяется. */
  for (const cc of openInstallmentCountries()) {
    const plan = defaultStepPlan(cc);
    assert.equal(plan.grace?.days ?? 0, INSTALLMENT_RULES[INSTALLMENT_COUNTRIES[cc].rules].graceDays, cc);
  }
});

test('что можно записать: срок до отказа, отказ раньше срока — с предупреждением, после отказа — ничего', () => {
  const ee = defaultStepPlan('EE');
  let s = defaultStepState(ee, [], '2026-12-01', true);
  assert.equal(s.canGrace, true);
  assert.equal(s.graceWarning, null);
  assert.equal(s.canWithdraw, false, 'в Эстонии без срока отказ не записывается');
  s = defaultStepState(ee, [], '2026-12-01', false);
  assert.equal(s.graceWarning, 'NO_THRESHOLD');
  const grace = { step: 'GRACE', given_on: '2026-12-01', deadline: '2026-12-16' };
  s = defaultStepState(ee, [grace], '2026-12-10', true);
  assert.equal(s.canWithdraw, true);
  assert.equal(s.withdrawWarning, 'DEADLINE_NOT_PASSED');
  assert.equal(s.graceWarning, 'GRACE_RUNNING');
  s = defaultStepState(ee, [grace], '2026-12-16', true);
  assert.equal(s.withdrawWarning, 'DEADLINE_NOT_PASSED', 'последний день срока ещё не прошёл');
  s = defaultStepState(ee, [grace], '2026-12-17', true);
  assert.equal(s.withdrawWarning, null);
  assert.equal(s.gracePassed, true);
  const done = { step: 'WITHDRAWAL', given_on: '2026-12-17', deadline: null };
  s = defaultStepState(ee, [grace, done], '2026-12-18', true);
  assert.equal(s.canGrace, false);
  assert.equal(s.canWithdraw, false);
  assert.equal(withdrawalDeclared([grace, done]), true);
  assert.equal(withdrawalDeclared([grace]), false);
  /* Финляндия: один шаг, сразу. */
  const fi = defaultStepPlan('FI');
  s = defaultStepState(fi, [], '2026-12-01', true);
  assert.equal(s.canGrace, false);
  assert.equal(s.canWithdraw, true);
  assert.equal(s.withdrawWarning, null);
  assert.equal(defaultStepState(fi, [], '2026-12-01', false).withdrawWarning, 'NO_THRESHOLD');
});

test('база: срок страны в днях тот же, что graceDays набора правил', () => {
  const sql = readFileSync(MIGRATION, 'utf8');
  const fn = sql.slice(sql.indexOf('create or replace function app.installment_grace_days'), sql.indexOf('revoke all on function app.installment_grace_days'));
  const days14 = fn.match(/in \(([^)]+)\) then 14/)[1].match(/'([A-Z]{2})'/g).map((x) => x.slice(1, 3));
  const days15 = [...fn.matchAll(/= '([A-Z]{2})' then 15/g)].map((m) => m[1]);
  for (const code of Object.keys(INSTALLMENT_COUNTRIES)) {
    const rules = INSTALLMENT_COUNTRIES[code].rules;
    const want = rules ? INSTALLMENT_RULES[rules].graceDays : 0;
    const got = days14.includes(code) ? 14 : days15.includes(code) ? 15 : 0;
    assert.equal(got, want, code);
  }
  assert.match(sql, /grant execute on function public\.record_installment_default_step\(uuid, text, date, date, jsonb, bigint, boolean\) to authenticated/);
});

test('тексты шагов: все поля на всех десяти языках, подстановки на месте', () => {
  assert.equal(locales.length, 10);
  const keys = Object.keys(DEFAULT_STEPS_TEXTS.en);
  for (const l of locales) {
    const t = DEFAULT_STEPS_TEXTS[l];
    assert.ok(t, l);
    assert.deepEqual(Object.keys(t), keys, l);
    for (const k of ['graceRule']) for (const ph of ['{days}', '{term}', '{law}', '{clause}']) assert.ok(t[k].includes(ph), `${l}.${k} ${ph}`);
    for (const ph of ['{amount}', '{deadline}', '{term}']) assert.ok(t.notifyGraceBody.includes(ph), `${l} notifyGraceBody ${ph}`);
    for (const ph of ['{step}', '{term}', '{date}']) assert.ok(t.notifyFinalBody.includes(ph), `${l} notifyFinalBody ${ph}`);
    assert.ok(t.graceDone.includes('{date}') && t.graceDone.includes('{deadline}'), l);
    assert.ok(t.warnDeadline.includes('{deadline}'), l);
    for (const kind of ['PERIOD', 'WARNING']) assert.ok(t.grace[kind], `${l}.grace.${kind}`);
    for (const kind of ['WITHDRAWAL', 'TERMINATION', 'REPOSSESSION']) assert.ok(t.final[kind], `${l}.final.${kind}`);
  }
});

const party = (name) => ({ name, businessId: '123', address: 'Street 1', email: 'a@b.c' });
const LANG_HINT = { FI_OSKL: 'Ostaja', EE_VOS: 'Ostja', LV_CL2070: 'Pircējs', SE_AVBL: 'Köpare', DK_KAL: 'Køber', LT_CK6414: 'Pirkėjas', DE_BGB449: 'Käufer', PL_KC589: 'Kupujący', RO_CC1755: 'Cumpărător' };

test('письма: у каждой открытой страны — на языке договора, с договором, просрочкой, сроком и последствием', () => {
  for (const code of openInstallmentCountries()) {
    const plan = defaultStepPlan(code);
    for (const step of ['GRACE', 'WITHDRAWAL']) {
      const exists = noticeLetterExists(plan.rules, step);
      assert.equal(exists, step === 'WITHDRAWAL' || plan.grace !== null, `${code} ${step}`);
      const doc = noticeLetter({
        step,
        rules: plan.rules,
        date: '01.12.2026',
        contract: { number: 'OS-2026-00042', date: '20.11.2026' },
        vehicle: 'Volvo FH ABC-123',
        seller: party('Seller Ltd'),
        buyer: party('Buyer Ltd'),
        overdue: [{ n: 3, due: '01.11.2026', amount: '800 €' }],
        total: '800 €',
        deadline: step === 'GRACE' ? '16.12.2026' : null,
        grace: step === 'WITHDRAWAL' && plan.grace ? { date: '01.12.2026', deadline: '16.12.2026' } : null,
        iban: 'FI21 1234',
      });
      if (!exists) {
        assert.equal(doc, null);
        continue;
      }
      const text = contractPlainText(doc);
      assert.ok(text.includes('OS-2026-00042'), `${code} ${step}: договор`);
      assert.ok(text.includes('Seller Ltd') && text.includes('Buyer Ltd'), `${code} ${step}: стороны`);
      assert.ok(text.includes('800 €'), `${code} ${step}: просрочка`);
      assert.ok(text.includes(LANG_HINT[plan.rules]), `${code} ${step}: язык договора`);
      assert.ok(text.includes(step === 'GRACE' ? plan.grace.clause : plan.final.clause.split(/[–,]/)[0]), `${code} ${step}: пункт договора`);
      if (step === 'GRACE') assert.ok(text.includes('16.12.2026'), `${code}: последний день`);
      if (step === 'WITHDRAWAL' && plan.grace) assert.ok(text.includes('16.12.2026'), `${code}: ссылка на срок`);
      assert.ok(!text.includes('______________'), `${code} ${step}: пустые места`);
    }
  }
});
