'use client';

import { cn } from '@/lib/cn';
import { useI18n } from '@/lib/i18n/provider';

/**
 * Состояние документа: загружен или нет.
 *
 * Галочка и подпись «загружено» дублируют цвет — состояние читается и без
 * различения зелёного.
 *
 * Компонент клиентский только ради подписи из словаря. Альтернатива —
 * принимать её пропсом, но тогда каждый вызывающий обязан помнить про
 * перевод, и рано или поздно кто-нибудь напишет строку руками.
 */
export function DocChip({
  label,
  uploaded,
  className,
}: {
  label: string;
  uploaded: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-control border px-3 py-2 text-[13px]',
        uploaded ? 'border-ok/30 bg-ok/5 text-ink' : 'border-line bg-sunken text-ink-muted',
        className,
      )}
    >
      <span className={uploaded ? 'text-ok' : 'text-ink-dim'} aria-hidden>
        {uploaded ? (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
            <path
              d="M3.5 8.5l3 3 6-7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        )}
      </span>
      {label}
      <span className="text-xs text-ink-dim">{uploaded ? t.doc.uploaded : t.doc.missing}</span>
    </span>
  );
}
