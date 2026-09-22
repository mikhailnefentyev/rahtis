import 'server-only';

import writeExcelFile, { type SheetData } from 'write-excel-file/node';
import type { Dictionary } from '@/lib/i18n';
import type { PeriodReport, ReportClaim, ReportLine } from './period';

/**
 * Таблицы отчёта для бухгалтерии: XLSX и CSV.
 *
 * Колонки описаны один раз и общие для обоих форматов — иначе CSV и
 * Excel одного отчёта разошлись бы составом на первой же правке.
 *
 * Числа — числами. В XLSX сумма лежит как 1234.5 с форматом, а не как
 * строка «1 234,50 €»: строку бухгалтерия не сложит. В CSV — евро с
 * точкой, даты ISO, разделитель «;», UTF-8 с BOM. Это то, что без
 * настройки понимает и импорт учётной системы, и Excel с финской
 * локалью (где запятая занята под десятичный знак).
 */

type Kind = 'text' | 'date' | 'int' | 'money' | 'percent';
type Column<T> = {
  header: string;
  kind: Kind;
  get: (row: T) => string | number | null;
  width?: number;
};

const euros = (cents: number | null) => (cents == null ? null : cents / 100);
const percent = (bps: number | null) => (bps == null ? null : bps / 100);

export function tripColumns(report: PeriodReport, t: Dictionary): Column<ReportLine>[] {
  const p = t.periodReport;
  const fees = report.role !== 'SHIPPER';

  return [
    { header: p.colDate, kind: 'date', get: (l) => l.closedOn, width: 12 },
    { header: p.colRef, kind: 'text', get: (l) => l.ref, width: 14 },
    {
      header: p.colShipperRef,
      kind: 'text',
      get: (l) => l.shipperRef,
      width: 14,
    },
    ...(report.role === 'ADMIN'
      ? [
          {
            header: p.colShipper,
            kind: 'text' as const,
            get: (l: ReportLine) => l.shipper,
            width: 22,
          },
        ]
      : []),
    ...(report.role === 'ADMIN'
      ? [
          {
            header: p.colCarrier,
            kind: 'text' as const,
            get: (l: ReportLine) => l.carrier,
            width: 22,
          },
        ]
      : []),
    { header: p.colRoute, kind: 'text', get: (l) => l.route, width: 36 },
    { header: p.colVehicle, kind: 'text', get: (l) => l.vehicle, width: 11 },
    { header: p.colTrailer, kind: 'text', get: (l) => l.trailer, width: 11 },
    { header: p.colKm, kind: 'int', get: (l) => l.km, width: 8 },
    { header: p.colRate, kind: 'money', get: (l) => euros(l.rate), width: 12 },
    ...(fees
      ? [
          {
            header: p.colCommissionRate,
            kind: 'percent' as const,
            get: (l: ReportLine) => percent(l.commissionBps),
            width: 10,
          },
          {
            header: p.colCommission,
            kind: 'money' as const,
            get: (l: ReportLine) => euros(l.commission),
            width: 12,
          },
          {
            header: p.colPayout,
            kind: 'money' as const,
            get: (l: ReportLine) => euros(l.payout),
            width: 12,
          },
        ]
      : []),
    {
      header: p.colVatRate,
      kind: 'percent',
      get: (l) => percent(l.vatBps),
      width: 8,
    },
    { header: p.colVat, kind: 'money', get: (l) => euros(l.vat), width: 11 },
    {
      header: p.colGross,
      kind: 'money',
      get: (l) => euros(l.gross),
      width: 12,
    },
    { header: p.colDocuments, kind: 'int', get: (l) => l.documents, width: 10 },
    {
      header: p.colClaims,
      kind: 'text',
      get: (l) => l.claims.map((c) => `${c.ref} (${t.claimStatus[c.status]})`).join(', ') || null,
      width: 28,
    },
  ];
}

