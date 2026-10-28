/*
 * Разрешённая масса сцепок по странам. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combinationMass, combinationProblem, legalMassKg, overloadKg } from './mass.ts';

const nuppi5 = { kind: 'TRUCK', axles: 5 };
const nuppi4 = { kind: 'TRUCK', axles: 4 };
const tractor3 = { kind: 'TRACTOR', axles: 3 };
const tractor2 = { kind: 'TRACTOR', axles: 2 };
const cassette4 = { kind: 'FULL', axles: 4, twinWheels: true };
const semi3 = { kind: 'SEMI', axles: 3, twinWheels: false };

test('FI: кассета 5+4 — 76 т со сдвоенными колёсами, 69 т без', () => {
  assert.equal(legalMassKg('FI', nuppi5, [cassette4]).kg, 76_000);
  assert.equal(legalMassKg('FI', nuppi5, [{ ...cassette4, twinWheels: false }]).kg, 69_000);
});

test('FI: одиночные nuppi 4 и 5 осей — 35 и 42 т', () => {
  assert.equal(legalMassKg('FI', nuppi4, []).kg, 35_000);
  assert.equal(legalMassKg('FI', nuppi5, []).kg, 42_000);
});

test('FI: тягач 3 + полуприцеп 3 — 28 + 24 = 52 т (таблица Traficom 2019); 4+4 со сдвоенными — 68 т', () => {
  assert.equal(legalMassKg('FI', tractor3, [semi3]).kg, 52_000);
  assert.equal(legalMassKg('FI', nuppi4, [cassette4]).kg, 68_000);
});

test('FI: прицеп с центральной осью — не больше 50 т', () => {
  assert.equal(legalMassKg('FI', nuppi5, [{ kind: 'CENTER_AXLE', axles: 3, twinWheels: true }]).kg, 50_000);
});

test('DE: 2+3 полуприцеп — 40 т, 4-осный самосвал — 32 т', () => {
  assert.equal(legalMassKg('DE', tractor2, [semi3]).kg, 40_000);
  assert.equal(legalMassKg('DE', nuppi4, []).kg, 32_000);
});

test('SE: BK1 64 т, BK4 74 т; NO: 50/60 т', () => {
  assert.equal(legalMassKg('SE', nuppi4, [cassette4], { roadClass: 'BK1' }).kg, 64_000);
  assert.equal(legalMassKg('SE', nuppi4, [cassette4], { roadClass: 'BK4' }).kg, 74_000);
  assert.equal(legalMassKg('NO', nuppi4, [cassette4]).kg, 50_000);
  assert.equal(legalMassKg('NO', nuppi4, [cassette4], { roadClass: 'NET60' }).kg, 60_000);
});

test('DK: 7+ осей 56 т, с 1.1.2027 — 58 т', () => {
  assert.equal(legalMassKg('DK', nuppi4, [{ kind: 'FULL', axles: 3, twinWheels: true }], { on: '2026-12-31' }).kg, 56_000);
  assert.equal(legalMassKg('DK', nuppi4, [{ kind: 'FULL', axles: 3, twinWheels: true }], { on: '2027-01-01' }).kg, 58_000);
});

test('техпаспорт ограничивает сверху, тара даёт грузоподъёмность', () => {
  const r = combinationMass(
    'FI',
    { ...nuppi5, grossMaxKg: 42_000, tareKg: 15_000 },
    [{ ...cassette4, grossMaxKg: 32_000, tareKg: 9_000 }],
  );
  assert.equal(r.legalKg, 76_000);
  assert.equal(r.technicalKg, 74_000);
  assert.equal(r.limitKg, 74_000);
  assert.equal(r.payloadKg, 50_000);
  assert.equal(r.totalAxles, 9);
});

test('сцепка собирается по правилам, перегруз считается в кг', () => {
  assert.equal(combinationProblem(nuppi5, [semi3]), 'SEMI_NEEDS_TRACTOR');
  assert.equal(combinationProblem(tractor3, [cassette4]), 'TRAILER_NEEDS_TRUCK');
  assert.equal(combinationProblem(nuppi5, [cassette4]), null);
  assert.equal(overloadKg(77_250, 76_000), 1_250);
  assert.equal(overloadKg(70_000, 76_000), 0);
});

test('FI: полуприцепы по таблице Traficom 2019 — 2+3 42 т, 3+2 44 т, 3+4 58 т, 3+5 64 т', () => {
  assert.equal(legalMassKg('FI', tractor2, [semi3]).kg, 42_000);
  assert.equal(legalMassKg('FI', tractor3, [{ kind: 'SEMI', axles: 2, twinWheels: false }]).kg, 44_000);
  assert.equal(legalMassKg('FI', tractor3, [{ kind: 'SEMI', axles: 4, twinWheels: false }]).kg, 58_000);
  assert.equal(legalMassKg('FI', tractor3, [{ kind: 'SEMI', axles: 5, twinWheels: false }]).kg, 64_000);
});

test('FI: расстояние между крайними осями — 52 т от 11,8 м, меньше — меньше; без размеров — верхняя граница', () => {
  const tractor = { ...tractor3, couplingM: 3.6 };
  assert.deepEqual(legalMassKg('FI', tractor, [{ ...semi3, couplingM: 8.2 }]), { kg: 52_000, basis: 'exact' });
  /* 3,6 + 7,0 = 10,6 м → 20 + 3,2 × 8,8 = 48,16 т */
  assert.deepEqual(legalMassKg('FI', tractor, [{ ...semi3, couplingM: 7.0 }]), { kg: 48_160, basis: 'exact' });
  assert.deepEqual(legalMassKg('FI', tractor3, [semi3]), { kg: 52_000, basis: 'upper' });
  /* 76 т — от 19,3 м */
  assert.equal(legalMassKg('FI', { ...nuppi5, couplingM: 9.0 }, [{ ...cassette4, couplingM: 10.3 }]).kg, 76_000);
  assert.equal(legalMassKg('FI', { ...nuppi5, couplingM: 9.0 }, [{ ...cassette4, couplingM: 9.0 }]).kg, 71_840);
});

