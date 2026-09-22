/*
 * Тесты справочного калькулятора. Запуск: npm test.
 *
 * Время в данных — в UTC, а ожидания — в местном времени Хельсинки:
 * именно это расхождение и проверяется. В сентябре Хельсинки UTC+3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitShift, summarizeDriver, payableKm, profileOn, finnishHolidays, tesBaseOn, tesGradeOn } from './driverPay.ts';

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

/* ── Kuorma-autoalan TES 2025–2028 ─────────────────────────────── */

const kuorma = {
  ...tes,
  baseHourlyCents: 1609,
  overtimeBasis: 'PERIOD',
  periodRegularMinutes: 4800,
  periodAnchor: '2026-01-05',
  overtime1Minutes: 720,
  overtime1Bps: 5000,
  overtime2Bps: 10000,
  eveningCents: 0,
  eveningBps: 1500,
  nightCents: 0,
  nightBps: 2000,
  saturdayBps: 0,
  sundayBps: 10000,
  holidaysAsSunday: true,
  minPaidMinutes: 285,
  rates: [
    { grade: 'TRUCK_0', validFrom: '2025-03-01', hourlyCents: 1577 },
    { grade: 'TRUCK_0', validFrom: '2026-06-01', hourlyCents: 1623 },
    { grade: 'TRUCK_4', validFrom: '2025-03-01', hourlyCents: 1594 },
    { grade: 'TRUCK_4', validFrom: '2026-06-01', hourlyCents: 1640 },
  ],
};
const kuormaProfile = (grade = null) => ({
  validFrom: '2025-03-01',
  model: 'TES',
  perKmCents: null,
  tripBps: null,
  hourlyCents: null,
  tes: kuorma,
  tesGrade: grade,
});

test('праздники Финляндии 2026: подвижные и кануны', () => {
  const h = finnishHolidays(2026);
  for (const d of ['2026-04-03', '2026-04-04', '2026-04-06', '2026-05-14', '2026-06-19', '2026-06-20', '2026-10-31', '2026-12-24']) {
    assert.ok(h.has(d), d);
  }
  assert.ok(!h.has('2026-04-05'), 'пасхальное воскресенье узнаётся по дню недели');
});

test('ставка по категории меняется в день повышения', () => {
  assert.equal(tesBaseOn(kuormaProfile('TRUCK_0'), '2026-05-31'), 1577);
  assert.equal(tesBaseOn(kuormaProfile('TRUCK_0'), '2026-06-01'), 1623);
  assert.equal(tesBaseOn(kuormaProfile(null), '2026-06-01'), 1609);
});

test('TES § 14.2: сверхурочные сверх 80 ч за 2 недели, 12 ч по +50 %, дальше +100 %', () => {
  // период 14.–27.9.2026; десять дней по 10 ч, 06:00–16:00 местного
  const days = ['14', '15', '16', '17', '18', '21', '22', '23', '24', '25'];
  const summary = summarizeDriver({
    shifts: days.map((d) => shift(`2026-09-${d}T03:00:00Z`, `2026-09-${d}T13:00:00Z`)),
    trips: [],
    profiles: [kuormaProfile('TRUCK_0')],
    now: NOW,
  });
  const byDate = Object.fromEntries(summary.days.map((d) => [d.date, d]));
  assert.equal(byDate['2026-09-23'].overtime1Minutes, 0); // 80 ч ровно к концу 8-го дня
  assert.equal(byDate['2026-09-24'].overtime1Minutes, 600);
  assert.equal(byDate['2026-09-25'].overtime1Minutes, 120);
  assert.equal(byDate['2026-09-25'].overtime2Minutes, 480);
  // ставка с 1.6.2026: 10 ч × 16,23 + 2 ч × 8,115 + 8 ч × 16,23
  assert.equal(byDate['2026-09-25'].amountCents, 16230 + 1623 + 12984);
});

test('TES § 11.3: короткий день оплачивается как 4 ч 45 мин', () => {
  const summary = summarizeDriver({
    shifts: [shift('2026-09-16T05:00:00Z', '2026-09-16T07:00:00Z')],
    trips: [],
    profiles: [kuormaProfile('TRUCK_0')],
    now: NOW,
  });
  const [day] = summary.days;
  assert.equal(day.workMinutes, 120);
  assert.equal(day.paidMinutes, 285);
  assert.equal(day.parts.baseCents, Math.round((285 * 1623) / 60));
});

test('TES § 10.1: вечер +15 %, ночь +20 % от ставки категории', () => {
  // пятница 18.09.2026, 16:00–23:00 местного
  const summary = summarizeDriver({
    shifts: [shift('2026-09-18T13:00:00Z', '2026-09-18T20:00:00Z')],
    trips: [],
    profiles: [kuormaProfile('TRUCK_0')],
    now: NOW,
  });
  const [day] = summary.days;
  assert.equal(day.parts.eveningCents, Math.round((240 * 1623 * 1500) / 60 / 10_000));
  assert.equal(day.parts.nightCents, Math.round((60 * 1623 * 2000) / 60 / 10_000));
});

test('TES § 11.4, § 14.5: сочельник оплачивается как воскресенье', () => {
  // четверг 24.12.2026, 10:00–12:00 местного (UTC+2)
  const summary = summarizeDriver({
    shifts: [shift('2026-12-24T08:00:00Z', '2026-12-24T10:00:00Z')],
    trips: [],
    profiles: [kuormaProfile('TRUCK_0')],
    now: NOW,
  });
  const [day] = summary.days;
  assert.equal(day.sundayMinutes, 120);
  assert.equal(day.parts.weekendCents, Math.round((120 * 1623 * 10_000) / 60 / 10_000));
});

test('TES § 8: ступень стажа считается от даты начала стажа', () => {
  const profile = { ...kuormaProfile('TRUCK'), tesExperienceSince: '2022-10-01' };
  assert.equal(tesGradeOn(profile, '2026-09-30'), 'TRUCK_0');
  assert.equal(tesGradeOn(profile, '2026-10-01'), 'TRUCK_4');
  assert.equal(tesBaseOn(profile, '2026-09-30'), 1623);
  assert.equal(tesBaseOn(profile, '2026-10-01'), 1640);
  // явная ступень не пересчитывается
  assert.equal(tesGradeOn({ ...profile, tesGrade: 'TRUCK_0' }, '2030-01-01'), 'TRUCK_0');
});
