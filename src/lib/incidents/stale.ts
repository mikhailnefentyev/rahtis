/**
 * Страница открыта со старой сборкой, а сайт уже выложен заново.
 *
 * Браузер просит кусок JavaScript прежней сборки, которого на сервере
 * больше нет, и страница падает посреди работы. Это не поломка кода: одна
 * перезагрузка подтягивает новую сборку, и всё работает. Так выглядели
 * сбои на столе перевозчика 15–21.09 — каждый вскоре после выкладки.
 *
 * Перезагрузка — одна за минуту: если после неё падает снова, значит,
 * дело не в сборке, и показывается обычный экран ошибки с записью в журнал.
 */

const STALE = /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const KEY = 'rahtis-stale-reload';

export function isStaleBundle(error: Error): boolean {
  return error.name === 'ChunkLoadError' || STALE.test(error.message ?? '');
}

/** true — перезагрузка началась, экран ошибки показывать незачем. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Имя класса ошибки для журнала: только слово, без текста сообщения. */
export function errorClass(error: Error): string | undefined {
  const name = isStaleBundle(error) ? 'ChunkLoadError' : error.name;
  return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : undefined;
}
