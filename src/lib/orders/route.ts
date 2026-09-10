import type { OrderStop } from '@/types/db';

/**
 * Концы маршрута одной строкой: откуда и куда.
 *
 * Казалось бы, «куда» — это точка с ролью DELIVERY. На деле форма
 * публикации такой роли почти не создаёт: выгрузки и загрузки она
 * добавляет кнопками «добавить выгрузку» и «добавить загрузку», то есть
 * ролями EXTRA_UNLOAD и EXTRA_LOAD. В боевой базе шесть заказов из девяти
 * не имеют DELIVERY вовсе, а имеют, например,
 * PICKUP → EXTRA_UNLOAD → EXTRA_LOAD → TRAILER_RETURN.
 *
 * Пока список искал DELIVERY, у этих заказов направление молча
 * пропадало: строка показывала только город забора, без стрелки и без
 * второго конца. Ошибка тихая — ничего не падает, просто половина
 * маршрута не видна.
 *
 * Поэтому «куда» — это последняя точка работы: не забор и не отцепка.
 * Отцепка не годится на эту роль: у перецепа прицеп нередко возвращают
 * туда же, откуда взяли, и строка «Hanko → Hanko» не сказала бы ничего.
 * Если работы нет вовсе — а такой заказ опубликовать нельзя, но прочитать
 * можно, — берётся отцепка: она хотя бы существует.
 */
export function routeEnds(stops: OrderStop[]): { from: OrderStop | null; to: OrderStop | null } {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);

  const from = ordered.find((s) => s.role === 'PICKUP') ?? ordered[0] ?? null;

  const work = ordered.filter((s) => s.role !== 'PICKUP' && s.role !== 'TRAILER_RETURN');
  const to = work.at(-1) ?? ordered.findLast((s) => s.role === 'TRAILER_RETURN') ?? null;

  return { from, to: to && to.id === from?.id ? null : to };
}

/** Город точки: название площадки его не заменяет — города короче и их сравнивают. */
export function cityOfStop(stop: OrderStop | null): string | null {
  return stop?.city || stop?.place_name || stop?.company_name || null;
}
