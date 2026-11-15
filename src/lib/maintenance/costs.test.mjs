/*
 * Расходы на обслуживание: суммы по месяцам и машинам, евро на км, повторы. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIN_KM, summarizeCosts } from './costs.ts';

const months = ['2026-09', '2026-10', '2026-11'];

test('плановое и ремонт раздельно, по месяцам и машинам; вне периода не входит', () => {
  const s = summarizeCosts({
    months,
    assetIds: ['a', 'b'],
    km: new Map(),
    defects: [],
    records: [
      { assetId: 'a', kind: 'SERVICE', doneOn: '2026-09-10', cents: 50000 },
      { assetId: 'a', kind: 'REPAIR', doneOn: '2026-10-02', cents: 120000 },
      { assetId: 'b', kind: 'INSPECTION', doneOn: '2026-11-01', cents: 9000 },
      { assetId: 'b', kind: 'REPAIR', doneOn: '2026-08-31', cents: 999999 },
      { assetId: 'b', kind: 'TYRES', doneOn: '2026-11-03', cents: null },
    ],
  });
  assert.equal(s.total, 179000);
  assert.equal(s.planned, 59000);
  assert.equal(s.repairs, 120000);
  assert.deepEqual(s.months.map((m) => [m.planned, m.repairs]), [[50000, 0], [0, 120000], [9000, 0]]);
  assert.equal(s.assets[0].assetId, 'a');
  assert.equal(s.assets[1].visits, 2);
});

test('евро на км — только при пробеге от MIN_KM; парк — по машинам с пробегом', () => {
  const s = summarizeCosts({
    months,
    assetIds: ['a', 'b', 'c'],
    defects: [],
    km: new Map([
      ['a', { km_start: 100000, km_end: 140000 }],
      ['b', { km_start: 5000, km_end: 5000 + MIN_KM - 1 }],
    ]),
    records: [
      { assetId: 'a', kind: 'SERVICE', doneOn: '2026-10-10', cents: 400000 },
      { assetId: 'b', kind: 'REPAIR', doneOn: '2026-10-10', cents: 100000 },
      { assetId: 'c', kind: 'REPAIR', doneOn: '2026-10-10', cents: 100000 },
    ],
  });
  const a = s.assets.find((x) => x.assetId === 'a');
  const b = s.assets.find((x) => x.assetId === 'b');
  const c = s.assets.find((x) => x.assetId === 'c');
  assert.equal(a.km, 40000);
  assert.equal(a.perKm, 10);
  assert.equal(b.perKm, null);
  assert.equal(c.km, null);
  assert.equal(s.fleetPerKm, 10);
});

test('повторяющиеся поломки: один узел одной машины больше раза за период', () => {
  const s = summarizeCosts({
    months,
    assetIds: ['a', 'b'],
    km: new Map(),
    records: [],
    defects: [
      { assetId: 'a', area: 'BRAKES', reportedOn: '2026-09-01' },
      { assetId: 'a', area: 'BRAKES', reportedOn: '2026-11-02' },
      { assetId: 'a', area: 'LIGHTS', reportedOn: '2026-10-02' },
      { assetId: 'b', area: 'BRAKES', reportedOn: '2026-10-02' },
      { assetId: 'b', area: 'TYRES', reportedOn: '2026-07-02' },
      { assetId: 'b', area: 'TYRES', reportedOn: '2026-10-05' },
    ],
  });
  assert.deepEqual(s.repeats, [{ assetId: 'a', area: 'BRAKES', count: 2 }]);
  assert.equal(s.assets.find((x) => x.assetId === 'a').defects, 3);
  assert.equal(s.assets.find((x) => x.assetId === 'b').defects, 2);
});
