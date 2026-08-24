'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { generateWeeklyReports } from './generate';

export type ReportState = { error: string | null; done: string | null };

/**
 * Ручной выпуск отчётов из админки.
 *
 * Та же функция, что зовёт планировщик. Кнопка нужна не «пока нет
 * расписания»: отчёт приходится перевыпускать, когда оператор задним
 * числом поправил рейс, и ждать до воскресенья ради этого нельзя.
 */
export async function generateReportsAction(
  _previous: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') {
    return { error: t.error.forbidden, done: null };
  }

  const week = String(formData.get('week') ?? '').trim() || undefined;
  const result = await generateWeeklyReports(week);

  revalidatePath(`/${locale}/admin/billing`);

  if (result.errors.length > 0) {
    console.error('Отчёты выпущены с ошибками:', result.errors.join('; '));
    return { error: t.report_.generateFailed, done: null };
  }

  return { error: null, done: `${result.week} · ${result.reports}` };
}
