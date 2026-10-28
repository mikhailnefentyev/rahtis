/*
 * Расход топлива методом полного бака. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuelStats, monthOf, monthsBack } from './fuel.ts';

let n = 0;
const row = (over) => ({
  id: `r${(n += 1)}`,
  vehicle_id: 'A',
  product: 'DIESEL',
  amount_cents: null,
  odometer_km: null,
  full_tank: true,
  ...over,
});

test('между двумя полными баками: литры второй заправки на разницу одометра', () => {
  const { fleet, byVehicle } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    row({ filled_at: '2026-10-05T06:00:00Z', quantity: 330, odometer_km: 101000, amount_cents: 59400 }),
  ]);
  const oct = byVehicle.get('A')[0];
  assert.equal(oct.month, '2026-10');
  assert.equal(oct.l100, 33);
  assert.equal(oct.km, 1000);
  assert.equal(oct.liquidL, 630);
  /* 594 € за 330 л = 1,80 €/л; 33 л/100 км → 59,4 цента на километр. */
  assert.equal(oct.centsPerKm, 59.4);
  assert.equal(fleet[0].l100, 33);
});

test('строка без одометра входит в интервал, в котором лежит', () => {
  const { byVehicle } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    row({ filled_at: '2026-10-03T06:00:00Z', quantity: 100 }),
    row({ filled_at: '2026-10-05T06:00:00Z', quantity: 200, odometer_km: 101000 }),
  ]);
  assert.equal(byVehicle.get('A')[0].l100, 30);
});

test('неполный бак не закрывает интервал', () => {
  const { byVehicle } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    row({ filled_at: '2026-10-03T06:00:00Z', quantity: 100, odometer_km: 100400, full_tank: false }),
    row({ filled_at: '2026-10-05T06:00:00Z', quantity: 230, odometer_km: 101000 }),
  ]);
  assert.equal(byVehicle.get('A')[0].l100, 33);
});

test('AdBlue — процент от дизеля, в расход не входит', () => {
  const { byVehicle } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    row({ filled_at: '2026-10-05T06:00:00Z', quantity: 300, odometer_km: 101000 }),
    row({ filled_at: '2026-10-05T06:01:00Z', quantity: 30, product: 'ADBLUE', odometer_km: 101000 }),
  ]);
  const oct = byVehicle.get('A')[0];
  assert.equal(oct.l100, 30);
  assert.equal(oct.adblueL, 30);
  assert.equal(oct.adbluePct, 5);
});

test('газ отдельно, в килограммах на 100 км', () => {
  const { byVehicle } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 150, product: 'LBG', odometer_km: 50000 }),
    row({ filled_at: '2026-10-04T06:00:00Z', quantity: 140, product: 'LBG', odometer_km: 50500 }),
  ]);
  const oct = byVehicle.get('A')[0];
  assert.equal(oct.kg100, 28);
  assert.equal(oct.l100, null);
  assert.equal(oct.gasKg, 290);
});

test('одометр назад и невозможный расход помечаются и не портят среднее', () => {
  const back = row({ filled_at: '2026-10-05T06:00:00Z', quantity: 300, odometer_km: 99000 });
  const wild = row({ filled_at: '2026-10-08T06:00:00Z', quantity: 300, odometer_km: 99100 });
  const { byVehicle, flags } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    back,
    wild,
  ]);
  assert.equal(flags.get(back.id), 'ODOMETER_BACK');
  assert.equal(flags.get(wild.id), 'OUTLIER');
  assert.equal(byVehicle.get('A')[0].l100, null);
});

test('парк: среднее взвешено по километрам, а не по машинам', () => {
  const { fleet } = fuelStats([
    row({ filled_at: '2026-10-01T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    row({ filled_at: '2026-10-05T06:00:00Z', quantity: 300, odometer_km: 101000 }),
    row({ vehicle_id: 'B', filled_at: '2026-10-01T06:00:00Z', quantity: 100, odometer_km: 5000 }),
    row({ vehicle_id: 'B', filled_at: '2026-10-05T06:00:00Z', quantity: 40, odometer_km: 5100 }),
  ]);
  /* (300 + 40) / (1000 + 100) × 100 = 30,9 */
  assert.equal(fleet[0].l100, 30.9);
});

test('месяц — по Хельсинки, интервал — в месяц закрывающей заправки', () => {
  assert.equal(monthOf('2026-10-31T22:30:00Z'), '2026-11');
  const { byVehicle } = fuelStats([
    row({ filled_at: '2026-10-28T06:00:00Z', quantity: 300, odometer_km: 100000 }),
    row({ filled_at: '2026-11-02T06:00:00Z', quantity: 330, odometer_km: 101000 }),
  ]);
  const [oct, nov] = byVehicle.get('A');
  assert.equal(oct.l100, null);
  assert.equal(nov.l100, 33);
});

test('месяцы назад через границу года', () => {
  assert.deepEqual(monthsBack('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
});
