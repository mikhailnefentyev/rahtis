/*
 * Тесты логики ADR: номер опасности и комплект оснащения. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLATES, checkKit, decodeHazard, plateQuestion, requiredKit } from './adr.ts';

test('номер опасности: удвоение — усиление, 0 — ничего, X — вода', () => {
  assert.deepEqual(decodeHazard('33'), ['3', 'intensified']);
  assert.deepEqual(decodeHazard('30'), ['3']);
  assert.deepEqual(decodeHazard('268'), ['2', '6', '8']);
  assert.deepEqual(decodeHazard('X423'), ['water', '4', '2', '3']);
  assert.deepEqual(decodeHazard('80'), ['8']);
  assert.deepEqual(decodeHazard('886'), ['8', 'intensified', '6']);
});

test('вопрос по табличке: 4 разных груза, правильный среди них', () => {
  for (let i = 0; i < PLATES.length; i++) {
    const q = plateQuestion(i, () => 0.3);
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(q.options.includes(q.correct));
  }
});

const full = (scenario, extinguishers) => [...requiredKit(scenario), ...extinguishers];
const codes = (f) => f.map((x) => x.code);

test('бензовоз 26 т, класс 3: базовый комплект, промывка, лопата/заглушка/ёмкость, огнетушители 2 + 6 + 6', () => {
  const s = { label: '3', mass: 26 };
  const req = requiredKit(s);
  for (const item of ['chock', 'signs', 'eyewash', 'shovel', 'drainSeal', 'container', 'instructions']) {
    assert.ok(req.includes(item), item);
  }
  assert.ok(!req.includes('mask'));
  assert.deepEqual(codes(checkKit(s, full(s, ['ext2a', 'ext6a', 'ext6b']))), ['ok']);
  assert.deepEqual(codes(checkKit(s, full(s, ['ext2a', 'ext6a']))), ['extinguishers']);
});

test('баллоны LPG, 2.1: без промывки глаз и без лопаты', () => {
  const req = requiredKit({ label: '2.1' });
  assert.ok(!req.includes('eyewash'));
  assert.ok(!req.includes('shovel'));
  assert.ok(!req.includes('mask'));
});

test('хлор, 2.3, 7 т: маска нужна, промывка нет; огнетушители 2 + 6', () => {
  const s = { label: '2.3', mass: 7 };
  assert.ok(requiredKit(s).includes('mask'));
  assert.ok(!requiredKit(s).includes('eyewash'));
  assert.deepEqual(codes(checkKit(s, full(s, ['ext2a', 'ext6a']))), ['ok']);
});

test('фургон с кислотой 3,2 т: огнетушители 2 + 2 достаточно, одного мало', () => {
  const s = { label: '8', mass: 3.2 };
  assert.deepEqual(codes(checkKit(s, full(s, ['ext2a', 'ext2b']))), ['ok']);
  assert.deepEqual(codes(checkKit(s, full(s, ['ext2a']))), ['extinguishers']);
});

test('забытый упор — ошибка со списком; буксировочный трос — предупреждение', () => {
  const s = { label: '3', mass: 26 };
  const chosen = full(s, ['ext2a', 'ext6a', 'ext6b']).filter((i) => i !== 'chock').concat('towRope');
  const f = checkKit(s, chosen);
  assert.deepEqual(f.find((x) => x.code === 'missing').items, ['chock']);
  assert.deepEqual(f.find((x) => x.code === 'not_adr').items, ['towRope']);
});

test('маска для груза, которому она не нужна, — предупреждение «лишнее», не ошибка', () => {
  const s = { label: '3', mass: 26 };
  const f = checkKit(s, full(s, ['ext2a', 'ext6a', 'ext6b', 'mask']));
  assert.equal(f[0].code, 'ok');
  assert.deepEqual(f.find((x) => x.code === 'extra').items, ['mask']);
});
