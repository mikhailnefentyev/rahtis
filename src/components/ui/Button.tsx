import { cn } from '@/lib/cn';

type Variant = 'primary' | 'default' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  /** Одно главное действие на экран: «Беру», «Выбрать», «Опубликовать». */
  primary: 'bg-accent text-accent-ink border-accent hover:bg-accent-hover hover:border-accent-hover',
  default: 'bg-raised text-ink border-line hover:border-accent-line hover:text-ink',
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
    'transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-35',
    sizeClass[size],
    variantClass[variant],
    className,
  );
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />;
}
