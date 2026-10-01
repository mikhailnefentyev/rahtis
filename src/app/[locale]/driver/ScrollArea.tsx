'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Прокручиваемая середина экрана приложения водителя.
 *
 * Прокручивается она, а не вся страница: на iPhone закреплённое снизу
 * меню (position: fixed) при прокрутке длинной страницы вверх уезжало до
 * середины экрана («Профиль», «Выполненные», 2.10.2026). Теперь экран —
 * ровно по высоте телефона, как у нативного приложения, и меню стоит
 * последней строкой этого экрана: уехать ему некуда.
 *
 * Next сбрасывает в начало прокрутку окна, а не этой области, поэтому
 * при переходе на другую вкладку или раздел она сбрасывается здесь.
 */
export function ScrollArea({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname, search]);

  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {children}
    </div>
  );
}
