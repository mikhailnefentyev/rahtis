import Link from 'next/link';
import { Card, CardBody, Mono } from '@/components/ui';
import { getI18n, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { PartyRole } from '@/types/db';

/**
 * Архив недельных отчётов компании.
 *
 * Ссылки подписанные и живут час. Бакет закрытый, и постоянной публичной
 * ссылки у отчёта быть не должно: в нём ставки, выплаты и контрагенты —
 * пересланная в чат ссылка открыла бы их кому угодно навсегда.
 */
export async function ReportArchive({ locale, role }: { locale: Locale; role: PartyRole }) {
  const [{ t, f }, supabase] = await Promise.all([getI18n(locale), createClient()]);

  const { data: reports } = await supabase
    .from('weekly_reports')
    .select('id, week, file_path, orders_count, bytes')
    .eq('role', role)
    .order('week', { ascending: false })
    .limit(12);

  if (!reports || reports.length === 0) return null;

  const links = await Promise.all(
    reports.map(async (report) => {
      const { data } = await supabase.storage
        .from('reports')
        .createSignedUrl(report.file_path, 3600);
      return { ...report, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <Card className="mt-4">
      <CardBody className="flex flex-col gap-2.5">
        <p className="label-micro">{t.report_.archive}</p>

        <ul className="flex flex-col gap-1.5">
          {links.map((report) => (
            <li
              key={report.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 border-t border-line pt-1.5 first:border-t-0 first:pt-0"
            >
              <span className="text-[13px]">
                <Mono>{f.date(report.week)}</Mono>{' '}
                <span className="text-ink-muted">· {report.orders_count}</span>
              </span>

              {report.url && (
                <Link
                  href={report.url}
                  target="_blank"
                  rel="noopener"
                  className="text-[13px] font-semibold text-accent hover:underline"
                >
                  {t.report_.download}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
