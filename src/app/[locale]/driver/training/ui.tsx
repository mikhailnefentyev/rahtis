'use client';

import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Мелочи экранов тренажёра: переключатель и длительность.
 *
 * Переключатель — тот же сегментированный, что «Aktiiviset / Valmiit» на
 * главной: крупный, под большой палец, активный залит акцентом.
 */
export function Segmented<T extends string>({
  items,
  active,
  onChange,
  label,
  size = 'lg',
}: {
  items: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
  label: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className="flex rounded-pill bg-raised p-1" role="group" aria-label={label}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(item.key)}
            className={cn(
              'flex flex-1 items-center justify-center rounded-pill px-2 text-center font-semibold leading-tight',
              size === 'lg' ? 'min-h-12 text-[15px]' : 'min-h-11 text-[14px]',
              on ? 'bg-accent text-accent-ink' : 'text-ink-muted',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Вкладки раздела — подчёркиванием, а не «таблетками»: переключатель
 * режима и сценариев уже залит акцентом, и три одинаковые полосы подряд
 * читались как одна. Цель во всю ширину колонки, 48 px.
 */
export function UnderlineTabs<T extends string>({
  items,
  active,
  onChange,
  label,
}: {
  items: ReadonlyArray<{ key: T; label: string }>;
  active: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div className="flex border-b border-line" role="tablist" aria-label={label}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(item.key)}
            className={cn(
              '-mb-px flex min-h-12 flex-1 items-center justify-center border-b-[3px] px-1 text-[15px] font-semibold',
              on ? 'border-accent text-accent' : 'border-transparent text-ink-muted',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** «4 h 30 min» на языке водителя. */
export function useDuration() {
  const { t } = useI18n();
  const { h, min } = t.training.units;
  return (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} ${min}`;
    return rest ? `${hours} ${h} ${rest} ${min}` : `${hours} ${h}`;
  };
}

export const primaryButton =
  'flex h-14 w-full items-center justify-center rounded-control bg-accent px-4 text-[17px] font-semibold text-accent-ink disabled:opacity-40';

export const secondaryButton =
  'flex h-12 items-center justify-center rounded-control border border-line bg-surface px-4 text-[15px] font-semibold text-ink disabled:opacity-40';
