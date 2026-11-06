'use client';

import { useActionState, useState } from 'react';
import { Badge, Button, Input, Select } from '@/components/ui';
import { cn } from '@/lib/cn';
import { todayInHelsinki } from '@/lib/dates';
import { useI18n } from '@/lib/i18n/provider';
import {
  confirmFreightPaidAction,
  deleteFreightInvoiceAction,
  markFreightPaidAction,
  saveFreightInvoiceAction,
  type InvoiceFormState,
} from '@/lib/invoices/actions';
import { addDaysIso, DEFAULT_TERM_DAYS, invoiceStatus, type InvoiceStatus } from '@/lib/invoices/schedule';
import { CURRENCIES } from '@/lib/money/currency';

/*
 * Счёт перевозчика заказчику по прямому рейсу (6.11.2026): «счёт
 * отправлен», статус оплаты и бесплатные напоминания от имени
 * перевозчика. Заказчику — список счетов с «оплачено».
 */

export type FreightInvoiceTarget = {
  editable: boolean;
  defaults: { amountCents: number | null; currency: string; sendTo: string | null };
  invoice: {
    id: string;
    number: string;
    amountCents: number;
    currency: string;
    issuedOn: string;
    dueOn: string;
    sendTo: string;
    paidAt: string | null;
    paidSide: string | null;
    confirmed: boolean;
    reminder1At: string | null;
    reminder2At: string | null;
  } | null;
  reportPrefilled: boolean;
};

const idle: InvoiceFormState = { error: null, saved: false };
const day = (d: string) => `${d.slice(0, 10)}T12:00:00Z`;

export function invoiceTone(status: InvoiceStatus): 'ok' | 'warn' | 'danger' | 'neutral' {
  return status === 'PAID' ? 'ok' : status === 'OVERDUE' ? 'danger' : status === 'PAID_UNCONFIRMED' ? 'warn' : 'neutral';
}

/** Значок статуса счёта в строке выполненного рейса. */
export function FreightInvoiceBadge({ target }: { target: FreightInvoiceTarget | undefined }) {
  const { t } = useI18n();
  const inv = target?.invoice;
  if (!inv) return null;
  const status = invoiceStatus({ dueOn: inv.dueOn, paidAt: inv.paidAt, paidSide: inv.paidSide, confirmed: inv.confirmed }, todayInHelsinki());
  return <Badge tone={invoiceTone(status)}>{t.trustWins[`status${status}`]}</Badge>;
}

