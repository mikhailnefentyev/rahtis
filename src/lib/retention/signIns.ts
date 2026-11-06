import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/** Устройства входа хранятся 12 месяцев с последнего входа (PRIVACY, раздел 8). */
export async function purgeOldSignInDevices(now = new Date()): Promise<{ deleted: number; errors: string[] }> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  const { data, error } = await createAdminClient()
    .from('sign_in_devices')
    .delete()
    .lt('last_seen', cutoff.toISOString())
    .select('id');
  /* До миграции таблицы нет — не ошибка запуска. */
  if (error) return { deleted: 0, errors: error.code === '42P01' || error.code === 'PGRST205' ? [] : [error.message] };
  return { deleted: data?.length ?? 0, errors: [] };
}
