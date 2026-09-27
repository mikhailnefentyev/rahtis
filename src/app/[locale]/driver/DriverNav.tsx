'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Нижняя навигация приложения водителя.
 *
 * Пять пунктов: задания, заработок, карта, сообщения, профиль. Пустых
 * вкладок нет — они учат водителя не нажимать на них. Цели — во
 * всю высоту полосы, под большой палец и перчатку.
 *
 * Значок над подписью и «таблетка» за значком активного пункта: одни
 * слова в полосе читались как текст, а не как кнопки. Активный пункт
 * отличается не только цветом — таблетка видна и на солнце, и тому, кто
 * плохо различает цвета.
 */
export function DriverNav({ unread }: { unread: number }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const base = `/${locale}/driver`;

  const items = [
    {
      href: base,
      label: t.driverApp.tasks,
      icon: TasksIcon,
      active: pathname === base || pathname.startsWith(`${base}/task`),
    },
    { href: `${base}/earnings`, label: t.driverApp.earnings, icon: EarningsIcon, active: pathname.startsWith(`${base}/earnings`) },
    { href: `${base}/map`, label: t.driverApp.map, icon: MapIcon, active: pathname.startsWith(`${base}/map`) },
    {
      href: `${base}/inbox`,
      label: t.driverApp.inbox,
      icon: InboxIcon,
      active: pathname.startsWith(`${base}/inbox`),
      badge: unread,
    },
    { href: `${base}/profile`, label: t.driverApp.profile, icon: ProfileIcon, active: pathname.startsWith(`${base}/profile`) },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)]">
      <ul className="mx-auto flex max-w-lg">
        {items.map(({ href, label, icon: Icon, active, badge }) => (
          <li key={href} className="min-w-0 flex-1">
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-[68px] flex-col items-center justify-center gap-1',
                active ? 'text-accent' : 'text-ink-muted',
              )}
            >
              <span
                className={cn(
                  'relative flex h-8 w-14 items-center justify-center rounded-pill transition-colors duration-200',
                  active && 'bg-accent-wash',
                )}
              >
                <Icon />
                {badge ? (
                  <span className="absolute -top-1 right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-[11px] leading-none font-bold text-surface ring-2 ring-surface">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'max-w-full truncate text-[12px] leading-tight tracking-tight',
                  active ? 'font-bold' : 'font-semibold',
                )}
              >
                {label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* Значки: встроенный SVG, штрих 2 px, как в тренажёре. Скрыты от чтения с экрана — рядом подпись. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'size-6',
};

/** Задания: планшет со списком. */
function TasksIcon() {
  return (
    <svg {...base}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5V3h6v1.5" />
      <path d="M9 10h6M9 14h6M9 18h3" />
    </svg>
  );
}

/** Заработок: кошелёк. */
function EarningsIcon() {
  return (
    <svg {...base}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" />
      <rect x="4" y="8" width="16" height="11" rx="2" />
      <path d="M16 13.5h.01" strokeWidth={3} />
    </svg>
  );
}

/** Карта: метка места. */
function MapIcon() {
  return (
    <svg {...base}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** Сообщения: облачко. */
function InboxIcon() {
  return (
    <svg {...base}>
      <path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1.2-4.2A7.5 7.5 0 1 1 20 12.5Z" />
    </svg>
  );
}

/** Профиль: человек. */
function ProfileIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}
