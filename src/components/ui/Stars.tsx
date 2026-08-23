'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

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
 *
 * Само значение форматируется по локали (4,7 в русском и финском, 4.7 в
 * английском), а число оценок склоняется через plural.
 */
export function Stars({
  value,
  count,
  className,
}: {
  value: number | null;
  count?: number;
  className?: string;
}) {
  const { t, m, f } = useI18n();

  if (value == null) {
    return <span className={cn('text-xs text-ink-dim', className)}>{t.rating.none}</span>;
  }

  const rounded = Math.round(value);
  const shown = f.decimal(value, 1);
  const label =
    count == null
      ? m('rating.summary', { value: shown })
      : m('rating.summaryWithCount', { value: shown, count });

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} title={label}>
      <span className="inline-flex gap-0.5" role="img" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= rounded} />
        ))}
      </span>
      <span className="font-mono text-xs font-bold text-warn">{shown}</span>
      {count != null && (
        /* «· 3 arviota», а не «(3)»: скобка не говорит, что за число внутри. */
        <span className="text-xs text-ink-dim">· {m('rating.ratingsCount', { count })}</span>
      )}
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
  const { m } = useI18n();
  const [hover, setHover] = useState(0);

  return (
    <span className={cn('inline-flex gap-0.5', className)} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={m('rating.setValue', { stars: n })}
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
