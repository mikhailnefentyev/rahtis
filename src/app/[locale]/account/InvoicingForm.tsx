'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardBody } from '@/components/ui';
import { saveWeeklyInvoicingAction, type InvoicingState } from '@/lib/companies/invoicingActions';
import { useI18n } from '@/lib/i18n/provider';

const initial: InvoicingState = { error: null, saved: false };

/**
 * Недельный счёт заказчику от имени перевозчика: RAHTIS составляет и шлёт по понедельникам (17.11.2026).
 *
 * Включение не выставляет историю (22.11.2026): база запоминает момент
 * включения (companies.weekly_invoicing_from), и в счёт идут рейсы,
 * закрытые с него. Дата видна под отметкой; тому, кто ставит отметку, до
 * сохранения сказано, что более ранние рейсы остаются за ним.
 */
export function InvoicingForm({ enabled, from, canEdit }: { enabled: boolean; from: string | null; canEdit: boolean }) {
  const { t, f, locale } = useI18n();
  const a = t.account;
  const [state, action, pending] = useActionState(saveWeeklyInvoicingAction, initial);
  const [checked, setChecked] = useState(enabled);

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
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={!canEdit || pending}
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
            />
            <span>{a.invoicingLabel}</span>
          </label>
          {enabled && from && <p className="text-xs text-ink-muted">{a.invoicingFrom.replace('{date}', f.date(from))}</p>}
          {checked && !enabled && <p className="max-w-xl text-xs leading-relaxed text-ink-muted">{a.invoicingTurnOnNote}</p>}
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
