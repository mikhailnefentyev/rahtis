'use client';

import { useEffect, useState } from 'react';
import { tipperSummaryAction, type TipperSummary as Summary } from '@/lib/orders/trip';
import { useI18n } from '@/lib/i18n/provider';
import { hoursLabel } from '@/lib/sites/work';

/**
 * Наработанное по самосвальному заказу — для заказчика: дни, часы, рейсы,
 * тонны нетто и сумма по ставке. Из этого считается итоговая цена
 * (договор заказчика 3.5). Права решает база (tipper_order_summary).
 */
export function TipperSummary({ orderId, className }: { orderId: string; className?: string }) {
  const { t, f } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    void tipperSummaryAction(orderId).then((value) => {
      if (alive) setSummary(value);
    });
    return () => {
      alive = false;
    };
  }, [orderId]);

  if (!summary || summary.days === 0) return null;
  const s = t.tipperClose;

  return (
    <div className={className}>
      <p className="label-micro mb-1">{s.title}</p>
      <p className="text-[13px]">
        {s.days} {summary.days} · {s.hours} {hoursLabel(summary.minutes)} · {s.loads} {summary.loads} · {s.tonnes}{' '}
        {f.decimal(summary.net_kg / 1000)} · <span className="font-semibold">{f.money(summary.amount_cents, summary.currency)}</span>
      </p>
    </div>
  );
}
