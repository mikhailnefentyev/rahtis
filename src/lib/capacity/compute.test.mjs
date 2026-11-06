/*
 * Догрузы: вместимость, участки, пороги. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cabotageLeft,
  coarse,
  correctFree,
  effectiveMode,
  fits,
  freeOf,
  isCabotage,
  isPartialLoad,
  proposalsForVehicle,
  vehicleCapacity,
  worthOffering,
} from './compute.ts';

const stop = (sequence, role, city, date, extra = {}) => ({
  sequence,
  role,
  city,
  country: 'FI',
  lat: 60.17,
  lon: 24.94,
  date,
  time: null,
  weightKg: null,
  completed: false,
  ...extra,
});

const order = (id, ldm, stops, haulKind = 'TRUCK') => ({ id, ref: id.toUpperCase(), haulKind, ldm, stops });
const semi = { ldm: 13.6, kg: 24000, pallets: null };

test('вместимость: сцепка из конструктора важнее частей', () => {
  const cap = vehicleCapacity({
    vehicleClass: 'TRUCK',
    vehicle: { ldm: 7.2, payloadKg: 9000 },
    trailer: { ldm: 8, payloadKg: 12000 },
    combo: { ldm: 15.2, payloadKg: 20000 },
  });
  assert.deepEqual(cap, { ldm: 15.2, kg: 20000, pallets: null });
});

test('вместимость: тягач — только полуприцеп, без прицепа места нет', () => {
  assert.deepEqual(vehicleCapacity({ vehicleClass: 'TRACTOR', vehicle: { ldm: null, payloadKg: null }, trailer: { ldm: 13.6, payloadKg: 25000 } }), {
    ldm: 13.6,
    kg: 25000,
    pallets: null,
  });
  assert.deepEqual(vehicleCapacity({ vehicleClass: 'TRACTOR', vehicle: { ldm: null, payloadKg: null } }), { ldm: null, kg: null, pallets: null });
});

test('вместимость: грузовик с прицепом без сцепки — сумма, неизвестный прицеп добавляет ноль', () => {
  assert.deepEqual(vehicleCapacity({ vehicleClass: 'TRUCK', vehicle: { ldm: 7, payloadKg: 9000 }, trailer: { ldm: 8, payloadKg: null } }), {
    ldm: 15,
    kg: 9000,
    pallets: null,
  });
});

test('один заказ на 7,6 м и 15 т в полуприцепе: свободно 6 м и 9 т', () => {
  const trip = [order('a', 7.6, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { weightKg: 15000 }), stop(1, 'DELIVERY', 'Tampere', '2026-11-07')], 'SEMI')];
  const [p] = proposalsForVehicle('v1', semi, trip, '2026-11-06');
  assert.equal(p.free.ldm, 6);
  assert.equal(p.free.kg, 9000);
  assert.equal(p.from.city, 'Helsinki');
  assert.equal(p.to.city, 'Tampere');
  assert.equal(p.offerable, true);
});

test('два заказа на участках: место — наименьшее на отрезке', () => {
  /* A Helsinki→Oulu весь путь, B Helsinki→Tampere только первый участок. */
  const trip = [
    order('a', 4, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { time: '08:00', weightKg: 5000 }), stop(1, 'DELIVERY', 'Oulu', '2026-11-08', { time: '12:00' })]),
    order('b', 5, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { time: '09:00', weightKg: 6000 }), stop(1, 'DELIVERY', 'Tampere', '2026-11-07', { time: '13:00' })]),
  ];
  const [p] = proposalsForVehicle('v1', semi, trip, '2026-11-06');
  assert.deepEqual(p.orderIds.sort(), ['a', 'b']);
  assert.equal(p.free.ldm, 4.6);
  assert.equal(p.free.kg, 13000);
  /* Участок после Тампере свободнее: там только A. */
  const last = p.legs[p.legs.length - 1];
  assert.equal(last.to.city, 'Oulu');
  assert.equal(last.free.ldm, 9.6);
  assert.equal(p.to.city, 'Oulu');
  assert.equal(p.availableTo, '2026-11-08');
});

test('выгрузка до следующей погрузки — два отдельных отрезка', () => {
  const trip = [
    order('a', 10, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { time: '08:00', weightKg: 20000 }), stop(1, 'DELIVERY', 'Turku', '2026-11-07', { time: '11:00' })]),
    order('b', 3, [stop(0, 'PICKUP', 'Turku', '2026-11-07', { time: '14:00', weightKg: 2000 }), stop(1, 'DELIVERY', 'Pori', '2026-11-07', { time: '17:00' })]),
  ];
  const runs = proposalsForVehicle('v1', semi, trip, '2026-11-06');
  assert.equal(runs.length, 2);
  assert.equal(runs[0].free.ldm, 3.6);
  assert.equal(runs[1].free.ldm, 10.6);
  assert.equal(runs[1].from.city, 'Turku');
});

test('один день без времени — считаем, что едут вместе (осторожно)', () => {
  const trip = [
    order('a', 6, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { weightKg: 1000 }), stop(1, 'DELIVERY', 'Lahti', '2026-11-07')]),
    order('b', 6, [stop(0, 'PICKUP', 'Lahti', '2026-11-07', { weightKg: 1000 }), stop(1, 'DELIVERY', 'Kouvola', '2026-11-07')]),
  ];
  const runs = proposalsForVehicle('v1', semi, trip, '2026-11-06');
  assert.equal(runs.length, 1);
  assert.equal(runs[0].free.ldm, 1.6);
});

