/**
 * Иконки тренажёра: встроенный SVG, один штрих 2 px, цвет — currentColor.
 * Своего набора иконок в проекте нет, а тянуть библиотеку ради пяти
 * значков незачем. Все скрыты от чтения с экрана — рядом всегда текст.
 */
type Props = { className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Тахограф: циферблат со стрелкой. */
export function GaugeIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 17a8.5 8.5 0 1 1 15 0" />
      <path d="M12 13.5 16 9" />
      <circle cx="12" cy="14" r="1.2" />
      <path d="M7 17h10" />
    </svg>
  );
}

/** Крепление груза: ящик, перетянутый ремнём. */
export function StrapIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="8" width="16" height="11" rx="1.5" />
      <path d="M9 8V5.5M15 8V5.5M9 5.5h6" />
      <path d="M12 8v11" />
    </svg>
  );
}

export function CheckIcon({ className = 'size-5' }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={2.5}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CrossIcon({ className = 'size-5' }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={2.5}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function PlusIcon({ className = 'size-5' }: Props) {
  return (
    <svg {...base} className={className} strokeWidth={2.5}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export const MODULE_ICONS = { tacho: GaugeIcon, cargo: StrapIcon } as const;
