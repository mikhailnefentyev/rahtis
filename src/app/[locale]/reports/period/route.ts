import { renderToBuffer } from '@react-pdf/renderer';
import { redirect } from 'next/navigation';
import { APP } from '@/lib/config';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getI18n, isLocale } from '@/lib/i18n';
import { buildPeriodReport } from '@/lib/reports/period';
import {
  claimColumns,
  periodCsv,
  periodXlsx,
  summaryRows,
  tripColumns,
} from '@/lib/reports/periodExport';
import { parseRange } from '@/lib/reports/periods';
import { PeriodReportPdf, type PdfColumn } from '@/lib/reports/PeriodReportPdf';

/**
 * Скачать отчёт за период: PDF, XLSX или CSV.
 *
 * Строится по запросу под сессией спрашивающего — отчёт не хранится.
 * Период произвольный, и складывать в бакет файл на каждое сочетание дат
 * значило бы копить архив, который никто не откроет второй раз. Архив
 * документов, которые что-то значат, — недельные и периодные — остаётся
 * как был.
 *
 * Отдаётся с no-store: в файле ставки и выплаты, и кэш промежуточного
 * узла не должен отдать его следующему, кто спросит тот же адрес.
 */
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const url = new URL(request.url);

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `${url.pathname}${url.search}`));
  if (viewer.status !== 'ready') redirect(noAccessPath(locale));

  const range = parseRange(
    url.searchParams.get('from') ?? undefined,
    url.searchParams.get('to') ?? undefined,
  );
  if (!range) return new Response('Invalid period', { status: 400 });

  const format = url.searchParams.get('format') ?? 'pdf';
  if (!['pdf', 'xlsx', 'csv'].includes(format))
    return new Response('Unknown format', { status: 400 });

  const company = url.searchParams.get('company');
  const companyId = viewer.role === 'ADMIN' && company && UUID.test(company) ? company : null;

  const { t, f } = await getI18n(locale);

  const { report, error } = await buildPeriodReport({
    role: viewer.role,
    from: range.from,
    to: range.to,
    country: viewer.company?.country ?? null,
    companyId,
  });

  if (!report) {
    console.error('period report failed:', error);
    return new Response('Report failed', { status: 500 });
  }

  const name = `rahtis-${range.from}_${range.to}`;
  const headers = (type: string, ext: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}.${ext}"`,
    'Cache-Control': 'private, no-store',
  });

  if (format === 'csv') {
    return new Response(periodCsv(report, t), {
      headers: headers('text/csv; charset=utf-8', 'csv'),
    });
  }

  if (format === 'xlsx') {
    const buffer = await periodXlsx(report, t);
    return new Response(new Uint8Array(buffer), {
      headers: headers('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'),
    });
  }

  /* PDF: те же колонки, что в таблицах, но отформатированные для глаза. */
  const trips = tripColumns(report, t);
  const claims = claimColumns(report, t);

  const show = (kind: string, value: string | number | null): string => {
    if (value == null || value === '') return '—';
    if (kind === 'money') return f.eur(Math.round(Number(value) * 100));
    if (kind === 'percent') return `${f.decimal(Number(value), 1)} %`;
    if (kind === 'date') return f.date(`${value}T12:00:00Z`);
    if (kind === 'int') return f.number(Number(value));
    return String(value);
  };

  const flex = (kind: string, header: string): PdfColumn => ({
    header,
    flex: { text: 1.6, money: 1, date: 1.2, percent: 1, int: 0.6 }[kind] ?? 1,
    right: kind !== 'text' && kind !== 'date',
  });

  /* Маршрут и имена шире прочих: иначе альбомный лист их обрежет. */
  const tripFlex = trips.map((c) =>
    c.header === t.periodReport.colRoute
      ? { ...flex(c.kind, c.header), flex: 3 }
      : flex(c.kind, c.header),
  );

  const title =
    report.role === 'ADMIN'
      ? t.periodReport.titleAdmin
      : report.role === 'CARRIER'
        ? t.periodReport.titleCarrier
        : t.periodReport.titleShipper;

  const who = report.role === 'ADMIN' ? report.companyName : (viewer.company?.name ?? null);
  const period = `${f.date(`${range.from}T12:00:00Z`)}–${f.date(`${range.to}T12:00:00Z`)}`;

  const vatNote =
    report.role === 'ADMIN'
      ? ''
      : (report.totals.vatBps ?? 0) > 0
        ? t.done.vatNoteDomestic
        : t.done.vatNoteReverse;

  const summary = summaryRows(report, t).map(([label, value, kind]): [string, string, boolean] => [
    label,
    kind === 'money' ? f.eur(value) : f.number(value),
    label === t.periodReport.rowGross,
  ]);

  const buffer = await renderToBuffer(
    PeriodReportPdf({
      title,
      subtitle: [period, who].filter(Boolean).join(' · '),
      operator: `${APP.operator.legalName} · Y-tunnus ${APP.operator.businessId}`,
      basis: t.periodReport.basis,
      vatNote,
      tripsTitle: t.periodReport.trips,
      claimsTitle: t.periodReport.claims,
      summaryTitle: t.periodReport.summary,
      empty: t.periodReport.empty,
      noClaims: t.periodReport.noClaims,
      page: t.report_.page,
      tripColumns: tripFlex,
      tripRows: report.lines.map((line) => trips.map((c) => show(c.kind, c.get(line)))),
      claimColumns: claims.map((c) => flex(c.kind, c.header)),
      claimRows: report.claims.map((claim) => claims.map((c) => show(c.kind, c.get(claim)))),
      summary,
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: headers('application/pdf', 'pdf'),
  });
}
