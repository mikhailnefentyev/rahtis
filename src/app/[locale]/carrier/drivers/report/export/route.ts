import { renderToBuffer } from '@react-pdf/renderer';
import { redirect } from 'next/navigation';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { DriverReportPdf } from '@/lib/drivers/DriverReportPdf';
import { reportColumns, reportCsv, reportRows, reportXlsx } from '@/lib/drivers/exports';
import { buildDriverReport } from '@/lib/drivers/report';
import { defaultLocale, getI18n, isLocale } from '@/lib/i18n';
import { parseRange } from '@/lib/reports/periods';

/**
 * Скачать отчёт по водителям: PDF, XLSX или CSV.
 *
 * Строится по запросу под сессией перевозчика и не хранится — как отчёт
 * за период. no-store: в файле часы и деньги людей, и промежуточный кэш
 * не должен отдать его следующему, кто спросит тот же адрес.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const url = new URL(request.url);

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `${url.pathname}${url.search}`));
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER') redirect(noAccessPath(locale));

  const range = parseRange(
    url.searchParams.get('from') ?? undefined,
    url.searchParams.get('to') ?? undefined,
  );
  if (!range) return new Response('Invalid period', { status: 400 });

  const format = url.searchParams.get('format') ?? 'pdf';
  if (!['pdf', 'xlsx', 'csv'].includes(format)) return new Response('Unknown format', { status: 400 });

  const driver = url.searchParams.get('driver');
  const driverId = driver && UUID.test(driver) ? driver : null;

  const { t, f } = await getI18n(locale);
  const report = await buildDriverReport({ from: range.from, to: range.to, driverId });

  const name = `${t.workReport.fileName}-${range.from}_${range.to}`;
  const headers = (type: string, ext: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}.${ext}"`,
    'Cache-Control': 'private, no-store',
  });

  if (format === 'csv') {
    return new Response(reportCsv(report, t), { headers: headers('text/csv; charset=utf-8', 'csv') });
  }

  if (format === 'xlsx') {
    const buffer = await reportXlsx(report, t);
    return new Response(new Uint8Array(buffer), {
      headers: headers('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'),
    });
  }

  const columns = reportColumns(t);
  const show = (kind: string, value: string | number | null): string => {
    if (value == null || value === '') return '';
    if (kind === 'money') return f.eur(Math.round(Number(value) * 100));
    if (kind === 'hours') return f.decimal(Number(value), 2);
    if (kind === 'date') return f.date(`${value}T12:00:00Z`);
    if (kind === 'int') return f.number(Number(value));
    return String(value);
  };

  const period = `${f.date(`${range.from}T12:00:00Z`)}–${f.date(`${range.to}T12:00:00Z`)}`;

  const buffer = await renderToBuffer(
    DriverReportPdf({
      title: t.workReport.title,
      subtitle: [period, viewer.company?.name].filter(Boolean).join(' · '),
      disclaimer: t.pay.disclaimer,
      empty: t.workReport.empty,
      page: t.report_.page,
      footer: `${t.workReport.generated} ${f.dateTime(new Date())}`,
      columns: columns.map((c) => ({
        header: c.header,
        flex: c.kind === 'text' ? (c.header === t.workReport.driver ? 2.2 : 1.4) : c.kind === 'money' ? 1.3 : 1,
        right: c.kind !== 'text' && c.kind !== 'date',
      })),
      rows: reportRows(report).map((row) => ({
        cells: columns.map((c) => show(c.kind, c.get(row))),
        total: row.totals,
      })),
    }),
  );

  return new Response(new Uint8Array(buffer), { headers: headers('application/pdf', 'pdf') });
}
