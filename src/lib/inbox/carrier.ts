import 'server-only';

import { cache } from 'react';
import { getViewer } from '@/lib/auth/viewer';
import { daysFromToday, todayInHelsinki } from '@/lib/dates';
import { COLLECTION_DAY } from '@/lib/invoices/schedule';
import type { Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { companyDocumentItems, emailDraftItems, loadDismissals, orderChangeItems, sensitiveChangeItems, type InboxResult } from './common';
import { carrierInvoiceItems, collapseInvoiceSend, rankItems, twoStepItem, urgencyByDue, type InboxItem } from './rank';
import { spaceLabel } from '@/lib/capacity/compute';
import { loadCarrierCapacity } from '@/lib/capacity/load';

type Stop = { completed_at: string | null; scheduled_date: string | null };

/**
 * «Требует вашего действия» перевозчика. Только существующие источники:
 * рейсы (my_assignments), правки, счета и отметки об оплате прямых
 * рейсов, документы, импорт топлива, сбор, смена реквизитов.
 * Два захода в базу: независимое — разом, потом зависящее от рейсов.
 */
export const loadCarrierInbox = cache(async (locale: Locale): Promise<InboxResult> => {
  const [supabase, viewer] = await Promise.all([createClient(), getViewer()]);
  const today = todayInHelsinki();
  const base = `/${locale}/carrier`;

  const [
    { data: assignments },
    targetsRes,
    reportsRes,
    docItems,
    { data: certs },
    { data: imports },
    { data: fees },
    sensitive,
    { data: fleet },
    { data: clients },
    dismissed,
    capacity,
    capacityRequests,
    emailItems,
  ] = await Promise.all([
    supabase.rpc('my_assignments'),
    supabase.rpc('freight_invoice_targets'),
    supabase.rpc('payment_report_targets'),
    companyDocumentItems(supabase, `${base}/fleet`, daysFromToday(30)),
    supabase
      .from('driver_certificates')
      .select('id, driver_id, type, expires_at, drivers!inner(full_name, status)')
      .lte('expires_at', daysFromToday(30))
      .eq('drivers.status', 'ACTIVE')
      .order('expires_at')
      .limit(20),
    supabase.from('fuel_imports').select('id, file_name, created_at').eq('status', 'REVIEW').limit(5),
    supabase
      .from('carrier_subscription_fees')
      .select('id, month, gross_cents, carrier_fee_deductions(amount_cents)')
      .is('paid_at', null)
      .not('invoice_id', 'is', null)
      .limit(12),
    sensitiveChangeItems(supabase, viewer.status === 'ready' ? viewer.userId : null, `/${locale}/account`),
    supabase.rpc('carrier_own_vehicles'),
    supabase.rpc('carrier_clients'),
    loadDismissals(supabase),
    /* Догрузы: до миграции функций нет — пункты просто не появляются. */
    loadCarrierCapacity(),
    supabase.rpc('capacity_requests_for_carrier'),
    emailDraftItems(supabase, (id) => `${base}/own?new=1&email=${id}`),
  ]);

  const items: InboxItem[] = [
    ...emailItems,
    ...docItems,
    ...sensitive,
    ...twoStepItem({
      owner: viewer.status === 'ready' && viewer.profile.member_kind !== 'DISPATCHER',
      enabled: viewer.status === 'ready' && viewer.twoStep,
      href: `/${locale}/account#two-step`,
    }),
  ];
  const trip = (id: string) => `${base}/desk#trip-${id}`;
  const done = (id: string) => `${base}/done#done-${id}`;

  /* ── Рейсы ── */
  const active = (assignments ?? []).filter((o) => o.status === 'AWAIT_DRIVER' || o.status === 'IN_PROGRESS');
  const withDriver = new Map((fleet ?? []).map((v) => [v.plate, Boolean(v.driver_name)]));
  const ownClientNames = new Set((clients ?? []).map((c) => c.name));

  for (const o of active) {
    const stops = ((o.stops ?? []) as unknown as Stop[]) ?? [];
    const pickup = stops[0]?.scheduled_date ?? null;
    if (o.status === 'AWAIT_DRIVER') {
      /* Срок выбора тикает — это первое на экране. Прямой заказ ждёт без срока. */
      items.push({
        key: `confirm:${o.id}`,
        kind: o.deadline_at ? 'confirmChosen' : 'confirmDirect',
        urgency: o.deadline_at ? 0 : 1,
        at: o.deadline_at ?? pickup,
        ref: o.ref,
        party: o.shipper_name,
        date: pickup,
        href: trip(o.id),
        op: { op: 'confirmOrder', orderId: o.id },
      });
    }
    if (!o.vehicle_plate) {
      items.push({ key: `novehicle:${o.id}`, kind: 'noVehicle', urgency: 0, at: pickup, ref: o.ref, party: o.shipper_name, date: pickup, href: trip(o.id) });
    } else if (withDriver.get(o.vehicle_plate) === false) {
      items.push({
        key: `nodriver:${o.id}`,
        kind: 'noDriver',
        urgency: urgencyByDue(pickup) <= 1 ? 0 : 2,
        at: pickup,
        ref: o.ref,
        party: o.vehicle_plate,
        date: pickup,
        href: `${base}/drivers`,
      });
    }
    /* Все точки пройдены, рейс не закрыт: закрывает перевозчик (ClosingPanel). */
    if (o.status === 'IN_PROGRESS' && stops.length > 0 && stops.every((s) => s.completed_at)) {
      items.push({
        key: `close:${o.id}`,
        kind: ownClientNames.has(o.shipper_name) ? 'closeOwn' : 'closeTrip',
        urgency: 1,
        at: null,
        ref: o.ref,
        party: o.shipper_name,
        href: trip(o.id),
      });
    }
  }

  const running = new Map(
    active.map((o) => [o.id, { ref: o.ref, party: o.shipper_name, href: trip(o.id), running: true }]),
  );
  /* ── Счета и отметки прямых рейсов (окно базы — 180 дней) ── */
  const targets = targetsRes.error ? [] : (targetsRes.data ?? []);
  const reports = new Map((reportsRes.error ? [] : (reportsRes.data ?? [])).map((r) => [r.order_id, r]));
  /* Окно базы — полгода рейсов: номера читаются пачками, чтобы адрес запроса не разросся. */
  const targetIds = targets.map((t) => t.order_id);
  const chunks: string[][] = [];
  for (let i = 0; i < targetIds.length; i += 100) chunks.push(targetIds.slice(i, i + 100));

  const [changeItems, ...targetOrders] = await Promise.all([
    orderChangeItems(supabase, 'CARRIER', running),
    ...chunks.map((ids) => supabase.from('orders').select('id, ref, updated_at').in('id', ids)),
  ]);
  items.push(...changeItems);
  const orderById = new Map(targetOrders.flatMap((r) => r.data ?? []).map((o) => [o.id, o]));
  /* Закрытие — последнее изменение выполненного заказа: closed_at перевозчику грантом не отдан. */
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const invoiceItems = targets.flatMap((t) => {
    const order = orderById.get(t.order_id);
    return order
      ? carrierInvoiceItems(t, { ref: order.ref, closedAt: order.updated_at }, reports.get(t.order_id), {
          today,
          since: monthAgo,
          collectionDay: COLLECTION_DAY,
          href: done(t.order_id),
        })
      : [];
  });
  items.push(...collapseInvoiceSend(invoiceItems, `${base}/done`));

  /* ── Удостоверения водителей ── */
  for (const c of certs ?? []) {
    const driver = c.drivers as unknown as { full_name: string } | null;
    items.push({
      key: `cert:${c.id}:${c.expires_at}`,
      kind: 'certExpiring',
      urgency: urgencyByDue(c.expires_at, new Date(), 14),
      at: c.expires_at,
      date: c.expires_at,
      party: driver?.full_name ?? null,
      docKind: c.type,
      href: `${base}/drivers/${c.driver_id}`,
      snooze: 1,
    });
  }

  for (const i of imports ?? []) {
    items.push({ key: `fuel-import:${i.id}`, kind: 'fuelImport', urgency: 2, at: i.created_at, note: i.file_name, href: `${base}/fuel/import/${i.id}` });
  }

  let feeCents = 0;
  for (const fee of fees ?? []) {
    const taken = (fee.carrier_fee_deductions ?? []).reduce((sum: number, d: { amount_cents: number }) => sum + d.amount_cents, 0);
    feeCents += Math.max(fee.gross_cents - taken, 0);
  }
  if (feeCents > 0) {
    items.push({ key: `fee:${(fees ?? []).map((f) => f.id).sort().join(',')}`.slice(0, 200), kind: 'feeOpen', urgency: 2, at: null, amountCents: feeCents, currency: 'EUR', href: `${base}/subscription`, snooze: 1 });
  }

  /* ── Догрузы: «показать место?», автопубликация за сутки, запросы ── */
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  for (const p of capacity.proposals) {
    const route = `${p.from.city} → ${p.to.city}`;
    const href = `${base}/capacity#cap-${p.vehicleId}-${p.anchorOrderId}`;
    if (!p.offer && p.mode === 'ASK' && p.offerable && !p.withdrawn) {
      items.push({
        key: `capacity:${p.key}`,
        kind: 'capacityPropose',
        urgency: 2,
        at: p.availableFrom,
        party: p.plate,
        date: p.availableFrom,
        note: `${route} · ${spaceLabel(p.free, locale)}`,
        href,
        op: { op: 'publishCapacity', vehicleId: p.vehicleId, orderId: p.anchorOrderId },
        snooze: 30,
      });
    } else if (p.offer?.status === 'PUBLISHED' && p.offer.auto && (p.offer.published_at ?? '') > dayAgo) {
      const free = { ldm: p.offer.free_ldm === null ? null : Number(p.offer.free_ldm), kg: p.offer.free_kg, pallets: null };
      items.push({
        key: `capacity-auto:${p.offer.id}`,
        kind: 'capacityAutoPublished',
        urgency: 2,
        at: p.offer.published_at,
        party: p.plate,
        date: p.availableFrom,
        note: `${route} · ${spaceLabel(free, locale)}`,
        href,
        op: { op: 'withdrawCapacity', offerId: p.offer.id },
        snooze: 1,
      });
    }
  }
  for (const r of capacityRequests.error ? [] : (capacityRequests.data ?? [])) {
    if (r.status !== 'PENDING') continue;
    items.push({
      key: `capacity-request:${r.request_id}`,
      kind: 'capacityRequest',
      urgency: 1,
      at: r.created_at,
      party: r.shipper_name,
      date: r.date_from,
      amountCents: r.price_cents,
      currency: r.currency,
      note: `${r.from_city} → ${r.to_city}`,
      href: `${base}/capacity#req-${r.request_id}`,
      op: { op: 'capacityRequest', requestId: r.request_id },
    });
  }

  return rankItems(items, dismissed, new Date(), 100);
});
