'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { analytics } from '@heycatch/sdk';
import { Button } from '@/components/ui';
import { CONSENT_KEY, isPublicPath } from '@/lib/analytics/public';
import { useI18n } from '@/lib/i18n/provider';

const REOPEN = 'rahtis:analytics-settings';
const CHANGED = 'rahtis:analytics-choice';

function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(CHANGED, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(CHANGED, notify);
  };
}

/* Запасная память на случай закрытого хранилища (приватное окно). */
let memory: string | null = null;

function stored(): string | null {
  try {
    return localStorage.getItem(CONSENT_KEY) ?? memory;
  } catch {
    return memory;
  }
}

/**
 * Вопрос про аналитику внизу открытых страниц.
 *
 * «Разрешить» включает HeyCatch (optInCapturing), «Нет» — оставляет его
 * немым. Выбор помнится в браузере; изменить его можно ссылкой
 * «Настройки аналитики» в подвале (ConsentSettingsLink). В кабинетах
 * вопроса нет: оттуда события не уходят в любом случае.
 */
export function AnalyticsConsent() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  /* На сервере выбора не видно — вопрос появляется только в браузере. */
  const choice = useSyncExternalStore(subscribe, stored, () => 'server');
  const [reopened, setReopened] = useState(false);
  const open = reopened || (choice === null && isPublicPath(pathname));

  useEffect(() => {
    if (choice === 'yes') analytics.optInCapturing();
  }, [choice]);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(REOPEN, reopen);
    return () => window.removeEventListener(REOPEN, reopen);
  }, []);

  function decide(yes: boolean) {
    memory = yes ? 'yes' : 'no';
    try {
      localStorage.setItem(CONSENT_KEY, yes ? 'yes' : 'no');
    } catch {
      /* без хранилища выбор живёт до перезагрузки */
    }
    if (yes) analytics.optInCapturing();
    else analytics.optOutCapturing();
    setReopened(false);
    window.dispatchEvent(new Event(CHANGED));
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label={t.site.consentSettings}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-lg sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-[13px] leading-relaxed text-ink">
        {t.site.consentText}{' '}
        <Link href={`/${locale}/${locale === 'fi' ? 'tietosuoja' : 'privacy'}`} className="text-ink-muted underline">
          {t.site.consentPrivacy}
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={() => decide(false)}>
          {t.site.consentNo}
        </Button>
        <Button size="sm" variant="primary" onClick={() => decide(true)}>
          {t.site.consentYes}
        </Button>
      </div>
    </div>
  );
}

/** Ссылка в подвале: снова показать вопрос и поменять выбор. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(REOPEN))}>
      {t.site.consentSettings}
    </button>
  );
}
