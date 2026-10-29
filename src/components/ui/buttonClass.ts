import { cn } from '@/lib/cn';

/* Классы кнопки — отдельно от клиентской кнопки: их зовут и серверные компоненты (ссылки «как кнопка»). */
export type ButtonVariant = 'primary' | 'default' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';
type Variant = ButtonVariant;
type Size = ButtonSize;

const variantClass: Record<Variant, string> = {
  /** Одно главное действие на экран: «Беру», «Выбрать», «Опубликовать». */
  /* Объём: свет сверху и цветная тень (8.10.2026). */
  primary:
    'bg-linear-to-b from-[#137896] to-accent text-accent-ink border-transparent shadow-primary hover:from-[#178aac] hover:to-[#0e6d8a] hover:-translate-y-px',
  default:
    'bg-surface text-ink border-line shadow-card hover:border-accent-line hover:text-ink hover:-translate-y-px hover:shadow-lift',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:bg-raised hover:text-ink',
  /**
   * Разрушающее действие: откат рейса, отказ, отклонение заявки.
   * Красным здесь окрашен текст, а не заливка — залитая красным кнопка
   * притягивает взгляд сильнее основного действия рядом с ней.
   */
  danger: 'bg-transparent text-danger border-line hover:border-danger hover:bg-danger/10',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-7 gap-1.5 rounded-control px-2.5 text-xs', // внутри строк таблиц
  md: 'h-9 gap-2 rounded-control px-3.5 text-[13px]',
  lg: 'h-10 gap-2 rounded-control px-5 text-sm',
};

/**
 * Классы кнопки отдельно от самой кнопки.
 *
 * Нужны там, где по смыслу ссылка, а по виду кнопка: переход в кабинет,
 * возврат на вход. Подменять <a> внутри <button> нельзя — получится
 * неверная разметка и сломанная навигация с клавиатуры.
 */
export function buttonClass({
  variant = 'default',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(
    'inline-flex cursor-pointer items-center justify-center border font-semibold',
    /*
     * Отклик на нажатие — полпикселя вниз. Ровно столько, чтобы палец и
     * глаз получили подтверждение; заметное движение в кнопке, которую
     * жмут сотню раз за смену, начинает раздражать на второй день.
     */
    'transition-[color,background-color,border-color,transform,box-shadow] duration-150',
    'active:translate-y-[0.5px]',
    'disabled:pointer-events-none disabled:opacity-35 disabled:active:translate-y-0',
    sizeClass[size],
    variantClass[variant],
    className,
  );
}
