'use client';

import Link from 'next/link';
import { useRef } from 'react';

/**
 * Карточка задачи на обзоре: число, что ждёт, куда идти.
 *
 * Единственное место кабинета с объёмом. Под курсором карточка чуть
 * наклоняется (до 4°) и ловит блик — взгляд идёт к делу, а не к
 * украшениям. Только с мышью: на телефоне наклонять нечем, а при
 * «уменьшить движение» карточка стоит.
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
  const ref = useRef<HTMLAnchorElement>(null);
  const quiet = count === 0;

  function move(e: React.PointerEvent<HTMLAnchorElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 4).toFixed(2)}deg) rotateY(${((x - 0.5) * 5).toFixed(2)}deg) translateY(-3px)`;
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={move}
      onPointerLeave={() => {
        if (ref.current) ref.current.style.transform = '';
      }}
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
