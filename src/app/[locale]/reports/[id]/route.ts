import { redirect } from 'next/navigation';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { isLocale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Открыть недельный отчёт.
 *
 * Уведомление о готовом отчёте вело в раздел выполненных рейсов: человек
 * приходил туда, где отчёта нет, и искал его сам среди карточек. Ведёт
 * сюда — и отчёт открывается.
 *
 * Постоянного адреса у файла нет и быть не должно: бакет закрытый, а в
 * отчёте ставки, выплаты и контрагенты. Ссылка выдаётся на час и только
 * тому, чья компания в отчёте, — строку отбирает RLS, а не проверка
 * здесь. Пересланный адрес этой страницы чужому ничего не откроет: он
 * приведёт его к своему отчёту или к отказу.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; id: string }> },
) {
  const { locale: raw, id } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `/${locale}/reports/${id}`));
  if (viewer.status !== 'ready') redirect(noAccessPath(locale));

  const supabase = await createClient();

  const { data: report } = await supabase
    .from('weekly_reports')
    .select('file_path')
    .eq('id', id)
    .maybeSingle();

  if (!report) redirect(noAccessPath(locale));

  const { data: link } = await supabase.storage
    .from('reports')
    .createSignedUrl(report.file_path, 3600);

  if (!link?.signedUrl) redirect(noAccessPath(locale));

  redirect(link.signedUrl);
}
