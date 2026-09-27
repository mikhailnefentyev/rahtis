'use client';

import { useActionState, useState } from 'react';
import { reportProblemAction, type DriverState } from '@/lib/driverApp/actions';
import { useI18n } from '@/lib/i18n/provider';

const idle: DriverState = { error: null, done: false };

/**
 * «Ilmoita ongelmasta» — сообщение перевозчику водителя, с номером рейса.
 * Свёрнуто по умолчанию: это выход из положения, а не рабочий шаг.
 */
export function ProblemForm({ orderId }: { orderId: string }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportProblemAction, idle);

  if (state.done) {
    return <p className="rounded-card bg-ok/10 px-4 py-3 text-[15px] text-ok">{t.driverApp.sent}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-12 rounded-control border border-line bg-surface text-[15px] font-semibold text-warn"
      >
        {t.driverApp.problem}
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="order_id" value={orderId} />
      <label className="flex flex-col gap-1">
        <span className="text-[15px] font-semibold">{t.driverApp.problem}</span>
        <textarea
          name="text"
          required
          minLength={3}
          maxLength={300}
          rows={3}
          placeholder={t.driverApp.problemPlaceholder}
          className="rounded-control border border-line bg-sunken px-3 py-2 text-[16px]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-control bg-ink text-[15px] font-semibold text-surface disabled:opacity-60"
      >
        {t.driverApp.send}
      </button>
      {state.error && <p className="text-[15px] text-danger">{state.error}</p>}
    </form>
  );
}
