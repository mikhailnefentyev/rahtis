'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden
      className={cn('size-3.5 shrink-0', filled ? 'text-warn' : 'text-line-strong', className)}
      fill="currentColor"
    >
      <path d="M10 1.6l2.47 5.3 5.53.7-4.08 3.9 1.06 5.7L10 14.5l-4.98 2.7 1.06-5.7L2 7.6l5.53-.7z" />
    </svg>
  );
}

/**
 * Рейтинг перевозчика — только для чтения.
 *
 * Рядом со звёздами всегда стоит число: пять нарисованных звёзд не дают
 * отличить 4.5 от 4.9, а заказчик выбирает машину именно по этой разнице.
 * Иконки — SVG, не символ «★»: он рисуется разными шрифтами по-разному.
 */
export function Stars({
  value,
  count,
  emptyLabel = 'нет оценок',
  className,
}: {
  value: number | null;
  count?: number;
  emptyLabel?: string;
  className?: string;
}) {
  if (value == null) {
    return <span className={cn('text-xs text-ink-dim', className)}>{emptyLabel}</span>;
  }

  const rounded = Math.round(value);
  const label = count != null ? `${value.toFixed(1)} из 5, оценок: ${count}` : `${value.toFixed(1)} из 5`;

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={label}>
      <span className="inline-flex gap-0.5" role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= rounded} />
        ))}
      </span>
      <span className="font-mono text-xs font-bold text-warn">{value.toFixed(1)}</span>
      {count != null && <span className="font-mono text-xs text-ink-dim">({count})</span>}
    </span>
  );
}

/** Выставление оценки после закрытого рейса. */
export function RateStars({
  onRate,
  disabled,
  className,
}: {
  onRate: (stars: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState(0);

  return (
    <span className={cn('inline-flex gap-0.5', className)} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`Оценка ${n} из 5`}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onClick={() => onRate(n)}
          className="cursor-pointer rounded-[3px] p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Star filled={n <= hover} className="size-4.5" />
        </button>
      ))}
    </span>
  );
}
