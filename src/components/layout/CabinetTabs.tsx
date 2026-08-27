'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Разделы кабинета в шапке.
 *
 * Клиентский компонент ради одного: подсветить текущий раздел. Список
 * приходит с сервера уже собранным и переведённым — в браузер уезжает
 * только сравнение адресов, а не логика ролей.
 *
 * Полоса едет вместе с шапкой, поэтому переход между разделами не
 * требует возврата наверх: раньше ссылки лежали на первом экране
 * кабинета, и из середины списка рейсов до них надо было доскроллить.
 */
export type CabinetTab = { href: string; label: string };

export function CabinetTabs({ tabs }: { tabs: CabinetTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5">
      {tabs.map((tab) => {
        /*
         * Корень кабинета совпадает с началом всех остальных адресов,
         * поэтому для него сравнение точное, а для разделов — по
         * префиксу: /carrier/fleet/ABC тоже «Kalusto».
         */
        const root = tabs[0]?.href === tab.href;
        const on = root ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            /*
             * Подчёркивание, а не заливка: вкладка обозначает место, а
             * заливка в этой системе значит «сюда можно нажать». Полоса
             * прозрачная у неактивных — иначе строка дёргалась бы на
             * пиксель при переключении.
             */
            className={[
              'shrink-0 border-b-2 px-2.5 py-2 text-[13px] whitespace-nowrap transition-colors',
              on
                ? 'border-accent font-semibold text-ink'
                : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
