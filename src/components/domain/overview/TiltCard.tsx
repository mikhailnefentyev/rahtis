'use client';

import Link from 'next/link';

/**
 * Карточка задачи на обзоре: число, что ждёт, куда идти.
 *
 * С 29.10.2026 плоская, как весь кабинет: наклон и блик под курсором
 * убраны вместе с остальным «объёмом» (консервативный стиль, как в
 * OwnerHub). Имя компонента оставлено, чтобы не трогать места вызова.
 */
export function TiltCard({
  href,
  count,
  title,
  text,
  action,
  tone,
  index,
}: {
  href: string;
  count: number;
  title: string;
  text: string;
  action: string;
  tone: 'warn' | 'danger' | 'live' | 'ok' | 'neutral';
  index: number;
}) {
  const quiet = count === 0;

  return (
    <Link
      href={href}
      className="task-card rise flex flex-col"
      style={
        {
          '--i': index,
          '--tone': quiet ? 'var(--color-line-strong)' : `var(--color-${tone === 'neutral' ? 'ink-dim' : tone})`,
        } as React.CSSProperties
      }
    >
      <span
        className="font-display text-[34px] leading-none font-extrabold"
        style={{ color: quiet ? 'var(--color-ink-dim)' : 'var(--tone)' }}
      >
        {count}
      </span>
      <span className="mt-2.5 text-[15px] font-semibold text-ink">{title}</span>
      <span className="mt-0.5 text-[13px] text-ink-muted">{text}</span>
      <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
        {action}
        <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
