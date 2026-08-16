'use client';

import { cn } from '@/lib/cn';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  /** Число рядом с подписью: сколько заявок в очереди, сколько откликов. */
  count?: number;
};

/**
 * Вкладки раздела.
 *
 * Активная помечена и цветом, и подчёркиванием: по одному лишь цвету
 * активную вкладку не найдёт тот, кто плохо различает бирюзовый.
 * Счётчик показывается только когда он больше нуля — «0» ничего не
 * сообщает, но занимает место и притягивает взгляд.
 */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  className,
}: {
  items: readonly TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1 border-b border-line', className)} role="tablist">
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
              'inline-flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold',
              '-mb-px border-b-2 transition-colors duration-150',
              on
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-faint hover:text-ink',
            )}
          >
            {item.label}
            {item.count != null && item.count > 0 && (
              <span
                className={cn(
                  'rounded-pill px-1.5 py-px font-mono text-[10px] leading-4 font-bold',
                  on ? 'bg-accent text-accent-ink' : 'bg-raised text-ink-faint',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
