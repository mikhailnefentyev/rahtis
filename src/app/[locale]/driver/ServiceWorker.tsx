'use client';

import { useEffect } from 'react';

/**
 * Регистрирует service worker приложения водителя.
 *
 * В разработке — нет: закэшированная офлайн-страница мешала бы видеть
 * изменения, а горячая перезагрузка и так работает без него.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/driver-sw.js', { scope: '/' }).catch(() => {});
  }, []);

  return null;
}
