import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { urgencyByDue, type Dismissal, type InboxItem } from './rank';

/*
 * Общее для кабинетов: правки и предложения цены другой стороны,
 * сообщения водителя, отложенные пункты. Сессионный клиент — права
 * решает RLS (order_amendments и order_change_requests — стороны рейса).
 */

export type Supabase = Awaited<ReturnType<typeof createClient>>;
export type InboxResult = { items: InboxItem[]; total: number };

/** Отложенные пункты. До миграции таблицы нет — пусто, список работает. */
export async function loadDismissals(supabase: Supabase): Promise<Dismissal[]> {
  const { data, error } = await supabase.from('inbox_dismissals').select('item_key, until').gt('until', new Date().toISOString());
  if (error) return [];
  return (data ?? []).map((d) => ({ key: d.item_key, until: d.until }));
}

type OrderInfo = { ref: string; party?: string | null; href: string; running: boolean };

/**
 * Правки и предложения цены, адресованные этой стороне, и открытые
 * сообщения водителя — по уже отобранным заказам (без запроса на заказ).
 */
export async function orderChangeItems(
  supabase: Supabase,
  side: 'SHIPPER' | 'CARRIER',
  orders: ReadonlyMap<string, OrderInfo>,
): Promise<InboxItem[]> {
  const ids = [...orders.keys()];
  if (ids.length === 0) return [];

  const amendmentQuery = supabase
    .from('order_amendments')
    .select('id, order_id, kind, proposal_status, actor_side, changes, created_at')
    .in('order_id', ids)
    .is('acknowledged_at', null);
  /* Чужие правки — как на карточке (OrderAmendments): у старых записей стороны нет, это заказчик. */
  const [{ data: amendments }, { data: requests }, { data: checks }] = await Promise.all([
    (side === 'SHIPPER'
      ? amendmentQuery.eq('actor_side', 'CARRIER')
      : amendmentQuery.or('actor_side.is.null,actor_side.neq.CARRIER')
    )
      .order('created_at')
      .limit(200),
    supabase
      .from('order_change_requests')
      .select('id, order_id, message, address, created_at')
      .in('order_id', ids)
      .is('resolved_at', null)
      .order('created_at')
      .limit(50),
    /* Сверка машины: расхождение, которое эта сторона ещё не подтвердила. */
    supabase
      .from('vehicle_checks')
      .select('id, order_id, created_at')
      .in('order_id', ids)
      .eq('verdict', 'MISMATCH')
      .is(side === 'SHIPPER' ? 'shipper_confirmed_at' : 'carrier_confirmed_at', null)
      .limit(50),
  ]);

  const items: InboxItem[] = [];
  const acks = new Map<string, { count: number; at: string }>();

  for (const a of amendments ?? []) {
    const order = orders.get(a.order_id);
    if (!order) continue;
    if (a.kind === 'PRICE_PROPOSED') {
      /* Своё предложение другая сторона и так видит; оператор цену не предлагает. */
      if (a.proposal_status !== 'PROPOSED' || a.actor_side === 'OPERATOR') continue;
      const rate = (a.changes as Record<string, { to?: unknown }> | null)?.rate_cents?.to;
      items.push({
        key: `proposal:${a.id}`,
        kind: 'priceProposal',
        urgency: 1,
        at: a.created_at,
        ref: order.ref,
        party: order.party,
        amountCents: typeof rate === 'number' ? rate : null,
        href: order.href,
        op: { op: 'acceptProposal', amendmentId: a.id },
      });
      continue;
    }
    /* Отметить «видел» можно только у рейса в работе — как на карточке. */
    if (!order.running) continue;
    const seen = acks.get(a.order_id);
    acks.set(a.order_id, { count: (seen?.count ?? 0) + 1, at: seen?.at ?? a.created_at });
  }

  for (const [orderId, { count, at }] of acks) {
    const order = orders.get(orderId)!;
    items.push({
      key: `amended:${orderId}:${count}`,
      kind: 'changes',
      urgency: 1,
      at,
      ref: order.ref,
      party: order.party,
      note: String(count),
      href: order.href,
      op: { op: 'acknowledge', orderId },
    });
  }

  for (const r of requests ?? []) {
    const order = orders.get(r.order_id);
    if (!order) continue;
    items.push({
      key: `request:${r.id}`,
      kind: 'addressReport',
      urgency: 1,
      at: r.created_at,
      ref: order.ref,
      party: order.party,
      note: r.address || r.message,
      href: order.href,
      op: { op: 'dismissRequest', requestId: r.id },
    });
  }
  for (const c of checks ?? []) {
    const order = orders.get(c.order_id);
    if (!order) continue;
    items.push({
      key: `vehicle:${c.id}`,
      kind: 'vehicleCheck',
      urgency: 0,
      at: c.created_at,
      ref: order.ref,
      party: order.party,
      href: order.href,
      op: { op: 'vehicleCheck', checkId: c.id, side },
    });
  }
  return items;
}

