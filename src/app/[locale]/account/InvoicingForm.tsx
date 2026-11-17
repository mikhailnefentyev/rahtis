'use client';

import { useActionState } from 'react';
import { Button, Card, CardBody } from '@/components/ui';
import { saveWeeklyInvoicingAction, type InvoicingState } from '@/lib/companies/invoicingActions';
import { useI18n } from '@/lib/i18n/provider';

const initial: InvoicingState = { error: null, saved: false };

/** Недельный счёт заказчику от имени перевозчика: RAHTIS составляет и шлёт по понедельникам (17.11.2026). */
export function InvoicingForm({ enabled, canEdit }: { enabled: boolean; canEdit: boolean }) {
  const { t, locale } = useI18n();
  const a = t.account;
  const [state, action, pending] = useActionState(saveWeeklyInvoicingAction, initial);

  return (
    <Card>
      <CardBody>
        <h2 className="text-[15px] font-semibold tracking-tight">{a.invoicingTitle}</h2>
        <p className="mt-1 mb-4 max-w-xl text-[13px] leading-relaxed text-ink-muted">{a.invoicingHint}</p>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="locale" value={locale} />
          <label className="flex cursor-pointer items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              name="weekly_invoicing"
              value="1"
              defaultChecked={enabled}
              disabled={!canEdit || pending}
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
            />
            <span>{a.invoicingLabel}</span>
          </label>
          {canEdit ? (
            <Button type="submit" variant="primary" size="sm" disabled={pending} className="self-start">
              {t.forwarder.roleSave}
            </Button>
          ) : (
            <p className="text-xs text-ink-dim">{t.forwarder.roleOwnerOnly}</p>
          )}
          {state.error && <p className="text-[13px] text-danger">{state.error}</p>}
          {state.saved && !pending && <p className="text-[13px] text-ok">{t.forwarder.roleSaved}</p>}
        </form>
      </CardBody>
    </Card>
  );
}
