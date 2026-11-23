import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PDF_FONT } from '@/lib/reports/pdfFont';
import { ansi } from '@/lib/reports/PeriodReportPdf';
import type { ContractBlock, ContractDocument } from './contractText/blocks';

/**
 * Договор рассрочки страны, кроме Финляндии (23.11.2026): печатает текст,
 * собранный в contractText/ (Эстония — ee.ts, Латвия — lv.ts). Финский
 * договор печатает ContractPdf.tsx, и он не менялся.
 *
 * Вид — как у финского договора: тот же шрифт Noto Sans (в нём есть
 * эстонские õ, ä, ö, ü, š, ž и латышские ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž —
 * проверено печатью 23.11.2026), те же размеры и рамка у оговорки о
 * сохранении права собственности на первой странице.
 */
const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 44, fontSize: 8.6, lineHeight: 1.35, color: '#111' },
  title: { fontSize: 18, fontWeight: 'bold', lineHeight: 1.2 },
  annex: { fontSize: 14, fontWeight: 'bold', lineHeight: 1.25, marginTop: 18, marginBottom: 4 },
  notice: { marginTop: 10, padding: 8, borderWidth: 1.2, borderColor: '#111', fontSize: 12.5, fontWeight: 'bold' },
  meta: { marginTop: 6, marginBottom: 6, color: '#333' },
  h: { fontSize: 10, fontWeight: 'bold', marginTop: 12, marginBottom: 3 },
  p: { marginBottom: 4 },
  li: { marginBottom: 3, marginLeft: 12 },
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  kv: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 2 },
  k: { width: 290, color: '#333', paddingRight: 8 },
  v: { flex: 1 },
  bold: { fontWeight: 'bold' },
  sign: { marginTop: 22, marginBottom: 10, flexDirection: 'row', gap: 30 },
  line: { marginTop: 28, borderTopWidth: 0.8, borderTopColor: '#111', paddingTop: 3 },
  table: { marginTop: 8, marginBottom: 8 },
  tHead: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: '#111', paddingBottom: 2, fontWeight: 'bold' },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: '#ddd', paddingVertical: 1.5 },
  tFoot: { flexDirection: 'row', borderTopWidth: 0.8, borderTopColor: '#111', paddingTop: 2, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 22, left: 44, right: 44, fontSize: 7, color: '#777', flexDirection: 'row', justifyContent: 'space-between' },
  /* Версия шаблона — отдельной строкой под подвалом, мельче (24.11.2026). */
  version: { position: 'absolute', bottom: 12, left: 44, fontSize: 5.5, color: '#999' },
});

/* Столбцы графика: номер, срок, взнос, проценты, итого, остаток. Первые два — по левому краю. */
const COLS = [{ width: 78 }, { width: 78 }, { flex: 1 }, { width: 70 }, { width: 78 }, { width: 86 }] as const;

function Cells({ cells }: { cells: string[] }) {
  return (
    <>
      {cells.map((cell, i) => (
        <Text key={i} style={[COLS[i] ?? { flex: 1 }, { textAlign: i < 2 ? 'left' : 'right', paddingRight: i < 2 ? 4 : 0 }]}>
          {ansi(cell)}
        </Text>
      ))}
    </>
  );
}

function Block({ b }: { b: ContractBlock }) {
  switch (b.kind) {
    case 'title':
      return <Text style={s.title}>{ansi(b.text)}</Text>;
    case 'notice':
      return <Text style={s.notice}>{ansi(b.text)}</Text>;
    case 'meta':
      return <Text style={s.meta}>{ansi(b.text)}</Text>;
    case 'h':
      return (
        <Text style={s.h} minPresenceAhead={30}>
          {ansi(b.text)}
        </Text>
      );
    case 'sub':
      return (
        <Text style={[s.p, s.bold]} minPresenceAhead={24}>
          {ansi(b.text)}
        </Text>
      );
    case 'p':
      return <Text style={s.p}>{ansi(b.text)}</Text>;
    case 'li':
      return <Text style={s.li}>{ansi(b.text)}</Text>;
    case 'kv':
      return (
        <View style={s.kv} wrap={false}>
          <Text style={b.strong ? [s.k, s.bold, { color: '#111' }] : s.k}>{ansi(b.k)}</Text>
          <Text style={b.strong ? [s.v, s.bold] : s.v}>{ansi(b.v)}</Text>
        </View>
      );
    case 'parties':
      return (
        <View style={[s.row, { marginBottom: 6 }]}>
          {[b.left, b.right].map((lines, side) => (
            <View key={side} style={s.col}>
              {lines.map((line, i) => (
                <Text key={i} style={i === 0 ? s.bold : undefined}>
                  {ansi(line)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case 'sign':
      return (
        <View style={s.sign} wrap={false}>
          {[b.left, b.right].map((lines, side) => (
            <View key={side} style={s.col}>
              {lines.map((line, i) => (
                <Text key={i} style={i === 0 ? s.line : undefined}>
                  {ansi(line)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case 'annex':
      return <Text style={s.annex}>{ansi(b.text)}</Text>;
    case 'table':
      return (
        <View style={s.table}>
          <View style={s.tHead}>
            <Cells cells={b.head} />
          </View>
          {b.rows.map((row, i) => (
            <View key={i} style={s.tRow} wrap={false}>
              <Cells cells={row} />
            </View>
          ))}
          <View style={s.tFoot} wrap={false}>
            <Cells cells={b.foot} />
          </View>
        </View>
      );
  }
}

/**
 * version — полное имя версии шаблона (EE_JARELMAKS@2026-11-23), печатается
 * мелко под подвалом каждой страницы (24.11.2026). Не передана (письма о
 * просрочке печатаются тем же компонентом) — строки нет.
 */
export function CountryContractPdf(doc: ContractDocument, version?: string) {
  return (
    <Document title={ansi(doc.title)} author={ansi(doc.author)}>
      {doc.pages.map((blocks, page) => (
        <Page key={page} size="A4" style={s.page}>
          {blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
          <View style={s.footer} fixed>
            <Text>{ansi(doc.footer)}</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
          {version ? (
            <Text style={s.version} fixed>
              {ansi(version)}
            </Text>
          ) : null}
        </Page>
      ))}
    </Document>
  );
}
