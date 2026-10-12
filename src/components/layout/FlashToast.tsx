'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/provider';

/* То же имя, что в lib/forms/flash.ts: тот модуль серверный, сюда его не импортировать. */
const FLASH_COOKIE = 'rahtis_flash';

export function FlashToast({ message }: { message: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    /* Показали — стираем: после перезагрузки страницы сообщение не должно всплыть снова. */
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/`;
    const id = window.setTimeout(() => setOpen(false), 12000);
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-start gap-3 rounded-control border border-danger/40 bg-surface px-4 py-3 text-[13px] text-danger shadow-lg sm:bottom-6"
    >
      <span className="min-w-0 flex-1">{message}</span>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={t.action.close}
        className="shrink-0 cursor-pointer font-semibold text-ink-muted hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
