'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';

export type ResolveIncidentState = { error: string | null };

/**
 * Оператор закрывает запись журнала сбоев.
 *
 * Открытая запись уровня FATAL держит /api/health в «degraded», а закрыть
 * её было нечем, кроме правки в базе (12.10.2026). Запись меняет
 * служебный ключ: у оператора на таблицу только чтение, и право писать
 * в журнал руками ему не нужно — нужна одна кнопка. Если поломка
 * вернётся, record_incident откроет запись заново.
 */
export async function resolveIncidentAction(
  _previous: ResolveIncidentState,
  formData: FormData,
): Promise<ResolveIncidentState> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') return { error: t.error.forbidden };

  const id = Number(formData.get('id'));
  if (!Number.isSafeInteger(id) || id <= 0) return { error: t.error.generic };

  const note = String(formData.get('note') ?? '').trim().slice(0, 500);

  const { error } = await createAdminClient()
    .from('incidents')
    .update({ status: 'RESOLVED', resolved_at: new Date().toISOString(), note: note || null })
    .eq('id', id)
    .neq('status', 'RESOLVED');

  if (error) return { error: t.error.generic };

  revalidatePath(`/${locale}/admin/incidents`);
  return { error: null };
}
