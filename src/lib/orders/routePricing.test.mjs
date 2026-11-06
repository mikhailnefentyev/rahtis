import test from 'node:test';
import assert from 'node:assert/strict';
import { distancePlausible, perKmTotal, routeRepriceDecision } from './routePricing.ts';

test('пробег: граница 3× и +1500 км', () => {
  assert.equal(distancePlausible(100, 300), true);
  assert.equal(distancePlausible(100, 301), false);
  assert.equal(distancePlausible(1000, 2500), true);
  assert.equal(distancePlausible(1000, 2501), false);
  assert.equal(distancePlausible(null, 5000), true);
  assert.equal(distancePlausible(100, 0), false);
  assert.equal(distancePlausible(100, null), false);
});

test('цена за км: округление и минимум', () => {
  assert.equal(perKmTotal(180, 245), 44100);
  assert.equal(perKmTotal(1, 0), 1);
  assert.equal(perKmTotal(133, 3), 399);
});

test('после правки маршрута: кто правил — то и решение', () => {
  const base = { mode: 'PER_KM', prevKm: 200, nextKm: 230 };
  assert.equal(routeRepriceDecision({ ...base, side: 'SHIPPER' }), 'APPLY');
  assert.equal(routeRepriceDecision({ ...base, side: 'OPERATOR' }), 'APPLY');
  assert.equal(routeRepriceDecision({ ...base, side: 'CARRIER' }), 'PROPOSE');
  assert.equal(routeRepriceDecision({ ...base, side: 'CARRIER', pendingProposal: true }), 'NONE');
});

test('после правки маршрута: фиксированная цена и тот же пробег не меняются', () => {
  assert.equal(routeRepriceDecision({ mode: 'FIXED', side: 'SHIPPER', prevKm: 200, nextKm: 260 }), 'NONE');
  assert.equal(routeRepriceDecision({ mode: 'PER_KM', side: 'SHIPPER', prevKm: 200, nextKm: 200 }), 'NONE');
});

test('после правки маршрута: неправдоподобный пробег — только оператор', () => {
  assert.equal(routeRepriceDecision({ mode: 'PER_KM', side: 'SHIPPER', prevKm: 200, nextKm: 900 }), 'OUT_OF_BOUNDS');
  assert.equal(routeRepriceDecision({ mode: 'PER_KM', side: 'CARRIER', prevKm: 200, nextKm: 900 }), 'OUT_OF_BOUNDS');
  assert.equal(routeRepriceDecision({ mode: 'PER_KM', side: 'OPERATOR', prevKm: 200, nextKm: 900 }), 'APPLY');
});
