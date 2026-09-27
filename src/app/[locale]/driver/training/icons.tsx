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

/** Массы: весы на опоре. */
export function ScaleIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4v16M8 20h8" />
      <path d="M5 8h14" />
      <path d="M5 8 2.5 14a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" />
    </svg>
  );
}

/** Осмотр: лупа с галочкой. */
export function InspectIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
      <path d="m7.8 10.6 1.9 1.9 3.3-3.6" />
    </svg>
  );
}

/** ADR: ромб знака опасности. */
export function HazardIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z" />
      <path d="M12 8v5M12 16.2v.1" />
    </svg>
  );
}

/** Охрана труда: каска. */
export function HelmetIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 16a8 8 0 0 1 16 0" />
      <path d="M2.5 16h19v2.5h-19Z" />
      <path d="M10 8.5V6h4v2.5" />
    </svg>
  );
}

/** Первая помощь: крест в круге. */
export function AidIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

/** Дорога: знак-треугольник. */
export function RoadIcon({ className = 'size-6' }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5 21 19.5H3Z" />
      <path d="M12 10v4.5M12 17v.1" />
    </svg>
  );
}

export const MODULE_ICONS = {
  tacho: GaugeIcon,
  cargo: StrapIcon,
  masses: ScaleIcon,
  tech: InspectIcon,
  adr: HazardIcon,
  tyoturva: HelmetIcon,
  ensiapu: AidIcon,
  tieturva: RoadIcon,
} as const;
