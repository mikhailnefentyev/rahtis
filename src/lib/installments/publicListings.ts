import 'server-only';

import { unstable_cache } from 'next/cache';
import { cleanListings, type PublicListing } from '@/lib/landing/equipmentSale';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Объявления для открытой страницы «Техника на продажу» (23.11.2026).
 *
 * Источник — public.public_equipment_listings(): только безопасные поля,
 * без продавца, номера машины и идентификаторов; отбор (опубликовано,
 * продавец проверен и не тестовый, страна открыта) делает база.
 *
 * Читается без куки и кэшируется на пять минут — как счётчик парка на
 * главной (fleet/size.ts): посетитель витрины не поднимает запрос в базу
 * на каждый заход, а новое объявление появляется на странице не позже чем
 * через пять минут после публикации.
 *
 * Страница не должна падать: функции ещё нет (выкладка раньше миграции
 * 20261128100000), база недоступна или ответ другой формы — пустой список,
 * страница показывает приглашение продавцам.
 */
const load = unstable_cache(
  async (): Promise<PublicListing[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('public_equipment_listings');
    /* Ошибка бросается, а не возвращается пустым списком: брошенное не кэшируется, и через минуту страница попробует снова. */
    if (error) throw new Error(error.message);
    return cleanListings(data);
  },
  ['public-equipment-listings'],
  { revalidate: 300, tags: ['public-equipment-listings'] },
);

export async function publicListings(): Promise<PublicListing[]> {
  try {
    return await load();
  } catch (cause) {
    console.error('объявления для открытой страницы:', cause instanceof Error ? cause.message : cause);
    return [];
  }
}
