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
const CACHE = 'rahtis-driver-v2';
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
