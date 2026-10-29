import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { PDF_FONT } from './pdfFont';

/**
 * Отчёт за период — PDF для чтения.
 *
 * Шрифт — Noto Sans, общий для всех PDF (pdfFont): кириллица, ė, ł и
 * стрелки выводятся как есть.
 *
 * Альбомный лист: у перевозчика и оператора до пятнадцати колонок, и в
 * книжном они сжимаются до нечитаемого.
 *
 * Шаблон получает уже отформатированные строки. Числа считает period.ts,
 * форматирует вызывающий — здесь только раскладка.
 */

/**
 * Знаки, которых нет в Noto Sans (pdfFont): без подмены стрелка выходит
 * апострофом (проверено 29.10.2026). Остальное — кириллица, ė, ł, ų —
 * шрифт рисует сам; до перехода с Helvetica здесь подменялось всё вне
 * Windows-1252.
 */
const MISSING: Record<string, string> = { '→': '-', '←': '-', '≈': '~' };

export function ansi(value: string): string {
  return value.replace(/[→←≈]/g, (ch) => MISSING[ch] ?? ch);
}

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT,
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 32,
    fontSize: 8,
    color: '#0c1626',
  },
  brand: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  operator: { fontSize: 7.5, color: '#44546b', marginTop: 2 },
  title: { fontSize: 12, fontWeight: 'bold', marginTop: 14 },
  sub: { fontSize: 8.5, color: '#44546b', marginTop: 3 },
  note: { fontSize: 7.5, color: '#44546b', marginTop: 8 },
  section: { fontSize: 9.5, fontWeight: 'bold', marginTop: 16 },
  head: {
    flexDirection: 'row',
    marginTop: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#0c1626',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dae0ea',
  },
  th: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#44546b',
    paddingRight: 4,
  },
  cell: { fontSize: 7.5, paddingRight: 4 },
  right: { textAlign: 'right' },
  summary: { marginTop: 6, width: 260 },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dae0ea',
  },
  bold: { fontWeight: 'bold' },
  empty: { fontSize: 8, color: '#44546b', marginTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#8894a6',
  },
});

export type PdfColumn = { header: string; flex: number; right?: boolean };

export type PeriodPdfInput = {
  title: string;
  subtitle: string;
  operator: string;
  basis: string;
  vatNote: string;
  tripsTitle: string;
  claimsTitle: string;
  summaryTitle: string;
  empty: string;
  noClaims: string;
  page: string;
  tripColumns: PdfColumn[];
  tripRows: string[][];
  claimColumns: PdfColumn[];
  claimRows: string[][];
  /** Свои рейсы и прямые заказы подписчика — отдельно от расчёта. */
  own?: { title: string; note: string; columns: PdfColumn[]; rows: string[][] } | null;
  summary: Array<[string, string, boolean?]>;
};

function Table({ columns, rows }: { columns: PdfColumn[]; rows: string[][] }) {
  return (
    <View>
      <View style={s.head} fixed>
        {columns.map((c, i) => (
          <Text key={i} style={[s.th, { flex: c.flex }, c.right ? s.right : {}]}>
            {ansi(c.header)}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={s.row} wrap={false}>
          {row.map((value, i) => (
            <Text
              key={i}
              style={[s.cell, { flex: columns[i]!.flex }, columns[i]!.right ? s.right : {}]}
            >
              {ansi(value)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PeriodReportPdf(input: PeriodPdfInput) {
  return (
    <Document title={ansi(`${input.title} ${input.subtitle}`)} author="RAHTIS">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.brand}>RAHTIS</Text>
        <Text style={s.operator}>{ansi(input.operator)}</Text>

        <Text style={s.title}>{ansi(input.title)}</Text>
        <Text style={s.sub}>{ansi(input.subtitle)}</Text>
        <Text style={s.note}>{ansi(`${input.basis} ${input.vatNote}`)}</Text>

        <Text style={s.section}>{ansi(input.summaryTitle)}</Text>
        <View style={s.summary}>
          {input.summary.map(([label, value, strong], i) => (
            <View key={i} style={s.sumRow}>
              <Text style={strong ? s.bold : {}}>{ansi(label)}</Text>
              <Text style={strong ? s.bold : {}}>{ansi(value)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>{ansi(input.tripsTitle)}</Text>
        {input.tripRows.length === 0 ? (
          <Text style={s.empty}>{ansi(input.empty)}</Text>
        ) : (
          <Table columns={input.tripColumns} rows={input.tripRows} />
        )}

        {input.own && input.own.rows.length > 0 ? (
          <>
            <Text style={s.section}>{ansi(input.own.title)}</Text>
            <Text style={s.note}>{ansi(input.own.note)}</Text>
            <Table columns={input.own.columns} rows={input.own.rows} />
          </>
        ) : null}

        <Text style={s.section}>{ansi(input.claimsTitle)}</Text>
        {input.claimRows.length === 0 ? (
          <Text style={s.empty}>{ansi(input.noClaims)}</Text>
        ) : (
          <Table columns={input.claimColumns} rows={input.claimRows} />
        )}

        <View style={s.footer} fixed>
          <Text>{ansi(input.operator)}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${ansi(input.page)} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
