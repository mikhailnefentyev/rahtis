'use client';

import { createContext, useContext } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';
import { useOutbox } from '../../OutboxProvider';

type StopInfo = {
  id: string;
  sequence: number;
  arrived: boolean;
  completed: boolean;
  /** Готовые строки баннера: считает сервер, у него словарь с подстановками. */
  stopOf: string;
  title: string;
};

type StopState = {
  current: boolean;
  arrived: boolean;
  completed: boolean;
  /** Отмечено на телефоне, но ещё не дошло. */
  arrivedQueued: boolean;
  completedQueued: boolean;
};

const Context = createContext<StopInfo[] | null>(null);

/**
 * Ход рейса с учётом очереди.
 *
 * Сервер знает только то, что до него дошло. Без связи водитель отметил
 * прибытие и «Tehty» — экран обязан показать следующую точку сразу, а не
 * когда найдётся сеть, иначе в порту работа встала бы. Поэтому, какая
 * точка текущая, решается здесь: по серверным отметкам плюс ждущим в
 * очереди.
 */
export function TaskProgress({ stops, children }: { stops: StopInfo[]; children: React.ReactNode }) {
  return <Context.Provider value={stops}>{children}</Context.Provider>;
}

function useStops(): StopInfo[] {
  const stops = useContext(Context);
  if (!stops) throw new Error('useStops outside TaskProgress');
  return stops;
}

function useEffective() {
  const stops = useStops();
  const { pending } = useOutbox();

  const queued = (kind: 'ARRIVE' | 'COMPLETE', id: string) =>
    pending.some((e) => e.kind === kind && e.fields.stop_id === id);

  const states = new Map<string, StopState>();
  let currentFound = false;

  for (const stop of [...stops].sort((a, b) => a.sequence - b.sequence)) {
    const completedQueued = !stop.completed && queued('COMPLETE', stop.id);
    const completed = stop.completed || completedQueued;
    const arrivedQueued = !stop.arrived && queued('ARRIVE', stop.id);
    const current = !completed && !currentFound;
    if (current) currentFound = true;

    states.set(stop.id, {
      current,
      completed,
      completedQueued,
      arrived: stop.arrived || arrivedQueued || completed,
      arrivedQueued,
    });
  }

  return { stops, states };
}

export function useStopState(stopId: string): StopState {
  return useEffective().states.get(stopId)!;
}

/** Показывает содержимое только в нужном состоянии точки. */
export function StopGate({
  stopId,
  when,
  children,
}: {
  stopId: string;
  when: 'current' | 'beforeArrive' | 'afterArrive' | 'completedQueued' | 'arrivedQueued';
  children: React.ReactNode;
}) {
  const s = useStopState(stopId);
  const show =
    when === 'current'
      ? s.current
      : when === 'beforeArrive'
        ? s.current && !s.arrived
        : when === 'afterArrive'
          ? s.current && s.arrived
          : when === 'completedQueued'
            ? s.completedQueued
            : s.arrivedQueued;
  return show ? <>{children}</> : null;
}

/** Кружок ленты: пройдено, текущая или впереди. */
export function StopDot({ stopId }: { stopId: string }) {
  const s = useStopState(stopId);
  return (
    <span
      className={cn(
        'mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        s.completed
          ? s.completedQueued
            ? 'bg-ok/50 text-white'
            : 'bg-ok text-white'
          : s.current
            ? 'bg-accent text-accent-ink'
            : 'border-2 border-line-strong',
      )}
    >
      {s.completed ? '✓' : ''}
    </span>
  );
}

/** Баннер следующего действия — тоже с учётом очереди. */
export function TaskBanner() {
  const { t } = useI18n();
  const { stops, states } = useEffective();
  const current = stops.find((s) => states.get(s.id)?.current);

  return (
    <div className="rounded-card bg-accent px-4 py-4 text-center text-accent-ink">
      {current ? (
        <>
          <p className="text-sm opacity-80">{current.stopOf}</p>
          <p className="text-xl font-semibold">{current.title}</p>
        </>
      ) : (
        <p className="text-[17px] font-semibold">{t.driverApp.allDone}</p>
      )}
    </div>
  );
}

/** Пометка «в очереди» у отметки, которая ещё не дошла до сервера. */
export function QueuedMark() {
  const { t } = useI18n();
  return <span className="ml-1 text-sm font-normal text-warn">· {t.driverApp.queuedBadge}</span>;
}
