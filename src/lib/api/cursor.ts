/**
 * Курсор списка заказов — updated_at и id последней строки: стабилен,
 * когда у нескольких заказов одинаковое время изменения.
 */

export function encodeCursor(updatedAt: string, id: string): string {
  return Buffer.from(`${updatedAt}|${id}`, 'utf8').toString('base64url');
}

/*
 * Время сверяется строгим шаблоном, а не Date.parse: курсор уходит в
 * строку фильтра PostgREST, и запятая или скобка в нём меняли бы фильтр.
 */
const AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** null — курсор повреждён или не наш. */
export function decodeCursor(cursor: string): { at: string; id: string } | null {
  const [at, id, extra] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!at || !id || extra !== undefined || !AT.test(at) || !/^[0-9a-f-]{36}$/.test(id)) return null;
  return { at, id };
}
