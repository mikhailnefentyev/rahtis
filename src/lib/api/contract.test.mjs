/*
 * Описание API не отстаёт от кода: каждый маршрут /api/v1 описан в
 * openapi.ts, список событий вебхуков совпадает с ограничением в базе,
 * отказы действий переводятся. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { WEBHOOK_EVENTS } from './events.ts';
import { translateRule } from './rules.ts';

const root = new URL('../../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const apiDir = join(root, 'src/app/api/v1');
const openapi = readFileSync(join(root, 'src/lib/api/openapi.ts'), 'utf8');

/** Маршруты Next → шаблоны путей OpenAPI: [ref] → {ref}. */
function routes(dir, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routes(full, `${prefix}/${name.replace(/^\[(.+)\]$/, '{$1}')}`));
    else if (name === 'route.ts') out.push({ path: prefix, methods: [...readFileSync(full, 'utf8').matchAll(/export const (GET|POST|PATCH|DELETE|PUT)\b/g)].map((m) => m[1]) });
  }
  return out;
}

test('каждый маршрут /api/v1 описан в openapi.ts', () => {
  const found = routes(apiDir).filter((r) => r.path !== '/openapi.json');
  assert.ok(found.length >= 15, `маршрутов мало: ${found.length}`);
  for (const r of found) {
    /* У претензий в описании параметр называется claim_ref: {ref} занят номером заказа. */
    const documented = r.path.startsWith('/claims/{ref}') ? r.path.replace('{ref}', '{claim_ref}') : r.path;
    assert.ok(openapi.includes(`'${documented}': {`), `нет в openapi.ts: ${documented}`);
    for (const m of r.methods) {
      const block = openapi.slice(openapi.indexOf(`'${documented}': {`));
      const next = block.indexOf("\n      '/", 1);
      assert.ok((next === -1 ? block : block.slice(0, next)).includes(`${m.toLowerCase()}: {`), `нет метода ${m} у ${documented}`);
    }
  }
});

test('события вебхуков совпадают с ограничением в базе', () => {
  const dir = join(root, 'supabase/migrations');
  const last = readdirSync(dir)
    .filter((f) => readFileSync(join(dir, f), 'utf8').includes('api_webhooks_events_known check'))
    .sort()
    .at(-1);
  const sql = readFileSync(join(dir, last), 'utf8');
  const list = sql.slice(sql.lastIndexOf('api_webhooks_events_known check'));
  const inDb = [...list.slice(0, list.indexOf(']')).matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual([...WEBHOOK_EVENTS].sort(), inDb);
});

test('отказы действий переводятся', () => {
  for (const [ru, field] of [
    ['Живая корректировка возможна только в идущем рейсе, текущий статус: DONE.', 'status'],
    ['Забор и отцепку прицепа из маршрута не убирают.', 'stop'],
    ['Оценка ставится после закрытия рейса, текущий статус: OPEN.', 'status'],
    ['Claim закрыт.', 'status'],
    ['Откат возможен только до начала рейса, текущий статус: IN_PROGRESS.', 'status'],
  ]) {
    const rule = translateRule(ru);
    assert.ok(rule, `нет перевода: ${ru}`);
    assert.equal(rule.field, field);
    assert.doesNotMatch(rule.message, /[а-яё]/i);
  }
});
