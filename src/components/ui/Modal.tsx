'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Модальное окно на нативном <dialog>.
 *
 * showModal() даёт три вещи, которые пришлось бы писать руками поверх div:
 * ловушку фокуса, закрытие по Esc и блокировку фона для программ чтения
 * с экрана. В этом интерфейсе модалки несут закрытие рейса и корректировку
 * маршрута — терять в них фокус нельзя.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Клик по подложке: цель события — сам dialog, а не его содержимое.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[min(30rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink',
        'backdrop:bg-black/70 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {subtitle && <div className="mt-1 text-xs text-ink-muted">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="-mt-1 -mr-1 cursor-pointer rounded-control p-1.5 text-ink-faint transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3.5">
          {footer}
        </div>
      )}
    </dialog>
  );
}
