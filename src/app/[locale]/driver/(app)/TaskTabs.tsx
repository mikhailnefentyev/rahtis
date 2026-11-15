'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/**
 * «Aktiiviset / Valmiit» — вкладки с линией под активной, как нижнее меню
 * (15.11.2026: капсулы читались игрушечно). Цель — во всю ширину половины
 * и 48 px высотой, под палец в перчатке.
 */
export function TaskTabs({ showDone }: { showDone: boolean }) {
  const { t, locale } = useI18n();
  const base = `/${locale}/driver`;

  const tab = (active: boolean) =>
    cn(
      'flex h-12 flex-1 items-center justify-center border-b-[3px] text-[15px] transition-colors',
      active ? 'border-accent font-semibold text-ink' : 'border-transparent font-medium text-ink-muted',
    );

  return (
    <div className="flex border-b border-line">
      <Link href={base} className={tab(!showDone)} aria-current={!showDone ? 'page' : undefined}>
        {t.driverApp.tabActive}
      </Link>
      <Link href={`${base}?tab=done`} className={tab(showDone)} aria-current={showDone ? 'page' : undefined}>
        {t.driverApp.tabDone}
      </Link>
    </div>
  );
}
