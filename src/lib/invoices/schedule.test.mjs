import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysIso, daysBetween, invoiceStatus, parseAmountCents, parseFreightInvoice, reminderAction } from './schedule.ts';

const open = { dueOn: '2026-11-10', paid: false, reminder1: false, reminder2: false, collectionHint: false };

test('напоминания: до срока и в день срока — ничего', () => {
  assert.deepEqual(reminderAction(open, '2026-11-09'), { email: null, collection: false });
  assert.deepEqual(reminderAction(open, '2026-11-10'), { email: null, collection: false });
});

test('напоминания: первое — на следующий день после срока, один раз', () => {
  assert.deepEqual(reminderAction(open, '2026-11-11'), { email: 1, collection: false });
  assert.deepEqual(reminderAction({ ...open, reminder1: true }, '2026-11-12'), { email: null, collection: false });
});

test('напоминания: второе — через 7 дней; пропущенное первое не догоняется', () => {
  assert.deepEqual(reminderAction({ ...open, reminder1: true }, '2026-11-17'), { email: 2, collection: false });
  assert.deepEqual(reminderAction(open, '2026-11-20'), { email: 2, collection: false });
  assert.deepEqual(reminderAction({ ...open, reminder1: true, reminder2: true }, '2026-11-20'), { email: null, collection: false });
});

test('напоминания: 14-й день — подсказка о взыскании, один раз', () => {
  const sent = { ...open, reminder1: true, reminder2: true };
  assert.deepEqual(reminderAction(sent, '2026-11-24'), { email: null, collection: true });
  assert.deepEqual(reminderAction({ ...sent, collectionHint: true }, '2026-11-30'), { email: null, collection: false });
});

test('напоминания: оплаченный и давно просроченный', () => {
  assert.deepEqual(reminderAction({ ...open, paid: true }, '2026-11-24'), { email: null, collection: false });
  assert.deepEqual(reminderAction(open, '2027-02-01'), { email: null, collection: true });
});

test('даты: сдвиг и разница', () => {
  assert.equal(addDaysIso('2026-12-25', 14), '2027-01-08');
  assert.equal(daysBetween('2026-11-10', '2026-11-24'), 14);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
});

test('статус счёта', () => {
  assert.equal(invoiceStatus({ dueOn: '2026-11-10', paidAt: null }, '2026-11-10'), 'OPEN');
  assert.equal(invoiceStatus({ dueOn: '2026-11-10', paidAt: null }, '2026-11-11'), 'OVERDUE');
  assert.equal(invoiceStatus({ dueOn: '2026-11-10', paidAt: '2026-11-09', paidSide: 'SHIPPER', confirmed: false }, '2026-11-11'), 'PAID_UNCONFIRMED');
  assert.equal(invoiceStatus({ dueOn: '2026-11-10', paidAt: '2026-11-09', paidSide: 'CARRIER' }, '2026-11-11'), 'PAID');
});

test('форма счёта: сумма и проверки', () => {
  assert.equal(parseAmountCents('1 234,50'), 123450);
  assert.equal(parseAmountCents('0'), null);
  assert.equal(parseAmountCents('12.345'), null);
  const ok = parseFreightInvoice({ number: ' 2026-17 ', amount: '850', currency: 'eur', issuedOn: '2026-11-06', dueOn: '2026-11-20', sendTo: 'Laskut@Firma.fi' });
  assert.deepEqual(ok, { ok: true, number: '2026-17', amountCents: 85000, currency: 'EUR', issuedOn: '2026-11-06', dueOn: '2026-11-20', sendTo: 'laskut@firma.fi' });
  assert.deepEqual(parseFreightInvoice({ number: 'x', amount: '10', currency: 'EUR', issuedOn: '2026-11-06', dueOn: '2026-11-01', sendTo: 'a@b.fi' }), { ok: false, error: 'dates' });
  assert.deepEqual(parseFreightInvoice({ number: 'x', amount: '10', currency: 'EUR', issuedOn: '2026-11-06', dueOn: '2026-11-08', sendTo: 'a@b' }), { ok: false, error: 'email' });
  assert.deepEqual(parseFreightInvoice({ number: '', amount: '10', currency: 'EUR', issuedOn: '2026-11-06', dueOn: '2026-11-08', sendTo: 'a@b.fi' }), { ok: false, error: 'number' });
});
