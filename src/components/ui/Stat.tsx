import { cn } from '@/lib/cn';
import { statusTextClass, type StatusTone } from './tone';

/**
 * Метрика: подпись капсом и крупное моноширинное число.
 *
 * Значение всегда моноширинное — тогда ряд метрик выравнивается по цифрам,
 * а не пляшет при каждом обновлении суммы.
 */
export function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: StatusTone;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-card border border-line bg-surface px-3.5 py-3', className)}>
      <div className="label-micro truncate">{label}</div>
      <div
        className={cn(
          'mt-2 font-mono text-xl leading-none font-bold tracking-tight',
          statusTextClass[tone],
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

/** Ряд метрик: четыре в строку на широком экране, две на узком. */
export function StatRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid grid-cols-2 gap-2.5 lg:grid-cols-4', className)} {...props} />;
}
