import { cn } from '@/lib/cn';
import type { StatusTone } from './tone';

const stripeClass: Record<StatusTone, string> = {
  neutral: 'border-l-line-strong',
  ok: 'border-l-ok',
  warn: 'border-l-warn',
  danger: 'border-l-danger',
  live: 'border-l-live',
  info: 'border-l-accent',
};

/**
 * Карточка — основная поверхность интерфейса.
 *
 * Теней нет: глубину даёт поверхность и волосяная граница. Опциональная
 * полоса слева окрашена в тон состояния — она позволяет считать статус
 * ленты карточек периферийным зрением, не читая ни одного бейджа.
 */
export function Card({
  stripe,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { stripe?: StatusTone }) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface',
        stripe && cn('border-l-2', stripeClass[stripe]),
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-4', className)} {...props} />;
}

/** Шапка карточки с отбивкой снизу — для заголовка секции над содержимым. */
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 border-b border-line px-4 py-3', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-[15px] font-semibold tracking-tight', className)} {...props} />;
}

/** Разделитель внутри карточки: между блоком маршрута и откликами. */
export function CardDivider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-line', className)} />;
}
