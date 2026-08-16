'use client';

import { useSyncExternalStore } from 'react';

/**
 * Текущее время как внешний источник данных.
 *
 * Часы — не состояние React, а внешняя система, которая меняется сама.
 * Поэтому здесь useSyncExternalStore, а не useState + setInterval:
 * Date.now() во время рендера непредсказуем, а setState прямо в теле
 * эффекта вызывает каскад лишних рендеров.
 *
 * Снимок округлён до секунды. Без округления каждый вызов возвращал бы
 * новое значение, React считал бы источник изменившимся на каждом рендере
 * и крутился бы вечно.
 *
 * На сервере возвращается null: серверные часы к обратному отсчёту у
 * пользователя отношения не имеют, и рисовать там время — значит
 * гарантированно разойтись с клиентом при гидратации.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Один таймер на все компоненты: сто карточек не должны заводить сто интервалов. */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(() => {
      for (const listener of listeners) listener();
    }, 1000);
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return Math.floor(Date.now() / 1000) * 1000;
}

function getServerSnapshot(): null {
  return null;
}
