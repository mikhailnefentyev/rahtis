import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import './pdfFont';

/**
 * Отчёт за период — PDF для чтения.
 *
 * Та же встроенная Helvetica, что у недельного отчёта (см. WeeklyReport):
 * Windows-1252, без файла шрифта. Всё, что в кодировку не входит, до
 * вёрстки приводится к ближайшему латинскому знаку функцией ansi() —
 * иначе литовское «ė» в имени перевозчика молча превратилось бы в мусор.
 *
 * Альбомный лист: у перевозчика и оператора до пятнадцати колонок, и в
 * книжном они сжимаются до нечитаемого.
 *
 * Шаблон получает уже отформатированные строки. Числа считает period.ts,
 * форматирует вызывающий — здесь только раскладка.
 */

const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const FALLBACK: Record<string, string> = {
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ı: 'i',
  ß: 'ss',
  '→': '-',
  '≈': '~',
};

/** Строка, которую Helvetica с WinAnsiEncoding нарисует без подмены. */
export function ansi(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code < 0x100 || CP1252_EXTRA.includes(ch)) {
      out += ch;
      continue;
    }
    if (FALLBACK[ch]) {
      out += FALLBACK[ch];
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base && base.codePointAt(0)! < 0x100 ? base : '?';
  }
  return out;
}

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 32,
    fontSize: 8,
    color: '#0c1626',
  },
  brand: { fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  operator: { fontSize: 7.5, color: '#44546b', marginTop: 2 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 14 },
  sub: { fontSize: 8.5, color: '#44546b', marginTop: 3 },
  note: { fontSize: 7.5, color: '#44546b', marginTop: 8 },
  section: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginTop: 16 },
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
    fontFamily: 'Helvetica-Bold',
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
  bold: { fontFamily: 'Helvetica-Bold' },
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
