/*
 * Тесты справочного калькулятора. Запуск: npm test.
 *
 * Время в данных — в UTC, а ожидания — в местном времени Хельсинки:
 * именно это расхождение и проверяется. В сентябре Хельсинки UTC+3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitShift, summarizeDriver, payableKm, profileOn } from './driverPay.ts';

const NOW = Date.parse('2026-12-31T00:00:00Z');

const tes = {
  baseHourlyCents: 1500,
  dailyRegularMinutes: 480,
  overtime1Minutes: 120,
  overtime1Bps: 5000,
  overtime2Bps: 10000,
  eveningStart: '18:00',
  eveningEnd: '22:00',
  eveningCents: 100,
  nightStart: '22:00',
  nightEnd: '06:00',
  nightCents: 200,
  saturdayBps: 0,
  sundayBps: 10000,
};

const shift = (start, end, breaks = [], odo = [null, null]) => ({
  id: start,
  start,
  end,
  breaks,
  odometerStart: odo[0],
  odometerEnd: odo[1],
});

test('перерыв вычитается, вечер и ночь считаются по местному времени', () => {
  // пятница 18.09.2026, 16:00–23:00 по Хельсинки, перерыв 30 минут
  const s = splitShift(
    shift('2026-09-18T13:00:00Z', '2026-09-18T20:00:00Z', [
      { start: '2026-09-18T15:00:00Z', end: '2026-09-18T15:30:00Z' },
    ]),
    tes,
    NOW,
  );
  assert.equal(s.date, '2026-09-18');
  assert.equal(s.workMinutes, 390);
  assert.equal(s.breakMinutes, 30);
  // вечер 18:00–22:00 минус перерыв 18:00–18:30
  assert.equal(s.eveningMinutes, 210);
  assert.equal(s.nightMinutes, 60);
});

test('ночная смена относится к дню начала, воскресенье — по минутам', () => {
  // суббота 19.09 22:00 → воскресенье 20.09 06:00 местного
  const s = splitShift(shift('2026-09-19T19:00:00Z', '2026-09-20T03:00:00Z'), tes, NOW);
  assert.equal(s.date, '2026-09-19');
  assert.equal(s.workMinutes, 480);
  assert.equal(s.nightMinutes, 480);
  assert.equal(s.saturdayMinutes, 120);
  assert.equal(s.sundayMinutes, 360);
});

test('переход на зимнее время не теряет и не удваивает час', () => {
  // 25.10.2026 в 04:00 местного часы переводятся на 03:00: 00:00–08:00 местного = 9 часов
  const s = splitShift(shift('2026-10-24T21:00:00Z', '2026-10-25T06:00:00Z'), null, NOW);
  assert.equal(s.workMinutes, 540);
});

test('TES: сверхурочные двумя ступенями по сумме смен дня', () => {
  const summary = summarizeDriver({
    // две смены четверга 17.09: 06:00–12:00 и 13:00–18:00 местного = 11 часов
    shifts: [
      shift('2026-09-17T03:00:00Z', '2026-09-17T09:00:00Z'),
      shift('2026-09-17T10:00:00Z', '2026-09-17T15:00:00Z'),
    ],
    trips: [],
    profiles: [{ validFrom: '2026-01-01', model: 'TES', perKmCents: null, tripBps: null, hourlyCents: null, tes }],
    now: NOW,
  });
  const [day] = summary.days;
  assert.equal(day.workMinutes, 660);
  assert.equal(day.overtime1Minutes, 120);
  assert.equal(day.overtime2Minutes, 60);
  assert.equal(day.parts.baseCents, 16500); // 11 ч × 15 €
  assert.equal(day.parts.overtimeCents, 1500 + 1500); // 2 ч × 7,50 + 1 ч × 15
  assert.equal(day.amountCents, 19500);
});

test('ставка берётся действующая на дату, без ставки сумма неполная', () => {
  const profiles = [
    { validFrom: '2026-09-10', model: 'FLAT_HOURLY', perKmCents: null, tripBps: null, hourlyCents: 2000, tes: null },
    { validFrom: '2026-09-15', model: 'FLAT_HOURLY', perKmCents: null, tripBps: null, hourlyCents: 2200, tes: null },
  ];
  assert.equal(profileOn(profiles, '2026-09-14').hourlyCents, 2000);
  assert.equal(profileOn(profiles, '2026-09-15').hourlyCents, 2200);
  assert.equal(profileOn(profiles, '2026-09-01'), null);

  const summary = summarizeDriver({
    shifts: [
      shift('2026-09-05T05:00:00Z', '2026-09-05T06:00:00Z'),
      shift('2026-09-16T05:00:00Z', '2026-09-16T07:00:00Z'),
    ],
    trips: [],
    profiles,
    now: NOW,
  });
  assert.equal(summary.totals.amountCents, 4400);
  assert.equal(summary.totals.missingRate, true);
});

test('км: одометр важнее пробега рейсов, процент — от выплаты', () => {
  assert.equal(payableKm({ odometerKm: 0, tripKm: 120 }), 120);
  assert.equal(payableKm({ odometerKm: 180, tripKm: 120 }), 180);

  const summary = summarizeDriver({
    shifts: [],
    trips: [
      { closedAt: '2026-09-16T10:00:00Z', distanceKm: 120, stopsDone: 3, payoutCents: 30000 },
      { closedAt: '2026-09-16T14:00:00Z', distanceKm: 80, stopsDone: 2, payoutCents: 20000 },
    ],
    profiles: [{ validFrom: '2026-01-01', model: 'TRIP_PERCENT', perKmCents: null, tripBps: 2500, hourlyCents: null, tes: null }],
    now: NOW,
  });
  assert.equal(summary.totals.trips, 2);
  assert.equal(summary.totals.stops, 5);
  assert.equal(summary.totals.tripKm, 200);
  assert.equal(summary.totals.amountCents, 12500);
});

test('незакрытая смена считается до текущей минуты', () => {
  const s = splitShift(shift('2026-09-18T05:00:00Z', null), null, Date.parse('2026-09-18T07:30:00Z'));
  assert.equal(s.workMinutes, 150);
});
