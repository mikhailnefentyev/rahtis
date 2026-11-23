/**
 * Подписи счёта (23.11.2026). По умолчанию — финские с английскими, как
 * печатались всегда (FI_INVOICE_LABELS): счета перевозчиков и финские счета
 * рассрочки их не передают и выглядят как раньше. Счёт рассрочки другой
 * страны передаёт свои подписи — на языке страны с английскими
 * (src/lib/installments/invoiceTexts.ts).
 * Модуль без зависимостей: его читают компонент счёта и тесты.
 */
export type Bilingual = [local: string, en: string];

export type InvoiceLabels = {
  /** Название документа в свойствах PDF и в имени файла: счёт и кредит-нота. */
  docName: string;
  creditDocName: string;
  /** Заголовок счёта. */
  title: string;
  /** Подпись номера плательщика НДС. */
  vatId: string;
  /** Подпись номера компании, когда он не финский Y-tunnus. */
  businessId: string;
  customer: Bilingual;
  number: Bilingual;
  date: Bilingual;
  due: Bilingual;
  job: Bilingual;
  period: Bilingual;
  colDate: string;
  colText: string;
  colQty: string;
  colPrice: string;
  colAmount: string;
  net: string;
  total: string;
  totalDue: string;
  iban: Bilingual;
  reference: Bilingual;
  amountDue: Bilingual;
  /** Конец строки внизу страницы: «счёт составлен в RAHTIS». */
  footer: string;
};

export const FI_INVOICE_LABELS: InvoiceLabels = {
  docName: 'Lasku',
  creditDocName: 'Hyvityslasku',
  title: 'LASKU / INVOICE',
  vatId: 'ALV',
  businessId: 'Yritystunnus / Business ID',
  customer: ['Asiakas', 'Customer'],
  number: ['Laskun numero', 'Invoice no.'],
  date: ['Laskun päivämäärä', 'Invoice date'],
  due: ['Eräpäivä', 'Due date'],
  job: ['Työmaa', 'Worksite'],
  period: ['Ajanjakso', 'Period'],
  colDate: 'Pvm / Date',
  colText: 'Kuvaus / Description',
  colQty: 'Määrä / Qty',
  colPrice: 'À-hinta / Unit',
  colAmount: 'Yhteensä / Total',
  net: 'Veroton yhteensä / Total excl. VAT',
  total: 'Yhteensä / Total',
  totalDue: 'Maksettava yhteensä / Total due',
  iban: ['Tilinumero (IBAN)', 'Bank account'],
  reference: ['Viitenumero', 'Reference'],
  amountDue: ['Maksettava', 'Amount due'],
  footer: 'Lasku on laadittu RAHTIS-palvelussa',
};