/** Перевозчик: отметить счёт, видеть оплату и напоминания, подтвердить оплату заказчика. */
export function FreightInvoiceControl({ orderId, target, className }: { orderId: string; target: FreightInvoiceTarget; className?: string }) {
  const { t, f, locale } = useI18n();
  const tw = t.trustWins;
  const inv = target.invoice;
  const [editing, setEditing] = useState(!inv && target.editable);
  const [state, action, pending] = useActionState(saveFreightInvoiceAction, idle);
  const [payState, payAction, paying] = useActionState(markFreightPaidAction, idle);
  const today = todayInHelsinki();
  const [issued, setIssued] = useState(inv?.issuedOn ?? today);
  const [due, setDue] = useState(inv?.dueOn ?? addDaysIso(today, DEFAULT_TERM_DAYS));

  const status = inv ? invoiceStatus({ dueOn: inv.dueOn, paidAt: inv.paidAt, paidSide: inv.paidSide, confirmed: inv.confirmed }, today) : null;
  const showForm = (editing || (state.error !== null && !state.saved)) && target.editable && (!inv || !inv.paidAt);

  return (
    <div className={cn('flex flex-col gap-2 text-xs', className)}>
      <p className="label-micro">{tw.invoiceTitle}</p>

      {inv && !showForm && (
        <div className="flex flex-col gap-1.5">
          <p className="text-ink">
            {tw.invoiceLine
              .replace('{number}', inv.number)
              .replace('{amount}', f.money(inv.amountCents, inv.currency))
              .replace('{date}', f.date(day(inv.dueOn)))}{' '}
            {status && <Badge tone={invoiceTone(status)}>{tw[`status${status}`]}</Badge>}
          </p>
          {inv.paidAt && <p className="text-ink-muted">{tw.paidOn.replace('{date}', f.date(day(inv.paidAt)))}</p>}
          {[inv.reminder1At, inv.reminder2At].map(
            (at, i) =>
              at && (
                <p key={i} className="text-ink-dim">
                  {tw.reminderSent.replace('{n}', String(i + 1)).replace('{date}', f.date(at))}
                </p>
              ),
          )}
          {target.reportPrefilled && <p className="text-warn">{tw.prefilledNote}</p>}

          <div className="flex flex-wrap items-end gap-2">
            {status === 'PAID_UNCONFIRMED' && (
              <>
                <form action={confirmFreightPaidAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="invoice_id" value={inv.id} />
                  <Button type="submit" size="sm" variant="primary">
                    {tw.confirmPaid}
                  </Button>
                </form>
                <form action={payAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="invoice_id" value={inv.id} />
                  <input type="hidden" name="clear" value="1" />
                  <Button type="submit" size="sm" disabled={paying}>
                    {tw.notReceived}
                  </Button>
                </form>
              </>
            )}
            {!inv.paidAt && (
              <form action={payAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="invoice_id" value={inv.id} />
                <label className="flex flex-col gap-1 text-ink-muted">
                  {tw.paidDate}
                  <Input type="date" name="paid_on" defaultValue={today} max={today} required className="w-40" />
                </label>
                <Button type="submit" size="sm" disabled={paying}>
                  {tw.markPaid}
                </Button>
              </form>
            )}
            {!inv.paidAt && target.editable && (
              <Button size="sm" onClick={() => setEditing(true)}>
                {tw.invoiceEdit}
              </Button>
            )}
            {!inv.paidAt && (
              <form action={deleteFreightInvoiceAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="invoice_id" value={inv.id} />
                <Button type="submit" size="sm">
                  {tw.invoiceDelete}
                </Button>
              </form>
            )}
          </div>
          {payState.error && <p className="text-danger">{payState.error}</p>}
        </div>
      )}

      {!inv && !showForm && target.editable && (
        <Button size="sm" className="self-start" onClick={() => setEditing(true)}>
          {tw.invoiceSave}
        </Button>
      )}

      {showForm && (
        <form action={action} className="flex flex-col gap-2 rounded-control border border-line bg-sunken p-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="order_id" value={orderId} />
          <p className="text-ink-muted">{tw.invoiceHint}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              {tw.invoiceNumber}
              <Input name="number" required maxLength={40} defaultValue={inv?.number ?? ''} />
            </label>
            <label className="flex flex-col gap-1">
              {tw.invoiceAmount}
              <Input
                name="amount"
                required
                inputMode="decimal"
                defaultValue={
                  inv ? String(inv.amountCents / 100).replace('.', ',') : target.defaults.amountCents ? String(target.defaults.amountCents / 100).replace('.', ',') : ''
                }
              />
            </label>
            <label className="flex flex-col gap-1">
              {tw.invoiceCurrency}
              <Select name="currency" defaultValue={inv?.currency ?? target.defaults.currency}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              {tw.invoiceIssued}
              <Input
                type="date"
                name="issued_on"
                required
                value={issued}
                onChange={(e) => {
                  setIssued(e.target.value);
                  if (!inv && e.target.value) setDue(addDaysIso(e.target.value, DEFAULT_TERM_DAYS));
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              {tw.invoiceDue}
              <Input type="date" name="due_on" required value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              {tw.invoiceSendTo}
              <Input type="email" name="send_to" required defaultValue={inv?.sendTo ?? target.defaults.sendTo ?? ''} />
            </label>
          </div>
          {state.error && <p className="text-danger">{state.error}</p>}
          <div className="flex gap-2">
            {inv && (
              <Button type="button" size="sm" onClick={() => setEditing(false)}>
                {t.action.cancel}
              </Button>
            )}
            <Button type="submit" size="sm" variant="primary" disabled={pending}>
              {inv ? tw.invoiceUpdate : tw.invoiceSave}
            </Button>
          </div>
        </form>
      )}
      {state.saved && !pending && !showForm && <p className="text-ok">{tw.invoiceSaved}</p>}
    </div>
  );
}

export type ShipperInvoiceRow = {
  id: string;
  orderRef: string;
  carrierName: string;
  number: string;
  amountCents: number;
  currency: string;
  dueOn: string;
  paidAt: string | null;
  paidSide: string | null;
  confirmed: boolean;
};

/** Заказчик: счета перевозчиков — сроки и «оплачено» (напоминания прекращаются). */
export function ShipperInvoices({ rows }: { rows: ShipperInvoiceRow[] }) {
  const { t, f } = useI18n();
  const tw = t.trustWins;
  const today = todayInHelsinki();

  return (
    <section id="invoices" className="mb-8 scroll-mt-24">
      <h2 className="mb-1 text-[15px] font-semibold tracking-tight">{tw.shipperInvoicesTitle}</h2>
      <p className="mb-3 max-w-2xl text-xs text-ink-muted">{tw.shipperInvoicesHint}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-muted">{tw.shipperInvoicesEmpty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="py-2 pr-3 font-normal">{tw.colCarrier}</th>
                <th className="py-2 pr-3 font-normal">{tw.colInvoice}</th>
                <th className="py-2 pr-3 font-normal">{tw.colDue}</th>
                <th className="py-2 pr-3 text-right font-normal">{tw.colAmount}</th>
                <th className="py-2 font-normal">{tw.colStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = invoiceStatus({ dueOn: r.dueOn, paidAt: r.paidAt, paidSide: r.paidSide, confirmed: r.confirmed }, today);
                return (
                  <tr key={r.id} id={`invoice-${r.id}`} className="scroll-mt-24 border-b border-line align-top target:bg-warn/10">
                    <td className="py-2 pr-3">{r.carrierName}</td>
                    <td className="py-2 pr-3">
                      <span className="font-mono">{r.number}</span>
                      <span className="block text-xs text-ink-dim">{r.orderRef}</span>
                    </td>
                    <td className="py-2 pr-3">{f.date(day(r.dueOn))}</td>
                    <td className="py-2 pr-3 text-right">{f.money(r.amountCents, r.currency)}</td>
                    <td className="py-2">
                      <Badge tone={invoiceTone(status)}>{tw[`status${status}`]}</Badge>
                      {r.paidAt && <span className="block text-xs text-ink-dim">{tw.paidOn.replace('{date}', f.date(day(r.paidAt)))}</span>}
                      {status === 'PAID_UNCONFIRMED' && <span className="block text-xs text-ink-dim">{tw.awaitingConfirm}</span>}
                      {!r.paidAt && <MarkPaid invoiceId={r.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MarkPaid({ invoiceId }: { invoiceId: string }) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(markFreightPaidAction, idle);
  const today = todayInHelsinki();
  if (state.saved) return null;
  return (
    <form action={action} className="mt-1.5 flex flex-wrap items-center gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <Input type="date" name="paid_on" defaultValue={today} max={today} required aria-label={t.trustWins.paidDate} className="w-36" />
      <Button type="submit" size="sm" disabled={pending}>
        {t.trustWins.markPaid}
      </Button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
