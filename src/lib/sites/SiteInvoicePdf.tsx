import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { businessIdLabelByShape } from '@/lib/country';
import { PDF_FONT } from '@/lib/reports/pdfFont';
import { ansi } from '@/lib/reports/PeriodReportPdf';
import { FI_INVOICE_LABELS, type InvoiceLabels } from './invoiceLabels';

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
  note: string;
  /** Подписи полей вместо «Työmaa» и «Ajanjakso» (счёт по рассрочке, 22.11.2026). */
  jobLabel?: [fi: string, en: string];
  periodLabel?: [fi: string, en: string];
  /** Сумма к оплате сейчас, если она не равна итогу (первый счёт рассрочки: взнос + весь НДС). */
  payNow?: { label: [fi: string, en: string]; amount: string };
  /** Заголовок вместо «LASKU / INVOICE» (кредит-нота рассрочки). */
  title?: string;
  /** Подпись суммы в платёжном блоке вместо «Maksettava» (кредит-нота: «Palautetaan»). */
  amountLabel?: [fi: string, en: string];
  /**
   * Подписи счёта на языке страны продавца (счёт рассрочки не из Финляндии,
   * 23.11.2026). Не переданы — финские с английскими, как всегда.
   */
  labels?: InvoiceLabels;
  /** Название документа в свойствах PDF, если это не счёт и не кредит-нота (платёжное уведомление). */
  docName?: string;
  /**
   * Документ не счёт и налога не показывает (23.11.2026): предварительный
   * счёт и платёжное требование Литвы, платёжная информация и
   * Zahlungsaufforderung Германии. Строк «без НДС» и «НДС» нет — только итог
   * к оплате. Не передано — счёт печатается как всегда.
   */
  noVat?: boolean;
};

/* Y-tunnus — только у финского номера; у компании другой страны общая подпись (номер хранится в своём виде). */
const idLabelOf = (L: InvoiceLabels) => (businessId: string) => businessIdLabelByShape(businessId, L.businessId);

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT, paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9, color: '#0c1626' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  seller: { fontSize: 13, fontWeight: 'bold' },
  muted: { color: '#44546b' },
  small: { fontSize: 7.5, color: '#5f6f86' },
  title: { fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  box: { marginTop: 14, flexDirection: 'row', gap: 24 },
  col: { flex: 1 },
  label: { fontSize: 7, color: '#5f6f86', marginBottom: 2, textTransform: 'uppercase' },
  table: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#dae0ea' },
  head: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#dae0ea', fontWeight: 'bold', fontSize: 8 },
  line: { flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: '#eef1f6' },
  cDate: { width: 62 },
  cText: { flex: 1 },
  cQty: { width: 58, textAlign: 'right' },
  cPrice: { width: 70, textAlign: 'right' },
  cAmount: { width: 72, textAlign: 'right' },
  totals: { marginTop: 10, alignSelf: 'flex-end', width: 240 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  /*
   * Подпись итога — своя колонка, переносится по словам; сумма — своя колонка
   * у правого края, не сжимается (24.11.2026). Длинная подпись кредит-ноты
   * («Palautetaan ostajalle / Refunded to the buyer») наезжала на сумму.
   * Короткие подписи стоят там же, где раньше: колонка подписи начинается у
   * левого края блока, сумма — у правого.
   */
  totalLabel: { flex: 1, flexShrink: 1 },
  totalAmount: { flexShrink: 0, marginLeft: 8, textAlign: 'right' },
  bold: { fontWeight: 'bold' },
  pay: { marginTop: 22, padding: 10, borderWidth: 1, borderColor: '#dae0ea', borderRadius: 4, flexDirection: 'row', gap: 18 },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, fontSize: 7, color: '#8894a6', textAlign: 'center' },
});

