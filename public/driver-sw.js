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
const CACHE = 'rahtis-driver-v5';
const CACHE_PREFIX = 'rahtis-driver-';
const OFFLINE = '/driver-offline.html';
const DRIVER_PAGE = /^\/[a-z]{2}\/driver(\/|$)/;
/* Главный экран приложения: /fi/driver, /ru/driver… */
const DRIVER_HOME = /^\/[a-z]{2}\/driver\/?$/;
/* Под этим ключом лежит адрес главного экрана, куда сервер перевёл /driver в последний раз. */
const START = '/driver-start';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, '/icon.png'])));
  self.skipWaiting();
});

/*
 * Прежний кэш приложения переезжает в новый, а не просто стирается
 * (22.11.2026): обновление service worker приходит, пока водитель в сети,
 * а следующий запуск может быть уже без неё — и сохранённые страницы
 * должны остаться. Чужие кэши (не приложения водителя) удаляются, как раньше.
 */
async function adopt(oldName) {
  if (!oldName.startsWith(CACHE_PREFIX)) return;
  try {
    const [old, next] = await Promise.all([caches.open(oldName), caches.open(CACHE)]);
    for (const request of await old.keys()) {
      if (await next.match(request)) continue;
      const response = await old.match(request);
      if (response) await next.put(request, response);
    }
  } catch {
    /* Не переехало — страницы закэшируются заново при первом открытии в сети. */
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => keys.filter((k) => k !== CACHE))
      .then(async (stale) => {
        for (const key of stale) {
          await adopt(key);
          await caches.delete(key);
        }
      })
      .then(() => self.clients.claim()),
  );
});

/*
 * Запуск с иконки без сети (22.11.2026). Стартовый адрес манифеста —
 * /driver, и сервер отвечает на него переводом на /fi/driver (язык из куки
 * или телефона). Перевод в кэш не ложится, поэтому без сети для /driver в
 * кэше не было ничего, и водитель видел «нет связи», хотя /fi/driver
 * сохранён. Теперь адрес главного экрана запоминается при каждой удачной
 * загрузке, и без сети /driver переводит на него сам service worker.
 */
async function rememberStart(cache, pathname) {
  try {
    await cache.put(START, new Response(pathname, { headers: { 'Content-Type': 'text/plain' } }));
  } catch {
    /* Не запомнили — останется поиск по кэшу (startPath). */
  }
}

async function startPath(cache) {
  const saved = await cache.match(START);
  const remembered = saved ? (await saved.text()).trim() : '';
  if (DRIVER_HOME.test(remembered) && (await cache.match(remembered))) return remembered;

  /* Адрес не запомнен (кэш от прежней версии) — последний сохранённый главный экран. */
  let found = null;
  for (const request of await cache.keys()) {
    const { pathname, search } = new URL(request.url);
    if (DRIVER_HOME.test(pathname) && !search) found = pathname;
  }
  return found;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const { pathname, search } = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
      if (DRIVER_HOME.test(pathname) && !search) rememberStart(cache, pathname);
    }
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (pathname === '/driver') {
      const start = await startPath(cache);
      /* Перевод, а не сама страница: адрес в строке должен совпасть со страницей, иначе приложение не оживёт. */
      if (start) return Response.redirect(start, 302);
    }
    return cache.match(OFFLINE);
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
