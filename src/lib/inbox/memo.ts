/*
 * Память счётчика «Требует действия» для меню кабинета (6.11.2026).
 *
 * Полный расчёт — полтора десятка запросов; меню на каждой странице его
 * не повторяет, а берёт число не старше минуты. Чистый модуль без базы —
 * его гоняет node --test.
 */

export type TtlMemo<V> = {
  get(key: string, now?: number): V | undefined;
  set(key: string, value: V, now?: number): void;
  delete(key: string): void;
};

/** Значения живут ttlMs; при переполнении уходят самые старые записи. */
export function createTtlMemo<V>(ttlMs: number, max: number): TtlMemo<V> {
  const store = new Map<string, { value: V; at: number }>();
  return {
    get(key, now = Date.now()) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (now - hit.at >= ttlMs) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value, now = Date.now()) {
      store.delete(key);
      store.set(key, { value, at: now });
      /* Map хранит порядок вставки: первые — самые старые. */
      while (store.size > max) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    delete(key) {
      store.delete(key);
    },
  };
}

/** Счётчики пользователей: ключ — пользователь и кабинет. Минута — потолок устаревания. */
export const inboxTotals = createTtlMemo<number>(60_000, 5000);

export const inboxTotalKey = (userId: string, role: string): string => `${role}:${userId}`;
