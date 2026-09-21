import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import '@/lib/reports/pdfFont';
import { ansi } from '@/lib/reports/PeriodReportPdf';

/**
 * Отчёт по водителям — PDF для внутренних выплат.
 *
 * Та же раскладка и та же встроенная Helvetica, что у отчёта за период:
 * альбомный лист, сетка строк, итог жирным. Дисклеймер — прямо под
 * заголовком, до любой цифры: это справка, а не расчёт зарплаты.
 *
 * Шаблон получает уже отформатированные строки — числа считает
 * lib/driverPay, форматирует вызывающий.
 */

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32, fontSize: 8, color: '#0c1626' },
  brand: { fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 14 },
  sub: { fontSize: 8.5, color: '#44546b', marginTop: 3 },
  disclaimer: {
    fontSize: 8,
    marginTop: 8,
    padding: 6,
    borderWidth: 0.75,
    borderColor: '#b7791f',
    color: '#7a4f12',
  },
  head: {
    flexDirection: 'row',
    marginTop: 12,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#0c1626',
  },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#dae0ea' },
  total: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#0c1626' },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#44546b', paddingRight: 4 },
  cell: { fontSize: 7.5, paddingRight: 4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  right: { textAlign: 'right' },
  empty: { fontSize: 8, color: '#44546b', marginTop: 10 },
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

export type DriverPdfColumn = { header: string; flex: number; right?: boolean };

export function DriverReportPdf(input: {
  title: string;
  subtitle: string;
  disclaimer: string;
  empty: string;
  page: string;
  footer: string;
  columns: DriverPdfColumn[];
  rows: { cells: string[]; total: boolean }[];
}) {
  return (
    <Document title={ansi(`${input.title} ${input.subtitle}`)} author="RAHTIS">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.brand}>RAHTIS</Text>
        <Text style={s.title}>{ansi(input.title)}</Text>
        <Text style={s.sub}>{ansi(input.subtitle)}</Text>
        <Text style={s.disclaimer}>{ansi(input.disclaimer)}</Text>

        {input.rows.length === 0 ? (
          <Text style={s.empty}>{ansi(input.empty)}</Text>
        ) : (
          <View>
            <View style={s.head} fixed>
              {input.columns.map((c, i) => (
                <Text key={i} style={[s.th, { flex: c.flex }, c.right ? s.right : {}]}>
                  {ansi(c.header)}
                </Text>
              ))}
            </View>
            {input.rows.map((row, r) => (
              <View key={r} style={row.total ? s.total : s.row} wrap={false}>
                {row.cells.map((value, i) => (
                  <Text
                    key={i}
                    style={[
                      s.cell,
                      { flex: input.columns[i]!.flex },
                      input.columns[i]!.right ? s.right : {},
                      row.total ? s.bold : {},
                    ]}
                  >
                    {ansi(value)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{ansi(input.footer)}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${ansi(input.page)} ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