export function claimColumns(report: PeriodReport, t: Dictionary): Column<ReportClaim>[] {
  const p = t.periodReport;
  return [
    {
      header: p.colFiled,
      kind: 'date',
      get: (c) => c.createdAt.slice(0, 10),
      width: 12,
    },
    { header: p.colRef, kind: 'text', get: (c) => c.ref, width: 18 },
    { header: p.colOrder, kind: 'text', get: (c) => c.orderRef, width: 14 },
    ...(report.role === 'ADMIN'
      ? [
          {
            header: p.colShipper,
            kind: 'text' as const,
            get: (c: ReportClaim) => c.shipper,
            width: 22,
          },
        ]
      : []),
    ...(report.role === 'ADMIN'
      ? [
          {
            header: p.colCarrier,
            kind: 'text' as const,
            get: (c: ReportClaim) => c.carrier,
            width: 22,
          },
        ]
      : []),
    {
      header: p.colKind,
      kind: 'text',
      get: (c) => t.claimKind[c.kind],
      width: 24,
    },
    {
      header: p.colFiledBy,
      kind: 'text',
      get: (c) => t.claims.author[c.filedByRole],
      width: 14,
    },
    {
      header: p.colStatus,
      kind: 'text',
      get: (c) => t.claimStatus[c.status],
      width: 14,
    },
    {
      header: p.colAmount,
      kind: 'money',
      get: (c) => euros(c.amount),
      width: 12,
    },
    {
      header: p.colResolution,
      kind: 'text',
      get: (c) => c.resolution,
      width: 40,
    },
  ];
}

/** Итоги строками «подпись — значение»: одинаковы в XLSX и PDF. */
export function summaryRows(report: PeriodReport, t: Dictionary): Array<[string, number, Kind]> {
  const p = t.periodReport;
  const s = report.totals;
  const rows: Array<[string, number, Kind]> = [
    [p.rowTrips, s.trips, 'int'],
    [p.rowDistance, s.km, 'int'],
    [p.rowRate, s.rate, 'money'],
  ];
  if (s.commission != null) rows.push([p.rowCommission, s.commission, 'money']);
  if (s.payout != null) rows.push([p.rowPayout, s.payout, 'money']);
  if (report.role === 'ADMIN' && s.commission != null)
    rows.push([p.rowMargin, s.commission, 'money']);
  rows.push([p.rowVat, s.vat, 'money'], [p.rowGross, s.gross, 'money']);
  rows.push([p.rowClaims, s.claims, 'int'], [p.rowClaimed, s.claimed, 'money']);
  return rows;
}

/* ── XLSX ──────────────────────────────────────────────────────── */

const FORMAT: Partial<Record<Kind, string>> = {
  money: '#,##0.00',
  percent: '0.0#',
  date: 'dd.mm.yyyy',
};

function cell(kind: Kind, value: string | number | null) {
  if (value == null || value === '') return null;
  if (kind === 'date')
    return {
      value: new Date(`${value}T00:00:00Z`),
      type: Date,
      format: FORMAT.date,
    };
  if (kind === 'text') return { value: String(value), type: String };
  return { value: Number(value), type: Number, format: FORMAT[kind] };
}

function sheet<T>(columns: Column<T>[], rows: T[]): SheetData {
  return [
    columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
    ...rows.map((row) => columns.map((c) => cell(c.kind, c.get(row)))),
  ];
}

export async function periodXlsx(report: PeriodReport, t: Dictionary): Promise<Buffer> {
  const trips = tripColumns(report, t);
  const claims = claimColumns(report, t);

  const summary: SheetData = [
    [
      { value: t.periodReport.summary, fontWeight: 'bold' },
      { value: `${report.from} – ${report.to}` },
    ],
    ...summaryRows(report, t).map(([label, value, kind]) => [
      { value: label },
      cell(kind, kind === 'money' ? value / 100 : value),
    ]),
  ];

  const blob = await writeExcelFile([
    {
      data: sheet(trips, report.lines),
      sheet: t.periodReport.sheetTrips,
      columns: trips.map((c) => ({ width: c.width ?? 12 })),
      stickyRowsCount: 1,
    },
    {
      data: sheet(claims, report.claims),
      sheet: t.periodReport.sheetClaims,
      columns: claims.map((c) => ({ width: c.width ?? 12 })),
      stickyRowsCount: 1,
    },
    {
      data: summary,
      sheet: t.periodReport.sheetSummary,
      columns: [{ width: 28 }, { width: 18 }],
    },
  ]).toBuffer();

  return blob;
}

/* ── CSV ───────────────────────────────────────────────────────── */

function csvValue(kind: Kind, value: string | number | null): string {
  if (value == null) return '';
  const text = kind === 'money' ? Number(value).toFixed(2) : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV — только рейсы, одна таблица. Импорт учётной системы ждёт один
 * набор строк одной формы; claims идут колонкой при рейсе, а целиком —
 * листом в XLSX.
 */
export function periodCsv(report: PeriodReport, t: Dictionary): string {
  const columns = tripColumns(report, t);
  const lines = [
    columns.map((c) => csvValue('text', c.header)).join(';'),
    ...report.lines.map((row) => columns.map((c) => csvValue(c.kind, c.get(row))).join(';')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
