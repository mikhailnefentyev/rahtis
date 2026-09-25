import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { ETA_MAX_AVG_KMH } from '@/lib/config';
import { routingConfigured, truckProfile } from '@/lib/routing';
import { tomtom } from '@/lib/routing/tomtom';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/types/database';

/**
 * Пересчёт оценки прибытия с пробками — сразу после отметки точки.
 *
 * База уже поставила следующей точке оценку по маршруту: момент отметки
 * плюс время плеча без пробок. Здесь она уточняется живым расчётом от
 * места, где стоял отмечающий, — перед Вуосаари в пятницу вечером разница
 * бывает в час.
 *
 * Всё здесь — попытка, а не обязанность. Нет ключа, нет координат, поставщик
 * не ответил — остаётся оценка по маршруту, и отметка точки от этого не
 * страдает: вызывающий не ждёт и не видит ошибок.
 *
 * Координаты читаются служебным ключом: у водителя нет права читать
 * таблицу точек напрямую, только через свои функции. Запись же идёт
 * сессией отмечающего — set_stop_eta проверяет, что рейс его.
 */

/*
 * Отметка из очереди телефона может прийти через час после нажатия.
 * Пробки «сейчас» к тому моменту уже ничего не говорят о пути, который
 * начался тогда, — остаётся оценка по маршруту от момента нажатия.
 */
const STALE_MS = 15 * 60 * 1000;

export async function refineEtaAfter(
  session: SupabaseClient<Database>,
  completedStopId: string,
): Promise<void> {
  if (!routingConfigured()) return;

  try {
    const admin = createAdminClient();

    const { data: done } = await admin
      .from('order_stops')
      .select('order_id, sequence, completed_at, completed_lat, completed_lon, lat, lon, country')
      .eq('id', completedStopId)
      .maybeSingle();

    if (!done?.completed_at) return;
    if (Date.now() - new Date(done.completed_at).getTime() > STALE_MS) return;

    const { data: next } = await admin
      .from('order_stops')
      .select('id, lat, lon, country, completed_at, arrived_at')
      .eq('order_id', done.order_id)
      .gt('sequence', done.sequence)
      .order('sequence')
      .limit(1)
      .maybeSingle();

    if (!next || next.completed_at || next.arrived_at) return;
    if (next.lat == null || next.lon == null) return;

    /* Где стоял отмечающий, а если браузер не дал места — адрес точки. */
    const from =
      done.completed_lat != null && done.completed_lon != null
        ? { lat: done.completed_lat, lon: done.completed_lon }
        : done.lat != null && done.lon != null
          ? { lat: done.lat, lon: done.lon }
          : null;
    if (!from) return;

    const route = await tomtom.route(
      [from, { lat: next.lat, lon: next.lon }],
      truckProfile(done.country ?? next.country),
      { traffic: true },
    );

    /*
     * Пробки удлиняют путь, но не делают его медленнее средней скорости
     * сцепки: на свободной трассе TomTom всё равно слишком оптимистичен.
     */
    const seconds = Math.max(route.durationS, route.distanceM / (ETA_MAX_AVG_KMH / 3.6));

    await session.rpc('set_stop_eta', {
      p_stop_id: next.id,
      p_eta: new Date(Date.now() + seconds * 1000).toISOString(),
      p_source: 'TRAFFIC',
    });
  } catch (error) {
    console.warn('[eta] пересчёт с пробками не удался', error);
  }
}
