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
/*
 * Та же старая вкладка после выкладки, но без слова «chunk»: модуль из
 * прежней сборки уже не тот («reading 'call'») или сервер не знает действия
 * формы из неё. Перезагрузка лечит так же. 6.10.2026 на странице входа
 * через полсуток после выкладки записан TypeError без подробностей —
 * по времени это она и была.
 */
const STALE_MODULE = /reading 'call'|evaluating '[^']*\.call'|Failed to find Server Action|UnrecognizedActionError/i;

/* Обрыв сети во время запроса: браузеры называют его TypeError. */
const NETWORK = /Failed to fetch|Load failed|NetworkError when attempting to fetch|network error/i;

const KEY = 'rahtis-stale-reload';

export function isStaleBundle(error: Error): boolean {
  const message = error.message ?? '';
  return error.name === 'ChunkLoadError' || STALE.test(message) || STALE_MODULE.test(message) || error.name === 'UnrecognizedActionError';
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
  /*
   * В журнал идёт только слово-класс, без текста ошибки. Чтобы голый
   * «TypeError» не оставался загадкой, сетевой обрыв получает свой класс.
   */
  const name = isStaleBundle(error)
    ? 'ChunkLoadError'
    : NETWORK.test(error.message ?? '')
      ? `${error.name || 'Error'}Network`
      : error.name;
  return typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : undefined;
}
