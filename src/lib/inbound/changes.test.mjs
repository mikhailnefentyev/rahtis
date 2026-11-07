/*
 * Поправка к рейсу из письма: сравнение «сейчас → в письме». Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeKey, refKey, sameAddress, selectedPatches, tripChanges } from './changes.ts';

const now = (over) => ({
  id: 's1', role: 'LOAD', sequence: 1, completed: false,
  address: 'Satamakaari 18, 00980 Helsinki', city: 'Helsinki', place_name: 'Vuosaaren satama', company_name: 'DFDS',
  contact_name: null, contact_phone: null, scheduled_date: '2026-11-09', scheduled_time: '08:00:00',
  external_ref: 'B-77', cargo_weight_kg: 24000, lat: 60.209, lon: 25.192,
  ...over,
});

const addr = (over) => ({ text: '', street: '', postalCode: '', city: '', country: 'FI', placeName: '', ...over });
const next = (over) => ({
  address: addr({ text: 'Satamakaari 18, 00980 Helsinki', street: 'Satamakaari 18', city: 'Helsinki' }),
  company: '', date: '', time: '', contact: '', phone: '', ref: '', weight: '', note: '', chosen: null,
  ...over,
});
const draft = (stops, over = {}) => ({
  haulKind: 'SEMI', shipperRef: '4471', unitPlate: '', vehiclePlate: '', containerFeet: '', ldm: '', rate: '', currency: null, comment: '',
  pickup: stops[0] ?? null, delivery: stops[1] ?? null, extras: [], ret: null, client: null, filled: [], missing: [], confidence: 'high', foreignPrice: null,
  ...over,
});
const none = () => null;

test('то же письмо ещё раз — изменений нет', () => {
  const c = tripChanges({
    stops: [now(), now({ id: 's2', role: 'UNLOAD', sequence: 2, address: 'Hatanpään valtatie 30, 33100 Tampere', city: 'Tampere', lat: 61.48, lon: 23.76 })],
    draft: draft([
      next({ date: '2026-11-09', time: '08:00', ref: 'b-77', weight: '24' }),
      next({ address: addr({ street: 'Hatanpään valtatie 30', city: 'Tampere' }) }),
    ]),
    vehicle: null,
    findVehicle: none,
  });
  assert.equal(c.empty, true);
});

test('новое время и дата погрузки, новый адрес выгрузки с координатами', () => {
  const c = tripChanges({
    stops: [now(), now({ id: 's2', role: 'UNLOAD', sequence: 2, address: 'Hatanpään valtatie 30, 33100 Tampere', city: 'Tampere', lat: 61.48, lon: 23.76 })],
    draft: draft([
      next({ date: '2026-11-10', time: '10:00' }),
      next({
        address: addr({ text: 'Nokiantie 2, 37100 Nokia', street: 'Nokiantie 2', city: 'Nokia' }),
        chosen: { address: 'Nokiantie 2, 37100 Nokia', city: 'Nokia', country: 'FI', position: { lat: 61.47, lon: 23.5 }, score: 0.9, precise: true },
      }),
    ]),
    vehicle: null,
    findVehicle: none,
  });
  assert.deepEqual(c.stops[0].fields.map((f) => f.key), ['date', 'time']);
  assert.equal(c.stops[0].fields[1].patch.scheduled_time, '10:00');
  assert.equal(c.stops[1].fields[0].key, 'address');
  assert.equal(c.stops[1].fields[0].patch.lat, '61.47');

  const all = new Set([changeKey('s1', 'time'), changeKey('s2', 'address')]);
  const patches = selectedPatches(c, all);
  assert.deepEqual(patches.map((p) => [p.stopId, Object.keys(p.patch).sort(), p.address]), [
    ['s1', ['scheduled_time'], false],
    ['s2', ['address', 'city', 'country', 'geocode_score', 'lat', 'lon'], true],
  ]);
});

test('адрес без координат и пройденная точка — без галочки', () => {
  const c = tripChanges({
    stops: [now({ completed: true }), now({ id: 's2', role: 'UNLOAD', sequence: 2, address: 'Hatanpään valtatie 30', city: 'Tampere', lat: null, lon: null })],
    draft: draft([next({ time: '11:00' }), next({ address: addr({ text: 'Nokiantie 2, Nokia', street: 'Nokiantie 2', city: 'Nokia' }) })]),
    vehicle: null,
    findVehicle: none,
  });
  assert.equal(c.stops[0].fields[0].blocked, 'done');
  assert.equal(c.stops[0].fields[0].patch, null);
  assert.equal(c.stops[1].fields[0].blocked, 'noCoordinates');
  /* Форма прислала ключи — но разрешённого нечего применять. */
  assert.deepEqual(selectedPatches(c, new Set([changeKey('s1', 'time'), changeKey('s2', 'address')])), []);
});

test('тот же адрес, написанный иначе, но в той же точке карты — не изменение', () => {
  const same = sameAddress(now(), next({
    address: addr({ street: 'Satamakaarenkatu 18', city: 'Helsingfors' }),
    chosen: { address: 'x', city: null, country: null, position: { lat: 60.2091, lon: 25.1921 }, score: 1, precise: true },
  }));
  assert.equal(same, true);
});

test('пустое в письме не стирает; другое число точек — сравниваются края', () => {
  const c = tripChanges({
    stops: [now(), now({ id: 'mid', sequence: 2 }), now({ id: 's3', role: 'UNLOAD', sequence: 3, address: 'Hatanpään valtatie 30', city: 'Tampere' })],
    draft: draft([next({ time: '09:00' }), next({ address: addr({ street: 'Hatanpään valtatie 30', city: 'Tampere' }), contact: 'Matti', phone: '+358 40 123' })]),
    vehicle: null,
    findVehicle: none,
  });
  assert.equal(c.stopCountDiffers, true);
  assert.deepEqual(c.stops.map((s) => s.stopId), ['s1', 's3']);
  assert.deepEqual(c.stops[1].fields.map((f) => f.key), ['contact', 'phone']);
});

test('машина: другая из парка, неизвестная, та же', () => {
  const fleet = { 'ABC-123': { id: 'v1', plate: 'ABC-123' }, 'XYZ-987': { id: 'v2', plate: 'XYZ-987' } };
  const find = (p) => fleet[p.toUpperCase()] ?? null;
  const base = { stops: [now()], findVehicle: find };
  assert.deepEqual(tripChanges({ ...base, draft: draft([next()], { vehiclePlate: 'xyz-987' }), vehicle: fleet['ABC-123'] }).vehicle, { now: 'ABC-123', next: 'XYZ-987', vehicleId: 'v2' });
  assert.deepEqual(tripChanges({ ...base, draft: draft([next()], { vehiclePlate: 'ZZZ-1' }), vehicle: fleet['ABC-123'] }).vehicle, { now: 'ABC-123', next: 'ZZZ-1', vehicleId: null });
  assert.equal(tripChanges({ ...base, draft: draft([next()], { vehiclePlate: 'abc-123' }), vehicle: fleet['ABC-123'] }).vehicle, null);
});

test('номер заказа клиента: без знаков и регистра', () => {
  assert.equal(refKey(' dfds-4471 / a '), 'DFDS4471A');
  assert.equal(refKey(null), '');
});
