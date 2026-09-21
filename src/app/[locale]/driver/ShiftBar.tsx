'use client';

import { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { shiftAction } from '@/lib/driverApp/actions';
import type { DriverMe } from '@/lib/driverApp/session';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';

/**
 * Полоса смены над списком заданий — как у DFDS «Tauko / Lopeta päivä».
 *
 * Счётчик рабочего времени бежит на телефоне, но считает его база: здесь
 * только разница между сейчас и началом смены за вычетом перерывов. Место
 * пишется лишь в момент начала и конца дня — не трекинг.
 */
export function ShiftBar({ shift }: { shift: DriverMe['shift'] }) {
  const { t, m, locale } = useI18n();
  const [pending, start] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!shift) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [shift]);

  const onBreak = Boolean(shift?.break_started_at);

  const worked = (() => {
    if (!shift || now == null) return null;
    const ongoingBreak = shift.break_started_at ? now - Date.parse(shift.break_started_at) : 0;
    const minutes = Math.max(
      0,
      Math.floor((now - Date.parse(shift.started_at) - ongoingBreak) / 60_000) - shift.break_minutes,
    );
    return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
  })();

  function act(action: 'START' | 'BREAK' | 'RESUME' | 'END') {
    start(async () => {
      const form = new FormData();
      form.set('locale', locale);
      form.set('action', action);
      if (action === 'START' || action === 'END') {
        const position = await askPosition(5000);
        if (position) {
          form.set('lat', String(position.lat));
          form.set('lon', String(position.lon));
        }
      }
      await shiftAction(form);
    });
  }

  const button = 'h-14 flex-1 rounded-control px-4 text-[16px] font-semibold disabled:opacity-50';

  return (
    <section
      className={cn(
        'rounded-card border px-4 py-3',
        !shift ? 'border-line bg-surface' : onBreak ? 'border-warn/40 bg-warn/10' : 'border-accent-line bg-accent-wash',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-micro">
          {!shift ? t.driverApp.shiftOff : onBreak ? t.driverApp.onBreak : t.driverApp.working}
        </span>
        {worked && <span className="font-mono text-lg font-bold tracking-tight">{worked}</span>}
      </div>
      {shift && shift.break_minutes > 0 && (
        <p className="mt-0.5 text-xs text-ink-muted">
          {m('driverApp.breakTotal', { minutes: shift.break_minutes })}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {!shift ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act('START')}
            className={cn(button, 'bg-accent text-accent-ink')}
          >
            {t.driverApp.startDay}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(onBreak ? 'RESUME' : 'BREAK')}
              className={cn(button, 'bg-ink text-surface')}
            >
              {onBreak ? t.driverApp.resume : t.driverApp.pause}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => act('END')}
              className={cn(button, 'bg-danger text-white')}
            >
              {t.driverApp.endDay}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
