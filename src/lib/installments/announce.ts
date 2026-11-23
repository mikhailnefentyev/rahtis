import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Уведомление перевозчикам о новом объявлении (23.11.2026).
 *
 * Кого уведомлять и что уже сказано, решает база
 * (public.announce_equipment_listing): перевозчики той же страны с
 * действующими документами, одно уведомление на объявление и компанию —
 * повторная публикация после снятия никого не тревожит второй раз.
 * Здесь только порции: за вызов база берёт не больше CHUNK компаний, и
 * вызов повторяется, пока порция полная. Потолок MAX_ROUNDS — защита от
 * бесконечного цикла; недосланным уведомление уйдёт при следующей
 * публикации этого объявления.
 *
 * Вызывается после ответа продавцу (after): публикация не ждёт рассылки
 * и не срывается из-за неё. Писем здесь нет — только кабинет.
 */
const CHUNK = 200;
const MAX_ROUNDS = 50;

export async function announceListing(listingId: string): Promise<number> {
  let total = 0;
  try {
    const admin = createAdminClient();
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const { data, error } = await admin.rpc('announce_equipment_listing', { p_listing_id: listingId, p_limit: CHUNK });
      if (error) {
        console.error('уведомление о новом объявлении:', error.message);
        break;
      }
      const sent = typeof data === 'number' ? data : 0;
      total += sent;
      if (sent < CHUNK) break;
    }
  } catch (cause) {
    console.error('уведомление о новом объявлении сорвалось:', cause instanceof Error ? cause.message : cause);
  }
  return total;
}
