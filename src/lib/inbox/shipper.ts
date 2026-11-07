import 'server-only';

import { cache } from 'react';
import { getViewer } from '@/lib/auth/viewer';
import { daysFromToday, todayInHelsinki } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { companyDocumentItems, emailDraftItems, loadDismissals, orderChangeItems, sensitiveChangeItems, type InboxResult } from './common';
import { inboxTotalKey, inboxTotals } from './memo';
import { rankItems, shipperInvoiceItem, twoStepItem, type InboxItem } from './rank';

/**
 * «Требует вашего действия» заказчика и экспедитора: выбор из откликов,
 * вернувшиеся прямые заказы, правки и предложения цены перевозчика,
 * сообщения водителя, счета к оплате, документы компании, претензии,
 * черновики с ошибками. Сессионный клиент — права решает RLS.
 */
export const loadShipperInbox = cache(async (locale: Locale): Promise<InboxResult> => {
  const [supabase, viewer] = await Promise.all([createClient(), getViewer()]);
  const today = todayInHelsinki();
  const base = `/${locale}/shipper`;
  const card = (id: string) => `${base}/orders#order-${id}`;

  const [{ data: orders }, invoicesRes, docItems, sensitive, { data: claims }, dismissed, emailItems, capacityRes] = await Promise.all([
    /* Колонки поимённо: назначение заказчику грантом не отдаётся. */
    supabase
      .from('orders')
      .select('id, ref, shipper_ref, status, dispatch_mode, deadline_at, created_at')
      .in('status', ['DRAFT', 'OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.rpc('shipper_freight_invoices'),
    companyDocumentItems(supabase, `/${locale}/account`, daysFromToday(30)),
    sensitiveChangeItems(supabase, viewer.status === 'ready' ? viewer.userId : null, `/${locale}/account`),
    supabase.rpc('my_claims'),
    loadDismissals(supabase),
    emailDraftItems(supabase, (id) => `${base}/orders?new=1&email=${id}`, (id) => `/${locale}/email-changes/${id}`),
    supabase.rpc('capacity_requests_for_shipper'),
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
  const list = orders ?? [];
  const label = (o: { ref: string; shipper_ref: string | null }) => (o.shipper_ref ? `${o.ref} · ${o.shipper_ref}` : o.ref);

  const requested = list.filter((o) => o.status === 'REQUESTED').map((o) => o.id);
  const drafts = list.filter((o) => o.status === 'DRAFT').map((o) => o.id);
  const tracked = new Map(
    list
      .filter((o) => o.status !== 'DRAFT')
      .map((o) => [
        o.id,
        { ref: label(o), href: card(o.id), running: o.status === 'AWAIT_DRIVER' || o.status === 'IN_PROGRESS' },
      ]),
  );

  const [changeItems, { data: offers }, { data: draftStops }] = await Promise.all([
    orderChangeItems(supabase, 'SHIPPER', tracked),
    requested.length
      ? supabase.rpc('offers_for_shipper', { p_order_ids: requested })
      : Promise.resolve({ data: [] as { order_id: string; is_chosen: boolean }[] }),
    drafts.length
      ? supabase.from('order_stops').select('order_id, lat, scheduled_date').in('order_id', drafts)
      : Promise.resolve({ data: [] as { order_id: string; lat: number | null; scheduled_date: string | null }[] }),
  ]);
  items.push(...changeItems);

  /* Отклики ждут выбора: сколько их и с какого времени. */
  const offerCount = new Map<string, number>();
  const chosen = new Set<string>();
  for (const offer of offers ?? []) {
    if (offer.is_chosen) chosen.add(offer.order_id);
    offerCount.set(offer.order_id, (offerCount.get(offer.order_id) ?? 0) + 1);
  }
  /* Черновик с ошибкой: точка без координат или дата уже прошла — публикация упрётся. */
  const broken = new Set(
    (draftStops ?? []).filter((s) => s.lat === null || (s.scheduled_date !== null && s.scheduled_date < today)).map((s) => s.order_id),
  );

  for (const o of list) {
    if (o.status === 'REQUESTED' && offerCount.has(o.id) && !chosen.has(o.id)) {
      items.push({ key: `choose:${o.id}`, kind: 'chooseOffer', urgency: 1, at: o.created_at, ref: label(o), note: String(offerCount.get(o.id)), href: card(o.id) });
    }
    /* Прямой заказ вернулся открытым — перевозчик отказался или срок вышел: решить, кому дальше. */
    if (o.status === 'OPEN' && o.dispatch_mode === 'DIRECT') {
      items.push({ key: `direct:${o.id}`, kind: 'directReturned', urgency: 1, at: o.created_at, ref: label(o), href: card(o.id), snooze: 30 });
    }
    if (o.status === 'DRAFT' && broken.has(o.id)) {
      items.push({ key: `draft:${o.id}`, kind: 'draftProblem', urgency: 2, at: o.created_at, ref: label(o), href: card(o.id) });
    }
  }

  /*
   * Черновик под свободное место: запрос отклонён или истёк, другого не
   * ждёт — «опубликовать на столе». Последний запрос заказа (список — свежие выше).
   */
  const draftIds = new Set(drafts);
  const seenOrders = new Set<string>();
  for (const r of capacityRes.error ? [] : (capacityRes.data ?? [])) {
    if (!r.order_id || !draftIds.has(r.order_id) || seenOrders.has(r.order_id)) continue;
    seenOrders.add(r.order_id);
    if (r.status !== 'DECLINED' && r.status !== 'EXPIRED') continue;
    items.push({
      key: `capacity-declined:${r.request_id}`,
      kind: 'capacityDeclined',
      urgency: 1,
      at: r.created_at,
      ref: r.order_ref,
      party: r.carrier_name,
      note: `${r.from_city} → ${r.to_city}`,
      href: `${base}/capacity#offer-${r.offer_id}`,
      op: { op: 'publishDraft', orderId: r.order_id },
      snooze: 7,
    });
  }

  /* Счета перевозчиков: срок через три дня или прошёл. «Оплачен» — одной кнопкой с сегодняшней датой. */
  for (const inv of invoicesRes.error ? [] : (invoicesRes.data ?? [])) {
    const item = shipperInvoiceItem(inv, { today, soonDays: 3, href: `/${locale}/shipper/done#invoice-${inv.id}` });
    if (item) items.push(item);
  }

  /* Претензия против заказчика открыта — ждёт его ответа. */
  for (const c of claims ?? []) {
    if (c.mine || (c.status !== 'OPEN' && c.status !== 'IN_REVIEW')) continue;
    items.push({ key: `claim:${c.id}`, kind: 'claimAnswer', urgency: 1, at: c.last_event_at ?? c.updated_at, ref: c.order_ref, party: c.carrier_name, href: `${base}/claims/${c.id}` });
  }

  const result = rankItems(items, dismissed, new Date(), 100);
  /* Итог — в память меню (src/lib/inbox/badge): другие страницы не считают заново. */
  if (viewer.status === 'ready') inboxTotals.set(inboxTotalKey(viewer.userId, 'SHIPPER'), result.total);
  return result;
});
