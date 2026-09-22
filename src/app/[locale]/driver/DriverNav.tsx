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
 */
export function DriverNav({ unread }: { unread: number }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const base = `/${locale}/driver`;

  const items = [
    { href: base, label: t.driverApp.tasks, active: pathname === base || pathname.startsWith(`${base}/task`) },
    { href: `${base}/earnings`, label: t.driverApp.earnings, active: pathname.startsWith(`${base}/earnings`) },
    { href: `${base}/map`, label: t.driverApp.map, active: pathname.startsWith(`${base}/map`) },
    { href: `${base}/inbox`, label: t.driverApp.inbox, active: pathname.startsWith(`${base}/inbox`), badge: unread },
    { href: `${base}/profile`, label: t.driverApp.profile, active: pathname.startsWith(`${base}/profile`) },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              className={cn(
                'relative flex h-16 items-center justify-center text-[14px] font-semibold',
                item.active ? 'text-accent' : 'text-ink-muted',
              )}
            >
              {item.label}
              {item.badge ? (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-xs text-accent-ink">
                  {item.badge}
                </span>
              ) : null}
              {item.active && <span className="absolute inset-x-6 top-0 h-0.5 bg-accent" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
