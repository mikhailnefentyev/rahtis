'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/** «Aktiiviset / Valmiit» — сегментированный переключатель, как у DFDS. */
export function TaskTabs({ showDone }: { showDone: boolean }) {
  const { t, locale } = useI18n();
  const base = `/${locale}/driver`;

  const tab = (active: boolean) =>
    cn(
      'flex h-12 flex-1 items-center justify-center rounded-pill text-[15px] font-semibold',
      active ? 'bg-accent text-accent-ink' : 'text-ink-muted',
    );

  return (
    <div className="flex rounded-pill bg-raised p-1">
      <Link href={base} className={tab(!showDone)} aria-current={!showDone ? 'page' : undefined}>
        {t.driverApp.tabActive}
      </Link>
      <Link href={`${base}?tab=done`} className={tab(showDone)} aria-current={showDone ? 'page' : undefined}>
        {t.driverApp.tabDone}
      </Link>
    </div>
  );
}
