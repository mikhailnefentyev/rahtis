/*
 * Тесты расчёта нагрузок по осям (практика «Jaa kuorma»). Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AXLE_CONFIG, calcAxleLoads, checkAxleLoads } from './axles.ts';

const empty = () => Array(AXLE_CONFIG.slots).fill(0);
const fill = (mass, from = 0, to = AXLE_CONFIG.slots) => empty().map((_, i) => (i >= from && i < to ? mass : 0));
const codes = (findings) => findings.map((f) => (f.code === 'over_axle' ? `over_${f.axle}` : f.code));

test('пустой поезд: сумма осей равна снаряжённой массе', () => {
  const l = calcAxleLoads(empty());
  assert.equal(l.total, 14);
  assert.ok(Math.abs(l.steer + l.drive + l.bogie - 14) < 0.02);
  assert.equal(checkAxleLoads(empty(), 0)[0].code, 'ok');
});

test('груз распределяется без потерь: сумма осей = снаряжённая масса + груз', () => {
  const slots = fill(2.2);
  const l = calcAxleLoads(slots);
  assert.equal(l.cargo, 24.2);
  assert.ok(Math.abs(l.steer + l.drive + l.bogie - l.total) < 0.02);
});

test('полный прицеп по 2,2 т ровно — в пределах всех лимитов', () => {
  assert.deepEqual(codes(checkAxleLoads(fill(2.2), 0)), ['ok']);
});

test('частичная разгрузка сзади перегружает ведущую ось, хотя масса упала', () => {
  const full = calcAxleLoads(fill(2.2));
  const frontOnly = fill(2.2, 0, 6);
  const after = calcAxleLoads(frontOnly);
  assert.ok(after.total < full.total);
  assert.ok(after.drive > full.drive);
  assert.deepEqual(codes(checkAxleLoads(frontOnly, 0)), ['over_drive']);
});

test('та же разгрузка из середины — без перегруза', () => {
  const slots = fill(2.2).map((m, i) => (i >= 3 && i < 8 ? 0 : m));
  assert.deepEqual(codes(checkAxleLoads(slots, 0)), ['ok']);
});

test('тяжёлый груз у передней стенки — перегруз ведущей оси, над тележкой — нет', () => {
  const front = empty();
  front[0] = 7;
  front[1] = 7;
  assert.deepEqual(codes(checkAxleLoads(front, 0)), ['over_drive']);

  const overBogie = empty();
  overBogie[7] = 7;
  overBogie[8] = 7;
  /* Перегруза нет; пустой перед при этом разгружает ведущую ось — отдельное предупреждение. */
  const errors = checkAxleLoads(overBogie, 0).filter((f) => f.level === 'error');
  assert.deepEqual(errors, []);
});

test('груз в хвосте перегружает тележку', () => {
  const tail = empty();
  tail[9] = 9;
  tail[10] = 9;
  assert.ok(codes(checkAxleLoads(tail, 0)).includes('over_bogie'));
});

test('груз в хвосте почти разгружает ведущую ось — предупреждение о сцеплении', () => {
  const tail = empty();
  tail[10] = 6;
  const f = checkAxleLoads(tail, 0);
  assert.equal(f.find((x) => x.code === 'drive_light')?.level, 'warn');
});

test('общая масса сверх 44 т — ошибка', () => {
  assert.ok(codes(checkAxleLoads(fill(2.8), 0)).includes('over_total'));
});

test('не весь груз поставлен — ошибка первой строкой', () => {
  assert.equal(checkAxleLoads(fill(2.2, 0, 5), 3)[0].code, 'unplaced');
});
