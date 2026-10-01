'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  const typing = useTyping();

  const items = [
    {
      href: base,
      label: t.driverApp.nav.tasks,
      icon: TasksIcon,
      active: pathname === base || pathname.startsWith(`${base}/task`),
    },
    { href: `${base}/earnings`, label: t.driverApp.nav.earnings, icon: EarningsIcon, active: pathname.startsWith(`${base}/earnings`) },
    { href: `${base}/map`, label: t.driverApp.nav.map, icon: MapIcon, active: pathname.startsWith(`${base}/map`) },
    {
      href: `${base}/inbox`,
      label: t.driverApp.nav.inbox,
      icon: InboxIcon,
      active: pathname.startsWith(`${base}/inbox`),
      badge: unread,
    },
    { href: `${base}/profile`, label: t.driverApp.nav.profile, icon: ProfileIcon, active: pathname.startsWith(`${base}/profile`) },
  ];

  return (
    /*
     * Полоса прячется, пока водитель печатает: с открытой клавиатурой
     * закреплённая снизу полоса на Android повисала посреди экрана, а на
     * iPhone прыгала при прокрутке («меню гуляет», 2.10.2026 — после
     * переписки на экране рейса печатать стали чаще). translateZ — свой
     * слой, чтобы на iPhone полоса не дрожала при инерционной прокрутке.
     */
    <nav
      aria-hidden={typing || undefined}
      className={cn(
        'fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] [transform:translateZ(0)]',
        typing && 'hidden',
      )}
    >
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

/** Печатает ли водитель: в фокусе поле ввода текста. */
function useTyping(): boolean {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const editable = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
      if (el.tagName !== 'INPUT') return false;
      const type = (el as HTMLInputElement).type;
      return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'hidden'].includes(type);
    };
    const onIn = (e: FocusEvent) => setTyping(editable(e.target));
    /* Фокус уходит на кнопку «Отправить» и т. п. — полоса возвращается. */
    const onOut = (e: FocusEvent) => setTyping(editable(e.relatedTarget));
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
    };
  }, []);

  return typing;
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
