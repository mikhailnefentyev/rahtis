'use server';

import { createClient } from '@/lib/supabase/server';
import type { Progress } from './leitner';
import { isTrainingModule } from './modules';

/**
 * Действия тренажёра водителя.
 *
 * Права решает база: training_sync и строки training_progress знают
 * только app.current_driver_id. Кабинет перевозчика сюда дотянуться не
 * может — у него нет водителя, и функция откажет.
 */

/**
 * Отправить прогресс с устройства. Ответ «не вышло» — не ошибка для
 * водителя: прогресс остался в телефоне и уйдёт при следующем открытии.
 */
export async function syncTrainingAction(cards: Progress): Promise<{ ok: boolean }> {
  const entries = Object.entries(cards ?? {}).slice(0, 500);
  if (entries.length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.rpc('training_sync', { p_cards: Object.fromEntries(entries) });
  if (error) console.error('тренажёр: прогресс не записан:', error.message);
  return { ok: !error };
}

/** «Сбросить прогресс» по одному модулю. */
export async function resetTrainingAction(module: string): Promise<{ ok: boolean }> {
  if (!isTrainingModule(module)) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.from('training_progress').delete().like('card_key', `${module}.%`);
  return { ok: !error };
}
