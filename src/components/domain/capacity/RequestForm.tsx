'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { requestCapacityAction, type CapacityRequestState } from '@/lib/capacity/actions';
import { useI18n } from '@/lib/i18n/provider';

export type RequestOrderOption = { id: string; label: string; price: number | null; currency: string; date: string | null };

/**
 * Запрос на свободное место: свой заказ (черновик или на столе без
 * откликов), цена, окно дат, паллеты и описание груза. Принятый запрос
 * становится прямым заказом этой машине. «Описать груз» (newOrderHref) —
 * форма заказа черновиком под это место: на стол он не уходит.
 */
export function RequestForm({
  offerId,
  orders,
  defaultOrderId,
  newOrderHref,
}: {
  offerId: string;
  orders: RequestOrderOption[];
  defaultOrderId?: string;
  newOrderHref: string;
}) {
  const { t, locale } = useI18n();
  const c = t.capacity;
  const [state, action, pending] = useActionState<CapacityRequestState, FormData>(requestCapacityAction, { error: null, done: false });

  if (state.done) return <p className="text-[13px] font-semibold text-ok">{c.requestSent}</p>;

  if (orders.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        {c.noOrders}{' '}
        <a href={newOrderHref} className="text-accent hover:underline">
          {c.holdNew}
        </a>
      </p>
    );
  }

  const first = orders.find((o) => o.id === defaultOrderId) ?? orders[0];
  const field = 'h-9 rounded-control border border-line bg-surface px-2 text-[13px]';

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="offer_id" value={offerId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-[13px]">
          <span className="label-micro">{c.yourOrder}</span>
          <select name="order_id" defaultValue={first.id} className={field}>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="label-micro">{c.price.replace('{currency}', first.currency)}</span>
          <input
            name="price"
            required
            inputMode="decimal"
            defaultValue={first.price ? String(first.price / 100) : ''}
            className={field + ' w-28'}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="label-micro">{c.dateFrom}</span>
          <input type="date" name="date_from" defaultValue={first.date ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="label-micro">{c.dateTo}</span>
          <input type="date" name="date_to" defaultValue={first.date ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="label-micro">{c.palletsLabel}</span>
          <input name="pallets" inputMode="numeric" className={field + ' w-20'} />
        </label>
      </div>
      <input name="description" maxLength={500} placeholder={c.descriptionPlaceholder} aria-label={c.description} className={field} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          {c.sendRequest}
        </Button>
        <span className="text-[12px] text-ink-faint">{c.requestHint}</span>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
      <p className="text-[12px] text-ink-faint">
        {c.holdHint}{' '}
        <a href={newOrderHref} className="text-accent hover:underline">
          {c.holdNew}
        </a>
      </p>
    </form>
  );
}
