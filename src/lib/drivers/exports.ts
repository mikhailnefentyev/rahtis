import 'server-only';

import writeExcelFile, { type SheetData } from 'write-excel-file/node';
import { payableKm, type WorkDay } from '@/lib/driverPay';
import type { Dictionary } from '@/lib/i18n';
import type { DriverReport } from './report';

/**
 * Отчёт по водителям для внутренних выплат: XLSX и CSV.
 *
 * Колонки описаны один раз и общие для обоих форматов и для PDF — как у
 * отчёта за период. Числа — числами: часы десятичной дробью, суммы в
 * евро. CSV — «;», UTF-8 с BOM: так его без настройки открывает Excel с
 * финской локалью.
 *
 * Дисклеймер стоит первой строкой в обоих форматах: файл уходит в
 * бухгалтерию отдельно от экрана, и справку нельзя принять там за
 * расчёт зарплаты.
 */

export type Kind = 'text' | 'date' | 'hours' | 'int' | 'money';

export type Row = { driver: string; day: WorkDay | null; totals: boolean };

export type Column = {
  header: string;
  kind: Kind;
  get: (row: Row) => string | number | null;
  width: number;
};

const h = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

export function reportColumns(t: Dictionary): Column[] {
  const w = t.workReport;
  const d = (row: Row) => row.day!;
  return [
    { header: w.driver, kind: 'text', get: (r) => r.driver, width: 22 },
    { header: w.colDate, kind: 'date', get: (r) => (r.totals ? null : d(r).date), width: 12 },
    { header: w.colHours, kind: 'hours', get: (r) => h(d(r).workMinutes), width: 9 },
    { header: w.colBreaks, kind: 'hours', get: (r) => h(d(r).breakMinutes), width: 9 },
    { header: w.colEvening, kind: 'hours', get: (r) => h(d(r).eveningMinutes), width: 9 },
    { header: w.colNight, kind: 'hours', get: (r) => h(d(r).nightMinutes), width: 9 },
    { header: w.colSaturday, kind: 'hours', get: (r) => h(d(r).saturdayMinutes), width: 8 },
    { header: w.colSunday, kind: 'hours', get: (r) => h(d(r).sundayMinutes), width: 8 },
    {
      header: w.colOvertime,
      kind: 'hours',
      get: (r) => h(d(r).overtime1Minutes + d(r).overtime2Minutes),
      width: 10,
    },
    { header: w.colKm, kind: 'int', get: (r) => payableKm(d(r)), width: 8 },
    { header: w.colStops, kind: 'int', get: (r) => d(r).stops, width: 8 },
    { header: w.colTrips, kind: 'int', get: (r) => d(r).trips, width: 8 },
    {
      header: w.colModel,
      kind: 'text',
      get: (r) =>
        r.totals ? w.total : d(r).model ? t.payModel[d(r).model!] : w.noRate,
      width: 16,
    },
    {
      header: w.colAmount,
      kind: 'money',
      get: (r) => (d(r).amountCents == null ? null : d(r).amountCents! / 100),
      width: 14,
    },
  ];
}

/**
 * Строки отчёта: дни каждого водителя и после них строка итога.
 * Итог — тот же тип строки, чтобы таблица была одной формы.
 */
export function reportRows(report: DriverReport): Row[] {
  const rows: Row[] = [];
  for (const entry of report.entries) {
    for (const day of entry.summary.days) {
      rows.push({ driver: entry.driver.full_name, day, totals: false });
    }
    const t = entry.summary.totals;
    rows.push({
      driver: entry.driver.full_name,
      day: { ...t, date: '', model: null, amountCents: t.amountCents },
      totals: true,
    });
  }
  return rows;
}

/* ── XLSX ──────────────────────────────────────────────────────── */

const FORMAT: Partial<Record<Kind, string>> = {
  money: '#,##0.00',
  hours: '0.00',
  date: 'dd.mm.yyyy',
};

function cell(kind: Kind, value: string | number | null, bold = false) {
  if (value == null || value === '') return null;
  const weight = bold ? { fontWeight: 'bold' as const } : {};
  if (kind === 'date') {
    return { value: new Date(`${value}T00:00:00Z`), type: Date, format: FORMAT.date, ...weight };
  }
  if (kind === 'text') return { value: String(value), type: String, ...weight };
  return { value: Number(value), type: Number, format: FORMAT[kind], ...weight };
}

export async function reportXlsx(report: DriverReport, t: Dictionary): Promise<Buffer> {
  const columns = reportColumns(t);
  const rows = reportRows(report);

  const data: SheetData = [
    [{ value: t.pay.disclaimer, fontWeight: 'bold' }],
    [{ value: `${report.from} – ${report.to}` }],
    [],
    columns.map((c) => ({ value: c.header, fontWeight: 'bold' as const })),
    ...rows.map((row) => columns.map((c) => cell(c.kind, c.get(row), row.totals))),
  ];

  return writeExcelFile([
    {
      data,
      sheet: t.workReport.title.slice(0, 31),
      columns: columns.map((c) => ({ width: c.width })),
    },
  ]).toBuffer();
}

/* ── CSV ───────────────────────────────────────────────────────── */

function csvValue(kind: Kind, value: string | number | null): string {
  if (value == null) return '';
  const text = kind === 'money' || kind === 'hours' ? Number(value).toFixed(2) : String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function reportCsv(report: DriverReport, t: Dictionary): string {
  const columns = reportColumns(t);
  const lines = [
    csvValue('text', t.pay.disclaimer),
    columns.map((c) => csvValue('text', c.header)).join(';'),
    ...reportRows(report).map((row) => columns.map((c) => csvValue(c.kind, c.get(row))).join(';')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}
