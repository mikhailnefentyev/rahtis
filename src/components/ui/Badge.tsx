import { cn } from '@/lib/cn';
import { statusToneClass, type StatusTone } from './tone';

/**
 * Статусная пилюля.
 *
 * Показывает состояние — и только его. Нажать на бейдж нельзя, поэтому
 * акцентного тона у него нет: бирюза в этом интерфейсе означает «сюда
 * можно нажать», и статус не имеет права её занимать.
 */
export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-pill border px-2.5 py-0.5',
        'text-[11px] leading-[1.45] font-semibold whitespace-nowrap',
        statusToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Точка-индикатор перед текстом. Нужна там, где цвет несёт смысл:
 * форма даёт второй канал для тех, кто цвет различает плохо.
 */
export function Dot({ tone = 'neutral', className }: { tone?: StatusTone; className?: string }) {
  const fill: Record<StatusTone, string> = {
    neutral: 'bg-ink-dim',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    live: 'bg-live',
    info: 'bg-accent',
  };
  return (
    <span
      aria-hidden
      className={cn('inline-block size-1.5 shrink-0 rounded-full', fill[tone], className)}
    />
  );
}
