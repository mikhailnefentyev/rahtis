/**
 * Что делать с действием из очереди, которое не уходит, хотя сеть есть
 * (22.11.2026).
 *
 * Раньше любая неудача считалась «нет сети»: очередь останавливалась на
 * первом таком действии и ждала. Но бывает, что сеть есть, а запрос не
 * проходит и не пройдёт никогда:
 *  · вышла новая версия сайта, а приложение открыто со старой — сервер не
 *    знает действие старой страницы. Лечится перезагрузкой страницы;
 *  · тело запроса больше, чем принимает площадка (снимок не сжался) —
 *    не лечится ничем.
 * Одно такое действие держало за собой все остальные.
 *
 * Правило: три неудачи подряд при живой сети — страница перезагружается
 * один раз (очередь лежит в IndexedDB и переживает это). Не помогло —
 * ещё три неудачи, и не раньше пяти минут от первой, действие
 * пропускается: водитель видит «не принято», остальные уходят. Пять минут
 * — запас на короткий сбой сервера: потерять отметку из-за минутной
 * аварии хуже, чем подождать.
 *
 * Модуль без React и без браузера: его проверяют тесты
 * (`outboxPolicy.test.mjs`), а время и «недавно перезагружались» приходят
 * снаружи.
 */

/** Снимок или PDF тяжелее этого в очередь не кладётся: площадка такой запрос не примет. */
export const MAX_BLOB_BYTES = 4 * 1024 * 1024;

/** Неудач подряд до перезагрузки и, после неё, до пропуска. */
export const FAILURES_BEFORE_ACTION = 3;

/** Неудачи чаще этого — одна попытка: возврат в приложение и таймер срабатывают пачкой. */
export const FAILURE_SPACING_MS = 10_000;

/** Действие не пропускается раньше, чем через столько от первой неудачи. */
export const SKIP_NOT_BEFORE_MS = 5 * 60_000;

/** Перезагрузка считается «недавней» столько: за это время вторая не делается. */
export const RELOAD_GUARD_MS = 30 * 60_000;

/** Счётчик неудач действия; хранится вместе с ним в очереди. Время — мс от эпохи. */
export type DeliveryState = {
  failures?: number;
  firstFailedAt?: number;
  lastFailedAt?: number;
  /** Когда ради этого действия перезагружали страницу. */
  reloadedAt?: number;
};

export type DeliveryStep = 'wait' | 'reload' | 'skip';

/**
 * Запрос не прошёл при живой сети. Возвращает, что делать, и новый счётчик.
 *
 * reloadedRecently — страницу уже перезагружали ради другого действия:
 * второй раз подряд не перезагружаем, иначе два негодных действия
 * гоняли бы страницу по кругу.
 */
export function afterFailure(
  state: DeliveryState | undefined,
  now: number,
  reloadedRecently: boolean,
): { step: DeliveryStep; state: DeliveryState } {
  const current = state ?? {};

  if (current.lastFailedAt != null && now - current.lastFailedAt < FAILURE_SPACING_MS && now >= current.lastFailedAt) {
    return { step: 'wait', state: current };
  }

  const next: DeliveryState = {
    ...current,
    failures: (current.failures ?? 0) + 1,
    firstFailedAt: current.firstFailedAt ?? now,
    lastFailedAt: now,
  };

  if ((next.failures ?? 0) < FAILURES_BEFORE_ACTION) return { step: 'wait', state: next };

  const reloaded = next.reloadedAt != null || reloadedRecently;
  if (!reloaded) {
    /* Счёт с нуля: после перезагрузки действие получает ещё три попытки. */
    return { step: 'reload', state: { ...next, failures: 0, reloadedAt: now } };
  }

  if (now - (next.firstFailedAt ?? now) >= SKIP_NOT_BEFORE_MS) return { step: 'skip', state: next };
  return { step: 'wait', state: next };
}

/** Перезагружали ли страницу недавно (отметка времени из sessionStorage). */
export function reloadedRecently(mark: string | null | undefined, now: number): boolean {
  const at = Number(mark);
  return Number.isFinite(at) && at > 0 && now >= at && now - at < RELOAD_GUARD_MS;
}

/** Файл можно класть в очередь: слишком тяжёлый не дойдёт до сервера никогда. */
export function blobFits(size: number | null | undefined): boolean {
  return size == null || size <= MAX_BLOB_BYTES;
}
