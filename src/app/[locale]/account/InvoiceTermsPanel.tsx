'use client';

import { useActionState } from 'react';
import { Badge, Button, Card, CardBody, Field, Select } from '@/components/ui';
import { answerInvoiceTermsAction, proposeInvoiceTermsAction, type TermsState } from '@/lib/invoices/termsActions';
import { PAYMENT_TERMS, SCHEDULES, isSchedule, type InvoiceSchedule } from '@/lib/invoices/terms';
import { useI18n } from '@/lib/i18n/provider';

export type CounterpartyTerms = {
  counterparty_id: string;
  counterparty_name: string;
  schedule: string;
  payment_term_days: number;
  proposed_schedule: string | null;
  proposed_term_days: number | null;
  proposed_by_me: boolean;
};

const idle: TermsState = { error: null, saved: false };

/**
 * Условия счёта с каждым контрагентом (17.11.2026): периодичность и срок
 * оплаты согласуют стороны. Ждущие ответа — наверху (порядок даёт база).
 */
export function InvoiceTermsPanel({ rows, canEdit }: { rows: CounterpartyTerms[]; canEdit: boolean }) {
  const { t } = useI18n();
  const it = t.invoiceTerms;

  return (
    <Card>
      <CardBody>
        <h2 id="invoice-terms" className="scroll-mt-24 text-[15px] font-semibold tracking-tight">
          {it.title}
        </h2>
        <p className="mt-1 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">{it.hint}</p>
        {rows.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{it.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <TermsRow key={row.counterparty_id} row={row} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function TermsRow({ row, canEdit }: { row: CounterpartyTerms; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const it = t.invoiceTerms;
  const [state, action, pending] = useActionState(proposeInvoiceTermsAction, idle);
  const label = (schedule: string, days: number) =>
    `${isSchedule(schedule) ? it.schedules[schedule] : schedule} · ${it.days.replace('{n}', String(days))}`;
  const theirs = row.proposed_schedule && !row.proposed_by_me;
  const mine = row.proposed_schedule && row.proposed_by_me;

  return (
    <li className="flex flex-col gap-2 rounded-control border border-line px-3 py-2.5 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{row.counterparty_name}</span>
        <Badge tone="neutral">{label(row.schedule, row.payment_term_days)}</Badge>
      </div>

      {theirs && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-warn">
            {it.proposalFromThem.replace('{terms}', label(row.proposed_schedule!, row.proposed_term_days!))}
          </span>
          {canEdit && (
            <form action={answerInvoiceTermsAction} className="flex gap-2">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="counterparty" value={row.counterparty_id} />
              <Button type="submit" name="decision" value="ACCEPT" variant="primary" size="sm">
                {it.accept}
              </Button>
              <Button type="submit" name="decision" value="REJECT" variant="default" size="sm">
                {it.reject}
              </Button>
            </form>
          )}
        </div>
      )}

      {mine && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-muted">
            {it.proposalMine.replace('{terms}', label(row.proposed_schedule!, row.proposed_term_days!))}
          </span>
          {canEdit && (
            <form action={answerInvoiceTermsAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="counterparty" value={row.counterparty_id} />
              <Button type="submit" name="decision" value="WITHDRAW" variant="default" size="sm">
                {it.withdraw}
              </Button>
            </form>
          )}
        </div>
      )}

      {canEdit && !theirs && (
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="counterparty" value={row.counterparty_id} />
          <Field label={it.schedule}>
            {(p) => (
              <Select {...p} name="schedule" defaultValue={row.schedule} disabled={pending}>
                {SCHEDULES.map((s: InvoiceSchedule) => (
                  <option key={s} value={s}>
                    {it.schedules[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={it.term}>
            {(p) => (
              <Select {...p} name="term_days" defaultValue={String(row.payment_term_days)} disabled={pending}>
                {PAYMENT_TERMS.map((d) => (
                  <option key={d} value={d}>
                    {it.days.replace('{n}', String(d))}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" variant="default" size="sm" disabled={pending}>
            {it.propose}
          </Button>
          {state.error && <p className="w-full text-[13px] text-danger">{state.error}</p>}
          {state.saved && !pending && <p className="w-full text-[13px] text-ok">{it.proposed}</p>}
        </form>
      )}
    </li>
  );
}