test('тягач + полуприцеп: груз ограничивает полуприцеп — 31,5 т, а не сумма техпаспортов', () => {
  const r = combinationMass(
    'FI',
    { ...tractor3, grossMaxKg: 26_000, tareKg: 8_500, couplingM: 3.6 },
    [{ ...semi3, grossMaxKg: 39_000, tareKg: 7_500, couplingM: 8.2 }],
  );
  assert.equal(r.legalKg, 52_000);
  assert.equal(r.technicalKg, 47_500);
  assert.equal(r.payloadKg, 31_500);
  assert.equal(r.spreadM, 11.8);
});

test('конструктор: виды сцепок и что собрать нельзя', async () => {
  const { comboKind } = await import('./mass.ts');
  assert.equal(comboKind('TRACTOR', null), 'TRACTOR_SOLO');
  assert.equal(comboKind('TRACTOR', { kind: 'SEMI', bodyType: 'TIPPER' }), 'PUOLIKAS');
  assert.equal(comboKind('TRACTOR', { kind: 'SEMI', bodyType: 'CURTAIN' }), 'SEMI');
  assert.equal(comboKind('TRACTOR', { kind: 'FULL' }), null);
  assert.equal(comboKind('TIPPER', null), 'NUPPI');
  /* Кассета — только с самосвальным прицепом; нуппи + трал — TPV. */
  assert.equal(comboKind('TIPPER', { kind: 'FULL', bodyType: 'TIPPER' }), 'KASETTI');
  assert.equal(comboKind('TIPPER', { kind: 'FULL', bodyType: 'LOWBED' }), 'TRUCK_TRAILER');
  assert.equal(comboKind('TRUCK', { kind: 'FULL', bodyType: 'CURTAIN' }), 'TRUCK_TRAILER');
  assert.equal(comboKind('TRUCK', { kind: 'SEMI' }), null);
  assert.equal(comboKind('VAN', { kind: 'FULL' }), null);
});

test('конструктор: грузовик 3 оси + тент — метры, объём и груз складываются, закон ограничивает', async () => {
  const { comboSummary } = await import('./mass.ts');
  const s = comboSummary(
    'FI',
    { vehicleClass: 'TRUCK', axles: 3, bodyType: 'CURTAIN', grossMaxKg: 26000, tareKg: 11000, payloadKg: 15000, ldm: 7.2, volumeM3: 45, loading: ['SIDE', 'REAR'] },
    { kind: 'FULL', axles: 3, twinWheels: true, bodyType: 'CURTAIN', grossMaxKg: 24000, tareKg: 6000, payloadKg: 18000, ldm: 8.2, volumeM3: 55, loading: ['SIDE', 'TOP'] },
  );
  assert.equal(s.kind, 'TRUCK_TRAILER');
  assert.equal(s.axles, 6);
  assert.equal(s.ldm, 15.4);
  assert.equal(s.volumeM3, 100);
  /* закон 53 т − тара 17 т = 36 т, заявлено 33 т → 33 т */
  assert.equal(s.payloadKg, 33000);
  assert.deepEqual(s.loading.sort(), ['REAR', 'SIDE', 'TOP']);
});

test('конструктор: тягач + самосвальный полуприцеп — puolikas, груз по полуприцепу', async () => {
  const { comboSummary } = await import('./mass.ts');
  const s = comboSummary(
    'FI',
    { vehicleClass: 'TRACTOR', axles: 3, grossMaxKg: 26000, tareKg: 8500 },
    { kind: 'SEMI', axles: 3, twinWheels: false, bodyType: 'TIPPER', grossMaxKg: 39000, tareKg: 7500, payloadKg: 31000 },
  );
  assert.equal(s.kind, 'PUOLIKAS');
  assert.equal(s.payloadKg, 31000);
  assert.deepEqual(s.bodies, ['TIPPER']);
});
