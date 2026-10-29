import { renderToBuffer } from '@react-pdf/renderer';
import { redirect } from 'next/navigation';
import { noAccessPath, signInPath } from '@/lib/auth/paths';
import { getViewer } from '@/lib/auth/viewer';
import { FUEL_SOURCES, monthOf, sourceQty, sourceSpread, SPREAD_NOTICE, type MonthStat } from '@/lib/fuel/fuel';
import { FuelReportPdf } from '@/lib/fuel/FuelReportPdf';
import { loadFuelMonth, parseFuelMonth, type FuelEntry } from '@/lib/fuel/month';
import { defaultLocale, isLocale } from '@/lib/i18n';
import { getViewerI18n } from '@/lib/i18n/viewer';
import { createClient } from '@/lib/supabase/server';

/**
 * Отчёт о топливе за месяц: PDF или CSV, весь парк или одна машина.
 *
 * Те же строки и тот же расчёт, что на странице «Топливо» (lib/fuel/month).
 * Строится по запросу под сессией перевозчика и не хранится; no-store —
 * в файле траты компании и имена водителей. Входит в подписку, как и сама
 * страница.
 */
export const dynamic = 'force-dynamic';

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
  const [{ t, f }, data] = await Promise.all([getViewerI18n(locale), loadFuelMonth(supabase, viewer.company.id, month)]);
  const s = t.fuel;

  /* Одна машина — только своя: чужой id просто даёт весь парк. */
  const vehicle = data.vehicles.find((v) => v.id === url.searchParams.get('vehicle')) ?? null;
  const rows = data.rows.filter((row) => monthOf(row.filled_at) === month && (!vehicle || row.vehicle_id === vehicle.id));
  const plates = new Map(data.vehicles.map((v) => [v.id, v.plate]));
  const drivers = new Map(data.drivers.map((d) => [d.id, d.full_name]));
  const product = (row: FuelEntry) =>
    (t.fuelDriver.products[row.product as keyof typeof t.fuelDriver.products] ?? row.product) +
    (row.full_tank ? '' : ` (${s.partial})`);
  const spreadPct = (row: FuelEntry) => {
    const spread = sourceSpread(row);
    return spread == null ? null : Math.round(spread * 1000) / 10;
  };

  const monthName = new Intl.DateTimeFormat(t.meta.intl, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-15T00:00:00Z`),
  );
  const scope = vehicle ? vehicle.plate : s.sourcesFleet;
  const name = `${s.reportFile}-${month}${vehicle ? `-${vehicle.plate.replace(/[^A-Za-z0-9-]/g, '')}` : ''}`;
  const headers = (type: string, ext: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}.${ext}"`,
    'Cache-Control': 'private, no-store',
  });

  const sourceHeader = (source: (typeof FUEL_SOURCES)[number]) => `${s.colQty}: ${s.sourceLine[source]}`;

  if (format === 'csv') {
    /* Числа — с точкой и без разделителя тысяч, как в остальных выгрузках: так их читает любая программа. */
    const header = [
      s.colDate,
      s.colVehicle,
      s.colDriver,
      s.colProduct,
      s.colQty,
      s.colUnit,
      `${s.colAmount} €`,
      s.colOdometer,
      s.colStation,
      ...FUEL_SOURCES.map(sourceHeader),
      `${s.sourcesDiff} %`,
    ];
    const lines = [header.map(csv).join(';')];
    for (const row of rows) {
      lines.push(
        [
          `${localDate(row.filled_at, f.zone)}`,
          plates.get(row.vehicle_id) ?? '',
          row.driver_id ? (drivers.get(row.driver_id) ?? '') : '',
          product(row),
          row.quantity.toFixed(2),
          row.unit ?? 'l',
          row.amount_cents != null ? (row.amount_cents / 100).toFixed(2) : '',
          row.odometer_km != null ? String(row.odometer_km) : '',
          row.station ?? '',
          ...FUEL_SOURCES.map((source) => sourceQty(row, source)?.toFixed(2) ?? ''),
          spreadPct(row)?.toFixed(1) ?? '',
        ]
          .map(csv)
          .join(';'),
      );
    }
    return new Response(`﻿${lines.join('\r\n')}\r\n`, { headers: headers('text/csv; charset=utf-8', 'csv') });
  }

  /* Итоги и таблица по машинам — из того же расчёта, что на странице. */
  const statsOf = (list: MonthStat[] | undefined) => list?.find((m) => m.month === month);
  const total = vehicle ? statsOf(data.stats.byVehicle.get(vehicle.id)) : statsOf(data.stats.fleet);
  const byVehicle = [...data.stats.byVehicle.entries()]
    .filter(([id]) => !vehicle || id === vehicle.id)
    .map(([id, list]) => ({ plate: plates.get(id) ?? '—', stat: statsOf(list) }))
    .filter((v): v is { plate: string; stat: MonthStat } => Boolean(v.stat))
    .sort((a, b) => a.plate.localeCompare(b.plate));
  const dash = (value: string | null | undefined) => value ?? '—';

  const buffer = await renderToBuffer(
    FuelReportPdf({
      title: s.reportTitle,
      subtitle: [monthName, viewer.company.name, scope].join(' · '),
      stats: [
        {
          label: s.statLitres,
          value: total ? f.number(Math.round(total.liquidL)) : '—',
          hint: total?.gasKg ? `${s.statGas}: ${f.number(Math.round(total.gasKg))}` : undefined,
        },
        { label: s.statAmount, value: total ? f.eur(total.amountCents) : '—' },
        {
          label: s.statL100,
          value: total?.l100 != null ? f.decimal(total.l100) : '—',
          hint: total?.kg100 != null ? `${f.decimal(total.kg100)} kg/100 km` : 'l/100 km',
        },
        {
          label: s.statCentsKm,
          value: total?.centsPerKm != null ? f.eur(Math.round(total.centsPerKm)) : '—',
          hint: total?.adbluePct != null ? `AdBlue ${f.decimal(total.adbluePct)} %` : undefined,
        },
      ],
      tables: [
        {
          title: s.byVehicle,
          note: s.trendHint,
          empty: s.noEntries,
          columns: [
            { header: s.colVehicle, flex: 1.2 },
            { header: s.colLitres, flex: 1, right: true },
            { header: 'AdBlue, l', flex: 1, right: true },
            { header: s.colGas, flex: 1, right: true },
            { header: s.colAmount, flex: 1.2, right: true },
            { header: 'km', flex: 0.9, right: true },
            { header: 'l/100 km', flex: 0.9, right: true },
            { header: s.colPerKm, flex: 0.9, right: true },
          ],
          rows: byVehicle.map(({ plate, stat }) => ({
            cells: [
              plate,
              f.decimal(stat.liquidL),
              stat.adblueL ? f.decimal(stat.adblueL) : '—',
              stat.gasKg ? f.decimal(stat.gasKg) : '—',
              f.eur(stat.amountCents),
              stat.km ? f.number(stat.km) : '—',
              dash(stat.l100 != null ? f.decimal(stat.l100) : null),
              dash(stat.centsPerKm != null ? f.eur(Math.round(stat.centsPerKm)) : null),
            ],
          })),
        },
        {
          title: s.entries,
          note: s.reportSourcesNote,
          empty: s.noEntries,
          columns: [
            { header: s.colDate, flex: 1.3 },
            { header: s.colVehicle, flex: 0.9 },
            { header: s.colDriver, flex: 1.3 },
            { header: s.colProduct, flex: 1.3 },
            { header: s.colQty, flex: 0.9, right: true },
            { header: s.colAmount, flex: 0.9, right: true },
            { header: s.colOdometer, flex: 1, right: true },
            { header: s.colStation, flex: 1.6 },
            ...FUEL_SOURCES.map((source) => ({ header: s.sourceLine[source], flex: 0.95, right: true })),
            { header: s.sourcesDiff, flex: 0.8, right: true },
          ],
          rows: [...rows].reverse().map((row) => {
            const pct = spreadPct(row);
            return {
              cells: [
                f.dateTime(row.filled_at),
                plates.get(row.vehicle_id) ?? '—',
                row.driver_id ? (drivers.get(row.driver_id) ?? '—') : '—',
                product(row),
                `${f.decimal(row.quantity)} ${row.unit ?? 'l'}`,
                row.amount_cents != null ? f.eur(row.amount_cents) : '—',
                row.odometer_km != null ? f.number(row.odometer_km) : '—',
                row.station ?? '',
                ...FUEL_SOURCES.map((source) => {
                  const qty = sourceQty(row, source);
                  return qty == null ? '—' : f.decimal(qty);
                }),
                pct == null ? '' : `${f.decimal(pct)} %`,
              ],
              warn: pct != null && pct / 100 > SPREAD_NOTICE ? 8 + FUEL_SOURCES.length : undefined,
            };
          }),
        },
      ],
      page: t.report_.page,
      footer: `${t.workReport.generated} ${f.dateTime(new Date())}`,
    }),
  );

  return new Response(new Uint8Array(buffer), { headers: headers('application/pdf', 'pdf') });
}

/**
 * Ячейка CSV. Станция приходит из распознанного отчёта, имя — из карточки
 * водителя, поэтому:
 *  · значение, которое после пробелов и служебных знаков начинается с
 *    «=», «+», «-», «@» (и их широких вариантов), получает апостроф —
 *    иначе Excel выполнил бы его как формулу;
 *  · каждое значение — в кавычках: Excel с английскими настройками делит
 *    строку по запятым, и «Neste, =…» без кавычек распалось бы на ячейку,
 *    начинающуюся с формулы.
 * Свои числа маршрут пишет сам, без знака — они тоже в кавычках, Excel
 * всё равно читает их числами.
 */
function csv(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@＝＋－＠]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** YYYY-MM-DD HH:MM в часовом поясе зрителя — так дату понимает Excel. */
function localDate(iso: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
