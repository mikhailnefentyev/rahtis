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

/** Черновики из пересланных писем — 30 дней с получения (PRIVACY, раздел 2). */
export async function purgeOldEmailDrafts(now = new Date()): Promise<{ deleted: number; errors: string[] }> {
  const cutoff = new Date(now.getTime() - 30 * 86_400_000);
  const { data, error } = await createAdminClient()
    .from('order_email_drafts')
    .delete()
    .lt('received_at', cutoff.toISOString())
    .select('id');
  if (error) return { deleted: 0, errors: error.code === '42P01' || error.code === 'PGRST205' ? [] : [error.message] };
  return { deleted: data?.length ?? 0, errors: [] };
}
