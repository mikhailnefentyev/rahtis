'use client';

import { useEffect } from 'react';

/**
 * Ссылка «#prefix-<id>» из «Требует действия» раскрывает нужную карточку
 * списка и прокручивает к ней — человек попадает прямо к форме.
 */
export function useHashTarget(prefix: string, open: (id: string) => void): void {
  useEffect(() => {
    const apply = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith(`${prefix}-`)) return;
      open(hash.slice(prefix.length + 1));
      /* После раскрытия высота меняется — прокрутка кадром позже. */
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: 'start' }));
    };
    const frame = requestAnimationFrame(apply);
    window.addEventListener('hashchange', apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', apply);
    };
  }, [prefix, open]);
}
