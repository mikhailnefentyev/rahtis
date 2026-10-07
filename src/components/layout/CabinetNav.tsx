'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NavIcon, type NavIconName } from './NavIcon';

export type NavItem = { href: string; label: string; short?: string; icon: NavIconName; count?: number };
export type NavGroup = { label: string; items: NavItem[] };

/**
 * Разделы кабинета: боковая панель на компьютере, нижнее меню на телефоне.
 *
 * Клиентский ради одного — подсветить текущий раздел. Список собирает
 * сервер (CabinetShell): роли, переводы и счётчики сюда приходят готовыми.
 *
 * Разделы сгруппированы по смыслу — работа, компания, документы. Раньше
 * девять вкладок стояли в одну строку, и ежедневная работа выглядела так
 * же, как настройки, в которые заходят раз в месяц.
 */
function useActive(home: string) {
  const pathname = usePathname();
  /* Корень кабинета — точным сравнением: с него начинаются все адреса. */
  return (href: string) => (href === home ? pathname === href : pathname.startsWith(href));
}

export function SideNav({ groups, home }: { groups: NavGroup[]; home: string }) {
  const active = useActive(home);
  return (
    <>
      {groups.map((group) => (
        <nav key={group.label} aria-label={group.label} className="cab-group">
          <p className="cab-group__label">{group.label}</p>
          <div className="cab-nav">
            {group.items.map((item) => {
              const on = active(item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined} className="cab-nav__link">
                  <NavIcon name={item.icon} />
                  <span className="truncate">{item.label}</span>
                  {item.count ? <span className="cab-nav__count">{item.count > 99 ? '99+' : item.count}</span> : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ))}
    </>
  );
}

/**
 * Нижнее меню телефона: четыре главных раздела и «Valikko» со всеми
 * остальными. Пять кнопок — предел, который ещё попадает под палец.
 */
export function TabBar({
  primary,
  groups,
  home,
  menuLabel,
  closeLabel,
  extra,
}: {
  primary: NavItem[];
  groups: NavGroup[];
  home: string;
  menuLabel: string;
  closeLabel: string;
  /** Учётная запись, язык и выход — в листе «Valikko». */
  extra?: React.ReactNode;
}) {
  const active = useActive(home);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const inPrimary = primary.some((item) => active(item.href));

  return (
    <>
      <nav className="cab-tabbar" aria-label={menuLabel}>
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active(item.href) ? 'page' : undefined}
            className="cab-tabbar__link"
          >
            <NavIcon name={item.icon} className="size-5" />
            <span>{item.short ?? item.label}</span>
            {item.count ? <span className="cab-tabbar__dot" aria-hidden /> : null}
          </Link>
        ))}
        <button
          type="button"
          className="cab-tabbar__link"
          aria-expanded={open}
          aria-current={!inPrimary ? 'page' : undefined}
          onClick={() => setOpen(true)}
        >
          <NavIcon name="menu" className="size-5" />
          <span>{menuLabel}</span>
        </button>
      </nav>

      {open && (
        <div className="cab-sheet" role="dialog" aria-modal aria-label={menuLabel}>
          <button type="button" className="cab-sheet__scrim" aria-label={closeLabel} onClick={() => setOpen(false)} />
          {/* Переход по ссылке из листа закрывает его. */}
          <div
            className="cab-sheet__panel"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('a')) setOpen(false);
            }}
          >
            <SideNav groups={groups} home={home} />
            {extra}
          </div>
        </div>
      )}
    </>
  );
}
