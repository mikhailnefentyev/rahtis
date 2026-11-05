import { renderToBuffer } from '@react-pdf/renderer';
import { redirect } from 'next/navigation';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { csvFile, csvNumber, csvText } from '@/lib/csv';
import { loadEconomics, monthRange } from '@/lib/economics/load';
import type { MonthEconomics } from '@/lib/economics/profit';
import { parseFuelMonth } from '@/lib/fuel/month';
import { defaultLocale, isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { TablesReportPdf, type TablesPdfColumn } from '@/lib/reports/TablesReportPdf';
import { createClient } from '@/lib/supabase/server';

/**
 * Отчёт о доходности: PDF или CSV, весь парк или одна машина.
 *
 * Те же цифры, что на странице Kannattavuus (lib/economics/load). Строится
 * по запросу под сессией перевозчика и не хранится; no-store — в файле
 * деньги компании. Входит в подписку, как и сама страница.
 *
 * PDF: итоги месяца, таблица по машинам и парк за год; для одной машины —
 * её статьи по месяцам и журнал разовых расходов. CSV — строка на машину и
 * месяц со всеми статьями: так его удобно сводить в таблице.
 *
 * Суммы — в рабочей валюте компании (load.ts пересчитал каждую строку по
 * курсу ЕЦБ её дня); в CSV валюта — отдельной колонкой, журнал в PDF — в
 * валюте каждой записи.
 */
export const dynamic = 'force-dynamic';

const cents2 = (c: number) => (c / 100).toFixed(2);

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;
  const url = new URL(request.url);

  const viewer = await getViewer();
  if (viewer.status === 'guest') redirect(signInPath(locale, `${url.pathname}${url.search}`));
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company) redirect(noAccessPath(locale));

  const format = url.searchParams.get('format') ?? 'pdf';
  if (format !== 'pdf' && format !== 'csv') return new Response('Unknown format', { status: 400 });

  const supabase = await createClient();
  const { data: access } = await supabase.rpc('own_orders_access');
  if (!access) return new Response('Subscription required', { status: 403 });

  const month = parseFuelMonth(url.searchParams.get('month'));
  const months = monthRange(month, 12);
  const { t, f } = await getViewerI18n(locale);
  const data = await loadEconomics(
    supabase,
    { id: viewer.company.id, partnership: viewer.company.partnership ?? null, currency: f.currency },
    months,
  );
  const s = t.economics;

  /* Одна машина — только своя: чужой id даёт весь парк. */
  const vehicle = data.vehicles.find((v) => v.id === url.searchParams.get('vehicle')) ?? null;
  const econ = vehicle ? data.economics.filter((v) => v.vehicleId === vehicle.id) : data.economics;

  const name = `${s.reportFile}-${month}${vehicle ? `-${vehicle.plate.replace(/[^A-Za-z0-9-]/g, '')}` : ''}`;
  const headers = (type: string, ext: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}.${ext}"`,
    'Cache-Control': 'private, no-store',
  });

  if (format === 'csv') {
    /* Числа — с точкой и без разделителя тысяч, как в остальных выгрузках. */
    const header = [
      s.month,
      s.colVehicle,
      s.revenuePlatform,
      s.revenueOwn,
      s.revenueSite,
      s.colRevenue,
      s.colFuel,
      s.colDriver,
      s.lineFinancing,
      s.lineDepreciation,
      s.lineInsurance,
      s.lineTax,
      s.lineFixed,
      s.lineJournal,
      s.lineRahtis,
      s.statCosts,
      s.colProfit,
      `${s.colMargin} %`,
      t.orderForm.currency,
    ].map((h) => csvText(h));
    const lines = [header];
    for (const v of econ) {
      for (const m of v.months) {
        const c = m.costs;
        lines.push([
          csvText(m.month),
          csvText(v.plate),
          ...[m.revenue.platform, m.revenue.own, m.revenue.site, m.revenue.total, c.fuel, c.driver, c.financing, c.depreciation, c.insurance, c.tax, c.fixed, c.journal, c.rahtis, c.total, m.profit].map(
            (x) => csvNumber(cents2(x)),
          ),
          csvNumber(m.marginPct?.toFixed(1)),
          csvText(data.currency),
        ]);
      }
    }
    return new Response(csvFile(lines), { headers: headers('text/csv; charset=utf-8', 'csv') });
  }

  const monthName = (m: string, style: 'long' | 'short' = 'long') =>
    new Intl.DateTimeFormat(t.meta.intl, { month: style, year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-15T00:00:00Z`));
  const eur = (c: number) => f.money(c, data.currency);
  const margin = (m: MonthEconomics) => (m.marginPct != null ? `${f.decimal(m.marginPct)} %` : '—');
  const totalOf = vehicle ? econ[0]!.months.find((m) => m.month === month)! : data.fleet.find((m) => m.month === month)!;
  const num = (header: string, flex = 1): TablesPdfColumn => ({ header, flex, right: true });

  const byVehicle = {
    title: s.byVehicle,
    empty: '—',
    columns: [
      { header: s.colVehicle, flex: 1 },
      num(s.colRevenue),
      num(s.colFuel),
      num(s.colDriver),
      num(s.colFinancing),
      num(s.colDepreciation),
      num(s.colInsurance, 1.2),
      num(s.colOther),
      num(s.colProfit),
      num(s.colMargin, 0.8),
      num(s.colPayback, 0.9),
    ],
    rows: [
      ...econ.map((v) => {
        const m = v.months.find((x) => x.month === month)!;
        return {
          cells: [
            v.plate,
            eur(m.revenue.total),
            eur(m.costs.fuel),
            eur(m.costs.driver),
            eur(m.costs.financing),
            eur(m.costs.depreciation),
            eur(m.costs.insurance + m.costs.tax),
            eur(m.costs.fixed + m.costs.journal + m.costs.rahtis),
            eur(m.profit),
            margin(m),
            v.paybackPct != null ? `${f.decimal(v.paybackPct)} %` : '—',
          ],
        };
      }),
      ...(vehicle
        ? []
        : [
            {
              cells: [
                s.fleetTotal,
                eur(totalOf.revenue.total),
                eur(totalOf.costs.fuel),
                eur(totalOf.costs.driver),
                eur(totalOf.costs.financing),
                eur(totalOf.costs.depreciation),
                eur(totalOf.costs.insurance + totalOf.costs.tax),
                eur(totalOf.costs.fixed + totalOf.costs.journal + totalOf.costs.rahtis),
                eur(totalOf.profit),
                margin(totalOf),
                '',
              ],
            },
          ]),
    ],
  };

  /* Год: для парка — итоги по месяцам, для машины — все статьи по месяцам. */
  const yearMonths = vehicle ? [...econ[0]!.months].reverse() : [...data.fleet].reverse();
  const year = vehicle
    ? {
        title: s.monthsTitle,
        empty: '—',
        columns: [
          { header: s.month, flex: 1 },
          num(s.colRevenue),
          num(s.colFuel),
          num(s.colDriver),
          num(s.lineFinancing),
          num(s.lineDepreciation),
          num(s.lineInsurance),
          num(s.lineTax),
          num(s.lineFixed),
          num(s.lineJournal),
          num(s.lineRahtis),
          num(s.colProfit),
          num(s.colMargin, 0.8),
        ],
        rows: yearMonths.map((m) => ({
          cells: [
            monthName(m.month, 'short'),
            eur(m.revenue.total),
            eur(m.costs.fuel),
            eur(m.costs.driver),
            eur(m.costs.financing),
            eur(m.costs.depreciation),
            eur(m.costs.insurance),
            eur(m.costs.tax),
            eur(m.costs.fixed),
            eur(m.costs.journal),
            eur(m.costs.rahtis),
            eur(m.profit),
            margin(m),
          ],
        })),
      }
    : {
        title: s.trendTitle,
        empty: '—',
        columns: [{ header: s.month, flex: 1.2 }, num(s.colRevenue), num(s.statCosts), num(s.colProfit), num(s.colMargin)],
        rows: yearMonths.map((m) => ({ cells: [monthName(m.month, 'short'), eur(m.revenue.total), eur(m.costs.total), eur(m.profit), margin(m)] })),
      };

  const tables = [byVehicle, year];
  if (vehicle) {
    const costs = data.costs.filter((c) => c.vehicle_id === vehicle.id);
    tables.push({
      title: s.costsTitle,
      empty: s.noCosts,
      columns: [{ header: s.spentOn, flex: 1 }, { header: s.category, flex: 1.4 }, num(f.label(s.amount), 1.2), { header: s.note, flex: 3 }],
      rows: costs.map((c) => ({
        cells: [f.date(`${c.spent_on}T12:00:00Z`), s.categories[c.category as keyof typeof s.categories] ?? c.category, f.money(c.amount_cents, c.currency), c.note ?? ''],
      })),
    } as typeof year);
  }

  const buffer = await renderToBuffer(
    TablesReportPdf({
      title: s.reportTitle,
      subtitle: [monthName(month), viewer.company.name, vehicle ? vehicle.plate : s.fleetTotal].join(' · '),
      stats: [
        { label: s.statRevenue, value: eur(totalOf.revenue.total) },
        { label: s.statCosts, value: eur(totalOf.costs.total) },
        { label: s.statProfit, value: eur(totalOf.profit) },
        { label: s.statMargin, value: margin(totalOf) },
      ],
      tables: tables.map((tb, i) => (i === 0 ? { ...tb, note: s.estimateNote } : tb)),
      page: t.report_.page,
      footer: `${t.workReport.generated} ${f.dateTime(new Date())}`,
    }),
  );

  return new Response(new Uint8Array(buffer), { headers: headers('application/pdf', 'pdf') });
}