export function SiteInvoicePdf(input: SiteInvoicePdfInput) {
  const L = input.labels ?? FI_INVOICE_LABELS;
  const idLabel = idLabelOf(L);
  /* stacked — поле в столбике: без flex, иначе высота делится поровну и строки наезжают. */
  const field = (fi: string, en: string, value: string, stacked = false) => (
    <View style={stacked ? { marginBottom: 6 } : s.col}>
      <Text style={s.label}>{ansi(`${fi} / ${en}`)}</Text>
      <Text>{ansi(value)}</Text>
    </View>
  );
  /* IBAN группами по четыре — так его читают и перепечатывают в банке. */
  const iban = input.seller.iban.replace(/\s/g, '').replace(/(.{4})(?=.)/g, '$1 ');

  return (
    <Document title={ansi(`${input.docName ?? (input.title ? L.creditDocName : L.docName)} ${input.number}`)} author={ansi(input.seller.name)}>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.seller}>{ansi(input.seller.name)}</Text>
            <Text style={s.muted}>{ansi(input.seller.address)}</Text>
            <Text style={s.muted}>
              {ansi(`${idLabel(input.seller.businessId)} ${input.seller.businessId}${input.seller.vatId ? ` · ${L.vatId} ${input.seller.vatId}` : ''}`)}
            </Text>
            <Text style={s.muted}>{ansi(input.seller.email)}</Text>
          </View>
          <View>
            <Text style={s.title}>{ansi(input.title ?? L.title)}</Text>
          </View>
        </View>

        <View style={s.box}>
          <View style={s.col}>
            <Text style={s.label}>{ansi(`${L.customer[0]} / ${L.customer[1]}`)}</Text>
            <Text style={s.bold}>{ansi(input.customer.name)}</Text>
            <Text>{ansi(input.customer.address)}</Text>
            {input.customer.businessId ? <Text>{ansi(`${idLabel(input.customer.businessId)} ${input.customer.businessId}`)}</Text> : null}
            {input.customer.vatId ? <Text>{ansi(`${L.vatId} ${input.customer.vatId}`)}</Text> : null}
          </View>
          <View style={s.col}>
            {field(...L.number, input.number, true)}
            {field(...L.date, input.issuedOn, true)}
            {field(...L.due, input.dueOn, true)}
          </View>
        </View>

        <View style={s.box}>
          {field(...(input.jobLabel ?? L.job), input.job)}
          {field(...(input.periodLabel ?? L.period), input.period)}
        </View>

        <View style={s.table}>
          <View style={s.head}>
            <Text style={s.cDate}>{ansi(L.colDate)}</Text>
            <Text style={s.cText}>{ansi(L.colText)}</Text>
            <Text style={s.cQty}>{ansi(L.colQty)}</Text>
            <Text style={s.cPrice}>{ansi(L.colPrice)}</Text>
            <Text style={s.cAmount}>{ansi(L.colAmount)}</Text>
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
          {input.noVat ? null : (
            <>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{ansi(L.net)}</Text>
                <Text style={s.totalAmount}>{ansi(input.net)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>{ansi(input.vatLabel)}</Text>
                <Text style={s.totalAmount}>{ansi(input.vat)}</Text>
              </View>
            </>
          )}
          <View style={s.totalRow}>
            <Text style={input.payNow ? s.totalLabel : [s.totalLabel, s.bold]}>{ansi(input.payNow ? L.total : L.totalDue)}</Text>
            <Text style={input.payNow ? s.totalAmount : [s.totalAmount, s.bold]}>{ansi(input.total)}</Text>
          </View>
          {input.payNow ? (
            <View style={s.totalRow}>
              <Text style={[s.totalLabel, s.bold]}>{ansi(`${input.payNow.label[0]} / ${input.payNow.label[1]}`)}</Text>
              <Text style={[s.totalAmount, s.bold]}>{ansi(input.payNow.amount)}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.pay}>
          {field(...L.iban, iban)}
          {field(...L.reference, input.reference)}
          {field(...L.due, input.dueOn)}
          {field(...(input.amountLabel ?? L.amountDue), input.payNow?.amount ?? input.total)}
        </View>

        <Text style={[s.small, { marginTop: 14 }]}>{ansi(input.note)}</Text>

        <Text style={s.footer} fixed>
          {ansi(`${input.seller.name} · ${idLabel(input.seller.businessId)} ${input.seller.businessId} · ${L.footer}`)}
        </Text>
      </Page>
    </Document>
  );
}
