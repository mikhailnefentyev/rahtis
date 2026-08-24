import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

/**
 * Недельный отчёт.
 *
 * Шрифт не регистрируется. Встроенная Helvetica выводится с
 * WinAnsiEncoding, а это Windows-1252: ä, ö, å, €, ·, — в ней есть.
 * Финского и шведского хватает, файл шрифта в репозиторий не нужен.
 *
 * Плата за это — всё, чего в Windows-1252 нет, рисуется неверно и молча.
 * Стрелка U+2192 в первом выпущенном отчёте стала апострофом; свои
 * разделители мы после этого держим внутри кодировки. Но имя польского
 * или литовского перевозчика с ł или ė так же тихо поедет, и починит это
 * только встроенный шрифт с полным Юникодом.
 *
 * Вёрстка своя, а не наша веб-разметка: react-pdf понимает подмножество
 * flexbox и ничего не знает о Tailwind. Числа выровнены по правому краю
 * руками — таблиц в этом движке нет.
 */

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 52, paddingHorizontal: 40, fontSize: 9, color: '#101418' },

  brand: { fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  operator: { fontSize: 8, color: '#5b6670', marginTop: 2 },

  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 18 },
  period: { fontSize: 9, color: '#5b6670', marginTop: 3 },

  /* Пометка про налог обязана быть на каждой странице, а не только на первой. */
  vat: { fontSize: 8, color: '#5b6670', marginTop: 10 },

  head: {
    flexDirection: 'row',
    marginTop: 18,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#101418',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#d7dde2',
  },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#5b6670', paddingRight: 6 },
  cell: { fontSize: 9, paddingRight: 6 },
  right: { textAlign: 'right' },

  totals: { flexDirection: 'row', marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#101418' },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', paddingRight: 6 },

  empty: { marginTop: 18, fontSize: 9, color: '#5b6670' },

  note: { marginTop: 22, fontSize: 8, color: '#5b6670', lineHeight: 1.5 },

  footer: {
    position: 'absolute',
    bottom: 26,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#8a949c',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export type ReportRow = {
  ref: string;
  closedAt: string;
  route: string;
  vehicle: string;
  distance: string;
  /** Уже отформатированные деньги: форматирование живёт в одном месте проекта. */
  gross: string;
  commission: string | null;
  net: string;
  documents: number;
};

export type ReportTexts = {
  title: string;
  period: string;
  vatNote: string;
  colRef: string;
  colDate: string;
  colRoute: string;
  colVehicle: string;
  colDistance: string;
  colGross: string;
  colCommission: string;
  colNet: string;
  colDocuments: string;
  total: string;
  empty: string;
  /** Почему рейс мог не попасть в эту неделю. */
  closingNote: string;
  operator: string;
  page: string;
};

export function WeeklyReport({
  texts,
  rows,
  totals,
  withCommission,
}: {
  texts: ReportTexts;
  rows: ReportRow[];
  totals: { gross: string; commission: string | null; net: string; distance: string };
  /** У заказчика колонки комиссии нет: доля оператора — не его дело. */
  withCommission: boolean;
}) {
  const cols = withCommission
    ? /* Заголовок «Palvelumaksu» длиннее числа под ним — ширину задаёт он. */
      { ref: 74, date: 58, route: 110, vehicle: 52, km: 32, gross: 50, commission: 64, net: 58 }
    : { ref: 68, date: 58, route: 210, vehicle: 62, km: 46, gross: 0, commission: 0, net: 70 };

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.brand}>RAHTIS</Text>
          <Text style={s.operator}>{texts.operator}</Text>
        </View>

        <Text style={s.title}>{texts.title}</Text>
        <Text style={s.period}>{texts.period}</Text>
        <Text style={s.vat}>{texts.vatNote}</Text>

        {rows.length === 0 ? (
          <Text style={s.empty}>{texts.empty}</Text>
        ) : (
          <>
            <View style={s.head} fixed>
              <Text style={[s.th, { width: cols.ref }]}>{texts.colRef}</Text>
              <Text style={[s.th, { width: cols.date }]}>{texts.colDate}</Text>
              <Text style={[s.th, { flex: 1 }]}>{texts.colRoute}</Text>
              <Text style={[s.th, { width: cols.vehicle }]}>{texts.colVehicle}</Text>
              <Text style={[s.th, s.right, { width: cols.km }]}>{texts.colDistance}</Text>
              {withCommission && (
                <>
                  <Text style={[s.th, s.right, { width: cols.gross }]}>{texts.colGross}</Text>
                  <Text style={[s.th, s.right, { width: cols.commission }]}>
                    {texts.colCommission}
                  </Text>
                </>
              )}
              <Text style={[s.th, s.right, { width: withCommission ? cols.net : 70 }]}>
                {texts.colNet}
              </Text>
            </View>

            {rows.map((row) => (
              <View key={row.ref} style={s.row} wrap={false}>
                <Text style={[s.cell, { width: cols.ref }]}>{row.ref}</Text>
                <Text style={[s.cell, { width: cols.date }]}>{row.closedAt}</Text>
                <Text style={[s.cell, { flex: 1 }]}>{row.route}</Text>
                <Text style={[s.cell, { width: cols.vehicle }]}>{row.vehicle}</Text>
                <Text style={[s.cell, s.right, { width: cols.km }]}>{row.distance}</Text>
                {withCommission && (
                  <>
                    <Text style={[s.cell, s.right, { width: cols.gross }]}>{row.gross}</Text>
                    <Text style={[s.cell, s.right, { width: cols.commission }]}>
                      {row.commission ?? '—'}
                    </Text>
                  </>
                )}
                <Text style={[s.cell, s.right, { width: withCommission ? cols.net : 70 }]}>
                  {row.net}
                </Text>
              </View>
            ))}

            <View style={s.totals}>
              <Text style={[s.totalLabel, { flex: 1 }]}>{texts.total}</Text>
              <Text style={[s.totalLabel, s.right, { width: cols.km }]}>{totals.distance}</Text>
              {withCommission && (
                <>
                  <Text style={[s.totalLabel, s.right, { width: cols.gross }]}>{totals.gross}</Text>
                  <Text style={[s.totalLabel, s.right, { width: cols.commission }]}>
                    {totals.commission ?? '—'}
                  </Text>
                </>
              )}
              <Text style={[s.totalLabel, s.right, { width: withCommission ? cols.net : 70 }]}>
                {totals.net}
              </Text>
            </View>
          </>
        )}

        <Text style={s.note}>{texts.closingNote}</Text>

        <View style={s.footer} fixed>
          <Text>{texts.operator}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${texts.page} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
