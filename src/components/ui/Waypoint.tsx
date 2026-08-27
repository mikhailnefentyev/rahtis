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
  /*
   * Концы рейса — где прицеп взяли и где оставили — одного цвета.
   * Перецеп это «забрали прицеп → поработали с грузом → отцепили», и
   * форма рейса должна читаться по левому краю списка: две акцентные
   * метки обрамляют янтарные действия с грузом. Раньше отцепка была
   * серой и терялась, хотя это ключевой момент рейса: без неё водитель
   * не знает, где расстаётся с железом.
   */
  PICKUP: { glyph: '▲', className: 'text-accent border-accent/40 bg-accent/10' },
  TRAILER_RETURN: { glyph: '↩', className: 'text-accent border-accent/40 bg-accent/10' },

  /* Действия с грузом: пришёл или ушёл. */
  EXTRA_LOAD: { glyph: '+', className: 'text-warn border-warn/40 bg-warn/10' },
  EXTRA_UNLOAD: { glyph: '−', className: 'text-warn border-warn/40 bg-warn/10' },

  /* Роли прежней модели: живут в заказах, созданных до списка действий. */
  DELIVERY: { glyph: '▼', className: 'text-live border-live/40 bg-live/10' },
  CONTINUATION: { glyph: '»', className: 'text-accent border-accent/40 bg-accent/10' },
};

export function Waypoint({
  kind,
  title,
  primary,
  secondary,
  meta,
  tags,
  code,
  note,
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
  /** Пилюли свойств груза: вес, пломба. */
  tags?: React.ReactNode;
  /**
   * Номер брони. Отдельной строкой и крупнее прочего: его диктуют по
   * телефону на воротах порта, и I от 1, а O от 0 должны различаться на
   * глаз — в общей строке через точку он для этого слишком мелкий.
   */
  code?: React.ReactNode;
  /**
   * Инструкции по точке. Не обрезаются: «въезд с задней стороны» теряет
   * смысл ровно там, где обрывается многоточием.
   */
  note?: string;
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
      <div className="min-w-0 flex-1">
        <div className="label-micro">{title}</div>
        <div className="mt-0.5 truncate text-[13px] text-ink">{primary}</div>
        {secondary && <div className="truncate text-xs text-ink-muted">{secondary}</div>}
        {meta && <div className="mt-0.5 font-mono text-xs tracking-tight text-ink-faint">{meta}</div>}

        {tags && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{tags}</div>}

        {code && (
          <div className="mt-1.5 font-mono text-[13px] tracking-tight text-ink">{code}</div>
        )}

        {note && (
          <p className="mt-1.5 rounded-control border border-line bg-sunken px-2.5 py-1.5 text-xs leading-relaxed text-ink-muted">
            {note}
          </p>
        )}
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
