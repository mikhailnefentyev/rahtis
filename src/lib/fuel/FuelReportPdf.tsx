import path from 'node:path';
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import '@/lib/reports/pdfFont';

/**
 * Отчёт о топливе за месяц — PDF.
 *
 * В отличие от остальных отчётов здесь не встроенная Helvetica, а Noto Sans
 * из файла (src/lib/reports/fonts, лицензия OFL): кабинет есть на русском,
 * литовском, латышском и польском, а Helvetica знает только Windows-1252 —
 * кириллица вышла бы знаками вопроса, «ė» и «ų» потеряли бы точки.
 *
 * Файлы шрифта читаются с диска; на Vercel их кладёт в функцию
 * outputFileTracingIncludes (next.config.ts).
 *
 * Шаблон получает уже отформатированные строки — считает и форматирует
 * маршрут выгрузки.
 */

const FONTS = path.join(process.cwd(), 'src', 'lib', 'reports', 'fonts');

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: path.join(FONTS, 'NotoSans-Regular.ttf') },
    { src: path.join(FONTS, 'NotoSans-Bold.ttf'), fontWeight: 'bold' },
  ],
});

const s = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 32, fontSize: 8, color: '#0c1626', fontFamily: 'NotoSans' },
  brand: { fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
  title: { fontSize: 12, fontWeight: 'bold', marginTop: 14 },
  sub: { fontSize: 8.5, color: '#44546b', marginTop: 3 },
  stats: { flexDirection: 'row', marginTop: 12, gap: 8 },
  stat: { flex: 1, borderWidth: 0.75, borderColor: '#dae0ea', padding: 6 },
  statLabel: { fontSize: 6.5, color: '#44546b', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  statHint: { fontSize: 7, color: '#44546b', marginTop: 1 },
  section: { fontSize: 9.5, fontWeight: 'bold', marginTop: 16 },
  note: { fontSize: 7, color: '#44546b', marginTop: 3 },
  head: { flexDirection: 'row', marginTop: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: '#0c1626' },
  row: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#dae0ea' },
  th: { fontSize: 6.5, fontWeight: 'bold', color: '#44546b', paddingHorizontal: 3 },
  cell: { fontSize: 7.5, paddingHorizontal: 3 },
  warn: { color: '#8f5e0c', fontWeight: 'bold' },
  right: { textAlign: 'right' },
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

export type FuelPdfColumn = { header: string; flex: number; right?: boolean };
export type FuelPdfTable = {
  title: string;
  note?: string;
  empty: string;
  columns: FuelPdfColumn[];
  /** Ячейки строки; warn — номер колонки, которую выделить (расхождение). */
  rows: { cells: string[]; warn?: number }[];
};

export function FuelReportPdf(input: {
  title: string;
  subtitle: string;
  stats: { label: string; value: string; hint?: string }[];
  tables: FuelPdfTable[];
  page: string;
  footer: string;
}) {
  return (
    <Document title={`${input.title} ${input.subtitle}`} author="RAHTIS">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.brand}>RAHTIS</Text>
        <Text style={s.title}>{input.title}</Text>
        <Text style={s.sub}>{input.subtitle}</Text>

        <View style={s.stats}>
          {input.stats.map((stat) => (
            <View key={stat.label} style={s.stat}>
              <Text style={s.statLabel}>{stat.label}</Text>
              <Text style={s.statValue}>{stat.value}</Text>
              {stat.hint ? <Text style={s.statHint}>{stat.hint}</Text> : null}
            </View>
          ))}
        </View>

        {input.tables.map((table) => (
          <View key={table.title}>
            <Text style={s.section} minPresenceAhead={40}>
              {table.title}
            </Text>
            {table.note ? <Text style={s.note}>{table.note}</Text> : null}
            {table.rows.length === 0 ? (
              <Text style={s.empty}>{table.empty}</Text>
            ) : (
              <View>
                {/* Без fixed: таблиц на листе несколько, и повторённая шапка первой легла бы на страницы второй. */}
                <View style={s.head}>
                  {table.columns.map((c, i) => (
                    <Text key={i} style={[s.th, { flex: c.flex }, c.right ? s.right : {}]}>
                      {c.header}
                    </Text>
                  ))}
                </View>
                {table.rows.map((row, r) => (
                  <View key={r} style={s.row} wrap={false}>
                    {row.cells.map((value, i) => (
                      <Text
                        key={i}
                        style={[
                          s.cell,
                          { flex: table.columns[i]!.flex },
                          table.columns[i]!.right ? s.right : {},
                          row.warn === i ? s.warn : {},
                        ]}
                      >
                        {value}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={s.footer} fixed>
          <Text>{input.footer}</Text>
          <Text render={({ pageNumber, totalPages }) => `${input.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
