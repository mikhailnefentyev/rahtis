'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Нижняя навигация приложения водителя.
 *
 * Пять пунктов: задания, заработок, карта, сообщения, профиль. Работа
 * на объекте — тоже задание и живёт в «Заданиях», а не отдельной вкладкой
 * (решение пользователя 28.10.2026). Пустых
 * вкладок нет — они учат водителя не нажимать на них. Цели — во
 * всю высоту полосы, под большой палец и перчатку.
 *
 * Значок над подписью: одни слова в полосе читались как текст, а не как
 * кнопки. Полоса тёмная, как у навигаторов и приложений водителя
 * Samsara и Webfleet (15.11.2026, вместо светлой с «таблеткой» за
 * значком — «выглядит как игрушечное и несерьёзное»): ночью в кабине не
 * слепит и отделяет управление от содержимого экрана. Активный пункт
 * отличается не только цветом — яркая линия сверху и белые значок с
 * подписью видны и на солнце, и тому, кто плохо различает цвета.
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
      active:
        pathname === base ||
        pathname.startsWith(`${base}/task`) ||
        pathname.startsWith(`${base}/site`) ||
        pathname.startsWith(`${base}/fuel`) ||
        pathname.startsWith(`${base}/defect`) ||
        pathname.startsWith(`${base}/inspection`),
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
     * переписки на экране рейса печатать стали чаще). Полоса больше не
     * закреплена поверх страницы: она последняя строка экрана (см.
     * ScrollArea в раскладке).
     */
    <nav
      aria-hidden={typing || undefined}
      className={cn(
        'relative z-20 shrink-0 border-t border-night-line bg-night pb-[env(safe-area-inset-bottom)]',
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
                'relative flex h-[64px] flex-col items-center justify-center gap-1 transition-colors duration-150',
                active ? 'text-night-ink' : 'text-night-muted active:text-night-ink',
              )}
            >
              {/* Метка активного пункта — линия по верхнему краю полосы. */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-3 top-0 h-[3px] rounded-b-sm bg-accent-bright transition-opacity duration-150',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <span className="relative flex h-7 items-center justify-center">
                <Icon />
                {badge ? (
                  <span className="absolute -top-1.5 left-[calc(50%+6px)] inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-danger px-1 font-mono text-[11px] leading-none font-semibold text-white ring-2 ring-night">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  'max-w-full truncate px-1 text-[11.5px] leading-tight',
                  active ? 'font-semibold' : 'font-medium',
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

/* Значки: встроенный SVG, штрих 1,75 px — строже, чем 2 px. Скрыты от чтения с экрана — рядом подпись. */
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
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
