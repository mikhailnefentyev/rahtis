/*
 * «Требует вашего действия» (6.11.2026): общий вид пункта и порядок.
 *
 * Чистый модуль без базы и путей @/ — его гоняет node --test. Тексты
 * собирает экран по kind, здесь только факты.
 */

/** 0 — просрочено или стоит работа, 1 — сегодня, 2 — скоро, 3 — когда будет время. */
export type InboxUrgency = 0 | 1 | 2 | 3;

/** Кнопка прямо в списке — существующие действия, без новых. */
export type InboxOp =
  | { op: 'acceptProposal'; amendmentId: number }
  | { op: 'acknowledge'; orderId: string }
  | { op: 'dismissRequest'; requestId: string }
  | { op: 'confirmInvoicePaid'; invoiceId: string }
  | { op: 'confirmOrder'; orderId: string }
  | { op: 'markInvoicePaid'; invoiceId: string }
  | { op: 'driverAckChanges'; orderId: string };

export type InboxItem = {
  /** Устойчивый ключ — по нему же скрывают («позже»). */
  key: string;
  kind: string;
  urgency: InboxUrgency;
  /** Срок или момент события: внутри уровня раньше — выше. */
  at: string | null;
  ref?: string | null;
  party?: string | null;
  /** Дата для строки контекста (срок, забор, истечение). */
  date?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  /** Вид документа (document_kind) — подпись берёт экран. */
  docKind?: string | null;
  /** Короткий текст из базы (сообщение водителя, причина). */
  note?: string | null;
  /** Точное место: якорь карточки, а не общий раздел. */
  href: string;
  op?: InboxOp;
  /** «Позже» на столько суток — у пунктов без своего «закрыть». */
  snooze?: number;
};

export type Dismissal = { key: string; until: string };

