'use client';

import { useEffect, useState } from 'react';

/**
 * Помощник — кнопка в углу, чат выезжает сбоку.
 *
 * Раньше чат стоял карточкой посреди обзора и занимал пол-экрана, даже
 * когда его не открывали. Содержимое рисуется сразу и только прячется:
 * открыл, закрыл, открыл — переписка на месте, без повторной загрузки.
 */
export function AssistantDock({
  label,
  closeLabel,
  children,
}: {
  label: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="assistant-fab"
        aria-expanded={open}
        aria-controls="assistant-drawer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="assistant-fab__bubble">
          <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </span>
        <span className="assistant-fab__label">{label}</span>
      </button>

      {open && <button type="button" className="assistant-scrim" aria-label={closeLabel} onClick={() => setOpen(false)} />}

      <aside id="assistant-drawer" className="assistant-drawer" data-open={open || undefined} aria-label={label} aria-hidden={!open}>
        <header className="assistant-drawer__head">
          <h2 className="font-display text-base font-bold">{label}</h2>
          <button type="button" className="cab-icon-btn ml-auto" aria-label={closeLabel} onClick={() => setOpen(false)}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="assistant-drawer__body">{children}</div>
      </aside>
    </>
  );
}
