'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n/provider';
import { markFreightPaidAction } from '@/lib/invoices/actions';
import { confirmOrderAction } from '@/lib/orders/matching';

/*
 * Кнопки «Требует действия» для действий с ответом (useActionState):
 * отказ базы показывается тут же, под кнопкой, а не теряется.
 */

export function ConfirmOrderButton({ orderId, label }: { orderId: string; label: string }) {
  const { locale } = useI18n();
  const [state, action, pending] = useActionState(confirmOrderAction, { error: null });
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <Button type="submit" size="sm" variant="primary" disabled={pending}>
        {label}
      </Button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

/** «Оплачено сегодня» — дата по умолчанию; другую дату ставят в списке счетов. */
export function MarkPaidButton({ invoiceId, paidOn, label }: { invoiceId: string; paidOn: string; label: string }) {
  const { locale } = useI18n();
  const [state, action, pending] = useActionState(markFreightPaidAction, { error: null, saved: false });
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="paid_on" value={paidOn} />
      <Button type="submit" size="sm" variant="primary" disabled={pending || state.saved}>
        {label}
      </Button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
