import { cn } from '@/lib/cn';

/**
 * Пара «подпись — значение» в одну строку.
 * Ширина подписи фиксирована, чтобы значения выстроились в колонку.
 */
export function Kv({
  k,
  v,
  mono,
  className,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-3 text-[13px]', className)}>
      <span className="w-20 shrink-0 text-ink-faint">{k}</span>
      <span className={cn('min-w-0 text-ink', mono && 'font-mono tracking-tight')}>{v}</span>
    </div>
  );
}

/** Заголовок секции внутри формы: «Откуда забираем», «Груз и оплата». */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mb-3 border-b border-line pb-2 text-[13px] font-semibold tracking-tight text-ink',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Пустое состояние: почему пусто и что сделать, чтобы стало не пусто. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed border-line px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Данные в тексте: номер машины, номер заказа, сумма. */
export function Mono({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('font-mono tracking-tight', className)} {...props} />;
}

/** Госномер — самый узнаваемый идентификатор в этом интерфейсе. */
export function Plate({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[13px] font-bold tracking-tight text-accent', className)}>
      {children}
    </span>
  );
}