/** Документы компании: отклонённые и истекающие в течение 30 дней. RLS — свои. */
export async function companyDocumentItems(supabase: Supabase, href: string, soon: string): Promise<InboxItem[]> {
  const { data } = await supabase
    .from('company_documents')
    .select('id, kind, valid_until, review_status, review_note')
    .eq('is_current', true)
    .or(`review_status.eq.REJECTED,valid_until.lte.${soon}`)
    .limit(20);
  return (data ?? []).map((d) =>
    d.review_status === 'REJECTED'
      ? {
          key: `doc-rejected:${d.id}`,
          kind: 'docRejected',
          urgency: 0,
          at: null,
          docKind: d.kind,
          note: d.review_note,
          href,
        }
      : {
          key: `doc-expiring:${d.id}`,
          kind: 'docExpiring',
          urgency: urgencyByDue(d.valid_until, new Date(), 14),
          at: d.valid_until,
          date: d.valid_until,
          docKind: d.kind,
          href,
          snooze: 1,
        },
  );
}

/**
 * Реквизиты или почту компании поменял кто-то другой за неделю —
 * человек должен узнать сразу (схема подмены счёта). Свою правку не показываем.
 */
export async function sensitiveChangeItems(supabase: Supabase, me: string | null, href: string): Promise<InboxItem[]> {
  const { data } = await supabase
    .from('company_sensitive_changes')
    .select('id, field, changed_at, changed_by')
    .gt('changed_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
    .limit(10);
  return (data ?? [])
    .filter((s) => !(s.changed_by && s.changed_by === me))
    .map((s) => ({ key: `sensitive:${s.id}`, kind: 'sensitiveChanged', urgency: 0, at: s.changed_at, date: s.changed_at, note: s.field, href, snooze: 30 }));
}

/** Разбор письма дольше этого — считаем, что он сорвался (запуск после ответа вебхуку оборвался). */
const EMAIL_PARSE_STALE_MS = 10 * 60_000;

/**
 * Черновики из пересланных писем (6.11.2026): готов — «проверь и
 * опубликуй», не прочитался — «заполни сам». Ссылка — прямо на форму.
 * До миграции таблицы нет — пусто.
 */
export async function emailDraftItems(supabase: Supabase, href: (id: string) => string, now = Date.now()): Promise<InboxItem[]> {
  const { data, error } = await supabase
    .from('order_email_drafts')
    .select('id, subject, from_address, received_at, status, created_at')
    .in('status', ['PENDING', 'PARSED', 'FAILED'])
    .order('received_at', { ascending: false })
    .limit(20);
  if (error) return [];
  const items: InboxItem[] = [];
  for (const d of data ?? []) {
    const stale = d.status === 'PENDING' && now - Date.parse(d.created_at) > EMAIL_PARSE_STALE_MS;
    if (d.status === 'PENDING' && !stale) continue;
    items.push({
      key: `email:${d.id}`,
      kind: d.status === 'PARSED' ? 'emailDraft' : 'emailDraftFailed',
      urgency: d.status === 'PARSED' ? 1 : 2,
      at: d.received_at,
      ref: d.subject || null,
      party: d.from_address,
      href: href(d.id),
      op: { op: 'dismissEmailDraft', draftId: d.id },
    });
  }
  return items;
}
