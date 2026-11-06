/*
 * Сцепка: app.combo_fit (20261107010000) — те же отказы, что у прежнего
 * combo_fit_reason, и тот же код, что раньше угадывался по тексту.
 * Отклик сцепкой (take_order_combo) видит прежние тексты. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = (name) => readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Тело функции от create до $$; */
function body(sql, name) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, name);
  const open = sql.indexOf('$$', start);
  return sql.slice(open + 2, sql.indexOf('$$', open + 2));
}

const oldBody = body(migration('20261028230000_combos_orders.sql'), 'app.combo_fit_reason');
const newSql = migration('20261107010000_final_review.sql');
const newBody = body(newSql, 'app.combo_fit');

/* Прежние отказы: return '…' или return format('…', …). */
const oldReasons = [...oldBody.matchAll(/return ((?:format\()?'[^']+'(?:, [^)]+\))?);/g)].map((m) => m[1]);
const pairs = [...newBody.matchAll(/code := '([A-Z]+)';\s*reason := ((?:format\()?'[^']+'(?:, [^)]+\))?);/g)].map((m) => ({ code: m[1], reason: m[2] }));

/* Как код выводился из текста в 20261106210000 (app.combo_misfit до правки). */
function codeFromText(text) {
  if (text.startsWith('Нужен другой кузов') || text.startsWith('Нет нужного способа')) return 'BODY';
  if (text.startsWith('Нужно от') || text.startsWith('Нужен тягач с шасси') || text.startsWith('У полуприцепа нет')) return 'SIZE';
  return 'CLASS';
}

test('combo_fit отказывает теми же текстами, что прежний combo_fit_reason', () => {
  assert.ok(oldReasons.length >= 10);
  assert.deepEqual([...new Set(pairs.map((p) => p.reason))].sort(), [...new Set(oldReasons)].sort());
  assert.equal(pairs.length, (newBody.match(/reason :=/g) ?? []).length, 'у каждого текста есть код');
});

test('код у каждого отказа — тот же, что выводился из текста', () => {
  for (const { code, reason } of pairs) {
    const text = reason.replace(/^format\(/, '').replace(/^'/, '');
    assert.equal(code, codeFromText(text), reason);
  }
});

test('кассета — с правкой 20261028230100 (не самосвальный прицеп — TPV)', () => {
  assert.match(newBody, /when v_trailer\.body_type in \('TIPPER', 'CASSETTE'\) then 'KASETTI' else 'TRUCK_TRAILER'/);
});

test('combo_fit_reason и combo_misfit берут из combo_fit, текст не разбирается', () => {
  assert.match(body(newSql, 'app.combo_fit_reason'), /select f\.reason from app\.combo_fit\(p_combo, p_order\) f/);
  const misfit = body(newSql, 'app.combo_misfit');
  assert.match(misfit, /select f\.code into v_code from app\.combo_fit\(p_combo, p_order\) f/);
  assert.doesNotMatch(misfit, /like/);
});
