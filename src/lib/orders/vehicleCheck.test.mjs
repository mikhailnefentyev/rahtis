/*
 * Сверка машины на погрузке: номер, GPS, водитель. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceM, normalizePlate, samePlate, vehicleVerdict, GPS_RADIUS_M } from './vehicleCheck.ts';

const AT = '2026-11-06T10:00:00Z';
const STOP = { lat: 60.1699, lon: 24.9384 };
const base = {
  expectedPlate: 'ABC-123',
  reportedPlate: null,
  expectedTrailer: null,
  reportedTrailer: null,
  stop: STOP,
  gps: null,
  completedAt: AT,
  assignedDriverId: 'd1',
  actualDriverId: 'd1',
  driverChangeRecorded: false,
};
const codes = (r) => r.reasons.map((x) => x.code);

test('номер: пробелы, дефисы, регистр', () => {
  assert.equal(normalizePlate(' abc-123 '), 'ABC123');
  assert.ok(samePlate('ABC-123', 'abc 123'));
  assert.ok(samePlate('ÅÄÖ-12', 'åäö12'));
  assert.ok(!samePlate('ABC-123', 'ABC-124'));
  assert.ok(!samePlate('', ''));
});

test('номер: знак страны впереди не мешает', () => {
  assert.ok(samePlate('FIN ABC-123', 'ABC-123'));
  assert.ok(samePlate('(PL) WX 12345', 'WX12345'));
  assert.ok(samePlate('EST-123ABC', '123 ABC'));
  assert.ok(samePlate('FI-ABC-123', 'S ABC123'));
  /* «EST-123» — финский номер, а не знак Эстонии: букв не теряем. */
  assert.ok(!samePlate('EST-123', '123'));
  /* Без разделителя знак не отрезаем: «DAB123» ≠ «AB123». */
  assert.ok(!samePlate('DAB123', 'AB123'));
});

test('расстояние: Хельсинки — Тампере около 160 км, ноль на месте', () => {
  assert.equal(distanceM(STOP, STOP), 0);
  const km = distanceM(STOP, { lat: 61.4978, lon: 23.761 }) / 1000;
  assert.ok(km > 155 && km < 165, String(km));
});

test('водитель подтвердил тот же номер — OK', () => {
  const r = vehicleVerdict({ ...base, reportedPlate: 'abc 123' });
  assert.equal(r.verdict, 'OK');
  assert.deepEqual(codes(r), ['PLATE_CONFIRMED', 'NO_GPS']);
  assert.equal(r.driverMatches, true);
});

test('водитель сменил номер — расхождение', () => {
  const r = vehicleVerdict({ ...base, reportedPlate: 'XYZ-999' });
  assert.equal(r.verdict, 'MISMATCH');
  assert.deepEqual(r.reasons[0], { code: 'PLATE_MISMATCH', expected: 'ABC-123', reported: 'XYZ-999' });
});

test('прицеп другой — расхождение, тягач тот же', () => {
  const r = vehicleVerdict({ ...base, reportedPlate: 'ABC-123', expectedTrailer: 'TRL-1', reportedTrailer: 'TRL-2' });
  assert.equal(r.verdict, 'MISMATCH');
  assert.deepEqual(codes(r), ['PLATE_CONFIRMED', 'TRAILER_MISMATCH', 'NO_GPS']);
});

test('GPS рядом — OK, далеко — расхождение', () => {
  const near = vehicleVerdict({ ...base, gps: { lat: 60.175, lon: 24.94, at: AT } });
  assert.equal(near.verdict, 'OK');
  assert.ok(near.gpsDistanceM < GPS_RADIUS_M);
  assert.equal(near.gpsSeenAt, AT);

  const far = vehicleVerdict({ ...base, gps: { lat: 61.4978, lon: 23.761, at: AT } });
  assert.equal(far.verdict, 'MISMATCH');
  assert.equal(far.reasons[0].code, 'GPS_FAR');
});

test('GPS устарел, нет координат точки или нет GPS — «нет данных», не расхождение', () => {
  const stale = vehicleVerdict({ ...base, gps: { lat: 61.4978, lon: 23.761, at: '2026-11-06T08:30:00Z' } });
  assert.equal(stale.verdict, 'NO_DATA');
  assert.equal(stale.gpsDistanceM, null);
  assert.equal(vehicleVerdict({ ...base, stop: null, gps: { lat: 61.4, lon: 23.7, at: AT } }).verdict, 'NO_DATA');
  assert.equal(vehicleVerdict(base).verdict, 'NO_DATA');
});

test('без номера в заказе сверять не с чем', () => {
  const r = vehicleVerdict({ ...base, expectedPlate: null, reportedPlate: 'XYZ-999' });
  assert.equal(r.verdict, 'NO_DATA');
});

test('другой водитель — справочно, без смены в журнале', () => {
  const other = vehicleVerdict({ ...base, reportedPlate: 'ABC-123', actualDriverId: 'd2' });
  assert.equal(other.verdict, 'OK');
  assert.equal(other.driverMatches, false);
  assert.ok(codes(other).includes('DRIVER_OTHER'));

  const recorded = vehicleVerdict({ ...base, actualDriverId: 'd2', driverChangeRecorded: true });
  assert.ok(!codes(recorded).includes('DRIVER_OTHER'));

  assert.equal(vehicleVerdict({ ...base, actualDriverId: null }).driverMatches, null);
});
