/*
 * Очередь водителя: действие не уходит при живой сети. Запуск: npm test.
 *
 * Проверяем правило из outboxPolicy.ts: три неудачи — одна перезагрузка,
 * после неё действие пропускается не сразу и не раньше пяти минут, а
 * перезагрузка никогда не повторяется по кругу.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterFailure,
  blobFits,
  reloadedRecently,
  FAILURE_SPACING_MS,
  MAX_BLOB_BYTES,
  RELOAD_GUARD_MS,
  SKIP_NOT_BEFORE_MS,
} from './outboxPolicy.ts';

const T0 = 1_800_000_000_000;
const STEP = 20_000;

/** Прогоняет неудачи раз в 20 секунд и возвращает шаги. */
function run(times, { state, start = T0, reloadedRecently: recent = false } = {}) {
  const steps = [];
  let current = state;
  let now = start;
  for (let i = 0; i < times; i += 1) {
    const result = afterFailure(current, now, recent);
    steps.push(result.step);
    current = result.state;
    now += STEP;
  }
  return { steps, state: current, now };
}

test('первые две неудачи — просто ждём, третья перезагружает страницу', () => {
  const { steps, state } = run(3);
  assert.deepEqual(steps, ['wait', 'wait', 'reload']);
  assert.equal(state.failures, 0, 'после перезагрузки счёт с нуля');
  assert.equal(state.reloadedAt, T0 + 2 * STEP);
  assert.equal(state.firstFailedAt, T0, 'первая неудача запомнена');
});

test('после перезагрузки второй перезагрузки нет — действие пропускается, но не раньше пяти минут', () => {
  const first = run(3);
  const after = run(3, { state: first.state, start: first.now });
  assert.deepEqual(after.steps, ['wait', 'wait', 'wait'], 'три неудачи после перезагрузки, но пяти минут ещё нет');
  assert.ok(!after.steps.includes('reload'));

  const late = afterFailure(after.state, T0 + SKIP_NOT_BEFORE_MS, false);
  assert.equal(late.step, 'skip');
});

test('действие, которое не уходит никогда, в итоге пропускается, а перезагрузка одна', () => {
  const { steps } = run(40);
  assert.equal(steps.filter((s) => s === 'reload').length, 1);
  assert.equal(steps.at(-1), 'skip');
  assert.ok(steps.indexOf('skip') * STEP >= SKIP_NOT_BEFORE_MS, 'не раньше пяти минут от первой неудачи');
});

test('страницу недавно перезагружали ради другого действия — это не перезагружает', () => {
  const { steps } = run(40, { reloadedRecently: true });
  assert.ok(!steps.includes('reload'));
  assert.equal(steps.at(-1), 'skip');
});

test('пачка неудач за несколько секунд считается одной', () => {
  let result = afterFailure(undefined, T0, false);
  for (let i = 1; i <= 5; i += 1) {
    result = afterFailure(result.state, T0 + i * 1000, false);
    assert.equal(result.step, 'wait');
  }
  assert.equal(result.state.failures, 1);

  result = afterFailure(result.state, T0 + FAILURE_SPACING_MS, false);
  assert.equal(result.state.failures, 2);
});

test('часы телефона ушли назад — неудача всё равно считается', () => {
  const first = afterFailure(undefined, T0, false);
  const second = afterFailure(first.state, T0 - 60_000, false);
  assert.equal(second.state.failures, 2);
});

test('отметка о перезагрузке: свежая действует, старая и мусор — нет', () => {
  assert.equal(reloadedRecently(String(T0), T0 + 60_000), true);
  assert.equal(reloadedRecently(String(T0), T0 + RELOAD_GUARD_MS), false);
  assert.equal(reloadedRecently(String(T0 + 60_000), T0), false, 'отметка из будущего');
  assert.equal(reloadedRecently(null, T0), false);
  assert.equal(reloadedRecently('', T0), false);
  assert.equal(reloadedRecently('abc', T0), false);
});

test('файл тяжелее 4 МБ в очередь не кладётся', () => {
  assert.equal(blobFits(undefined), true, 'действие без файла');
  assert.equal(blobFits(300_000), true);
  assert.equal(blobFits(MAX_BLOB_BYTES), true);
  assert.equal(blobFits(MAX_BLOB_BYTES + 1), false);
  assert.equal(blobFits(6 * 1024 * 1024), false, 'несжатый снимок с камеры');
});
