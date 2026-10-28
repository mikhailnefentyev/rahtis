'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { closeOrderAction, tipperSummaryAction, type TipperSummary, type TripState } from '@/lib/orders/trip';
import { useI18n } from '@/lib/i18n/provider';
import { hoursLabel } from '@/lib/sites/work';

const initial: TripState = { error: null };

/**
 * Закрытие самосвального заказа: что наработал водитель на объекте
 * (дни, часы, рейсы, тонны нетто) и сколько это по ставке. Кнопка
 * закрывает рейс с этой суммой — она и становится ценой заказа.
 *
 * Точек и CMR у стройки нет: факт — в записях водителя на экране «Объект».
 */
export function TipperClosingPanel({ orderId }: { orderId: string }) {
  const { t, f, locale } = useI18n();
  const [summary, setSummary] = useState<TipperSummary | null>(null);
  const [close, closeAction, closing] = useActionState(closeOrderAction, initial);
  const s = t.tipperClose;

  useEffect(() => {
    let alive = true;
    void tipperSummaryAction(orderId).then((value) => {
      if (alive) setSummary(value);
    });
    return () => {
      alive = false;
    };
  }, [orderId]);

  if (!summary) return null;

  const ready = summary.days > 0 && summary.open_days === 0 && !(summary.pricing === 'TONNE' && summary.net_kg === 0);
  const reason =
    summary.days === 0 ? s.notArrived : summary.open_days > 0 ? s.dayOpen : summary.pricing === 'TONNE' && summary.net_kg === 0 ? s.noWeights : null;

  return (
    <div className="mt-4 rounded-control border border-line bg-sunken p-3">
      <p className="label-micro mb-2">{s.title}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-ink-faint">{s.days}</dt>
          <dd className="font-mono">{summary.days}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">{s.hours}</dt>
          <dd className="font-mono">{hoursLabel(summary.minutes)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">{s.loads}</dt>
          <dd className="font-mono">{summary.loads}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">{s.tonnes}</dt>
          <dd className="font-mono">{f.decimal(summary.net_kg / 1000)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[13px]">
        {s.amount}: <span className="font-mono font-semibold">{f.eur(summary.amount_cents)}</span>{' '}
        <span className="text-ink-faint">
          ({t.sites.pricingOptions[summary.pricing]}, {f.eur(summary.unit_rate_cents)})
        </span>
      </p>
      <p className="mt-1 text-xs text-ink-faint">{s.hint}</p>
      {reason && <p className="mt-2 text-xs text-warn">{reason}</p>}
      {close.error && <p className="mt-2 text-xs text-danger">{close.error}</p>}
      <form action={closeAction} className="mt-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="order_id" value={orderId} />
        <Button type="submit" variant="primary" size="sm" disabled={!ready || closing}>
          {s.close}
        </Button>
      </form>
    </div>
  );
}
