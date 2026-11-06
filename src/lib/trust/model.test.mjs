import test from 'node:test';
import assert from 'node:assert/strict';
import { onTimePct, parseReport, registryFlag, toTrust, trustTone } from './model.ts';

const row = {
  company_id: 'c1',
  country: 'FI',
  registered_on: '2015-03-10',
  on_platform_since: '2026-09-01',
  registry_verdict: 'OK',
  registry_situations: [],
  registry_vat: true,
  registry_prepayment: true,
  registry_checked_at: '2026-11-01',
  invoiced_count: 10,
  paid_on_time: 7,
  paid_late: 2,
  avg_days_late: 6,
  overdue_count: 1,
  reports_on_time: 3,
  reports_late: 1,
  reports_unpaid: 0,
  done_12m: 25,
  first_done_at: '2026-01-15',
};

test('сведения о заказчике: доля вовремя среди решённых счетов', () => {
  assert.equal(onTimePct(7, 2, 1), 70);
  assert.equal(onTimePct(0, 0, 0), null);
  assert.equal(onTimePct(2, 1, 0), 67);
  assert.equal(onTimePct(0, 0, 3), 0);
});

test('сведения о заказчике: ситуации реестра', () => {
  assert.equal(registryFlag('Konkurssissa'), 'BANKRUPTCY');
  assert.equal(registryFlag('KONK'), 'BANKRUPTCY');
  assert.equal(registryFlag('Saneerauksessa'), 'RESTRUCTURING');
  assert.equal(registryFlag('Selvitystilassa'), 'LIQUIDATION');
  assert.equal(registryFlag('Pakkoselvitystilassa'), 'LIQUIDATION');
  assert.equal(registryFlag('XYZ'), 'OTHER');
});

test('сведения о заказчике: строка базы и тон', () => {
  const t = toTrust(row);
  assert.equal(t.aivomaa.onTimePct, 70);
  assert.equal(t.reports.total, 4);
  assert.equal(trustTone(t), 'bad');
  assert.equal(trustTone(toTrust({ ...row, overdue_count: 0 })), 'warn');
  assert.equal(trustTone(toTrust({ ...row, overdue_count: 0, paid_late: 0, reports_late: 0 })), 'neutral');
  assert.equal(trustTone(toTrust({ ...row, overdue_count: 0, paid_late: 0, reports_late: 0, registry_situations: ['Konkurssissa'] })), 'bad');
  assert.equal(toTrust({ ...row, registry_situations: null }).registry.flags.length, 0);
});

test('отметка перевозчика: разбор формы', () => {
  assert.deepEqual(parseReport('ON_TIME', '5', ''), { ok: true, status: 'ON_TIME', daysLate: null, note: null });
  assert.deepEqual(parseReport('LATE', '12', ' muistutus '), { ok: true, status: 'LATE', daysLate: 12, note: 'muistutus' });
  assert.deepEqual(parseReport('LATE', '', ''), { ok: false, error: 'days' });
  assert.deepEqual(parseReport('LATE', '0', ''), { ok: false, error: 'days' });
  assert.deepEqual(parseReport('LATE', '-3', ''), { ok: false, error: 'days' });
  assert.deepEqual(parseReport('PAID', '', ''), { ok: false, error: 'status' });
  assert.deepEqual(parseReport('UNPAID', '', 'x'.repeat(301)), { ok: false, error: 'note' });
});
