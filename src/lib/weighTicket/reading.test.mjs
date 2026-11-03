/*
 * Весовой талон: разбор напечатанных весов и проверки. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formWeights, matchScaleSite, parsePrintedWeight, sanitizeReading, ticketWarnings, weighedAtIso } from './reading.ts';

test('кг: пробел, точка и запятая между тройками — тысячи', () => {
  assert.equal(parsePrintedWeight('24 560', 'kg'), 24_560);
  assert.equal(parsePrintedWeight('24.560', 'kg'), 24_560);
  assert.equal(parsePrintedWeight('24,560', 'kg'), 24_560);
  assert.equal(parsePrintedWeight('24560,0', 'kg'), 24_560);
});

test('тонны: запятая и точка — десятичные', () => {
  assert.equal(parsePrintedWeight('24,56', 't'), 24_560);
  assert.equal(parsePrintedWeight('24.56', 't'), 24_560);
  assert.equal(parsePrintedWeight('2,45', 't'), 2_450);
  assert.equal(parsePrintedWeight('1.024,5', 't'), 1_024_500);
});

test('без единицы: меньше 100 — тонны', () => {
  assert.equal(parsePrintedWeight('24,5', null), 24_500);
  assert.equal(parsePrintedWeight('24560', null), 24_560);
  assert.equal(parsePrintedWeight('abc', null), null);
});

test('напечатанная строка важнее килограммов модели', () => {
  const r = sanitizeReading({ unit: 't', gross_text: '38,40', gross_kg: 3840, tare_text: null, tare_kg: 14200, net_text: null, net_kg: null, plates: ['ABC-123'], confidence: 'high' });
  assert.equal(r.grossKg, 38_400);
  assert.equal(r.tareKg, 14_200);
  assert.deepEqual(r.plates, ['ABC-123']);
});

test('тара из брутто и нетто', () => {
  assert.deepEqual(formWeights({ grossKg: 38_400, tareKg: null, netKg: 24_200 }), { grossKg: 38_400, tareKg: 14_200 });
  assert.deepEqual(formWeights({ grossKg: null, tareKg: 14_200, netKg: 24_200 }), { grossKg: 38_400, tareKg: 14_200 });
});

const base = { ticketNo: null, scaleSiteId: null, reading: null, duplicates: null, expectedPlates: [], limitKg: null, comboTareKg: null };

test('сдвинутая запятая: 2,45 т брутто → предложить 24,5 т', () => {
  const w = ticketWarnings({ ...base, grossKg: 2_450, tareKg: 14_000 });
  assert.equal(w[0].code, 'DECIMAL');
  assert.equal(w[0].suggestedKg, 24_500);
});

test('чужой номер машины', () => {
  const reading = sanitizeReading({ plates: ['XYZ-999', 'abc 123'], confidence: 'high' });
  const w = ticketWarnings({ ...base, grossKg: 40_000, tareKg: 15_000, reading, expectedPlates: ['ABC-123'] });
  assert.deepEqual(w.map((x) => x.code), ['PLATE_MISMATCH']);
  assert.deepEqual(w[0].read, ['XYZ-999']);
});

test('нетто не равно брутто − тара', () => {
  const reading = sanitizeReading({ unit: 'kg', gross_text: '40 000', tare_text: '15 000', net_text: '35 000', confidence: 'high' });
  const w = ticketWarnings({ ...base, grossKg: 40_000, tareKg: 15_000, reading });
  assert.ok(w.some((x) => x.code === 'NET_MISMATCH'));
});

test('повтор талона: те же весы или весы неизвестны — да; другие весы — нет', () => {
  const dup = { load_id: 'l', ticket_no: '12 345', scale_site_id: 's1', scale_name: 'A', unloaded_at: '2026-11-02T10:00:00Z', net_kg: 1, job_name: 'J' };
  const duplicates = { photo: [], ticket: [dup] };
  assert.ok(ticketWarnings({ ...base, grossKg: 40_000, tareKg: 15_000, ticketNo: '12345', scaleSiteId: 's1', duplicates }).some((x) => x.code === 'DUPLICATE_TICKET'));
  assert.ok(ticketWarnings({ ...base, grossKg: 40_000, tareKg: 15_000, ticketNo: '12-345', scaleSiteId: null, duplicates }).some((x) => x.code === 'DUPLICATE_TICKET'));
  assert.ok(!ticketWarnings({ ...base, grossKg: 40_000, tareKg: 15_000, ticketNo: '12345', scaleSiteId: 's2', duplicates }).some((x) => x.code === 'DUPLICATE_TICKET'));
});

test('нетто больше грузоподъёмности сцепки', () => {
  const w = ticketWarnings({ ...base, grossKg: 75_000, tareKg: 15_000, limitKg: 42_000, comboTareKg: 16_000 });
  assert.ok(w.some((x) => x.code === 'OVER_PAYLOAD'));
});

test('нормальный рейс — без предупреждений', () => {
  assert.deepEqual(ticketWarnings({ ...base, grossKg: 41_200, tareKg: 16_100, limitKg: 42_000, comboTareKg: 16_000, expectedPlates: ['ABC-123'] }), []);
});

test('весы по шапке талона', () => {
  const sites = [
    { id: '1', name: 'HSY Ämmässuo ekoteollisuuskeskus', city: 'Espoo' },
    { id: '2', name: 'NCC Mäntsälä Ohkola', city: 'Mäntsälä' },
  ];
  assert.equal(matchScaleSite('HSY Ämmässuo vaaka 2', sites)?.id, '1');
  assert.equal(matchScaleSite('Ohkolan kalliomurske, Mäntsälä', sites)?.id, '2');
  assert.equal(matchScaleSite('Tuntematon', sites), null);
});

test('время талона по Хельсинки', () => {
  assert.equal(weighedAtIso('2026-11-03T10:15'), '2026-11-03T08:15:00.000Z');
  assert.equal(weighedAtIso('2026-07-03T10:15'), '2026-07-03T07:15:00.000Z');
  assert.equal(weighedAtIso('2026-11-03'), null);
});
