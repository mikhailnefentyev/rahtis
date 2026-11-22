/**
 * Выборка целиком, а не первой тысячей строк (22.11.2026).
 *
 * PostgREST отдаёт не больше 1000 строк за запрос, сколько бы ни стояло в
 * `.limit()`, и об обрезке не сообщает: счёт, доходность и курсы молча
 * считались бы по началу выборки. Здесь запрос повторяется страницами
 * через `.range()`; порядок строк обязан быть устойчивым (сортировка по
 * уникальному полю), иначе страницы пересекутся.
 *
 * Без импортов из приложения: модуль читают сервер и тесты.
 */

export const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Все строки запроса. `page(from, to)` — запрос с `.order(...)` и
 * `.range(from, to)`. Ошибка любой страницы — ошибка всей выборки: половина
 * строк хуже, чем ни одной. maxPages — предохранитель от бесконечного цикла.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  size: number = PAGE_SIZE,
  maxPages: number = 500,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let index = 0; index < maxPages; index++) {
    const { data, error } = await page(index * size, index * size + size - 1);
    if (error) return { data: [], error };
    const list = data ?? [];
    rows.push(...list);
    if (list.length < size) return { data: rows, error: null };
  }
  return { data: [], error: { message: `выборка длиннее ${maxPages * size} строк` } };
}

/** Список по частям: длинный `.in()` не помещается в адрес запроса. */
export function chunks<T>(list: readonly T[], size: number = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * `.in()` по длинному списку: запрос на каждую часть, строки вместе.
 * Ошибка любой части — ошибка всей выборки.
 */
export async function fetchIn<T, K>(
  keys: readonly K[],
  query: (part: K[]) => PromiseLike<PageResult<T>>,
  size: number = 100,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (const part of chunks(keys, size)) {
    const { data, error } = await query(part);
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}
