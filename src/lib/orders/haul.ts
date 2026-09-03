import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { Database } from '@/types/database';
import type { StopRole } from '@/types/db';

export type HaulKind = Database['public']['Enums']['haul_kind'];

/**
 * Названия точек, зависящие от того, что тянут.
 *
 * Ролей у точки шесть, а различаются между полуприцепом и контейнером
 * ровно две: забор единицы и её возврат. Загрузка и выгрузка называются
 * одинаково — груз кладут в оба, — поэтому общий словарь ролей остаётся
 * общим, а различия живут отдельно.
 *
 * Функция, а не тернарник на месте вызова: тех мест семь, и правило
 * «какие роли зависят от единицы» должно быть записано один раз. Иначе
 * третий тип единицы придётся искать по семи файлам.
 *
 * Умолчание TRAILER не заглушка: у заказов, созданных до появления
 * контейнеров, haul_kind именно такой, и подставлять его руками на каждом
 * вызове значило бы просить об этом и следующего, кто напишет новый
 * экран.
 */
export function stopTitle(
  t: Dictionary,
  role: StopRole,
  haulKind: HaulKind = 'TRAILER',
): string {
  if (role === 'PICKUP') return t.haul[haulKind].stopPickup;
  if (role === 'TRAILER_RETURN') return t.haul[haulKind].stopReturn;

  return t.stopKind[role];
}
