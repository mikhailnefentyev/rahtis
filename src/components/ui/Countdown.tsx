'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { formatCountdown } from '@/lib/format';
import { useNow } from '@/lib/useNow';

/**
 * Обратный отсчёт до дедлайна решения (15 минут по ТЗ §6).
 *
 * Компонент только показывает остаток. Сам откат заказа на стол делает
 * серверный планировщик по полю deadline_at: вкладку можно закрыть,
 * заснуть, потерять сеть — на срок это не влияет. Отсчёт здесь нужен,
 * чтобы человек понимал, сколько у него времени, а не чтобы что-то решать.
 *
 * До гидратации время неизвестно (серверные часы тут не годятся), поэтому
 * первый кадр показывает прочерк той же ширины — без скачка вёрстки.
 */
export function Countdown({
  deadline,
  label = 'до отката',
  onExpire,
  className,
}: {
  deadline: string | number | Date;
  label?: string;
  /** Вызывается один раз в момент истечения — например, чтобы обновить список. */
  onExpire?: () => void;
  className?: string;
}) {
  const now = useNow();
  const target = new Date(deadline).getTime();
  const left = now == null ? null : target - now;
  const expired = left != null && left <= 0;

  const fired = useRef(false);
  useEffect(() => {
    if (expired && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [expired, onExpire]);

  // Последние пять минут — красным: пора решать, а не смотреть.
  const urgent = left != null && !expired && left < 5 * 60 * 1000;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-xs tabular-nums',
        left == null || expired ? 'text-ink-dim' : urgent ? 'text-danger' : 'text-warn',
        className,
      )}
    >
      <ClockIcon />
      {left == null ? '—:—' : expired ? 'время вышло' : `${formatCountdown(left)} ${label}`}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0" fill="none">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8l2.4 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