/** Порядок: срочность, потом срок (раньше — выше), пункты без срока — в конце уровня. */
export function compareItems(a: InboxItem, b: InboxItem): number {
  if (a.urgency !== b.urgency) return a.urgency - b.urgency;
  if (a.at !== b.at) {
    if (a.at === null) return 1;
    if (b.at === null) return -1;
    return a.at < b.at ? -1 : 1;
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/**
 * Убирает отложенные (до срока) и дубли ключей, сортирует, режет до limit.
 * total — сколько всего ждёт: для счётчика в меню и «показать все».
 */
export function rankItems(
  items: readonly InboxItem[],
  dismissed: readonly Dismissal[] = [],
  now: Date = new Date(),
  limit = 20,
): { items: InboxItem[]; total: number } {
  const hidden = new Set(dismissed.filter((d) => new Date(d.until).getTime() > now.getTime()).map((d) => d.key));
  const seen = new Set<string>();
  const kept: InboxItem[] = [];
  for (const item of items) {
    if (hidden.has(item.key) || seen.has(item.key)) continue;
    seen.add(item.key);
    kept.push(item);
  }
  kept.sort(compareItems);
  return { items: kept.slice(0, Math.max(limit, 0)), total: kept.length };
}

/** Целых суток от сегодня до даты (YYYY-MM-DD или ISO); в прошлом — меньше нуля. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const day = date.slice(0, 10);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Helsinki' }).format(now);
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Срочность по сроку: прошёл — 0, сегодня-завтра — 1, в пределах soonDays — 2, иначе 3. */
export function urgencyByDue(due: string | null | undefined, now: Date = new Date(), soonDays = 7): InboxUrgency {
  if (!due) return 3;
  const days = daysUntil(due, now);
  if (days < 0) return 0;
  if (days <= 1) return 1;
  if (days <= soonDays) return 2;
  return 3;
}

/** Срок истёк или истекает в пределах окна — пункт нужен; дальше — нет. */
export function expiresWithin(date: string | null | undefined, days: number, now: Date = new Date()): boolean {
  return Boolean(date) && daysUntil(date as string, now) <= days;
}

/* ── Пункты по счетам прямых рейсов — чистые, их проверяют тесты ── */

/** Дней от a до b (даты YYYY-MM-DD). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

/** Строка freight_invoice_targets — нужные поля. */
export type FreightTargetRow = {
  order_id: string;
  invoice_id: string | null;
  editable: boolean;
  default_amount_cents: number | null;
  default_currency: string;
  amount_cents: number | null;
  currency: string | null;
  due_on: string | null;
  paid_at: string | null;
  paid_marked_side: string | null;
  paid_confirmed_at: string | null;
};

/**
 * Перевозчик и счёт выполненного прямого рейса:
 *   нет счёта (рейс закрыт за окно since) — «Счёт отправлен?»;
 *   заказчик отметил оплату — подтвердить; оплачен без отметки об оплате — заполнить;
 *   срок прошёл — «не оплачен», с collectionDay дня — подсказка о взыскании.
 */
export function carrierInvoiceItems(
  t: FreightTargetRow,
  order: { ref: string; closedAt: string },
  report: { editable: boolean; status: string | null } | undefined,
  ctx: { today: string; since: string; collectionDay: number; href: string },
): InboxItem[] {
  const base = { ref: order.ref, href: ctx.href };
  if (!t.invoice_id) {
    return t.editable && order.closedAt > ctx.since
      ? [{ ...base, key: `invoice-send:${t.order_id}`, kind: 'invoiceSend', urgency: 2, at: order.closedAt, amountCents: t.default_amount_cents, currency: t.default_currency, snooze: 1 }]
      : [];
  }
  if (t.paid_at) {
    const out: InboxItem[] = [];
    if (t.paid_marked_side === 'SHIPPER' && !t.paid_confirmed_at) {
      out.push({ ...base, key: `invoice-confirm:${t.invoice_id}`, kind: 'invoiceConfirm', urgency: 2, at: t.paid_at, amountCents: t.amount_cents, currency: t.currency, op: { op: 'confirmInvoicePaid', invoiceId: t.invoice_id } });
    }
    if (report?.editable && !report.status) {
      out.push({ ...base, key: `payreport:${t.order_id}`, kind: 'paymentReport', urgency: 3, at: t.paid_at, snooze: 1 });
    }
    return out;
  }
  if (!t.due_on || t.due_on >= ctx.today) return [];
  const late = dayDiff(t.due_on, ctx.today);
  const collect = late >= ctx.collectionDay;
  return [
    {
      ...base,
      key: `invoice-late:${t.invoice_id}`,
      kind: collect ? 'invoiceCollection' : 'invoiceOverdue',
      urgency: collect ? 0 : 1,
      at: t.due_on,
      date: t.due_on,
      amountCents: t.amount_cents,
      currency: t.currency,
      note: String(late),
      snooze: 1,
    },
  ];
}

/**
 * «Счёт отправлен?» по многим рейсам — одной строкой со счётчиком:
 * кто выставляет счета вне RAHTIS, не должен получить список на экран.
 */
export function collapseInvoiceSend(items: InboxItem[], href: string): InboxItem[] {
  const ask = items.filter((i) => i.kind === 'invoiceSend');
  if (ask.length < 2) return items;
  const latest = ask.reduce((a, b) => ((a.at ?? '') > (b.at ?? '') ? a : b));
  return [
    ...items.filter((i) => i.kind !== 'invoiceSend'),
    { key: 'invoice-send:many', kind: 'invoiceSend', urgency: 2, at: latest.at, note: String(ask.length), href, snooze: 7 },
  ];
}

/** Строка shipper_freight_invoices — нужные поля. */
export type ShipperInvoiceRow = {
  id: string;
  order_ref: string;
  carrier_name: string;
  amount_cents: number;
  currency: string;
  due_on: string;
  paid_at: string | null;
};

/** Заказчик: счёт перевозчика со сроком через soonDays или просроченный — «оплачено сегодня». */
export function shipperInvoiceItem(inv: ShipperInvoiceRow, ctx: { today: string; soonDays: number; href: string }): InboxItem | null {
  if (inv.paid_at) return null;
  const late = dayDiff(inv.due_on, ctx.today);
  if (late < -ctx.soonDays) return null;
  return {
    key: `invoice:${inv.id}`,
    kind: late > 0 ? 'invoiceOverdueShipper' : 'invoiceDue',
    urgency: late > 0 ? 0 : late === 0 ? 1 : 2,
    at: inv.due_on,
    ref: inv.order_ref,
    party: inv.carrier_name,
    date: inv.due_on,
    amountCents: inv.amount_cents,
    currency: inv.currency,
    href: ctx.href,
    op: { op: 'markInvoicePaid', invoiceId: inv.id },
    snooze: 1,
  };
}