test('промежуточная выгрузка места не освобождает, вес — самой тяжёлой точки', () => {
  const trip = [
    order('a', 8, [
      stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { weightKg: 12000 }),
      stop(1, 'EXTRA_UNLOAD', 'Hämeenlinna', '2026-11-07'),
      stop(2, 'EXTRA_LOAD', 'Tampere', '2026-11-07', { weightKg: 4000 }),
      stop(3, 'DELIVERY', 'Jyväskylä', '2026-11-08'),
    ]),
  ];
  const [p] = proposalsForVehicle('v1', semi, trip, '2026-11-06');
  assert.equal(p.free.ldm, 5.6);
  assert.equal(p.free.kg, 12000);
  assert.equal(p.to.city, 'Jyväskylä');
});

test('перецеп занимает машину целиком', () => {
  const trip = [order('a', null, [stop(0, 'PICKUP', 'Vuosaari', '2026-11-07'), stop(1, 'DELIVERY', 'Tampere', '2026-11-07')], 'TRAILER')];
  const [p] = proposalsForVehicle('v1', semi, trip, '2026-11-06');
  assert.equal(p.free.ldm, 0);
  assert.equal(p.offerable, false);
});

test('начатый, прошедший и слишком тесный отрезок не предлагаются', () => {
  const started = [order('a', 4, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { completed: true, weightKg: 1 }), stop(1, 'DELIVERY', 'Tampere', '2026-11-07')])];
  assert.equal(proposalsForVehicle('v1', semi, started, '2026-11-06')[0].offerable, false);
  const past = [order('a', 4, [stop(0, 'PICKUP', 'Helsinki', '2026-11-05', { weightKg: 1 }), stop(1, 'DELIVERY', 'Tampere', '2026-11-05')])];
  assert.equal(proposalsForVehicle('v1', semi, past, '2026-11-06')[0].offerable, false);
  const tight = [order('a', 13, [stop(0, 'PICKUP', 'Helsinki', '2026-11-07', { weightKg: 1 }), stop(1, 'DELIVERY', 'Tampere', '2026-11-07')])];
  assert.equal(proposalsForVehicle('v1', semi, tight, '2026-11-06')[0].offerable, false);
});

test('паллеты: известна вместимость — считаются, иначе неизвестны', () => {
  assert.deepEqual(freeOf({ ldm: 13.6, kg: 24000, pallets: 33 }, { ldm: 6, kg: 1000, pallets: 15 }), { ldm: 7.6, kg: 23000, pallets: 18 });
  assert.equal(freeOf(semi, { ldm: 6, kg: 1000, pallets: 15 }).pallets, null);
});

test('вес неизвестен у машины — место только по метрам', () => {
  const free = freeOf({ ldm: 7.2, kg: null, pallets: null }, { ldm: 3, kg: 1000, pallets: 0 });
  assert.deepEqual(free, { ldm: 4.2, kg: null, pallets: null });
  assert.equal(worthOffering(free), true);
  assert.equal(worthOffering({ ldm: null, kg: null, pallets: 5 }), false);
  assert.equal(worthOffering({ ldm: 4, kg: 300, pallets: null }), false);
});

test('fits: проверяются только известные измерения', () => {
  assert.equal(fits({ ldm: 4, kg: 5000, pallets: null }, { ldm: 6, kg: 9000, pallets: null }), true);
  assert.equal(fits({ ldm: 6.1, kg: 5000, pallets: null }, { ldm: 6, kg: 9000, pallets: null }), false);
  assert.equal(fits({ ldm: 2, kg: 5000, pallets: 10 }, { ldm: 6, kg: 9000, pallets: 8 }), false);
  assert.equal(fits({ ldm: 2, kg: 5000, pallets: 10 }, { ldm: 6, kg: null, pallets: null }), true);
});

test('частичная загрузка и каботаж', () => {
  assert.equal(isPartialLoad('VAN', 2), true);
  assert.equal(isPartialLoad('SEMI', 6), true);
  assert.equal(isPartialLoad('SEMI', 13.6), false);
  assert.equal(isPartialLoad('TRAILER', null), false);
  assert.equal(isCabotage('PL', 'FI', 'FI'), true);
  assert.equal(isCabotage('FI', 'FI', 'FI'), false);
  assert.equal(isCabotage('PL', 'PL', 'FI'), false);
  assert.equal(cabotageLeft(2), 1);
  assert.equal(cabotageLeft(5), 0);
});

test('режим: машина, иначе компания, иначе спрашивать', () => {
  const settings = [{ vehicleId: null, mode: 'AUTO' }, { vehicleId: 'v2', mode: 'NEVER' }];
  assert.equal(effectiveMode(settings, 'v1'), 'AUTO');
  assert.equal(effectiveMode(settings, 'v2'), 'NEVER');
  assert.equal(effectiveMode([], 'v1'), 'ASK');
});

test('поправка: не больше вместимости, пустое — расчёт', () => {
  const computed = { ldm: 6, kg: 9000, pallets: null };
  assert.deepEqual(correctFree(computed, semi, { ldm: 20, kg: 8000 }), { ldm: 13.6, kg: 8000, pallets: null });
  assert.deepEqual(correctFree(computed, semi, { pallets: 12 }), { ldm: 6, kg: 9000, pallets: 12 });
});

test('координаты — сетка 0,1°', () => {
  assert.equal(coarse(60.1699), 60.2);
  assert.equal(coarse(24.9384), 24.9);
  assert.equal(coarse(null), null);
});
