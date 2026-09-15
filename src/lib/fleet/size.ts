import 'server-only';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export type FleetSize = { vehicles: number; regions: number };

/**
 * Сколько машин на платформе и в скольких городах — для первого экрана.
 *
 * Кэш здесь не про экономию запроса, а про то, какой становится главная
 * страница. Прежде счётчик читался клиентом посетителя, а тот клиент
 * читает куку сессии — и Next из-за одной куки отдавал витрину
 * динамической: каждый заход анонима поднимал функцию, ходил в базу и
 * только потом рисовал кадр порта. Замер до правки: 820 мс на пустую
 * главную.
 *
 * Служебным ключом и без куки страница снова становится статической.
 * Вольность та же, что у условий и политики: наружу выходят два
 * агрегата, одинаковые для всех, и персонального в них нет.
 *
 * Пятнадцать минут — потому что парк меняется допусками оператора, а не
 * трафиком. Число, отставшее на четверть часа, не врёт; лишний поход в
 * базу на каждого посетителя витрины — врёт про скорость.
 */
export const fleetSize = unstable_cache(
  async (): Promise<FleetSize | null> => {
    const admin = createAdminClient();

    const { data } = await admin.rpc('fleet_size');
    const row = data?.[0];

    return row ? { vehicles: row.vehicles, regions: row.regions } : null;
  },
  ['fleet-size'],
  { revalidate: 900, tags: ['fleet'] },
);
