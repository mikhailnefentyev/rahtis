import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import '@/lib/reports/pdfFont';
import { ansi } from '@/lib/reports/PeriodReportPdf';

/**
 * Счёт перевозчика клиенту (lasku) — по-фински с английскими подписями.
 *
 * Состав — по arvonlisäverolaki 209 e §: дата и номер, продавец с
 * Y-tunnus и ALV-номером, покупатель с адресом, что и когда оказано,
 * сумма без налога, ставка и сумма налога; для обратного начисления —
 * пометка словами и ALV-номер покупателя. Плюс реквизиты платежа:
 * IBAN, номер для платежа (viitenumero), срок.
 */
export type SiteInvoicePdfInput = {
  number: string;
  issuedOn: string;
  dueOn: string;
  reference: string;
  seller: { name: string; businessId: string; vatId: string | null; address: string; iban: string; email: string };
  customer: { name: string; businessId: string | null; vatId: string | null; address: string };
  job: string;
  period: string;
  lines: { date: string; text: string; quantity: string; unit: string; unitPrice: string; amount: string }[];
  net: string;
  vatLabel: string;
  vat: string;
  total: string;
  reverseCharge: boolean;
  note: string;
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9, color: '#0c1626' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  seller: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  muted: { color: '#44546b' },
  small: { fontSize: 7.5, color: '#5f6f86' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 20 },
  box: { marginTop: 14, flexDirection: 'row', gap: 24 },
  col: { flex: 1 },
  label: { fontSize: 7, color: '#5f6f86', marginBottom: 2, textTransform: 'uppercase' },
  table: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#dae0ea' },
  head: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#dae0ea', fontFamily: 'Helvetica-Bold', fontSize: 8 },
  line: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eef1f6' },
  cDate: { width: 62 },
  cText: { flex: 1 },
  cQty: { width: 58, textAlign: 'right' },
  cPrice: { width: 70, textAlign: 'right' },
  cAmount: { width: 72, textAlign: 'right' },
  totals: { marginTop: 10, alignSelf: 'flex-end', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  bold: { fontFamily: 'Helvetica-Bold' },
  pay: { marginTop: 22, padding: 10, borderWidth: 1, borderColor: '#dae0ea', borderRadius: 4, flexDirection: 'row', gap: 18 },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, fontSize: 7, color: '#8894a6', textAlign: 'center' },
});

export function SiteInvoicePdf(input: SiteInvoicePdfInput) {
  const field = (fi: string, en: string, value: string) => (
    <View style={s.col}>
      <Text style={s.label}>{ansi(`${fi} / ${en}`)}</Text>
      <Text>{ansi(value)}</Text>
    </View>
  );

  return (
    <Document title={ansi(`Lasku ${input.number}`)} author={ansi(input.seller.name)}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.seller}>{ansi(input.seller.name)}</Text>
            <Text style={s.muted}>{ansi(input.seller.address)}</Text>
            <Text style={s.muted}>
              {ansi(`Y-tunnus ${input.seller.businessId}${input.seller.vatId ? ` · ALV ${input.seller.vatId}` : ''}`)}
            </Text>
            <Text style={s.muted}>{ansi(input.seller.email)}</Text>
          </View>
          <View>
            <Text style={s.title}>{ansi('LASKU / INVOICE')}</Text>
          </View>
        </View>

        <View style={s.box}>
          <View style={s.col}>
            <Text style={s.label}>{ansi('Asiakas / Customer')}</Text>
            <Text style={s.bold}>{ansi(input.customer.name)}</Text>
            <Text>{ansi(input.customer.address)}</Text>
            {input.customer.businessId ? <Text>{ansi(`Y-tunnus ${input.customer.businessId}`)}</Text> : null}
            {input.customer.vatId ? <Text>{ansi(`ALV ${input.customer.vatId}`)}</Text> : null}
          </View>
          <View style={s.col}>
            {field('Laskun numero', 'Invoice no.', input.number)}
            {field('Päiväys', 'Date', input.issuedOn)}
            {field('Eräpäivä', 'Due date', input.dueOn)}
          </View>
        </View>

        <View style={s.box}>
          {field('Työmaa', 'Worksite', input.job)}
          {field('Ajanjakso', 'Period', input.period)}
        </View>

        <View style={s.table}>
          <View style={s.head}>
            <Text style={s.cDate}>{ansi('Pvm')}</Text>
            <Text style={s.cText}>{ansi('Kuvaus / Description')}</Text>
            <Text style={s.cQty}>{ansi('Määrä')}</Text>
            <Text style={s.cPrice}>{ansi('À-hinta')}</Text>
            <Text style={s.cAmount}>{ansi('Yhteensä')}</Text>
          </View>
          {input.lines.map((l, i) => (
            <View key={i} style={s.line} wrap={false}>
              <Text style={s.cDate}>{ansi(l.date)}</Text>
              <Text style={s.cText}>{ansi(l.text)}</Text>
              <Text style={s.cQty}>{ansi(`${l.quantity} ${l.unit}`)}</Text>
              <Text style={s.cPrice}>{ansi(l.unitPrice)}</Text>
              <Text style={s.cAmount}>{ansi(l.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}>
            <Text>{ansi('Veroton yhteensä / Net')}</Text>
            <Text>{ansi(input.net)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text>{ansi(input.vatLabel)}</Text>
            <Text>{ansi(input.vat)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.bold}>{ansi('Maksettava / Total')}</Text>
            <Text style={s.bold}>{ansi(input.total)}</Text>
          </View>
        </View>

        {input.reverseCharge ? (
          <Text style={[s.small, { marginTop: 8 }]}>
            {ansi('Käännetty verovelvollisuus / Reverse charge, Directive 2006/112/EC art. 196.')}
          </Text>
        ) : null}

        <View style={s.pay}>
          {field('Tilinumero (IBAN)', 'Bank account', input.seller.iban)}
          {field('Viitenumero', 'Reference', input.reference)}
          {field('Eräpäivä', 'Due', input.dueOn)}
          {field('Summa', 'Amount', input.total)}
        </View>

        <Text style={[s.small, { marginTop: 14 }]}>{ansi(input.note)}</Text>

        <Text style={s.footer} fixed>
          {ansi(`${input.seller.name} · Y-tunnus ${input.seller.businessId} · Lasku laadittu RAHTIS-palvelussa`)}
        </Text>
      </Page>
    </Document>
  );
}
