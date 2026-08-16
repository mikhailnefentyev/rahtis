import { cn } from '@/lib/cn';

export type WaypointKind =
  | 'PICKUP'
  | 'DELIVERY'
  | 'EXTRA_LOAD'
  | 'EXTRA_UNLOAD'
  | 'CONTINUATION'
  | 'TRAILER_RETURN';

/**
 * Точка маршрута.
 *
 * Вид точки кодируется дважды — цветом и глифом. Маршрут читают в кабине,
 * при боковом свете и на телефоне с выкрученной яркостью; одного цвета
 * там мало.
 *
 * Все точки заказа — один упорядоченный список, а не разные поля формы:
 * заказчик вправе вставить новую выгрузку в середину уже идущего рейса
 * (ТЗ §8), и структура данных должна это позволять без переделки.
 */
const kindStyle: Record<WaypointKind, { glyph: string; className: string }> = {
  PICKUP: { glyph: '▲', className: 'text-accent border-accent/40 bg-accent/10' },
  DELIVERY: { glyph: '▼', className: 'text-live border-live/40 bg-live/10' },
  EXTRA_LOAD: { glyph: '+', className: 'text-warn border-warn/40 bg-warn/10' },
  EXTRA_UNLOAD: { glyph: '−', className: 'text-warn border-warn/40 bg-warn/10' },
  CONTINUATION: { glyph: '»', className: 'text-accent border-accent/40 bg-accent/10' },
  TRAILER_RETURN: { glyph: '↩', className: 'text-ink-faint border-line-strong bg-raised' },
};

export function Waypoint({
  kind,
  title,
  primary,
  secondary,
  meta,
  className,
}: {
  kind: WaypointKind;
  /** Надпись капсом: «ЗАБОР · ПОРТ», «ВОЗВРАТ ПРИЦЕПА». */
  title: string;
  /** Главная строка: название места или компании. */
  primary: string;
  /** Адрес и контакт. */
  secondary?: string;
  /** Дата и время — моноширинным, чтобы вставало в колонку. */
  meta?: string;
  className?: string;
}) {
  const style = kindStyle[kind];

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span
        aria-hidden
        className={cn(
          'mt-px flex size-5 shrink-0 items-center justify-center rounded-[5px] border text-[10px] leading-none',
          style.className,
        )}
      >
        {style.glyph}
      </span>
      <div className="min-w-0">
        <div className="label-micro">{title}</div>
        <div className="mt-0.5 truncate text-[13px] text-ink">{primary}</div>
        {secondary && <div className="truncate text-xs text-ink-muted">{secondary}</div>}
        {meta && <div className="mt-0.5 font-mono text-xs tracking-tight text-ink-faint">{meta}</div>}
      </div>
    </div>
  );
}

/** Список точек с вертикальной нитью — маршрут читается как один путь. */
export function WaypointList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3',
        'before:absolute before:top-5 before:bottom-5 before:left-2.5 before:w-px before:bg-line',
        className,
      )}
      {...props}
    />
  );
}
