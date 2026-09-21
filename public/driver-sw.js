/*
 * Service worker приложения водителя.
 *
 * Первая версия делает две вещи: позволяет установить приложение на экран
 * «Домой» и показывает понятную страницу вместо ошибки браузера, когда
 * связи нет. Очередь отметок без связи и push-уведомления — следующие
 * этапы (RAHTIS-driver-app.md, §6–7).
 *
 * Страницы заданий не кэшируются: устаревшее задание на экране хуже
 * честного «нет связи» — водитель поехал бы по отменённому маршруту.
 */
const CACHE = 'rahtis-driver-v1';
const OFFLINE = '/driver-offline.html';

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

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate') return;

  const url = new URL(request.url);
  if (!/^\/[a-z]{2}\/driver(\/|$)/.test(url.pathname) && url.pathname !== '/driver') return;

  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
});
