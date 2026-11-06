import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoAnswerLang, composeAutoAnswer, detectAsk, hasLiveData, isLate, localParts } from './autoAnswer.ts';

const L = {
  delivered: 'Delivered {at}, {city}.',
  loaded: 'Loaded {at}, {city}.',
  notLoaded: 'Not loaded yet.',
  lastDone: 'Last: {stop}, done {at}.',
  onSite: 'Now at {stop}, arrived {at}.',
  next: 'Next: {stop}.',
  planned: 'Planned {at}.',
  eta: 'ETA {at}.',
  late: 'Running late.',
  notStarted: 'Not started yet.',
  started: 'On the way.',
  assigned: 'Truck assigned.',
  notAssigned: 'No truck assigned yet.',
  pickupPlanned: 'Pickup planned {at}, {city}.',
  notified: 'The dispatcher has been notified.',
  askDriver: 'No live data: ask the driver here.',
};

const ctx = {
  stop: (role) => ({ PICKUP: 'Pickup', DELIVERY: 'Delivery' })[role] ?? role,
  at: (iso) => iso.slice(11, 16),
  planned: (date, time) => `${date}${time ? ` ${time.slice(0, 5)}` : ''}`,
};

const stop = (role, city, extra = {}) => ({
  role,
  city,
  country: 'FI',
  date: null,
  time: null,
  arrivedAt: null,
  completedAt: null,
  ...extra,
});

const pickup = stop('PICKUP', 'Kouvola', { date: '2026-11-06', time: '08:00:00' });
const delivery = stop('DELIVERY', 'Turku', { date: '2026-11-06', time: '14:00:00' });

const base = {
  kind: 'WHERE',
  asker: 'SHIPPER',
  status: 'AWAIT_DRIVER',
  haulKind: 'TRAILER',
  assigned: false,
  delivered: false,
  pickup,
  lastDone: null,
  next: pickup,
  eta: null,
};

const compose = (facts) => composeAutoAnswer({ ...base, ...facts }, L, ctx).split('\n');

test('не начат, машины нет — план погрузки и «диспетчеру сообщили»', () => {
  assert.equal(hasLiveData(base), false);
  assert.deepEqual(compose({}), [
    'Not started yet.',
    'No truck assigned yet.',
    'Pickup planned 2026-11-06 08:00, Kouvola.',
    'The dispatcher has been notified.',
  ]);
});

test('не начат, машина назначена; спросил перевозчик — «спросите водителя»', () => {
  assert.deepEqual(compose({ assigned: true, asker: 'CARRIER' }), [
    'Not started yet.',
    'Truck assigned.',
    'Pickup planned 2026-11-06 08:00, Kouvola.',
    'No live data: ask the driver here.',
  ]);
});

test('без плановой даты — без строки плана', () => {
  const lines = compose({ pickup: stop('PICKUP', 'Kouvola'), next: stop('PICKUP', 'Kouvola') });
  assert.ok(!lines.some((l) => l.startsWith('Pickup planned')));
});

test('едет к погрузке с оценкой — следующая точка, план, оценка', () => {
  assert.deepEqual(compose({ status: 'IN_PROGRESS', eta: { at: '2026-11-06T07:50:00Z', late: false } }), [
    'On the way.',
    'Next: Pickup, Kouvola.',
    'Planned 2026-11-06 08:00.',
    'ETA 07:50.',
  ]);
});

test('погружено, едет к выгрузке и опаздывает', () => {
  const done = { ...pickup, completedAt: '2026-11-06T06:12:00Z' };
  assert.deepEqual(
    compose({ status: 'IN_PROGRESS', pickup: done, lastDone: done, next: delivery, eta: { at: '2026-11-06T13:40:00Z', late: true } }),
    ['Last: Pickup, Kouvola, done 06:12.', 'Next: Delivery, Turku.', 'Planned 2026-11-06 14:00.', 'ETA 13:40.', 'Running late.'],
  );
});

test('стоит на точке — «на месте с …», без оценки', () => {
  const here = { ...pickup, arrivedAt: '2026-11-06T05:58:00Z' };
  assert.deepEqual(compose({ status: 'IN_PROGRESS', next: here }), ['On the way.', 'Now at Pickup, Kouvola, arrived 05:58.']);
});

