'use client';

import { useActionState } from 'react';
import { Badge, Button, Card, CardBody } from '@/components/ui';
import { sendSiteInvoiceNowAction, siteInvoicePdfUrlAction, type SendInvoiceState } from '@/lib/sites/actions';
import { useI18n } from '@/lib/i18n/provider';

const initial: SendInvoiceState = { message: null, ok: false };

export type InvoiceRow = {
  id: string;
  number: string;
  issued_on: string;
  due_on: string;
  total: string;
  sent_at: string | null;
  sent_to: string | null;
};

/** Счета объекта: отправить сейчас и список выставленных с PDF. */
export function Invoices({ jobId, schedule, invoices }: { jobId: string; schedule: string; invoices: InvoiceRow[] }) {
  const { t, locale, f } = useI18n();
  const [state, action, pending] = useActionState(sendSiteInvoiceNowAction, initial);
  const s = t.siteInvoice;

  async function openPdf(id: string) {
    const url = await siteInvoicePdfUrlAction(id);
    if (url) window.open(url, '_blank', 'noopener');
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink-faint">
        {s.invoices}
        <span className="ml-2 font-normal">
          · {s.schedule}: {(s.schedules[schedule as keyof typeof s.schedules] ?? schedule).toLocaleLowerCase(locale)}
        </span>
      </h2>
      <form action={action} className="mb-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="job_id" value={jobId} />
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {s.sendNow}
        </Button>
        <span className="text-xs text-ink-dim">{s.sendNowHint}</span>
      </form>
      {state.message && <p className={`mb-3 text-[13px] ${state.ok ? 'text-ok' : 'text-warn'}`}>{state.message}</p>}
      {invoices.length === 0 ? (
        <p className="text-[13px] text-ink-muted">{s.noInvoices}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {invoices.map((inv) => (
            <Card key={inv.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
                <span>
                  <span className="font-mono font-semibold">{inv.number}</span> · {f.date(`${inv.issued_on}T12:00:00Z`)} · {inv.total} · {s.due}{' '}
                  {f.date(`${inv.due_on}T12:00:00Z`)}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={inv.sent_at ? 'ok' : 'warn'}>{inv.sent_at ? `${s.sent} ${inv.sent_to ?? ''}` : s.notSent}</Badge>
                  <Button size="sm" onClick={() => openPdf(inv.id)}>
                    {s.pdf}
                  </Button>
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
