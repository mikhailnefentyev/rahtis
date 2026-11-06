/*
 * «Требует действия»: пункты по счетам прямых рейсов. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carrierInvoiceItems, collapseInvoiceSend, shipperInvoiceItem } from './rank.ts';

const ctx = { today: '2026-11-20', since: '2026-10-21T00:00:00Z', collectionDay: 14, href: '/fi/carrier/done#done-o1' };
const target = (over = {}) => ({
  order_id: 'o1',
  invoice_id: 'i1',
  editable: true,
  default_amount_cents: 50000,
  default_currency: 'EUR',
  amount_cents: 52000,
  currency: 'EUR',
  due_on: '2026-11-25',
  paid_at: null,
  paid_marked_side: null,
  paid_confirmed_at: null,
  ...over,
});
const order = { ref: 'R-1', closedAt: '2026-11-10T12:00:00Z' };

test('нет счёта у свежего рейса — «Счёт отправлен?» с суммой по умолчанию; старый рейс — ничего', () => {
  const [item] = carrierInvoiceItems(target({ invoice_id: null }), order, undefined, ctx);
  assert.equal(item.kind, 'invoiceSend');
  assert.equal(item.amountCents, 50000);
  assert.equal(item.snooze, 1);
  assert.deepEqual(carrierInvoiceItems(target({ invoice_id: null }), { ...order, closedAt: '2026-09-01T00:00:00Z' }, undefined, ctx), []);
  assert.deepEqual(carrierInvoiceItems(target({ invoice_id: null, editable: false }), order, undefined, ctx), []);
});

test('счёт в срок — ничего; просрочен — «не оплачен», с 14-го дня — взыскание и наверх', () => {
  assert.deepEqual(carrierInvoiceItems(target(), order, undefined, ctx), []);
  const [late] = carrierInvoiceItems(target({ due_on: '2026-11-15' }), order, undefined, ctx);
  assert.equal(late.kind, 'invoiceOverdue');
  assert.equal(late.urgency, 1);
  assert.equal(late.note, '5');
  const [collect] = carrierInvoiceItems(target({ due_on: '2026-11-06' }), order, undefined, ctx);
  assert.equal(collect.kind, 'invoiceCollection');
  assert.equal(collect.urgency, 0);
});

test('заказчик отметил оплату — подтвердить кнопкой; пустая отметка об оплате — заполнить', () => {
  const items = carrierInvoiceItems(
    target({ paid_at: '2026-11-18', paid_marked_side: 'SHIPPER' }),
    order,
    { editable: true, status: null },
    ctx,
  );
  assert.deepEqual(items.map((i) => i.kind), ['invoiceConfirm', 'paymentReport']);
  assert.deepEqual(items[0].op, { op: 'confirmInvoicePaid', invoiceId: 'i1' });
  const confirmed = carrierInvoiceItems(
    target({ paid_at: '2026-11-18', paid_marked_side: 'SHIPPER', paid_confirmed_at: '2026-11-19' }),
    order,
    { editable: true, status: 'ON_TIME' },
    ctx,
  );
  assert.deepEqual(confirmed, []);
});

test('заказчик: счёт через 3 дня и раньше — в списке с «оплачено сегодня», позже или оплачен — нет', () => {
  const inv = { id: 'i9', order_ref: 'R-9', carrier_name: 'Kuljetus Oy', amount_cents: 1000, currency: 'EUR', due_on: '2026-11-22', paid_at: null };
  const sctx = { today: '2026-11-20', soonDays: 3, href: '#' };
  assert.equal(shipperInvoiceItem(inv, sctx).kind, 'invoiceDue');
  assert.equal(shipperInvoiceItem(inv, sctx).urgency, 2);
  assert.equal(shipperInvoiceItem({ ...inv, due_on: '2026-11-20' }, sctx).urgency, 1);
  const overdue = shipperInvoiceItem({ ...inv, due_on: '2026-11-19' }, sctx);
  assert.equal(overdue.kind, 'invoiceOverdueShipper');
  assert.equal(overdue.urgency, 0);
  assert.deepEqual(overdue.op, { op: 'markInvoicePaid', invoiceId: 'i9' });
  assert.equal(shipperInvoiceItem({ ...inv, due_on: '2026-11-30' }, sctx), null);
  assert.equal(shipperInvoiceItem({ ...inv, paid_at: '2026-11-19' }, sctx), null);
});

test('«Счёт отправлен?» по нескольким рейсам — одна строка со счётчиком', () => {
  const one = carrierInvoiceItems(target({ invoice_id: null }), order, undefined, ctx);
  assert.deepEqual(collapseInvoiceSend(one, '/done'), one);
  const two = [...one, ...carrierInvoiceItems(target({ invoice_id: null, order_id: 'o2' }), { ...order, closedAt: '2026-11-12T00:00:00Z' }, undefined, ctx)];
  const late = carrierInvoiceItems(target({ due_on: '2026-11-15' }), order, undefined, ctx);
  const merged = collapseInvoiceSend([...two, ...late], '/done');
  assert.deepEqual(merged.map((i) => i.kind), ['invoiceOverdue', 'invoiceSend']);
  assert.equal(merged[1].note, '2');
  assert.equal(merged[1].at, '2026-11-12T00:00:00Z');
  assert.equal(merged[1].snooze, 7);
});
