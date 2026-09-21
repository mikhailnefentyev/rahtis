/*
 * Service worker приложения водителя.
 *
 * Страницы приложения — сначала из сети, копия ложится в кэш. Без сети
 * отдаётся последняя загруженная версия: водитель в порту видит задание
 * и продолжает отмечать точки, а отметки копит очередь (OutboxProvider).
 * Что страница может быть устаревшей, говорит баннер «Ei yhteyttä».
 *
 * Статика Next (/_next/static) — из кэша: её имена содержат хэш и не
 * меняются, а без неё закэшированная страница не оживёт.
 *
 * При выходе из приложения кэш стирается целиком (profile/SignOut) —
 * следующий на этом телефоне не увидит чужие задания.
 */
const CACHE = 'rahtis-driver-v3';
const OFFLINE = '/driver-offline.html';
const DRIVER_PAGE = /^\/[a-z]{2}\/driver(\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, '/icon.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(OFFLINE));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && (DRIVER_PAGE.test(url.pathname) || url.pathname === '/driver')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.png') {
    event.respondWith(cacheFirst(request));
  }
});

/*
 * Push-уведомление: новый рейс, прямой заказ, отмена. Текст собирает
 * сайт на языке водителя; здесь — только показ и переход по нажатию.
 * tag по рейсу: второе уведомление о том же рейсе заменяет первое, а не
 * копится стопкой.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'RAHTIS', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/driver' },
    }),
  );
});

/* Нажатие открывает рейс: в уже открытом окне приложения, если оно есть. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/driver', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
