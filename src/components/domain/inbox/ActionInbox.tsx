import Link from 'next/link';
import { Button, buttonClass, Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { todayInHelsinki } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { snoozeInboxItemAction } from '@/lib/inbox/actions';
import type { InboxItem } from '@/lib/inbox/rank';
import { confirmFreightPaidAction } from '@/lib/invoices/actions';
import { acknowledgeAmendmentsAction, dismissChangeRequestAction, respondProposalAction } from '@/lib/orders/amend';
import { ConfirmOrderButton, MarkPaidButton } from './InboxButtons';

/** Сколько пунктов видно сразу; остальные — под «Показать все». */
const VISIBLE = 7;

/**
 * «Требует вашего действия» (6.11.2026) — первый блок обзора кабинета.
 *
 * Одна строка — одно дело: что, по какому рейсу и одна кнопка, которая
 * делает это на месте или ведёт ровно к нужной форме. Всё, что не ждёт
 * человека, остаётся в лентах и списках.
 */
export async function ActionInbox({ locale, items, total }: { locale: Locale; items: InboxItem[]; total: number }) {
  const { t } = await getViewerI18n(locale);
  const ti = t.inbox;
  const head = items.slice(0, VISIBLE);
  const rest = items.slice(VISIBLE);

  return (
    <section id="inbox" aria-label={ti.title} className="flex scroll-mt-24 flex-col gap-2.5">
      <p className="label-micro rise flex items-center gap-2" style={{ '--i': 1 } as React.CSSProperties}>
        {ti.title}
        {total > 0 && <span className="cab-nav__count">{total > 99 ? '99+' : total}</span>}
      </p>
      {items.length === 0 ? (
        <p className="text-[13px] text-ink-muted">{ti.empty}</p>
      ) : (
        <Card className="rise overflow-hidden" style={{ '--i': 2 } as React.CSSProperties}>
          <ul>
            {head.map((item) => (
              <Row key={item.key} item={item} locale={locale} />
            ))}
          </ul>
          {rest.length > 0 && (
            <details className="[&[open]>summary]:hidden">
              <summary className="cursor-pointer list-none border-t border-line px-4 py-2.5 text-[13px] font-semibold text-accent">
                {ti.showAll.replace('{count}', String(items.length))}
              </summary>
              <ul>
                {rest.map((item) => (
                  <Row key={item.key} item={item} locale={locale} />
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}
    </section>
  );
}

async function Row({ item, locale }: { item: InboxItem; locale: Locale }) {
  const { t, f } = await getViewerI18n(locale);
  const ti = t.inbox;
  const title = (ti as Record<string, string>)[item.kind] ?? item.kind;
  const context = contextLine(item, t, f);
  const op = item.op;

  const hidden = (fields: Record<string, string | number>) => (
    <>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
  const open = (primary: boolean) => (
    <Link href={item.href} className={buttonClass({ variant: primary ? 'primary' : 'default', size: 'sm' })}>
      {ti.open}
    </Link>
  );

  let actions: React.ReactNode;
  switch (op?.op) {
    case 'acceptProposal':
      actions = (
        <>
          <form action={respondProposalAction}>
            {hidden({ amendment_id: op.amendmentId, accept: '1' })}
            <Button type="submit" size="sm" variant="primary">
              {ti.accept}
            </Button>
          </form>
          {open(false)}
        </>
      );
      break;
    case 'acknowledge':
      actions = (
        <>
          <form action={acknowledgeAmendmentsAction}>
            {hidden({ order_id: op.orderId })}
            <Button type="submit" size="sm" variant="primary">
              {ti.acknowledge}
            </Button>
          </form>
          {open(false)}
        </>
      );
      break;
    case 'dismissRequest':
      /* Применить адрес — на карточке (поле адреса); здесь только «не нужно». */
      actions = (
        <>
          {open(true)}
          <form action={dismissChangeRequestAction}>
            {hidden({ request_id: op.requestId })}
            <Button type="submit" size="sm" variant="ghost">
              {ti.dismiss}
            </Button>
          </form>
        </>
      );
      break;
    case 'confirmInvoicePaid':
      actions = (
        <>
          <form action={confirmFreightPaidAction}>
            {hidden({ invoice_id: op.invoiceId })}
            <Button type="submit" size="sm" variant="primary">
              {ti.confirmPaid}
            </Button>
          </form>
          {open(false)}
        </>
      );
      break;
    case 'confirmOrder':
      actions = (
        <>
          <ConfirmOrderButton orderId={op.orderId} label={ti.confirm} />
          {open(false)}
        </>
      );
      break;
    case 'markInvoicePaid':
      /* Дата по умолчанию — сегодня; другая дата — в списке счетов. */
      actions = (
        <>
          <MarkPaidButton invoiceId={op.invoiceId} paidOn={todayInHelsinki()} label={ti.markPaid} />
          {open(false)}
        </>
      );
      break;
    default:
      actions = open(true);
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 first:border-t-0">
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          item.urgency === 0 ? 'bg-danger' : item.urgency === 1 ? 'bg-warn' : 'bg-ink-dim/50',
        )}
      />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14px] font-semibold leading-snug">{title}</p>
        {context && <p className="truncate text-[12.5px] text-ink-muted">{context}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {item.snooze ? (
          <form action={snoozeInboxItemAction}>
            {hidden({ key: item.key, days: item.snooze })}
            <Button type="submit" size="sm" variant="ghost">
              {item.kind === 'sensitiveChanged' ? ti.recognise : ti.later}
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

type I18n = Awaited<ReturnType<typeof getViewerI18n>>;

/** Строка контекста: рейс, контрагент, срок или сумма — что нужно, чтобы решить без перехода. */
function contextLine(item: InboxItem, t: I18n['t'], f: I18n['f']): string {
  const ti = t.inbox;
  const day = (d: string) => f.date(d.length === 10 ? `${d}T12:00:00Z` : d);
  const parts: string[] = [];
  if (item.ref) parts.push(item.ref);
  if (item.party) parts.push(item.party);

  if (item.docKind) {
    const label =
      (t.documents as Record<string, unknown>)[item.docKind] ??
      (t.certificates.types as Record<string, string>)[item.docKind] ??
      item.docKind;
    parts.push(String(label));
  }
  if (item.kind === 'sensitiveChanged' && item.note) {
    parts.push((t.trustWins as Record<string, string>)[`field${item.note}`] ?? item.note);
  }

  if (item.date) {
    if (item.kind.startsWith('invoice')) parts.push(ti.due.replace('{date}', day(item.date)));
    else if (item.kind === 'docExpiring' || item.kind === 'certExpiring') parts.push(ti.expires.replace('{date}', day(item.date)));
    else if (item.kind === 'sensitiveChanged') parts.push(f.dateTime(item.date));
    else parts.push(ti.pickup.replace('{date}', day(item.date)));
  }

  if (item.amountCents) {
    const amount = f.money(item.amountCents, item.currency ?? undefined);
    parts.push(item.kind === 'priceProposal' ? ti.newPrice.replace('{amount}', amount) : amount);
  }

  if (item.note && item.kind !== 'sensitiveChanged') {
    if (item.kind === 'changes') parts.push(ti.changesCount.replace('{count}', item.note));
    else if (item.kind === 'chooseOffer') parts.push(ti.offersCount.replace('{count}', item.note));
    else if (item.kind === 'invoiceSend') parts.push(ti.tripsCount.replace('{count}', item.note));
    else if (item.kind === 'invoiceOverdue' || item.kind === 'invoiceCollection') parts.push(ti.daysLate.replace('{days}', item.note));
    else parts.push(item.note);
  }
  return parts.join(' · ');
}
