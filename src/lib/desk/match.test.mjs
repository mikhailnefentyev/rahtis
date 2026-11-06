/*
 * Стол: подбор своей машины к заказу. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localMinute, matchDesk, pickupLocal, roadKm } from './match.ts';

const plates = { v1: 'ABC-123', v2: 'XYZ-9', v3: 'KLM-5' };
const order = { id: 'o1', pickupDate: '2026-11-06', pickupTime: '15:00:00' };
const row = (vehicleId, lineKm, misfit = null, comboId = null) => ({ orderId: 'o1', vehicleId, comboId, misfit, lineKm });
const point = (vehicleId, freeLocal, source = 'GPS', afterRef = null) => ({ vehicleId, source, afterRef, freeLocal });

test('дорога: прямая × 1,25, кратно 5 км', () => {
  assert.equal(roadKm(10), 15);
  assert.equal(roadKm(40), 50);
  assert.equal(roadKm(0), 0);
  assert.equal(roadKm(null), null);
});

test('время: формат базы и забор без времени — конец дня', () => {
  assert.equal(localMinute('2026-11-06T14:00:00'), '2026-11-06T14:00');
  assert.equal(localMinute('2026-11-06 14:00:00'), '2026-11-06T14:00');
  assert.equal(pickupLocal({ id: 'x', pickupDate: '2026-11-07', pickupTime: null }), '2026-11-07T23:59');
  assert.equal(pickupLocal({ id: 'x', pickupDate: null, pickupTime: null }), null);
});

test('успевающая к забору раньше, чем ближняя, но занятая', () => {
  const r = matchDesk(
    [order],
    [row('v1', 5), row('v2', 40)],
    [point('v1', '2026-11-06T18:00:00', 'ORDER', 'R-1'), point('v2', '2026-11-06T09:00:00')],
    plates,
  );
  assert.deepEqual(r.o1.choices.map((c) => c.plate), ['XYZ-9', 'ABC-123']);
  assert.equal(r.o1.choices[1].inTime, false);
  assert.equal(r.o1.choices[1].afterRef, 'R-1');
  assert.equal(r.o1.reason, null);
});

test('среди успевающих — меньше порожних км; без точки — в конце', () => {
  const r = matchDesk(
    [order],
    [row('v1', 40), row('v2', 10), row('v3', null)],
    [point('v1', '2026-11-06T09:00:00'), point('v2', '2026-11-06T10:00:00', 'BASE')],
    plates,
  );
  assert.deepEqual(r.o1.choices.map((c) => c.plate), ['XYZ-9', 'ABC-123', 'KLM-5']);
  assert.equal(r.o1.choices[0].emptyKm, 15);
  assert.equal(r.o1.choices[0].source, 'BASE');
  assert.equal(r.o1.choices[2].inTime, true);
});

test('одна машина — один вариант; сцепка при равенстве раньше', () => {
  const r = matchDesk(
    [order],
    [row('v1', 10), row('v1', 10, null, 'k1'), row('v2', 10, 'BODY')],
    [point('v1', '2026-11-06T09:00:00')],
    plates,
    { k1: 'ABC-123 + reefer' },
  );
  assert.equal(r.o1.choices.length, 1);
  assert.equal(r.o1.choices[0].value, 'c:k1');
  assert.equal(r.o1.choices[0].comboName, 'ABC-123 + reefer');
});

test('не подходит никто: причина ближе всего к годности', () => {
  const r = matchDesk([order], [row('v1', 5, 'CLASS'), row('v2', 5, 'BODY'), row('v3', 5, 'SIZE')], [], plates);
  assert.deepEqual(r.o1.choices, []);
  assert.equal(r.o1.reason, 'BODY');
  const w = matchDesk([order], [row('v1', 5, 'WEIGHT'), row('v2', 5, 'BODY')], [], plates);
  assert.equal(w.o1.reason, 'WEIGHT');
});

test('машин на рейсы нет — NONE; чужая машина (без номера) не предлагается', () => {
  assert.equal(matchDesk([order], [], [], plates).o1.reason, 'NONE');
  assert.equal(matchDesk([order], [row('zz', 5)], [], plates).o1.reason, 'NONE');
});

test('забор без даты — любая подходящая успевает', () => {
  const r = matchDesk(
    [{ id: 'o1', pickupDate: null, pickupTime: null }],
    [row('v1', 5)],
    [point('v1', '2026-11-09T09:00:00', 'ORDER')],
    plates,
  );
  assert.equal(r.o1.choices[0].inTime, true);
});
