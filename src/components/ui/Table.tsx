import { cn } from '@/lib/cn';

/**
 * Таблица-документ.
 *
 * Единственное место, где интерфейс намеренно отходит от «волосяных границ
 * и никаких заливок»: у финансовых таблиц видна вся сетка ячеек, как в
 * накладной. Счёт и ведомость на выплату — это документы, они и должны
 * выглядеть документами: по такой сетке глаз держит строку до конца.
 *
 * Обёртка всегда прокручивается по горизонтали сама — страница не должна
 * ехать вбок из-за широкой таблицы.
 */
export function TableFrame({
  caption,
  actions,
  children,
  className,
}: {
  caption?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-surface', className)}>
      {(caption || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          {caption && <h3 className="text-[13px] font-semibold tracking-tight">{caption}</h3>}
          {actions}
        </div>
      )}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full border-collapse text-[13px] whitespace-nowrap', className)}
      {...props}
    />
  );
}

export function Th({
  numeric,
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'label-micro border-b border-line-grid px-3 py-2.5 font-semibold',
        'border-r last:border-r-0',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  numeric,
  mono,
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; mono?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-r border-line-grid px-3 py-2.5 last:border-r-0',
        numeric && 'text-right',
        (numeric || mono) && 'font-mono tracking-tight',
        className,
      )}
      {...props}
    />
  );
}

/** Строка. Кликабельная подсвечивается и получает курсор. */
export function Tr({
  interactive,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'last:[&>td]:border-b-0',
        interactive && 'cursor-pointer transition-colors duration-150 hover:bg-raised',
        className,
      )}
      {...props}
    />
  );
}
