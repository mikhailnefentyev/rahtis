import 'server-only';

import { csvNumber, csvText } from '@/lib/csv';
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
    /* Валюта — колонкой, когда в таблице есть не евро (у оператора — прямые договоры). */
    ...(report.lines.some((l) => l.currency !== 'EUR')
      ? [{ header: t.orderForm.currency, kind: 'text' as const, get: (l: ReportLine) => l.currency, width: 8 }]
      : []),
    /* Плата заказчика, удержание и выплата прежней модели (до 6.11.2026) убраны 08.11.2026. */
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

/** Колонки своих рейсов: отдельный блок, без денег расчёта. Одни в XLSX и PDF. */
export function ownColumns(report: PeriodReport, t: Dictionary): Column<ReportLine>[] {
  const p = t.periodReport;
  return [
    { header: p.colDate, kind: 'date', get: (l) => l.closedOn, width: 12 },
    { header: p.colRef, kind: 'text', get: (l) => l.ref, width: 14 },
    {
      header: report.role === 'CARRIER' ? t.report_.colClient : t.report_.colCarrier,
      kind: 'text',
      get: (l) => (report.role === 'CARRIER' ? l.shipper : l.carrier),
      width: 24,
    },
    { header: p.colRoute, kind: 'text', get: (l) => l.route, width: 40 },
    { header: p.colVehicle, kind: 'text', get: (l) => l.vehicle, width: 12 },
    { header: p.colKm, kind: 'int', get: (l) => l.km, width: 8 },
    { header: p.colRate, kind: 'money', get: (l) => euros(l.rate), width: 12 },
    /* Цена своего рейса — в его валюте; колонка рядом, чтобы кроны не читались евро. */
    { header: t.orderForm.currency, kind: 'text', get: (l) => l.currency, width: 8 },
  ];
}

/** Итоги строками «подпись — значение»: одинаковы в XLSX и PDF. */
export function summaryRows(report: PeriodReport, t: Dictionary): Array<[string, number, Kind]> {
  const p = t.periodReport;
  const s = report.totals;
  /*
   * Только прямые рейсы (с 6.11.2026 — все новые): итоги по ним — рейсы,
   * километры и цена (если она в евро; иначе цена — в блоке ниже, в своей
   * валюте). Налог и сумма с налогом — в счёте перевозчика, не здесь.
   */
  if (report.lines.length === 0 && report.own.lines.length > 0) {
    const own = report.own;
    return [
      [p.rowTrips, own.lines.length, 'int'],
      [p.rowDistance, own.km, 'int'],
      ...(own.currency === 'EUR' ? [[p.rowRate, own.rate, 'money'] as [string, number, Kind]] : []),
      [p.rowClaims, s.claims, 'int'],
      [p.rowClaimed, s.claimed, 'money'],
    ];
  }
  const rows: Array<[string, number, Kind]> = [
    [p.rowTrips, s.trips, 'int'],
    [p.rowDistance, s.km, 'int'],
    [p.rowRate, s.rate, 'money'],
  ];
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
  const own = ownColumns(report, t);

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

  /* Пустой лист рейсов прежней модели не нужен, когда все рейсы — по прямому договору. */
  const withTrips = report.lines.length > 0 || report.own.lines.length === 0;

  const blob = await writeExcelFile([
    ...(withTrips
      ? [
          {
            data: sheet(trips, report.lines),
            sheet: t.periodReport.sheetTrips,
            columns: trips.map((c) => ({ width: c.width ?? 12 })),
            stickyRowsCount: 1,
          },
        ]
      : []),
    /* Свои рейсы — своим листом: в расчёт и итоги они не входят. */
    ...(report.own.lines.length
      ? [
          {
            data: sheet(own, report.own.lines),
            sheet: t.report_.ownTitle.slice(0, 31),
            columns: own.map((c) => ({ width: c.width ?? 12 })),
            stickyRowsCount: 1,
          },
        ]
      : []),
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

/* Текст (имена, адреса, номера) — с защитой от формул; числа пишет код, они без апострофа (lib/csv). */
function csvValue(kind: Kind, value: string | number | null): string {
  if (kind === 'text' || kind === 'date') return csvText(value);
  if (value == null) return csvNumber(null);
  return csvNumber(kind === 'money' ? Number(value).toFixed(2) : String(value));
}

/**
 * CSV — рейсы одной таблицей. Импорт учётной системы ждёт один набор
 * строк одной формы; claims идут колонкой при рейсе, а целиком — листом
 * в XLSX.
 *
 * Свои рейсы перевозчика (свои клиенты, прямые заказы) — тоже здесь.
 * Без них CSV перевозчика на абонементе, который возит только своих
 * клиентов, был пустым — один заголовок (прогон 21.10.2026). Если
 * рейсов через платформу нет, CSV — это таблица своих рейсов; если есть
 * и те и другие, свои идут вторым блоком после пустой строки и строки
 * с названием, как отдельный лист в XLSX.
 */
export function periodCsv(report: PeriodReport, t: Dictionary): string {
  const table = <T,>(columns: Column<T>[], rows: T[]) => [
    columns.map((c) => csvValue('text', c.header)).join(';'),
    ...rows.map((row) => columns.map((c) => csvValue(c.kind, c.get(row))).join(';')),
  ];
  const trips = table(tripColumns(report, t), report.lines);
  const own = table(ownColumns(report, t), report.own.lines);

  const lines =
    report.own.lines.length === 0
      ? trips
      : report.lines.length === 0
        ? own
        : [...trips, '', csvValue('text', t.report_.ownTitle), ...own];
  return `﻿${lines.join('\r\n')}\r\n`;
}
