'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { DriverMe } from '@/lib/driverApp/session';
import { useI18n } from '@/lib/i18n/provider';
import { askPosition } from '@/lib/orders/position';
import { useOutbox } from './OutboxProvider';

type Shift = DriverMe['shift'];

/**
 * Состояние смены с учётом ещё не отправленных нажатий: без связи
 * «Tauko» должна сработать на экране сразу, а не когда найдётся сеть.
 * Сервер получит те же нажатия с тем же временем.
 */
function effectiveShift(server: Shift, pending: ReturnType<typeof useOutbox>['pending']): Shift {
  let shift = server;
  for (const event of pending) {
    if (event.kind !== 'SHIFT') continue;
    const at = event.pressedAt;
    switch (event.fields.action) {
      case 'START':
        shift = shift ?? { id: event.id, started_at: at, break_started_at: null, break_minutes: 0 };
        break;
      case 'BREAK':
        if (shift && !shift.break_started_at) shift = { ...shift, break_started_at: at };
        break;
      case 'RESUME':
        if (shift?.break_started_at) {
          const minutes = Math.round((Date.parse(at) - Date.parse(shift.break_started_at)) / 60_000);
          shift = { ...shift, break_started_at: null, break_minutes: shift.break_minutes + minutes };
        }
        break;
      case 'END':
        shift = null;
        break;
    }
  }
  return shift;
}

/**
 * Полоса смены над списком заданий — как у DFDS «Tauko / Lopeta päivä».
 *
 * Счётчик бежит на телефоне, но считает база: здесь только разница между
 * сейчас и началом смены за вычетом перерывов. Место пишется лишь в
 * момент начала и конца дня — не трекинг.
 */
export function ShiftBar({ shift: serverShift }: { shift: Shift }) {
  const { t, m } = useI18n();
  const { pending, enqueue } = useOutbox();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const shift = effectiveShift(serverShift, pending);

  /* Зависимость — флаг, а не объект: объект собирается заново на каждом рендере. */
  const running = shift !== null;
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [running]);

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

  async function act(action: 'START' | 'BREAK' | 'RESUME' | 'END') {
    setBusy(true);
    try {
      const fields: Record<string, string> = { action };
      if (action === 'START' || action === 'END') {
        const position = await askPosition(4000);
        if (position) {
          fields.lat = String(position.lat);
          fields.lon = String(position.lon);
        }
      }
      await enqueue('SHIFT', fields);
    } finally {
      setBusy(false);
    }
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
            disabled={busy}
            onClick={() => act('START')}
            className={cn(button, 'bg-accent text-accent-ink')}
          >
            {t.driverApp.startDay}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => act(onBreak ? 'RESUME' : 'BREAK')}
              className={cn(button, 'bg-ink text-surface')}
            >
              {onBreak ? t.driverApp.resume : t.driverApp.pause}
            </button>
            <button
              type="button"
              disabled={busy}
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
