'use client';

import { useState } from 'react';
import { declineTaskAction } from '@/lib/driverApp/actions';

/**
 * Отказ от задания — в два касания.
 *
 * Раньше хватало одного: палец в кабине промахнулся мимо «Принять», и
 * задание ушло. У своего рейса перевозчика отказ ещё и окончательный —
 * рейс снимается, а не возвращается на стол (прогон 12.10.2026).
 *
 * Подписи приходят со страницы: словарь водителя живёт на сервере.
 */
export function DeclineTask({
  locale,
  orderId,
  labels,
}: {
  locale: string;
  orderId: string;
  labels: { decline: string; confirm: string; yes: string };
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="h-12 w-full rounded-control border border-line text-[15px] font-semibold text-danger"
      >
        {labels.decline}
      </button>
    );
  }

  return (
    <form action={declineTaskAction} className="flex flex-col gap-2 rounded-control border border-danger/40 p-3">
      <p className="text-[15px] text-ink">{labels.confirm}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="←"
          onClick={() => setAsking(false)}
          className="h-12 w-14 rounded-control border border-line text-[17px] font-semibold"
        >
          ←
        </button>
        <button className="h-12 flex-1 rounded-control border border-danger text-[15px] font-semibold text-danger">
          {labels.yes}
        </button>
      </div>
    </form>
  );
}
