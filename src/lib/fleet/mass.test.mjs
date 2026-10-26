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

test('FI: тягач 3 + полуприцеп 3 = 6 осей — 53 т; 4+4 со сдвоенными — 68 т', () => {
  assert.equal(legalMassKg('FI', tractor3, [semi3]).kg, 53_000);
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