test('«Погружено?» — да, и погрузка не повторяется', () => {
  const done = { ...pickup, completedAt: '2026-11-06T06:12:00Z' };
  assert.deepEqual(compose({ kind: 'LOADED', status: 'IN_PROGRESS', pickup: done, lastDone: done, next: delivery }), [
    'Loaded 06:12, Kouvola.',
    'Next: Delivery, Turku.',
    'Planned 2026-11-06 14:00.',
  ]);
});

test('«Погружено?» — ещё нет', () => {
  assert.deepEqual(compose({ kind: 'LOADED', status: 'IN_PROGRESS', eta: { at: '2026-11-06T07:50:00Z', late: false } }), [
    'Not loaded yet.',
    'Next: Pickup, Kouvola.',
    'Planned 2026-11-06 08:00.',
    'ETA 07:50.',
  ]);
  /* Данных нет — «нет» и то, что известно. */
  assert.deepEqual(compose({ kind: 'LOADED' })[0], 'Not loaded yet.');
});

test('доставлено — одна строка', () => {
  const done = { ...delivery, completedAt: '2026-11-06T12:30:00Z' };
  assert.deepEqual(compose({ status: 'DONE', delivered: true, lastDone: done, next: null }), ['Delivered 12:30, Turku.']);
  assert.deepEqual(compose({ kind: 'LOADED', status: 'DONE', delivered: true, lastDone: done, next: null }), [
    'Delivered 12:30, Turku.',
  ]);
});

test('язык ответа: свой, по региону, чужой — английский', () => {
  assert.equal(autoAnswerLang('fi'), 'fi');
  assert.equal(autoAnswerLang('ru-RU'), 'ru');
  assert.equal(autoAnswerLang('LT'), 'lt');
  assert.equal(autoAnswerLang('nb'), 'en');
  assert.equal(autoAnswerLang(''), 'en');
  assert.equal(autoAnswerLang(null), 'en');
});

test('опоздание — по местному времени точки с допуском 30 минут', () => {
  const plan = { date: '2026-11-06', time: '14:00:00' };
  assert.equal(isLate({ date: '2026-11-06', time: '14:30' }, plan), false);
  assert.equal(isLate({ date: '2026-11-06', time: '14:31' }, plan), true);
  assert.equal(isLate({ date: '2026-11-07', time: '06:00' }, plan), true);
  assert.equal(isLate({ date: '2026-11-05', time: '23:00' }, plan), false);
  assert.equal(isLate({ date: '2026-11-06', time: '23:59' }, { date: '2026-11-06', time: null }), false);
  assert.equal(isLate({ date: '2026-11-06', time: '10:00' }, { date: null, time: null }), false);
});

test('местные дата и время — в поясе точки', () => {
  assert.deepEqual(localParts('2026-11-06T22:30:00Z', 'Europe/Helsinki'), { date: '2026-11-07', time: '00:30' });
  assert.deepEqual(localParts('2026-11-06T22:30:00Z', 'Europe/Warsaw'), { date: '2026-11-06', time: '23:30' });
});

test('похоже на вопрос о машине — на всех языках', () => {
  for (const text of ['Missä auto on?', 'missäs rekka', 'Where is the truck', 'Var är bilen?', 'Где машина?', 'Gdzie jest auto?', 'Wo ist der LKW?', 'Kus on auto?', 'Kur ir mašīna?', 'Kur yra sunkvežimis?']) {
    assert.equal(detectAsk(text), 'WHERE', text);
  }
  for (const text of ['Milloin saapuu?', 'Saapuuko tänään?', 'When will it arrive', 'ETA?', 'När kommer den?', 'Когда будет?', 'Kiedy będzie?', 'Wann kommt er?', 'Millal jõuab?', 'Kad būs?', 'Kada atvyks?']) {
    assert.equal(detectAsk(text), 'WHEN', text);
  }
});

test('обычные сообщения — без подсказки', () => {
  for (const text of ['Portti 3 on kiinni', 'Thanks!', 'Позвоните мне', 'Proszę zadzwonić', 'Kurier', 'Beta', 'Wolke', 'Kadaver']) {
    assert.equal(detectAsk(text), null, text);
  }
});
