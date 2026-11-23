/**
 * Тексты счетов и писем рассрочки по стране продавца (23.11.2026).
 *
 * До открытия Эстонии и Латвии тексты стояли прямо в firstInvoice.ts и
 * payments.ts — финские с английскими, со ссылками на финский закон об НДС.
 * Финские перенесены сюда дословно (их закрепляет тест
 * invoiceTexts.test.mjs); у Эстонии и Латвии — свои: язык страны с
 * английским, ссылки на KMS и PVN likums из docs/equipment-sale/countries/.
 *
 * Что одинаково во всех трёх странах (ee.md и lv.md, «Шаг 3»): первый счёт —
 * вся цена и весь НДС, к оплате сейчас взнос и НДС; взносы — без НДС;
 * проценты — отдельной строкой, иначе они попадают в налоговую базу
 * (KMS § 12 lg 8; PVN likums 34. p. 8. d.).
 *
 * Латвия с 01.01.2028: счёт другому латвийскому предприятию обязан быть
 * структурированным электронным (Grāmatvedības likums 11. p. 14. d.), PDF
 * счётом быть перестаёт. Платформа таких счетов не делает, поэтому с этой
 * даты её документ для латвийского продавца — платёжное уведомление, а счёт
 * продавец выписывает в своей бухгалтерской программе (documentKind).
 *
 * Швеция и Дания (23.11.2026, se.md и dk.md): тот же порядок — первый счёт
 * со всей ценой и всем НДС, взносы без НДС. Суммы в кронах (валюта сделки),
 * ссылка платежа — RF: шведский OCR/bankgiro и датский FI-kort требуют
 * договора продавца с банком, которого у платформы нет, и счёт говорит об
 * этом прямо. В Дании обязательность электронного счёта не подтверждена —
 * это тоже написано на счёте.
 *
 * Литва и Германия (23.11.2026, lt.md и de.md) — документы другого вида:
 *   · Литва: НДС со всей цены возникает при ПЕРЕДАЧЕ, а аванс до передачи НДС
 *     не облагается (PVMĮ 4 str. 2 d., 14 str. 4–5 d.). Поэтому до передачи —
 *     не счёт с НДС, а предварительный счёт (išankstinio mokėjimo sąskaita,
 *     proforma) на взнос и сумму, равную НДС всей цены; PVM sąskaita faktūra на
 *     всю цену с НДС — в день передачи, с зачётом полученного аванса
 *     (payments.ts issueHandoverVatInvoice). Ежемесячные документы — платёжные
 *     требования (mokėjimo pranešimas), не счета, без НДС.
 *   · Германия: первый счёт как в Финляндии (вся цена с USt 19 %, взнос и весь
 *     НДС до передачи). PDF — счёт только с согласия покупателя (оно в договоре,
 *     п. 4.2) и только до 31.12.2026 (§ 27 Abs. 38 UStG; продавцу с оборотом до
 *     800 000 € — до 31.12.2027, но оборот платформе неизвестен, поэтому для
 *     всех ранняя дата). С 01.01.2027 — если документ выставлен или машина
 *     передаётся с этого дня — документ платформы — платёжная информация
 *     (Zahlungsinformation) без НДС, а E-Rechnung продавец выставляет сам.
 *     Ежемесячные документы — всегда Zahlungsaufforderung без НДС: повторный
 *     показ налога создал бы второй налог (§ 14c UStG).
 *   Документы, которые не являются счетами (предварительный счёт, платёжные
 *   требования, уведомления Германии), печатаются без строк НДС (noVat) и
 *   получают номер от номера договора, а не из серии счетов продавца:
 *   серию счетов они не занимают.
 *
 * Польша и Румыния (23.11.2026, pl.md и ro.md) — платформа счетов НЕ делает
 * совсем (countries.ts sellerInvoices). Счёт между компаниями там — только
 * структурированный счёт в KSeF (обязателен для всех польских компаний с
 * 01.04.2026) или XML в RO e-Factura (между румынскими компаниями; PDF вне
 * системы не счёт, штраф 15 % и выставителю, и получателю). Поэтому каждый
 * документ платформы — платёжное уведомление без НДС со своим номером от
 * номера договора, и в каждом прямо сказано: «это не счёт, счёт выставляет
 * продавец в KSeF / RO e-Factura», и что этот счёт должен содержать:
 *   · до передачи — уведомление о первом платеже (notice, IP-/NP-…);
 *   · при передаче — справка о передаче (handoverDoc, IW-/PV-…): Польша —
 *     НДС со всей цены возникает при передаче (art. 7 ust. 1 pkt 2, art. 19a
 *     ust. 1), платёж до неё — аванс (art. 19a ust. 8), счёт на всю цену
 *     выставляется при передаче; Румыния — по договору (п. 4.2) вся цена
 *     фактурируется до передачи (art. 282), дата передачи — дата поставки;
 *   · каждый месяц — уведомление о взносе (paymentDoc): взносы по цене
 *     счетами не оформляются (Польша — один счёт при передаче; Румыния —
 *     цена уже фактурирована), проценты в Румынии продавец фактурирует сам
 *     ежемесячно без НДС (art. 292), в Польше — как решит бухгалтер (pl.md,
 *     открытый вопрос 2: до решения — только сумма, без вывода о НДС);
 *   · отмена до передачи — отмена уведомления (cancel), не кредит-нота.
 * Слово «счёт» на языке страны (faktura, factură) в этих документах стоит
 * только в предложениях «это не счёт…» — это проверяют тест и печать.
 *
 * Модуль без зависимостей от сервера: его читают счета и тесты.
 */
import type { VatMode } from './calc.ts';
import { installmentCountryEntry } from './countries.ts';
import type { Bilingual, InvoiceLabels } from '../sites/invoiceLabels.ts';

export type InvoiceTextCountry = 'FI' | 'EE' | 'LV' | 'SE' | 'DK' | 'LT' | 'DE' | 'PL' | 'RO';

/**
 * Подстановки примечания первого документа. Поля после vatMode (23.11.2026)
 * нужны уведомлениям Польши и Румынии — что должен содержать счёт продавца в
 * KSeF / RO e-Factura; тексты других стран их не читают.
 */
type FirstNote = {
  down: string;
  vat: string;
  rest: string;
  months: number;
  contract: string;
  vatMode: VatMode;
  /** Цена без НДС, НДС-ставка числом («23»), цена с НДС. */
  price?: string;
  vatPercent?: string;
  gross?: string;
  /** Платёж до передачи (взнос и сумма НДС всей цены) и НДС, содержащийся в нём (Польша: аванс — сумма с НДС, art. 19a ust. 8). */
  advance?: string;
  advanceVat?: string;
  /** Согласованный день передачи. */
  handover?: string;
};
type FirstMail = {
  number: string;
  contract: string;
  what: string;
  seller: string;
  sellerEmail: string;
  payNow: string;
  due: string;
  iban: string;
  reference: string;
};
type PaymentMail = { contract: string; n: number; months: number; what: string; total: string; due: string; iban: string };
type CreditNote = { original: string; originalDate: string; contract: string; refund: string | null };
type CreditTexts = {
  linePrefix: string;
  job: (a: { contract: string }) => string;
  periodLabel: Bilingual;
  title: string;
  payNowLabel: Bilingual;
  amountLabel: Bilingual;
  note: (a: CreditNote) => string;
  mailSubject: (a: { seller: string; original: string }) => string;
  mailText: (a: { original: string; contract: string }) => string;
};

/**
 * Документ, который платформа выпускает вместо счёта (23.11.2026): платёжное
 * уведомление Латвии с 2028 года, предварительный счёт и платёжное
 * требование Литвы, платёжная информация и Zahlungsaufforderung Германии.
 */
export type PlainDocTexts = {
  title: string;
  docName: string;
  /** Подписи, которые у документа свои: «номер и дата документа», а не счёта. */
  labels: Partial<InvoiceLabels>;
  /**
   * true — документ печатается без строк НДС: только итог к оплате (Литва,
   * Германия). У латвийского уведомления строки НДС остаются, как были.
   */
  noVat?: true;
  /** Начало имени файла во вложении письма; нет — как у счёта страны. */
  filePrefix?: string;
};

/** Номер документа, который не счёт: от номера договора, серию счетов продавца не занимает. */
type NumberOf = (a: { contract: string; n?: number; original?: string }) => string;

export type InstallmentInvoiceTexts = {
  country: InvoiceTextCountry;
  /** Язык чисел и сумм. */
  intl: string;
  /** Дата из ГГГГ-ММ-ДД, как её пишут в стране. */
  date: (iso: string) => string;
  /** Единица в строке счёта: «шт.». */
  unit: string;
  /** Подписи счёта; undefined — финские по умолчанию (SiteInvoicePdf). */
  labels: InvoiceLabels | undefined;
  /** Начало имени файла во вложении письма. */
  filePrefix: string;
  /** Подпись строки НДС: ставка в процентах уже строкой («25,5»); null — 0 %. */
  vatLabel: (percent: string | null) => string;
  first: {
    line: (a: { what: string; contract: string }) => string;
    jobLabel: Bilingual;
    periodLabel: Bilingual;
    payNowLabel: Bilingual;
    note: (a: FirstNote) => string;
    mailSubject: (a: { number: string; seller: string; contract: string }) => string;
    mailText: (a: FirstMail) => string;
  };
  payment: {
    jobLabel: Bilingual;
    periodLabel: Bilingual;
    line: (a: { n: number; months: number; contract: string; what: string }) => string;
    interestLine: string;
    /** hasInterest — в документе есть строка процентов (23.11.2026; читают тексты Польши и Румынии). */
    note: (a: { firstNumber: string; hasInterest?: boolean }) => string;
    mailSubject: (a: { seller: string; n: number; months: number; contract: string }) => string;
    mailText: (a: PaymentMail) => string;
    /** Последняя строка письма: номер документа и ссылка платежа. */
    mailFooter: (a: { number: string; reference: string }) => string;
  };
  credit: CreditTexts;
  /**
   * Платёжное уведомление вместо счёта: Латвия с 2028 года (с НДС, как
   * было), Германия с 2027 года (без НДС, firstLine и firstNote — свой текст
   * первого документа); null — в стране такого нет.
   */
  notice:
    | (PlainDocTexts & {
        /** Пояснение в начале примечания: почему это не счёт. */
        note: string;
        firstLine?: (a: { what: string; contract: string }) => string;
        firstNote?: (a: FirstNote) => string;
        /** Письмо с первым документом, если он уведомление, а не счёт (Германия). */
        firstMailSubject?: (a: { number: string; seller: string; contract: string }) => string;
        firstMailText?: (a: FirstMail) => string;
        /**
         * Номер первого уведомления от номера договора (Польша, Румыния,
         * 23.11.2026): серию счетов продавца оно не занимает. Нет — номер из
         * серии, как у немецкой платёжной информации.
         */
        number?: NumberOf;
      })
    | null;
  /**
   * Литва: первый документ — предварительный счёт без НДС одной строкой
   * (взнос и сумма НДС всей цены); его примечание — first.note.
   */
  proforma?: PlainDocTexts & { line: (a: { what: string; contract: string }) => string; number: NumberOf };
  /**
   * Литва: счёт с НДС на всю цену в день передачи, с зачётом аванса. Польша и
   * Румыния: справка о передаче — не счёт (handoverDoc), с тем, что должен
   * содержать счёт продавца; поля после contract — для неё.
   */
  handover?: {
    line: (a: { what: string; contract: string }) => string;
    note: (a: {
      proforma: string;
      advance: string;
      vat: string;
      rest: string;
      months: number;
      contract: string;
      price?: string;
      gross?: string;
      vatPercent?: string;
      advanceVat?: string;
      handover?: string;
    }) => string;
    payNowLabel: Bilingual;
    amountLabel: Bilingual;
    /* Номер счёта добавляется к теме и в конец письма при отправке (payments.ts deliverInvoice). */
    mailSubject: (a: { seller: string; contract: string }) => string;
    mailText: (a: { contract: string; what: string; seller: string }) => string;
  };
  /** Литва и Германия: ежемесячный документ — платёжное требование без НДС, не счёт. */
  paymentDoc?: PlainDocTexts & { number: NumberOf };
  /**
   * Польша и Румыния: документ при передаче — справка без НДС со своим
   * номером, не счёт (тексты — handover). Нет поля — при передаче, если
   * документ есть, это счёт с НДС (Литва).
   */
  handoverDoc?: PlainDocTexts & { number: NumberOf };
  /** Отмена документа без НДС (предварительного счёта, платёжной информации) — не кредит-нота. */
  cancel?: CreditTexts & PlainDocTexts & { number: NumberOf };
};

const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
};

const paddedDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
};

const lines = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join('\n');

/* ── Финляндия: тексты как были до 23.11.2026, без изменений ─────────── */

const FI_VAT_NOTE: Record<VatMode, string> = {
  STANDARD: '',
  MARGIN: 'Voittomarginaalijärjestelmä – käytetyt tavarat. / Margin scheme – second-hand goods.',
  EXEMPT: 'Veroton myynti, AVL 61 §. / VAT-exempt sale, VAT Act s. 61.',
  NONE: 'Myyjä ei ole arvonlisäverovelvollinen. / The seller is not VAT-registered.',
};

const FI: InstallmentInvoiceTexts = {
  country: 'FI',
  intl: 'fi-FI',
  date: shortDate,
  unit: 'kpl',
  labels: undefined,
  filePrefix: 'Lasku',
  vatLabel: (percent) => (percent ? `ALV / VAT ${percent} %` : 'ALV / VAT 0 %'),
  first: {
    line: ({ what, contract }) => `${what} – kauppahinta, osamaksusopimus nro ${contract} / purchase price, hire-purchase contract`,
    jobLabel: ['Kaupan kohde', 'Item sold'],
    periodLabel: ['Luovutus', 'Handover'],
    payNowLabel: ['Maksettava nyt', 'Due now'],
    note: ({ down, vat, rest, months, contract, vatMode }) =>
      lines(
        `Osamaksukauppa: koko kauppahinnan arvonlisävero laskutetaan tällä laskulla. Maksettava nyt: käsiraha ${down} + arvonlisävero ${vat}. Loppuosa ${rest} maksetaan ${months} erässä osamaksusopimuksen nro ${contract} mukaisesti; erät eivät sisällä arvonlisäveroa. Omistusoikeus säilyy myyjällä, kunnes kauppahinta on kokonaan maksettu. Ajoneuvo luovutetaan, kun tämä lasku on maksettu.`,
        `Hire-purchase: VAT on the whole price is invoiced on this invoice. Due now: down payment + VAT. The remainder is paid in ${months} instalments under contract ${contract}, without VAT. The seller retains ownership until the price is paid in full. The vehicle is handed over once this invoice is paid.`,
        FI_VAT_NOTE[vatMode],
        'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli eikä vastaanota maksua. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.',
      ),
    mailSubject: ({ number, seller, contract }) => `Lasku ${number} · ${seller} · osamaksusopimus ${contract}`,
    mailText: (a) =>
      [
        'Hei,',
        '',
        `liitteenä osamaksukaupan ensimmäinen lasku ${a.number} (sopimus ${a.contract}, ${a.what}). Laskuttaja: ${a.seller}.`,
        `Maksettava nyt ${a.payNow} (käsiraha ja koko kauppahinnan arvonlisävero), eräpäivä ${a.due}.`,
        `Tilinumero (IBAN) ${a.iban}, viitenumero ${a.reference}.`,
        'Maksu suoritetaan suoraan myyjälle, ei RAHTIS-palvelulle eikä Aivomaa Oy:lle.',
        '',
        `Kysymykset: vastatkaa tähän viestiin (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is the first invoice ${a.number} of the hire-purchase contract ${a.contract} (${a.what}) from ${a.seller}. Due now ${a.payNow} (down payment and VAT on the whole price), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Osamaksusopimus', 'Hire-purchase contract'],
    periodLabel: ['Maksuerä', 'Instalment'],
    line: ({ n, months, contract, what }) => `Maksuerä ${n}/${months}, osamaksusopimus nro ${contract} (${what}) / Instalment ${n}/${months}`,
    interestLine: 'Korko, veroton rahoituspalvelu (AVL 41 §) / Interest, VAT-exempt financial service',
    note: ({ firstNumber }) =>
      [
        `Osamaksuerä ilman arvonlisäveroa: kauppahinnan arvonlisävero on laskutettu kokonaisuudessaan laskulla nro ${firstNumber}. / The instalment has no VAT: VAT on the whole price was invoiced on invoice ${firstNumber}.`,
        'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli eikä vastaanota maksua. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.',
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Lasku · ${seller} · maksuerä ${n}/${months}, sopimus ${contract}`,
    mailText: (a) =>
      [
        'Hei,',
        '',
        `liitteenä osamaksusopimuksen ${a.contract} maksuerän ${a.n}/${a.months} lasku (${a.what}).`,
        `Maksettava ${a.total}, eräpäivä ${a.due}. Tilinumero (IBAN) ${a.iban}.`,
        'Maksu suoritetaan suoraan myyjälle, ei RAHTIS-palvelulle eikä Aivomaa Oy:lle.',
        '',
        '—',
        `Attached is the invoice for instalment ${a.n}/${a.months} of hire-purchase contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Lasku / Invoice ${number} · viitenumero / reference ${reference}`,
  },
  credit: {
    linePrefix: 'Hyvitys / Credit: ',
    job: ({ contract }) => `${contract} · peruttu / cancelled`,
    periodLabel: ['Hyvitettävä lasku', 'Credited invoice'],
    title: 'HYVITYSLASKU / CREDIT NOTE',
    payNowLabel: ['Palautetaan ostajalle', 'Refunded to the buyer'],
    amountLabel: ['Palautetaan', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `HYVITYSLASKU / CREDIT NOTE. Hyvittää laskun nro ${original} (${originalDate}) kokonaisuudessaan, koska osamaksukauppa ${contract} peruttiin ennen ajoneuvon luovutusta. ${refund ? `Myyjä palauttaa ostajalle maksetun ${refund}.` : 'Laskua ei ollut maksettu, joten palautettavaa ei ole.'} / Credits invoice ${original} in full because hire-purchase ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale.',
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Hyvityslasku · ${seller} · lasku ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Hei,',
        '',
        `liitteenä hyvityslasku, joka hyvittää laskun ${original}: osamaksukauppa ${contract} on peruttu ennen luovutusta.`,
        '',
        '—',
        `Attached is a credit note crediting invoice ${original}: hire-purchase ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
  notice: null,
};

/* ── Эстония ─────────────────────────────────────────────────────────── */

const EE_ISSUER =
  'Arve esitab müüja; RAHTIS (Aivomaa Oy) ei ole tehingu pool ega võta makseid vastu. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.';
/* E-arve: покупатель, отмеченный в äriregister получателем, вправе требовать машиночитаемый счёт (RPS § 7¹ lg 7); платформа его не делает. */
const EE_EINVOICE =
  'Kui ostja on äriregistris märgitud e-arve vastuvõtjaks ja nõuab e-arvet, esitab müüja arve masintöödeldavana oma raamatupidamistarkvarast. / If the buyer requires an e-invoice, the seller provides it in machine-readable form from its own accounting software.';

const EE_LABELS: InvoiceLabels = {
  docName: 'Arve',
  creditDocName: 'Kreeditarve',
  title: 'ARVE / INVOICE',
  vatId: 'KMKR',
  businessId: 'Registrikood / Reg. code',
  customer: ['Ostja', 'Customer'],
  number: ['Arve number', 'Invoice no.'],
  date: ['Arve kuupäev', 'Invoice date'],
  due: ['Maksetähtpäev', 'Due date'],
  job: ['Müügiese', 'Item sold'],
  period: ['Periood', 'Period'],
  colDate: 'Kuupäev / Date',
  colText: 'Kirjeldus / Description',
  colQty: 'Kogus / Qty',
  colPrice: 'Ühikuhind / Unit',
  colAmount: 'Kokku / Total',
  net: 'Kokku käibemaksuta / Total excl. VAT',
  total: 'Kokku / Total',
  totalDue: 'Tasuda kokku / Total due',
  iban: ['Arvelduskonto (IBAN)', 'Bank account'],
  reference: ['Viitenumber', 'Reference'],
  amountDue: ['Tasuda', 'Amount due'],
  footer: 'Arve on koostatud RAHTIS-teenuses',
};

const EE: InstallmentInvoiceTexts = {
  country: 'EE',
  intl: 'et-EE',
  date: paddedDate,
  unit: 'tk',
  labels: EE_LABELS,
  filePrefix: 'Arve',
  vatLabel: (percent) => (percent ? `Käibemaks / VAT ${percent} %` : 'Käibemaks / VAT 0 %'),
  first: {
    line: ({ what, contract }) => `${what} – ostuhind, järelmaksuga müügi leping nr ${contract} / purchase price, instalment sale contract`,
    jobLabel: ['Müügiese', 'Item sold'],
    periodLabel: ['Üleandmine', 'Handover'],
    payNowLabel: ['Tasuda nüüd', 'Due now'],
    note: ({ down, vat, rest, months, contract }) =>
      lines(
        `Järelmaksuga müük omandireservatsiooniga: kogu ostuhinna käibemaks esitatakse sellel arvel (KMS § 2 lg 5, § 11 lg 1). Tasuda nüüd: sissemakse ${down} + käibemaks ${vat}. Ostuhinna jääk ${rest} tasutakse ${months} osamaksena lepingu nr ${contract} kohaselt; osamaksed ei sisalda käibemaksu. Sõiduki omand jääb müüjale, kuni ostuhind on täielikult tasutud (VÕS § 233). Sõiduk antakse üle, kui see arve on tasutud.`,
        `Instalment sale with retention of title: VAT on the whole price is invoiced on this invoice. Due now: down payment + VAT. The remainder is paid in ${months} instalments under contract ${contract}, without VAT. The seller retains ownership until the price is paid in full. The vehicle is handed over once this invoice is paid.`,
        EE_EINVOICE,
        EE_ISSUER,
      ),
    mailSubject: ({ number, seller, contract }) => `Arve ${number} · ${seller} · järelmaksuga müügi leping ${contract}`,
    mailText: (a) =>
      [
        'Tere,',
        '',
        `lisatud on järelmaksuga müügi esimene arve ${a.number} (leping ${a.contract}, ${a.what}). Arve esitaja: ${a.seller}.`,
        `Tasuda nüüd ${a.payNow} (sissemakse ja kogu ostuhinna käibemaks), maksetähtpäev ${a.due}.`,
        `Arvelduskonto (IBAN) ${a.iban}, viitenumber ${a.reference}.`,
        'Makse tehakse otse müüjale, mitte RAHTIS-teenusele ega Aivomaa Oy-le.',
        '',
        `Küsimused: vastake sellele kirjale (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is the first invoice ${a.number} of the instalment sale contract ${a.contract} (${a.what}) from ${a.seller}. Due now ${a.payNow} (down payment and VAT on the whole price), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Järelmaksuga müügi leping', 'Instalment sale contract'],
    periodLabel: ['Osamakse', 'Instalment'],
    line: ({ n, months, contract, what }) => `Osamakse ${n}/${months}, järelmaksuga müügi leping nr ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты — отдельной строкой: только так они вне налоговой базы (KMS § 12 lg 8) и освобождены (§ 16 lg 2¹ p 2). */
    interestLine:
      'Intress – maksuvaba finantsteenus (KMS § 16 lg 2¹ p 2), ei kuulu müügi maksustatava väärtuse hulka (KMS § 12 lg 8) / Interest, VAT-exempt financial service, outside the taxable amount of the sale',
    note: ({ firstNumber }) =>
      [
        `Osamakse ei sisalda käibemaksu: kogu ostuhinna käibemaks on esitatud arvel nr ${firstNumber}. / The instalment has no VAT: VAT on the whole price was invoiced on invoice ${firstNumber}.`,
        EE_EINVOICE,
        EE_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Arve · ${seller} · osamakse ${n}/${months}, leping ${contract}`,
    mailText: (a) =>
      [
        'Tere,',
        '',
        `lisatud on järelmaksuga müügi lepingu ${a.contract} osamakse ${a.n}/${a.months} arve (${a.what}).`,
        `Tasuda ${a.total}, maksetähtpäev ${a.due}. Arvelduskonto (IBAN) ${a.iban}.`,
        'Makse tehakse otse müüjale, mitte RAHTIS-teenusele ega Aivomaa Oy-le.',
        '',
        '—',
        `Attached is the invoice for instalment ${a.n}/${a.months} of instalment sale contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Arve / Invoice ${number} · viitenumber / reference ${reference}`,
  },
  credit: {
    linePrefix: 'Kreeditarve / Credit: ',
    job: ({ contract }) => `${contract} · tühistatud / cancelled`,
    periodLabel: ['Krediteeritav arve', 'Credited invoice'],
    title: 'KREEDITARVE / CREDIT NOTE',
    payNowLabel: ['Tagastatakse ostjale', 'Refunded to the buyer'],
    amountLabel: ['Tagastatakse', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `KREEDITARVE / CREDIT NOTE. Krediteerib täielikult arve nr ${original} (${originalDate}), sest järelmaksuga müük ${contract} tühistati enne sõiduki üleandmist (KMS § 29 lg 7). ${refund ? `Müüja tagastab ostjale tasutud summa ${refund}.` : 'Arvet ei olnud tasutud, seega tagastatavat summat ei ole.'} / Credits invoice ${original} in full because instalment sale ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        'Arve esitab müüja; RAHTIS (Aivomaa Oy) ei ole tehingu pool. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale.',
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Kreeditarve · ${seller} · arve ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Tere,',
        '',
        `lisatud on kreeditarve, mis krediteerib arve ${original}: järelmaksuga müük ${contract} tühistati enne üleandmist.`,
        '',
        '—',
        `Attached is a credit note crediting invoice ${original}: instalment sale ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
  notice: null,
};

/* ── Латвия ──────────────────────────────────────────────────────────── */

const LV_ISSUER =
  'Rēķinu izraksta pārdevējs; RAHTIS (Aivomaa Oy) nav darījuma puse un nepieņem maksājumus. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.';

const LV_LABELS: InvoiceLabels = {
  docName: 'Rēķins',
  creditDocName: 'Kredītrēķins',
  title: 'RĒĶINS / INVOICE',
  vatId: 'PVN reģ. Nr.',
  businessId: 'Reģ. Nr. / Reg. no.',
  customer: ['Pircējs', 'Customer'],
  number: ['Rēķina numurs', 'Invoice no.'],
  date: ['Rēķina datums', 'Invoice date'],
  due: ['Apmaksas termiņš', 'Due date'],
  job: ['Pirkuma priekšmets', 'Item sold'],
  period: ['Periods', 'Period'],
  colDate: 'Datums / Date',
  colText: 'Apraksts / Description',
  colQty: 'Skaits / Qty',
  colPrice: 'Cena / Unit',
  colAmount: 'Summa / Total',
  net: 'Summa bez PVN / Total excl. VAT',
  total: 'Kopā / Total',
  totalDue: 'Kopā apmaksai / Total due',
  iban: ['Konts (IBAN)', 'Bank account'],
  reference: ['Maksājuma atsauce', 'Reference'],
  amountDue: ['Apmaksai', 'Amount due'],
  footer: 'Dokuments sagatavots pakalpojumā RAHTIS',
};

const LV: InstallmentInvoiceTexts = {
  country: 'LV',
  intl: 'lv-LV',
  date: paddedDate,
  unit: 'gab.',
  labels: LV_LABELS,
  filePrefix: 'Rekins',
  vatLabel: (percent) => (percent ? `PVN / VAT ${percent} %` : 'PVN / VAT 0 %'),
  first: {
    line: ({ what, contract }) => `${what} – pirkuma maksa, nomaksas pirkuma līgums Nr. ${contract} / purchase price, instalment purchase contract`,
    jobLabel: ['Pirkuma priekšmets', 'Item sold'],
    periodLabel: ['Nodošana', 'Handover'],
    payNowLabel: ['Tagad maksājams', 'Due now'],
    note: ({ down, vat, rest, months, contract }) =>
      lines(
        `Nomaksas pirkums ar īpašuma tiesību paturēšanu (Pievienotās vērtības nodokļa likuma 1. panta 13. punkts): šajā rēķinā iekļauts PVN par visu pirkuma maksu. Tagad maksājams: pirmā iemaksa ${down} + PVN ${vat}. Pirkuma maksas atlikums ${rest} maksājams ${months} maksājumos saskaņā ar līgumu Nr. ${contract}; maksājumi neietver PVN. Īpašuma tiesības paliek pārdevējam līdz pilnīgai pirkuma maksas samaksai (Civillikuma 2069. pants). Transportlīdzekli nodod pēc šī rēķina samaksas.`,
        `Instalment purchase with retention of title: VAT on the whole price is invoiced on this invoice. Due now: first payment + VAT. The remainder is paid in ${months} instalments under contract ${contract}, without VAT. The seller retains ownership until the price is paid in full. The vehicle is handed over once this invoice is paid.`,
        LV_ISSUER,
      ),
    mailSubject: ({ number, seller, contract }) => `Rēķins ${number} · ${seller} · nomaksas pirkuma līgums ${contract}`,
    mailText: (a) =>
      [
        'Labdien!',
        '',
        `Pielikumā ir nomaksas pirkuma pirmais rēķins ${a.number} (līgums ${a.contract}, ${a.what}). Rēķina izrakstītājs: ${a.seller}.`,
        `Tagad maksājams ${a.payNow} (pirmā iemaksa un PVN par visu pirkuma maksu), apmaksas termiņš ${a.due}.`,
        `Konts (IBAN) ${a.iban}, maksājuma atsauce ${a.reference}.`,
        'Maksājums veicams tieši pārdevējam, nevis pakalpojumam RAHTIS vai Aivomaa Oy.',
        '',
        `Jautājumi: atbildiet uz šo vēstuli (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is the first invoice ${a.number} of the instalment purchase contract ${a.contract} (${a.what}) from ${a.seller}. Due now ${a.payNow} (first payment and VAT on the whole price), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Nomaksas pirkuma līgums', 'Instalment purchase contract'],
    periodLabel: ['Maksājums', 'Instalment'],
    line: ({ n, months, contract, what }) => `Maksājums ${n}/${months}, nomaksas pirkuma līgums Nr. ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты — отдельной строкой: база не включает kredītprocenti (PVN likums 34. p. 8. d.); разъяснения VID именно для движимого имущества нет (lv.md). */
    interestLine:
      'Kredītprocenti – nav iekļauti ar nodokli apliekamajā vērtībā (Pievienotās vērtības nodokļa likuma 34. panta astotā daļa, 52. panta pirmās daļas 21. punkta “a” apakšpunkts) / Credit interest, outside the taxable amount',
    note: ({ firstNumber }) =>
      [
        `Maksājums neietver PVN: PVN par visu pirkuma maksu iekļauts rēķinā Nr. ${firstNumber}. / The instalment has no VAT: VAT on the whole price was invoiced on invoice ${firstNumber}.`,
        LV_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Rēķins · ${seller} · maksājums ${n}/${months}, līgums ${contract}`,
    mailText: (a) =>
      [
        'Labdien!',
        '',
        `Pielikumā ir nomaksas pirkuma līguma ${a.contract} maksājuma ${a.n}/${a.months} dokuments (${a.what}).`,
        `Maksājams ${a.total}, apmaksas termiņš ${a.due}. Konts (IBAN) ${a.iban}.`,
        'Maksājums veicams tieši pārdevējam, nevis pakalpojumam RAHTIS vai Aivomaa Oy.',
        '',
        '—',
        `Attached is the document for instalment ${a.n}/${a.months} of instalment purchase contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Dokuments / Document ${number} · maksājuma atsauce / reference ${reference}`,
  },
  credit: {
    linePrefix: 'Kredītrēķins / Credit: ',
    job: ({ contract }) => `${contract} · atcelts / cancelled`,
    periodLabel: ['Kreditējamais rēķins', 'Credited invoice'],
    title: 'KREDĪTRĒĶINS / CREDIT NOTE',
    payNowLabel: ['Atmaksājams pircējam', 'Refunded to the buyer'],
    amountLabel: ['Atmaksājams', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `KREDĪTRĒĶINS / CREDIT NOTE. Pilnībā kreditē rēķinu Nr. ${original} (${originalDate}), jo nomaksas pirkums ${contract} atcelts pirms transportlīdzekļa nodošanas. ${refund ? `Pārdevējs atmaksā pircējam samaksāto summu ${refund}.` : 'Rēķins nebija samaksāts, tāpēc atmaksājamas summas nav.'} / Credits invoice ${original} in full because instalment purchase ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        'Rēķinu izraksta pārdevējs; RAHTIS (Aivomaa Oy) nav darījuma puse. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale.',
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Kredītrēķins · ${seller} · rēķins ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Labdien!',
        '',
        `Pielikumā ir kredītrēķins, kas kreditē rēķinu ${original}: nomaksas pirkums ${contract} atcelts pirms nodošanas.`,
        '',
        '—',
        `Attached is a credit note crediting invoice ${original}: instalment purchase ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
  notice: {
    /* Заголовок короткий: длинный не помещается рядом с названием продавца (проверено печатью). */
    title: 'MAKSĀJUMA PAZIŅOJUMS',
    labels: { number: ['Dokumenta numurs', 'Document no.'], date: ['Dokumenta datums', 'Date'] },
    docName: 'Maksājuma paziņojums',
    note:
      'Šis dokuments ir maksājuma paziņojums, nevis rēķins: no 2028. gada 1. janvāra rēķinu citam Latvijas uzņēmumam noformē kā strukturētu elektronisko rēķinu (Grāmatvedības likuma 11. panta četrpadsmitā daļa), un to pārdevējs izraksta savā grāmatvedības sistēmā. / This document is a payment notice, not an invoice: from 1 January 2028 an invoice to another Latvian company must be a structured electronic invoice, which the seller issues from its own accounting system.',
  },
};

/* ── Швеция ──────────────────────────────────────────────────────────── */

/*
 * Швеция (23.11.2026, docs/equipment-sale/countries/se.md). Первый счёт — как
 * в Финляндии: вся цена и весь НДС, к оплате сейчас kontantinsats (взнос и
 * НДС); основание — ML 5 kap. 3 § и 7 kap. 7 §. Счета взносов — без НДС.
 * Процентов в шведской сделке нет (их НДС не выяснен, кабинет ставку не
 * предлагает), поэтому строка процентов ничего не говорит о налоге: она
 * останется только на случай, если проценты когда-нибудь включат.
 * PDF — законный счёт при согласии получателя (ML 17 kap. 20 §); обязательных
 * электронных счетов между компаниями нет.
 * Ссылка платежа — международная RF: шведский OCR-номер и bankgiro требуют
 * договора продавца с банком, которого у платформы нет, — об этом сказано в
 * счёте, чтобы покупатель не искал OCR.
 */
const SE_ISSUER =
  'Fakturan utfärdas av säljaren; RAHTIS (Aivomaa Oy) är inte part i köpet och tar inte emot betalningen. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.';
const SE_PAYMENT =
  'Betalning görs till säljarens konto (IBAN) med betalningsreferensen som meddelande. Fakturan har inget OCR-nummer och inget bankgiro. / Pay to the seller’s account (IBAN) quoting the payment reference; this invoice has no OCR number or bankgiro.';

const SE_LABELS: InvoiceLabels = {
  docName: 'Faktura',
  creditDocName: 'Kreditnota',
  title: 'FAKTURA / INVOICE',
  vatId: 'Momsreg.nr',
  businessId: 'Organisationsnummer / Org. no.',
  customer: ['Köpare', 'Customer'],
  number: ['Fakturanummer', 'Invoice no.'],
  date: ['Fakturadatum', 'Invoice date'],
  due: ['Förfallodag', 'Due date'],
  job: ['Köpeobjekt', 'Item sold'],
  period: ['Period', 'Period'],
  colDate: 'Datum / Date',
  colText: 'Beskrivning / Description',
  colQty: 'Antal / Qty',
  colPrice: 'À-pris / Unit',
  colAmount: 'Belopp / Total',
  net: 'Summa exkl. moms / Total excl. VAT',
  total: 'Summa / Total',
  totalDue: 'Att betala / Total due',
  iban: ['Kontonummer (IBAN)', 'Bank account'],
  reference: ['Betalningsreferens', 'Reference'],
  amountDue: ['Att betala', 'Amount due'],
  footer: 'Fakturan är upprättad i tjänsten RAHTIS',
};

const isoDate = (iso: string) => iso;

const SE: InstallmentInvoiceTexts = {
  country: 'SE',
  intl: 'sv-SE',
  date: isoDate,
  unit: 'st',
  labels: SE_LABELS,
  filePrefix: 'Faktura',
  vatLabel: (percent) => (percent ? `Moms / VAT ${percent} %` : 'Moms / VAT 0 %'),
  first: {
    line: ({ what, contract }) => `${what} – pris, avtal om avbetalningsköp nr ${contract} / purchase price, instalment purchase contract`,
    jobLabel: ['Köpeobjekt', 'Item sold'],
    periodLabel: ['Utlämnande', 'Handover'],
    payNowLabel: ['Att betala nu', 'Due now'],
    note: ({ down, vat, rest, months, contract }) =>
      lines(
        `Avbetalningsköp med förbehåll om återtaganderätt (lagen (1978:599) om avbetalningsköp mellan näringsidkare m.fl.): mervärdesskatten på hela köpet faktureras med denna faktura (5 kap. 3 § andra stycket 2 och 7 kap. 7 § mervärdesskattelagen (2023:200)). Att betala nu (kontantinsats): ${down} av priset + mervärdesskatt ${vat}. Kreditbeloppet ${rest} betalas genom ${months} avbetalningar enligt avtal nr ${contract}; avbetalningarna innehåller ingen mervärdesskatt. Äganderätten övergår till köparen först när hela kreditfordran är betald. Fordonet lämnas ut när denna faktura är betald.`,
        `Instalment purchase with a reservation of the right to repossess: VAT on the whole price is invoiced on this invoice. Due now: down payment + VAT. The credited amount is paid in ${months} instalments under contract ${contract}, without VAT. Ownership passes to the buyer only when the whole credit claim is paid. The vehicle is handed over once this invoice is paid.`,
        SE_PAYMENT,
        SE_ISSUER,
      ),
    mailSubject: ({ number, seller, contract }) => `Faktura ${number} · ${seller} · avtal om avbetalningsköp ${contract}`,
    mailText: (a) =>
      [
        'Hej,',
        '',
        `bifogat finns den första fakturan ${a.number} för avbetalningsköpet (avtal ${a.contract}, ${a.what}). Fakturan utfärdas av: ${a.seller}.`,
        `Att betala nu ${a.payNow} (kontantinsats inklusive mervärdesskatten på hela köpet), förfallodag ${a.due}.`,
        `Kontonummer (IBAN) ${a.iban}, betalningsreferens ${a.reference}. Fakturan har inget OCR-nummer; ange referensen som meddelande.`,
        'Betalningen görs direkt till säljaren, inte till RAHTIS eller Aivomaa Oy.',
        '',
        `Frågor: svara på detta meddelande (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is the first invoice ${a.number} of the instalment purchase contract ${a.contract} (${a.what}) from ${a.seller}. Due now ${a.payNow} (down payment and VAT on the whole price), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Avtal om avbetalningsköp', 'Instalment purchase contract'],
    periodLabel: ['Avbetalning', 'Instalment'],
    line: ({ n, months, contract, what }) => `Avbetalning ${n}/${months}, avtal om avbetalningsköp nr ${contract} (${what}) / Instalment ${n}/${months}`,
    /* В шведской сделке процентов нет; строка без утверждений о налоге — НДС на проценты не выяснен (se.md, открытый вопрос 1). */
    interestLine: 'Ränta på kreditbeloppet enligt avtalets punkt 4.4 / Interest on the credited amount',
    note: ({ firstNumber }) =>
      [
        `Avbetalningen innehåller ingen mervärdesskatt: mervärdesskatten på hela köpet har fakturerats med faktura nr ${firstNumber}. / The instalment has no VAT: VAT on the whole price was invoiced on invoice ${firstNumber}.`,
        SE_PAYMENT,
        SE_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Faktura · ${seller} · avbetalning ${n}/${months}, avtal ${contract}`,
    mailText: (a) =>
      [
        'Hej,',
        '',
        `bifogat finns fakturan för avbetalning ${a.n}/${a.months} enligt avtal om avbetalningsköp ${a.contract} (${a.what}).`,
        `Att betala ${a.total}, förfallodag ${a.due}. Kontonummer (IBAN) ${a.iban}.`,
        'Betalningen görs direkt till säljaren, inte till RAHTIS eller Aivomaa Oy.',
        '',
        '—',
        `Attached is the invoice for instalment ${a.n}/${a.months} of instalment purchase contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Faktura / Invoice ${number} · betalningsreferens / reference ${reference}`,
  },
  credit: {
    linePrefix: 'Kreditering / Credit: ',
    job: ({ contract }) => `${contract} · hävt / cancelled`,
    periodLabel: ['Krediterad faktura', 'Credited invoice'],
    title: 'KREDITNOTA / CREDIT NOTE',
    payNowLabel: ['Återbetalas till köparen', 'Refunded to the buyer'],
    amountLabel: ['Återbetalas', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `KREDITNOTA / CREDIT NOTE. Krediterar faktura nr ${original} (${originalDate}) i sin helhet, eftersom avbetalningsköpet ${contract} hävdes före utlämnandet av fordonet (17 kap. 22 § mervärdesskattelagen). ${refund ? `Säljaren återbetalar det betalda beloppet ${refund} till köparen.` : 'Fakturan hade inte betalats, så inget återbetalas.'} / Credits invoice ${original} in full because instalment purchase ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        'Kreditnotan utfärdas av säljaren; RAHTIS (Aivomaa Oy) är inte part i köpet. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale.',
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Kreditnota · ${seller} · faktura ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Hej,',
        '',
        `bifogat finns en kreditnota som krediterar faktura ${original}: avbetalningsköpet ${contract} hävdes före utlämnandet.`,
        '',
        '—',
        `Attached is a credit note crediting invoice ${original}: instalment purchase ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
  notice: null,
};

/* ── Дания ───────────────────────────────────────────────────────────── */

/*
 * Дания (23.11.2026, docs/equipment-sale/countries/dk.md). Первый счёт — как
 * в Финляндии: вся цена и весь НДС, к оплате сейчас udbetaling (взнос и
 * НДС); основание — momsloven § 4, stk. 3, nr. 2 и § 23. Счета взносов — без
 * НДС; проценты — отдельной строкой с суммой: только при этом условии они
 * вне базы НДС (momsloven § 27, stk. 3, nr. 4).
 * Обязателен ли электронный счёт между компаниями, исследование по
 * первоисточнику не подтвердило (momsbekendtgørelsen не открыт): на каждом
 * счёте об этом сказано прямо, без обещания.
 * Ссылка платежа — международная RF: датская строка FI-kort (+71) требует
 * договора продавца с банком, которого у платформы нет.
 */
const DK_ISSUER =
  'Fakturaen udstedes af sælger; RAHTIS (Aivomaa Oy) er ikke part i handlen og modtager ikke betalingen. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.';
const DK_PAYMENT =
  'Betaling sker til sælgers konto (IBAN) med angivelse af betalingsreferencen. Fakturaen har ingen FI-betalingslinje (+71). / Pay to the seller’s account (IBAN) quoting the payment reference; this invoice has no FI payment line (+71).';
const DK_EINVOICE =
  'Fakturaen sendes som PDF. Om der gælder krav om elektronisk faktura mellem virksomheder, er ikke bekræftet af RAHTIS; afklar det med jeres revisor. / Sent as PDF. Whether an electronic invoice is required between companies has not been confirmed by RAHTIS; check with your accountant.';

const DK_LABELS: InvoiceLabels = {
  docName: 'Faktura',
  creditDocName: 'Kreditnota',
  title: 'FAKTURA / INVOICE',
  vatId: 'Momsnr.',
  businessId: 'CVR-nr. / Business ID',
  customer: ['Køber', 'Customer'],
  number: ['Fakturanummer', 'Invoice no.'],
  date: ['Fakturadato', 'Invoice date'],
  due: ['Forfaldsdato', 'Due date'],
  job: ['Købsgenstand', 'Item sold'],
  period: ['Periode', 'Period'],
  colDate: 'Dato / Date',
  colText: 'Beskrivelse / Description',
  colQty: 'Antal / Qty',
  colPrice: 'Enhedspris / Unit',
  colAmount: 'Beløb / Total',
  net: 'I alt ekskl. moms / Total excl. VAT',
  total: 'I alt / Total',
  totalDue: 'Til betaling / Total due',
  iban: ['Kontonummer (IBAN)', 'Bank account'],
  reference: ['Betalingsreference', 'Reference'],
  amountDue: ['Til betaling', 'Amount due'],
  footer: 'Fakturaen er udarbejdet i tjenesten RAHTIS',
};

const DK: InstallmentInvoiceTexts = {
  country: 'DK',
  intl: 'da-DK',
  date: paddedDate,
  unit: 'stk.',
  labels: DK_LABELS,
  filePrefix: 'Faktura',
  vatLabel: (percent) => (percent ? `Moms / VAT ${percent} %` : 'Moms / VAT 0 %'),
  first: {
    line: ({ what, contract }) => `${what} – købesum, købekontrakt med ejendomsforbehold nr. ${contract} / purchase price, contract with retention of title`,
    jobLabel: ['Købsgenstand', 'Item sold'],
    periodLabel: ['Overgivelse', 'Handover'],
    payNowLabel: ['Til betaling nu', 'Due now'],
    note: ({ down, vat, rest, months, contract }) =>
      lines(
        `Kreditkøb med ejendomsforbehold (lov om kreditaftaler): momsen af hele købesummen faktureres med denne faktura (momslovens § 4, stk. 3, nr. 2, og § 23). Til betaling nu (udbetaling): ${down} af købesummen + moms ${vat}. Restkøbesummen ${rest} betales i ${months} afdrag efter købekontrakt nr. ${contract}; afdragene indeholder ikke moms. Sælger forbeholder sig ejendomsretten, indtil hele købesummen med renter og omkostninger er betalt. Køretøjet overgives, når denne faktura er betalt, og ejendomsforbeholdet er anmeldt til tinglysning i bilbogen.`,
        `Credit purchase with retention of title: VAT on the whole price is invoiced on this invoice. Due now: down payment + VAT. The remainder is paid in ${months} instalments under contract ${contract}, without VAT. The seller retains ownership until the price with interest and costs is paid in full. The vehicle is handed over once this invoice is paid and the retention of title has been filed for registration in the Bilbogen.`,
        DK_EINVOICE,
        DK_PAYMENT,
        DK_ISSUER,
      ),
    mailSubject: ({ number, seller, contract }) => `Faktura ${number} · ${seller} · købekontrakt ${contract}`,
    mailText: (a) =>
      [
        'Hej,',
        '',
        `vedhæftet er den første faktura ${a.number} for kreditkøbet (købekontrakt ${a.contract}, ${a.what}). Fakturaen udstedes af: ${a.seller}.`,
        `Til betaling nu ${a.payNow} (udbetaling inklusive momsen af hele købesummen), forfaldsdato ${a.due}.`,
        `Kontonummer (IBAN) ${a.iban}, betalingsreference ${a.reference}. Fakturaen har ingen FI-betalingslinje; angiv referencen ved betalingen.`,
        'Betalingen sker direkte til sælger, ikke til RAHTIS eller Aivomaa Oy.',
        '',
        `Spørgsmål: svar på denne mail (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is the first invoice ${a.number} of the purchase contract with retention of title ${a.contract} (${a.what}) from ${a.seller}. Due now ${a.payNow} (down payment and VAT on the whole price), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Købekontrakt med ejendomsforbehold', 'Contract with retention of title'],
    periodLabel: ['Afdrag', 'Instalment'],
    line: ({ n, months, contract, what }) => `Afdrag ${n}/${months}, købekontrakt nr. ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты — отдельной строкой с суммой: условие, при котором они вне базы НДС (momsloven § 27, stk. 3, nr. 4). */
    interestLine:
      'Rente af den til enhver tid skyldige del af købesummen – indgår ikke i momsgrundlaget (momslovens § 27, stk. 3, nr. 4) / Interest on the outstanding part of the price, outside the VAT base',
    note: ({ firstNumber }) =>
      [
        `Afdraget indeholder ikke moms: momsen af hele købesummen er faktureret med faktura nr. ${firstNumber}. / The instalment has no VAT: VAT on the whole price was invoiced on invoice ${firstNumber}.`,
        DK_EINVOICE,
        DK_PAYMENT,
        DK_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Faktura · ${seller} · afdrag ${n}/${months}, købekontrakt ${contract}`,
    mailText: (a) =>
      [
        'Hej,',
        '',
        `vedhæftet er fakturaen for afdrag ${a.n}/${a.months} efter købekontrakt ${a.contract} (${a.what}).`,
        `Til betaling ${a.total}, forfaldsdato ${a.due}. Kontonummer (IBAN) ${a.iban}.`,
        'Betalingen sker direkte til sælger, ikke til RAHTIS eller Aivomaa Oy.',
        '',
        '—',
        `Attached is the invoice for instalment ${a.n}/${a.months} of purchase contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Faktura / Invoice ${number} · betalingsreference / reference ${reference}`,
  },
  credit: {
    linePrefix: 'Kreditering / Credit: ',
    job: ({ contract }) => `${contract} · annulleret / cancelled`,
    periodLabel: ['Krediteret faktura', 'Credited invoice'],
    title: 'KREDITNOTA / CREDIT NOTE',
    payNowLabel: ['Tilbagebetales til køber', 'Refunded to the buyer'],
    amountLabel: ['Tilbagebetales', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `KREDITNOTA / CREDIT NOTE. Krediterer faktura nr. ${original} (${originalDate}) fuldt ud, fordi kreditkøbet ${contract} blev annulleret før overgivelsen af køretøjet. ${refund ? `Sælger tilbagebetaler det betalte beløb ${refund} til køber.` : 'Fakturaen var ikke betalt, så der tilbagebetales intet.'} / Credits invoice ${original} in full because credit purchase ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        'Kreditnotaen udstedes af sælger; RAHTIS (Aivomaa Oy) er ikke part i handlen. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale.',
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Kreditnota · ${seller} · faktura ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Hej,',
        '',
        `vedhæftet er en kreditnota, der krediterer faktura ${original}: kreditkøbet ${contract} blev annulleret før overgivelsen.`,
        '',
        '—',
        `Attached is a credit note crediting invoice ${original}: credit purchase ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
  notice: null,
};

/* ── Литва ───────────────────────────────────────────────────────────── */

/*
 * Литва (23.11.2026, docs/equipment-sale/countries/lt.md). НДС со всей цены
 * возникает при передаче машины (PVMĮ 4 str. 2 d., 14 str. 5 d.), аванс до
 * передачи НДС не облагается (14 str. 4 d.). Поэтому:
 *   · до передачи — išankstinio mokėjimo sąskaita (предварительный счёт, не
 *     счёт-фактура): взнос и сумма, равная НДС всей цены, одной строкой, без
 *     строк НДС. Называть его «счёт-фактура с НДС» нельзя (lt.md, шаг 3);
 *   · в день передачи — PVM sąskaita faktūra на всю цену с НДС 21 %, с зачётом
 *     полученного аванса; платить по ней нечего;
 *   · каждый месяц — mokėjimo pranešimas (платёжное требование), не счёт и без
 *     НДС; проценты отдельной строкой как освобождённый кредит (PVMĮ 28 str.
 *     1 d.; позиция VMI не подтверждена — так и написано в кабинете);
 *   · отмена до передачи — аннулирование предварительного счёта: счёта с НДС
 *     ещё не было, кредитный документ (PVMĮ 83 str.) не нужен.
 * Обязательных электронных счетов между компаниями нет: PDF — законный документ.
 * Даты — «ГГГГ-ММ-ДД», как их пишут в Литве (lt.md, 3.12).
 */
const LT_ISSUER =
  'Dokumentą išrašo pardavėjas; RAHTIS (Aivomaa Oy) nėra sandorio šalis ir mokėjimų nepriima. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.';

const LT_LABELS: InvoiceLabels = {
  docName: 'PVM sąskaita faktūra',
  creditDocName: 'Kreditinė PVM sąskaita faktūra',
  /* Заголовки и подписи итога — короткие: длинные налезают на соседний текст (проверено печатью 23.11.2026). */
  title: 'PVM SĄSKAITA FAKTŪRA',
  vatId: 'PVM kodas',
  businessId: 'Įmonės kodas',
  customer: ['Pirkėjas', 'Customer'],
  number: ['Sąskaitos numeris', 'Invoice no.'],
  date: ['Išrašymo data', 'Invoice date'],
  due: ['Apmokėti iki', 'Due date'],
  job: ['Pirkimo objektas', 'Item sold'],
  period: ['Laikotarpis', 'Period'],
  colDate: 'Data / Date',
  colText: 'Aprašymas / Description',
  colQty: 'Kiekis / Qty',
  colPrice: 'Kaina / Unit',
  colAmount: 'Suma / Total',
  net: 'Suma be PVM / Total excl. VAT',
  total: 'Iš viso / Total',
  totalDue: 'Iš viso mokėti / Total due',
  iban: ['Sąskaitos numeris (IBAN)', 'Bank account'],
  reference: ['Mokėjimo nuoroda', 'Reference'],
  amountDue: ['Mokėti', 'Amount due'],
  footer: 'Dokumentas parengtas RAHTIS paslaugoje',
};

/* Подписи документа, который не счёт: номер и дата документа. */
const LT_DOC_LABELS: Partial<InvoiceLabels> = { number: ['Dokumento numeris', 'Document no.'], date: ['Dokumento data', 'Date'] };

const LT_CANCEL: CreditTexts & PlainDocTexts & { number: NumberOf } = {
  title: 'SĄSKAITOS ANULIAVIMAS',
  docName: 'Išankstinio mokėjimo sąskaitos anuliavimas',
  labels: LT_DOC_LABELS,
  noVat: true,
  number: ({ original }) => `${original}-ANUL`,
  linePrefix: 'Anuliuojama / Cancelled: ',
  job: ({ contract }) => `${contract} · nutraukta / cancelled`,
  periodLabel: ['Anuliuojamas dokumentas', 'Cancelled document'],
  payNowLabel: ['Grąžinama', 'Refund'],
  amountLabel: ['Grąžinama', 'Refund'],
  note: ({ original, originalDate, contract, refund }) =>
    [
      `Anuliuojama išankstinio mokėjimo sąskaita Nr. ${original} (${originalDate}), nes pirkimo–pardavimo išsimokėtinai sandoris ${contract} nutrauktas iki transporto priemonės perdavimo. PVM sąskaita faktūra nebuvo išrašyta, todėl kreditinis dokumentas nereikalingas. ${refund ? `Pardavėjas grąžina pirkėjui sumokėtą sumą ${refund}.` : 'Dokumentas nebuvo apmokėtas, grąžinti nėra ko.'} / Cancels pro forma ${original} because instalment sale ${contract} was cancelled before handover; no VAT invoice had been issued. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'It was not paid, so nothing is refunded.'}`,
      LT_ISSUER,
    ].join('\n'),
  mailSubject: ({ seller, original }) => `Išankstinio mokėjimo sąskaitos anuliavimas · ${seller} · ${original}`,
  mailText: ({ original, contract }) =>
    [
      'Laba diena,',
      '',
      `pridedame išankstinio mokėjimo sąskaitos ${original} anuliavimą: sandoris ${contract} nutrauktas iki transporto priemonės perdavimo.`,
      '',
      '—',
      `Attached is the cancellation of pro forma ${original}: sale ${contract} was cancelled before handover.`,
    ].join('\n'),
};

const LT: InstallmentInvoiceTexts = {
  country: 'LT',
  intl: 'lt-LT',
  date: isoDate,
  unit: 'vnt.',
  labels: LT_LABELS,
  filePrefix: 'Dokumentas',
  vatLabel: (percent) => (percent ? `PVM / VAT ${percent} %` : 'PVM / VAT 0 %'),
  first: {
    /* Первый документ Литвы — всегда предварительный счёт (proforma.line); эта строка для единообразия типа. */
    line: ({ what, contract }) => `${what} – pradinė įmoka, pirkimo–pardavimo išsimokėtinai sutartis Nr. ${contract} / down payment, instalment sale contract`,
    jobLabel: ['Pirkimo objektas', 'Item sold'],
    periodLabel: ['Perdavimas', 'Handover'],
    payNowLabel: ['Mokėti dabar', 'Due now'],
    note: ({ down, vat, rest, months, contract }) =>
      lines(
        `Tai išankstinio mokėjimo sąskaita, o ne PVM sąskaita faktūra. Iki transporto priemonės perdavimo mokama pradinė įmoka ${down} ir suma, lygi visos Kainos PVM sumai ${vat} (sutarties 4.2 punktas). PVM sąskaitą faktūrą visai Kainai pardavėjas išrašo transporto priemonės perdavimo dieną (Pridėtinės vertės mokesčio įstatymo 4 straipsnio 2 dalis ir 14 straipsnio 5 dalis); joje įskaitoma pagal šį dokumentą gauta suma. Likusi Kainos dalis ${rest} mokama ${months} periodinėmis įmokomis be PVM pagal sutartį Nr. ${contract}. Nuosavybės teisė lieka pardavėjui, kol visiškai sumokama Kaina (Civilinio kodekso 6.411 straipsnis). Transporto priemonė perduodama, kai šis dokumentas apmokėtas.`,
        `This is a pro forma invoice, not a VAT invoice. Due before handover: the down payment plus an amount equal to the VAT on the whole price. The seller issues the VAT invoice for the whole price on the day of handover and sets off this payment against it. The remainder is paid in ${months} instalments under contract ${contract}, without VAT. The seller retains ownership until the price is paid in full. The vehicle is handed over once this document is paid.`,
        LT_ISSUER,
      ),
    mailSubject: ({ number, seller, contract }) => `Išankstinio mokėjimo sąskaita ${number} · ${seller} · sutartis ${contract}`,
    mailText: (a) =>
      [
        'Laba diena,',
        '',
        `pridedame pirkimo–pardavimo išsimokėtinai išankstinio mokėjimo sąskaitą ${a.number} (sutartis ${a.contract}, ${a.what}). Dokumentą išrašė: ${a.seller}.`,
        `Mokėti iki perdavimo ${a.payNow} (pradinė įmoka ir suma, lygi visos Kainos PVM), terminas ${a.due}. PVM sąskaitą faktūrą pardavėjas išrašys perdavimo dieną.`,
        `Sąskaitos numeris (IBAN) ${a.iban}, mokėjimo nuoroda ${a.reference}.`,
        'Mokama tiesiogiai pardavėjui, ne RAHTIS ir ne Aivomaa Oy.',
        '',
        `Klausimai: atsakykite į šį laišką (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is the pro forma invoice ${a.number} of the instalment sale contract ${a.contract} (${a.what}) from ${a.seller}. Due before handover ${a.payNow} (down payment plus an amount equal to the VAT on the whole price), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. The seller issues the VAT invoice on the day of handover. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Pirkimo–pardavimo išsimokėtinai sutartis', 'Instalment sale contract'],
    periodLabel: ['Periodinė įmoka', 'Instalment'],
    line: ({ n, months, contract, what }) => `Periodinė įmoka ${n}/${months}, sutartis Nr. ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты — отдельной строкой, как освобождённый кредит (PVMĮ 28 str. 1 d.); позиция VMI не подтверждена (lt.md, 3.6). */
    interestLine: 'Palūkanos už išsimokėjimą – PVM neapmokestinama (Pridėtinės vertės mokesčio įstatymo 28 straipsnio 1 dalis) / Interest, VAT-exempt credit',
    note: ({ firstNumber }) =>
      [
        `Tai mokėjimo pranešimas, o ne PVM sąskaita faktūra. Periodinė įmoka PVM neapima: visos Kainos PVM nurodytas PVM sąskaitoje faktūroje Nr. ${firstNumber}, išrašytoje perdavimo dieną (sutarties 4.3 punktas). / This is a payment request, not a VAT invoice. The instalment has no VAT: VAT on the whole price was invoiced on VAT invoice ${firstNumber}, issued on the day of handover.`,
        LT_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Mokėjimo pranešimas · ${seller} · įmoka ${n}/${months}, sutartis ${contract}`,
    mailText: (a) =>
      [
        'Laba diena,',
        '',
        `pridedame pirkimo–pardavimo išsimokėtinai sutarties ${a.contract} periodinės įmokos ${a.n}/${a.months} mokėjimo pranešimą (${a.what}).`,
        `Mokėti ${a.total}, terminas ${a.due}. Sąskaitos numeris (IBAN) ${a.iban}.`,
        'Mokama tiesiogiai pardavėjui, ne RAHTIS ir ne Aivomaa Oy.',
        '',
        '—',
        `Attached is the payment request for instalment ${a.n}/${a.months} of instalment sale contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Dokumentas / Document ${number} · mokėjimo nuoroda / reference ${reference}`,
  },
  credit: LT_CANCEL,
  notice: null,
  proforma: {
    title: 'IŠANKSTINĖ SĄSKAITA',
    docName: 'Išankstinio mokėjimo sąskaita',
    labels: LT_DOC_LABELS,
    noVat: true,
    number: ({ contract }) => `IS-${contract}`,
    line: ({ what, contract }) =>
      `${what} – pradinė įmoka su suma, lygia visos Kainos PVM, pirkimo–pardavimo išsimokėtinai sutartis Nr. ${contract} / down payment incl. an amount equal to the VAT on the whole price`,
  },
  handover: {
    line: ({ what, contract }) => `${what} – Kaina, pirkimo–pardavimo išsimokėtinai sutartis Nr. ${contract} / purchase price, instalment sale contract`,
    note: ({ proforma, advance, vat, rest, months, contract }) =>
      lines(
        `PVM sąskaita faktūra išrašyta transporto priemonės perdavimo dieną: prievolė apskaičiuoti PVM visai Kainai atsiranda perduodant transporto priemonę (Pridėtinės vertės mokesčio įstatymo 4 straipsnio 2 dalis ir 14 straipsnio 5 dalis). Įskaityta pagal išankstinio mokėjimo sąskaitą Nr. ${proforma} gauta pradinė įmoka ${advance}, kuri apima visą PVM sumą ${vat}. Likusi Kainos dalis ${rest} mokama ${months} periodinėmis įmokomis be PVM pagal sutartį Nr. ${contract}; pagal šią sąskaitą dabar mokėti nereikia. Nuosavybės teisė lieka pardavėjui, kol visiškai sumokama Kaina.`,
        `VAT invoice issued on the day of handover, when VAT on the whole price becomes chargeable. The down payment of ${advance} received under pro forma ${proforma}, which includes the whole VAT, is set off. The remainder is paid in ${months} instalments under contract ${contract}, without VAT; nothing is due on this invoice now. The seller retains ownership until the price is paid in full.`,
        LT_ISSUER,
      ),
    payNowLabel: ['Mokėti dabar', 'Due now'],
    amountLabel: ['Mokėti', 'Amount due'],
    mailSubject: ({ seller, contract }) => `PVM sąskaita faktūra · ${seller} · sutartis ${contract}`,
    mailText: (a) =>
      [
        'Laba diena,',
        '',
        `pridedame PVM sąskaitą faktūrą visai Kainai pagal pirkimo–pardavimo išsimokėtinai sutartį ${a.contract} (${a.what}). Ji išrašyta transporto priemonės perdavimo dieną; joje įskaityta jau sumokėta pradinė įmoka, todėl dabar mokėti nereikia. Dokumentą išrašė: ${a.seller}.`,
        '',
        '—',
        `Attached is the VAT invoice for the whole price under instalment sale contract ${a.contract} (${a.what}), issued on the day of handover. The down payment already received is set off; nothing is due now.`,
      ].join('\n'),
  },
  paymentDoc: {
    title: 'MOKĖJIMO PRANEŠIMAS',
    docName: 'Mokėjimo pranešimas',
    labels: LT_DOC_LABELS,
    noVat: true,
    number: ({ contract, n }) => `MP-${contract}-${String(n ?? 0).padStart(2, '0')}`,
  },
  cancel: LT_CANCEL,
};

/* ── Германия ────────────────────────────────────────────────────────── */

/*
 * Германия (23.11.2026, docs/equipment-sale/countries/de.md). Первый счёт —
 * как в Финляндии: вся цена с USt 19 %, к оплате до передачи — Anzahlung со
 * всем НДС (§ 13 Abs. 1 Nr. 1 Buchst. a UStG; договор п. 4.2). Счёт от имени
 * продавца (§ 14 Abs. 2 Satz 7 UStG).
 * E-Rechnung: PDF — счёт только с согласия получателя (в договоре, п. 4.2) и
 * только за обороты до 31.12.2026 (§ 27 Abs. 38 UStG); продавцу с оборотом до
 * 800 000 € — до 31.12.2027, но оборот платформе неизвестен, поэтому для всех
 * ранняя дата. С 01.01.2027 (документ выставлен или машина передаётся с этого
 * дня) — Zahlungsinformation без НДС, а E-Rechnung (XRechnung, ZUGFeRD)
 * продавец выставляет в своей бухгалтерии (documentKind).
 * Ежемесячно — Zahlungsaufforderung: не счёт по § 14 UStG и без НДС (повторный
 * показ налога — § 14c UStG, норма в исследовании не прочитана: осторожный
 * вариант). Проценты — отдельной строкой «steuerfrei nach § 4 Nr. 8 Buchst. a
 * UStG»: только при отдельном соглашении с годовой ставкой (договор п. 4.4);
 * условия UStAE 3.11 не подтверждены — так сказано в кабинете.
 * Отмена до передачи: счёт — Rechnungskorrektur (Storno) по § 17 UStG, слово
 * «Gutschrift» не используется (в UStG это счёт покупателя); платёжная
 * информация — просто отменяется.
 */
const DE_ISSUER =
  'Erstellt im Namen und für Rechnung des Verkäufers (§ 14 Abs. 2 Satz 7 UStG); RAHTIS (Aivomaa Oy) ist nicht Partei des Kaufs und nimmt keine Zahlungen entgegen. / Issued in the name and on behalf of the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.';
const DE_PDF =
  'Diese Rechnung wird mit Zustimmung des Käufers (Vertrag Ziffer 4.2) als PDF übermittelt; das ist nach § 27 Abs. 38 UStG nur bis 31.12.2026 zulässig. Ab 01.01.2027 stellt der Verkäufer Rechnungen als E-Rechnung (XRechnung oder ZUGFeRD) aus seiner eigenen Buchhaltung aus. / Sent as PDF with the buyer’s consent (contract clause 4.2), permitted only until 31 December 2026; from 1 January 2027 the seller issues e-invoices (XRechnung or ZUGFeRD) from its own accounting software.';

const DE_LABELS: InvoiceLabels = {
  docName: 'Rechnung',
  creditDocName: 'Rechnungskorrektur',
  title: 'RECHNUNG / INVOICE',
  vatId: 'USt-IdNr.',
  businessId: 'Kennnummer',
  customer: ['Käufer', 'Customer'],
  number: ['Rechnungsnummer', 'Invoice no.'],
  date: ['Rechnungsdatum', 'Invoice date'],
  due: ['Fällig am', 'Due date'],
  job: ['Kaufgegenstand', 'Item sold'],
  period: ['Zeitraum', 'Period'],
  colDate: 'Datum / Date',
  colText: 'Beschreibung / Description',
  colQty: 'Menge / Qty',
  colPrice: 'Einzelpreis / Unit',
  colAmount: 'Betrag / Total',
  net: 'Summe netto / Total excl. VAT',
  total: 'Summe / Total',
  totalDue: 'Zu zahlen / Total due',
  iban: ['Bankverbindung (IBAN)', 'Bank account'],
  reference: ['Verwendungszweck', 'Reference'],
  amountDue: ['Zu zahlen', 'Amount due'],
  footer: 'Erstellt im Dienst RAHTIS',
};

const DE_DOC_LABELS: Partial<InvoiceLabels> = { number: ['Dokumentnummer', 'Document no.'], date: ['Datum', 'Date'] };

const DE: InstallmentInvoiceTexts = {
  country: 'DE',
  intl: 'de-DE',
  date: paddedDate,
  unit: 'Stk.',
  labels: DE_LABELS,
  filePrefix: 'Rechnung',
  vatLabel: (percent) => (percent ? `USt / VAT ${percent} %` : 'USt / VAT 0 %'),
  first: {
    line: ({ what, contract }) => `${what} – Kaufpreis, Kaufvertrag mit Ratenzahlung und Eigentumsvorbehalt Nr. ${contract} / purchase price, instalment sale contract`,
    jobLabel: ['Kaufgegenstand', 'Item sold'],
    periodLabel: ['Lieferung (Übergabe)', 'Delivery (handover)'],
    payNowLabel: ['Vor Übergabe zu zahlen', 'Due now'],
    note: ({ down, vat, rest, months, contract }) =>
      lines(
        `Kauf mit Ratenzahlung und Eigentumsvorbehalt (§ 449 BGB): Diese Rechnung umfasst den gesamten Kaufpreis mit gesondertem Ausweis der Umsatzsteuer (Vertrag Ziffer 4.2). Vor der Übergabe zu zahlen: Anzahlung ${down} zuzüglich der gesamten Umsatzsteuer ${vat}. Der Restkaufpreis ${rest} wird in ${months} Raten nach Vertrag Nr. ${contract} gezahlt; die Raten enthalten keine Umsatzsteuer. Die Lieferung wird mit der Übergabe des Fahrzeugs ausgeführt. Das Eigentum bleibt bis zur vollständigen Zahlung beim Verkäufer.`,
        `Instalment sale with retention of title: this invoice covers the whole price with VAT shown separately. Due before handover: down payment plus the whole VAT. The remainder is paid in ${months} instalments under contract ${contract}, without VAT. The supply takes place on handover; the seller retains ownership until the price is paid in full.`,
        DE_PDF,
        DE_ISSUER,
      ),
    mailSubject: ({ number, seller, contract }) => `Rechnung ${number} · ${seller} · Kaufvertrag ${contract}`,
    mailText: (a) =>
      [
        'Guten Tag,',
        '',
        `anbei die Rechnung ${a.number} zum Kaufvertrag mit Ratenzahlung ${a.contract} (${a.what}). Rechnungsaussteller: ${a.seller}.`,
        `Vor der Übergabe zu zahlen: ${a.payNow} (Anzahlung und die gesamte Umsatzsteuer des Kaufs), fällig am ${a.due}.`,
        `Bankverbindung (IBAN) ${a.iban}, Verwendungszweck ${a.reference}.`,
        'Die Zahlung geht direkt an den Verkäufer, nicht an RAHTIS oder die Aivomaa Oy.',
        '',
        `Fragen: Antworten Sie auf diese E-Mail (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is invoice ${a.number} for instalment sale contract ${a.contract} (${a.what}) from ${a.seller}. Due before handover ${a.payNow} (down payment and the whole VAT), due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
  },
  payment: {
    jobLabel: ['Kaufvertrag mit Ratenzahlung', 'Instalment sale contract'],
    periodLabel: ['Rate', 'Instalment'],
    line: ({ n, months, contract, what }) => `Rate ${n}/${months}, Kaufvertrag Nr. ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты — отдельной строкой: освобождение § 4 Nr. 8 Buchst. a UStG только при отдельном соглашении (договор п. 4.4). */
    interestLine: 'Zinsen nach Ziffer 4.4 des Vertrags – steuerfrei nach § 4 Nr. 8 Buchst. a UStG / Interest, VAT-exempt credit',
    note: ({ firstNumber }) =>
      [
        `Diese Zahlungsaufforderung ist keine Rechnung im Sinne des § 14 UStG und weist keine Umsatzsteuer aus: Die gesamte Umsatzsteuer des Kaufs ist ${firstNumber ? `mit der Rechnung Nr. ${firstNumber}` : 'mit der Rechnung des Verkäufers über den gesamten Kaufpreis'} berechnet (Vertrag Ziffer 4.3). / This payment request is not an invoice and shows no VAT: the whole VAT of the sale was charged ${firstNumber ? `on invoice ${firstNumber}` : 'on the seller’s invoice for the whole price'}.`,
        DE_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Zahlungsaufforderung · ${seller} · Rate ${n}/${months}, Vertrag ${contract}`,
    mailText: (a) =>
      [
        'Guten Tag,',
        '',
        `anbei die Zahlungsaufforderung für die Rate ${a.n}/${a.months} aus dem Kaufvertrag mit Ratenzahlung ${a.contract} (${a.what}).`,
        `Zu zahlen ${a.total}, fällig am ${a.due}. Bankverbindung (IBAN) ${a.iban}.`,
        'Die Zahlung geht direkt an den Verkäufer, nicht an RAHTIS oder die Aivomaa Oy.',
        '',
        '—',
        `Attached is the payment request for instalment ${a.n}/${a.months} of instalment sale contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Dokument / Document ${number} · Verwendungszweck / reference ${reference}`,
  },
  credit: {
    linePrefix: 'Storno / Credit: ',
    job: ({ contract }) => `${contract} · storniert / cancelled`,
    periodLabel: ['Berichtigte Rechnung', 'Corrected invoice'],
    title: 'RECHNUNGSKORREKTUR',
    payNowLabel: ['Rückzahlung', 'Refund'],
    amountLabel: ['Rückzahlung', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `RECHNUNGSKORREKTUR / CREDIT NOTE. Storniert die Rechnung Nr. ${original} vom ${originalDate} vollständig, weil der Kauf ${contract} vor der Übergabe des Fahrzeugs aufgehoben wurde; die Umsatzsteuer wird nach § 17 UStG berichtigt. ${refund ? `Der Verkäufer zahlt dem Käufer den gezahlten Betrag von ${refund} zurück.` : 'Die Rechnung war nicht bezahlt; es wird nichts zurückgezahlt.'} / Cancels invoice ${original} in full because sale ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'The invoice was not paid, so nothing is refunded.'}`,
        DE_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Rechnungskorrektur · ${seller} · Rechnung ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Guten Tag,',
        '',
        `anbei die Rechnungskorrektur (Storno) zur Rechnung ${original}: Der Kauf ${contract} wurde vor der Übergabe aufgehoben.`,
        '',
        '—',
        `Attached is a credit note cancelling invoice ${original}: sale ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
  notice: {
    title: 'ZAHLUNGSINFORMATION',
    docName: 'Zahlungsinformation',
    labels: DE_DOC_LABELS,
    noVat: true,
    filePrefix: 'Zahlungsinformation',
    firstMailSubject: ({ number, seller, contract }) => `Zahlungsinformation ${number} · ${seller} · Kaufvertrag ${contract}`,
    firstMailText: (a) =>
      [
        'Guten Tag,',
        '',
        `anbei die Zahlungsinformation ${a.number} zum Kaufvertrag mit Ratenzahlung ${a.contract} (${a.what}) von ${a.seller}. Sie ist keine Rechnung: Die E-Rechnung über den gesamten Kaufpreis stellt der Verkäufer aus seiner eigenen Buchhaltung aus.`,
        `Vor der Übergabe zu zahlen: ${a.payNow} (Anzahlung und ein Betrag in Höhe der gesamten Umsatzsteuer des Kaufs), fällig am ${a.due}.`,
        `Bankverbindung (IBAN) ${a.iban}, Verwendungszweck ${a.reference}.`,
        'Die Zahlung geht direkt an den Verkäufer, nicht an RAHTIS oder die Aivomaa Oy.',
        '',
        `Fragen: Antworten Sie auf diese E-Mail (${a.sellerEmail}).`,
        '',
        '—',
        `Attached is payment information ${a.number} for instalment sale contract ${a.contract} (${a.what}) from ${a.seller}. It is not an invoice: the seller issues the e-invoice from its own accounting software. Due before handover ${a.payNow}, due date ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy.`,
      ].join('\n'),
    note: 'Dieses Dokument ist keine Rechnung im Sinne des § 14 UStG und weist keine Umsatzsteuer aus: Ab 01.01.2027 ist eine Rechnung an ein anderes inländisches Unternehmen als E-Rechnung (XRechnung oder ZUGFeRD) auszustellen (§ 14 Abs. 1 und § 27 Abs. 38 UStG). Die Rechnung über den gesamten Kaufpreis mit Umsatzsteuer stellt der Verkäufer aus seiner eigenen Buchhaltung aus. / This document is not an invoice and shows no VAT: from 1 January 2027 an invoice to another German business must be an e-invoice (XRechnung or ZUGFeRD), which the seller issues from its own accounting software.',
    firstLine: ({ what, contract }) =>
      `${what} – Anzahlung einschließlich eines Betrags in Höhe der gesamten Umsatzsteuer des Kaufs, Kaufvertrag Nr. ${contract} / down payment incl. an amount equal to the whole VAT`,
    firstNote: ({ down, vat, rest, months, contract }) =>
      lines(
        `Vor der Übergabe zu zahlen: Anzahlung ${down} zuzüglich eines Betrags in Höhe der gesamten Umsatzsteuer des Kaufs ${vat} (Vertrag Ziffer 4.2). Der Restkaufpreis ${rest} wird in ${months} Raten nach Vertrag Nr. ${contract} ohne Umsatzsteuer gezahlt. Das Eigentum bleibt bis zur vollständigen Zahlung beim Verkäufer.`,
        `Due before handover: down payment plus an amount equal to the whole VAT of the sale. The remainder is paid in ${months} instalments under contract ${contract}. The seller retains ownership until the price is paid in full.`,
        DE_ISSUER,
      ),
  },
  paymentDoc: {
    title: 'ZAHLUNGSAUFFORDERUNG',
    docName: 'Zahlungsaufforderung',
    labels: DE_DOC_LABELS,
    noVat: true,
    filePrefix: 'Zahlungsaufforderung',
    number: ({ contract, n }) => `ZA-${contract}-${String(n ?? 0).padStart(2, '0')}`,
  },
  cancel: {
    title: 'STORNIERUNG',
    docName: 'Stornierung',
    labels: DE_DOC_LABELS,
    noVat: true,
    filePrefix: 'Stornierung',
    number: ({ original }) => `${original}-STORNO`,
    linePrefix: 'Storniert / Cancelled: ',
    job: ({ contract }) => `${contract} · storniert / cancelled`,
    periodLabel: ['Stornierte Zahlungsinformation', 'Cancelled document'],
    payNowLabel: ['Rückzahlung', 'Refund'],
    amountLabel: ['Rückzahlung', 'Refund'],
    note: ({ original, originalDate, contract, refund }) =>
      [
        `Storniert die Zahlungsinformation Nr. ${original} vom ${originalDate}, weil der Kauf ${contract} vor der Übergabe des Fahrzeugs aufgehoben wurde. Über RAHTIS wurde keine Rechnung ausgestellt; eine Rechnung, die der Verkäufer selbst ausgestellt hat, berichtigt er nach § 17 UStG in seiner Buchhaltung. ${refund ? `Der Verkäufer zahlt dem Käufer den gezahlten Betrag von ${refund} zurück.` : 'Es war nichts bezahlt; es wird nichts zurückgezahlt.'} / Cancels payment information ${original} because sale ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'Nothing was paid, so nothing is refunded.'}`,
        DE_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, original }) => `Stornierung · ${seller} · ${original}`,
    mailText: ({ original, contract }) =>
      [
        'Guten Tag,',
        '',
        `anbei die Stornierung der Zahlungsinformation ${original}: Der Kauf ${contract} wurde vor der Übergabe aufgehoben.`,
        '',
        '—',
        `Attached is the cancellation of payment information ${original}: sale ${contract} was cancelled before handover.`,
      ].join('\n'),
  },
};

/* ── Польша ──────────────────────────────────────────────────────────── */

/*
 * Польша (23.11.2026, docs/equipment-sale/countries/pl.md). Счёт между
 * польскими компаниями — только faktura ustrukturyzowana в KSeF (ustawa o VAT
 * art. 106ga; для всех — с 01.04.2026); RAHTIS к KSeF не подключён и счетов не
 * выставляет. Документы платформы — informacja o płatności со своей нумерацией:
 *   · до передачи (IP-<договор>) — первый платёж: взнос и сумма, равная НДС
 *     всей цены. Это аванс: НДС с него возникает при получении, полученная
 *     сумма считается суммой с НДС (art. 19a ust. 8), — в тексте и сумма
 *     аванса, и НДС внутри неё;
 *   · при передаче (IW-<договор>) — справка: НДС со всей цены возникает при
 *     передаче (art. 7 ust. 1 pkt 2, art. 19a ust. 1), продавец выставляет в
 *     KSeF счёт на всю цену с учётом аванса; порядок «счёт на аванс и итоговый
 *     счёт или один счёт» исследование не подтвердило (art. 106b, 106f, 106i не
 *     читались) — его утверждает бухгалтер продавца, так и написано;
 *   · каждый месяц (IP-<договор>-NN) — уведомление о взносе: взносы счетами не
 *     оформляются (договор п. 4.3); проценты — только сумма, без вывода о НДС
 *     (pl.md, открытый вопрос 2);
 *   · отмена до передачи (…-ANUL) — отмена уведомления; faktura korygująca —
 *     дело продавца в KSeF.
 * Даты — «дд.мм.гггг», суммы — «123 456,78 zł» (pl-PL).
 */
const PL_ISSUER =
  'Dokument przygotowany w imieniu Sprzedawcy w serwisie RAHTIS; Aivomaa Oy (RAHTIS) nie jest stroną sprzedaży i nie przyjmuje płatności. / Prepared on behalf of the seller in RAHTIS; Aivomaa Oy (RAHTIS) is not a party to the sale and does not receive payments.';

const PL_LABELS: InvoiceLabels = {
  /* Ни одна подпись не называет документ счётом: всё, что печатает платформа в Польше, — информация о платеже. */
  docName: 'Informacja o płatności',
  creditDocName: 'Anulowanie informacji o płatności',
  title: 'INFORMACJA O WPŁACIE',
  vatId: 'VAT UE',
  businessId: 'NIP',
  customer: ['Kupujący', 'Buyer'],
  number: ['Numer dokumentu', 'Document no.'],
  date: ['Data dokumentu', 'Date'],
  due: ['Termin płatności', 'Due date'],
  job: ['Przedmiot sprzedaży', 'Item sold'],
  period: ['Okres', 'Period'],
  colDate: 'Data / Date',
  colText: 'Opis / Description',
  colQty: 'Ilość / Qty',
  colPrice: 'Kwota / Unit',
  colAmount: 'Razem / Total',
  net: 'Kwota netto / Total excl. VAT',
  total: 'Razem / Total',
  totalDue: 'Do zapłaty / Total due',
  iban: ['Rachunek (IBAN)', 'Bank account'],
  reference: ['Tytuł płatności', 'Reference'],
  amountDue: ['Do zapłaty', 'Amount due'],
  footer: 'Dokument przygotowany w serwisie RAHTIS',
};

const PL_DOC_LABELS: Partial<InvoiceLabels> = { number: ['Numer dokumentu', 'Document no.'], date: ['Data dokumentu', 'Date'] };

const PL_NOT_INVOICE_EN =
  'This is not an invoice: invoices between Polish companies are structured invoices in KSeF, and the seller issues them himself; RAHTIS issues no invoices and is not connected to KSeF.';

const plFirstLine = ({ what, contract }: { what: string; contract: string }) =>
  `${what} – pierwsza wpłata przed wydaniem pojazdu (część ceny i kwota równa podatkowi VAT od całej ceny), umowa nr ${contract} / payment before handover`;

const plFirstNote = (a: FirstNote) =>
  lines(
    `Informacja o płatności przed wydaniem pojazdu (pkt 3.2 i 4.2 umowy nr ${a.contract}): Kupujący wpłaca na rachunek Sprzedawcy pierwszą wpłatę ${a.advance ?? ''} – część ceny ${a.down} oraz kwotę ${a.vat} równą podatkowi VAT ${a.vatPercent ?? ''} % od całej ceny. Pozostała część ceny ${a.rest} jest płatna w ${a.months} ratach. Pojazd zostaje wydany, gdy umowa ma datę pewną, a Sprzedawca potwierdzi otrzymanie wpłaty. Do zapłaty całej ceny właścicielem pojazdu pozostaje Sprzedawca (art. 589 Kodeksu cywilnego).`,
    `To nie jest faktura: Sprzedawca sam dokumentuje tę wpłatę w Krajowym Systemie e-Faktur (KSeF) jako zaliczkę – obowiązek podatkowy powstaje z chwilą jej otrzymania, a otrzymana kwota ${a.advance ?? ''} jest kwotą brutto zawierającą podatek ${a.advanceVat ?? ''} (art. 19a ust. 8 ustawy o podatku od towarów i usług); fakturę na całą cenę – netto ${a.price ?? ''}, VAT ${a.vatPercent ?? ''} % ${a.vat}, brutto ${a.gross ?? ''} – Sprzedawca wystawia w KSeF z datą wydania pojazdu (art. 7 ust. 1 pkt 2 i art. 19a ust. 1), uwzględniając zaliczkę, a na raty nie wystawia odrębnych faktur; czy zaliczka wymaga odrębnej faktury, czy wystarczy jedna faktura, gdy wpłata i wydanie przypadają w tym samym miesiącu, ustala księgowy Sprzedawcy.`,
    `${PL_NOT_INVOICE_EN} Due before handover: ${a.advance ?? ''} (down payment ${a.down} plus an amount equal to the VAT on the whole price). Under the VAT act the payment is an advance taxed on receipt; the seller issues the invoice for the whole price (net ${a.price ?? ''}, VAT ${a.vat}, gross ${a.gross ?? ''}) in KSeF on the handover date, taking the advance into account. The instalments are not invoiced. The seller retains ownership until the price is paid in full.`,
    PL_ISSUER,
  );

const plFirstMailSubject = ({ number, seller, contract }: { number: string; seller: string; contract: string }) =>
  `Informacja o płatności ${number} · ${seller} · umowa ${contract}`;

const plFirstMailText = (a: FirstMail) =>
  [
    'Dzień dobry,',
    '',
    `w załączeniu informacja o płatności ${a.number} przed wydaniem pojazdu – umowa sprzedaży na raty ${a.contract} (${a.what}), Sprzedawca: ${a.seller}.`,
    `Do zapłaty przed wydaniem: ${a.payNow} (część ceny i kwota równa podatkowi VAT od całej ceny), termin ${a.due}.`,
    `Rachunek (IBAN) ${a.iban}, tytuł płatności ${a.reference}.`,
    'Płatność trafia bezpośrednio do Sprzedawcy, nie do RAHTIS ani Aivomaa Oy.',
    'To nie jest faktura: faktury wystawia Sprzedawca w KSeF.',
    '',
    `Pytania: odpowiedz na tę wiadomość (${a.sellerEmail}).`,
    '',
    '—',
    `Attached is payment information ${a.number} due before handover under instalment sale contract ${a.contract} (${a.what}) from ${a.seller}. Due ${a.payNow} by ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy. This is not an invoice: the seller issues the invoices in KSeF.`,
  ].join('\n');

const PL_CANCEL: CreditTexts & PlainDocTexts & { number: NumberOf } = {
  title: 'ANULOWANIE INFORMACJI',
  docName: 'Anulowanie informacji o płatności',
  labels: PL_DOC_LABELS,
  noVat: true,
  filePrefix: 'Anulowanie',
  number: ({ original }) => `${original}-ANUL`,
  linePrefix: 'Anulowano / Cancelled: ',
  job: ({ contract }) => `${contract} · anulowano / cancelled`,
  periodLabel: ['Anulowany dokument', 'Cancelled document'],
  payNowLabel: ['Do zwrotu', 'Refund'],
  amountLabel: ['Do zwrotu', 'Refund'],
  note: ({ original, originalDate, contract, refund }) =>
    [
      `Anulowanie informacji o płatności nr ${original} z dnia ${originalDate}: sprzedaż na raty ${contract} została odwołana przed wydaniem pojazdu. ${refund ? `Sprzedawca zwraca Kupującemu wpłaconą kwotę ${refund}.` : 'Nic nie zostało wpłacone, więc nie ma zwrotu.'}`,
      'To nie jest faktura korygująca: jeżeli Sprzedawca udokumentował wpłatę fakturą w KSeF, korektę (fakturę korygującą) wystawia sam w KSeF.',
      `Cancels payment information ${original} because instalment sale ${contract} was cancelled before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'Nothing was paid, so nothing is refunded.'} This is not a correcting invoice: if the seller documented the payment with an invoice in KSeF, he issues the correction in KSeF himself.`,
      PL_ISSUER,
    ].join('\n'),
  mailSubject: ({ seller, original }) => `Anulowanie informacji o płatności · ${seller} · ${original}`,
  mailText: ({ original, contract }) =>
    [
      'Dzień dobry,',
      '',
      `w załączeniu anulowanie informacji o płatności ${original}: sprzedaż na raty ${contract} została odwołana przed wydaniem pojazdu.`,
      '',
      '—',
      `Attached is the cancellation of payment information ${original}: sale ${contract} was cancelled before handover.`,
    ].join('\n'),
};

const PL: InstallmentInvoiceTexts = {
  country: 'PL',
  intl: 'pl-PL',
  date: paddedDate,
  unit: 'szt.',
  labels: PL_LABELS,
  filePrefix: 'Informacja-o-platnosci',
  vatLabel: (percent) => (percent ? `VAT ${percent} %` : 'VAT 0 %'),
  /* Первый документ Польши — всегда уведомление (notice): эти поля — для единообразия типа, тексты те же. */
  first: {
    line: plFirstLine,
    jobLabel: ['Przedmiot sprzedaży', 'Item sold'],
    periodLabel: ['Wydanie pojazdu', 'Handover'],
    payNowLabel: ['Do zapłaty teraz', 'Due now'],
    note: plFirstNote,
    mailSubject: plFirstMailSubject,
    mailText: plFirstMailText,
  },
  payment: {
    jobLabel: ['Umowa sprzedaży na raty', 'Instalment sale contract'],
    periodLabel: ['Rata', 'Instalment'],
    line: ({ n, months, contract, what }) => `Rata ${n}/${months}, umowa nr ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты — отдельной строкой и без вывода о НДС: освобождение (art. 43 ust. 1 pkt 38) или часть цены (art. 29a) — не подтверждено. */
    interestLine: 'Odsetki od odroczonej części ceny (pkt 4.4 umowy) / Interest on the deferred part of the price',
    note: ({ hasInterest }) =>
      [
        `To nie jest faktura: rata jest zapłatą części ceny objętej fakturą, którą Sprzedawca wystawia w KSeF przy wydaniu pojazdu, i Sprzedawca nie wystawia odrębnych faktur na raty (pkt 4.3 umowy)${hasInterest ? '; sposób udokumentowania odsetek (zwolnienie z VAT jako usługa kredytowa albo część ceny) nie został potwierdzony i ustala go księgowy Sprzedawcy' : ''}.`,
        `This is a payment notice, not an invoice: the instalment pays part of the price invoiced by the seller in KSeF at handover; instalments are not invoiced separately.${hasInterest ? ' How interest is documented for VAT is not confirmed and is for the seller’s accountant to decide.' : ''}`,
        PL_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Informacja o płatności raty · ${seller} · rata ${n}/${months}, umowa ${contract}`,
    mailText: (a) =>
      [
        'Dzień dobry,',
        '',
        `w załączeniu informacja o płatności raty ${a.n}/${a.months} – umowa sprzedaży na raty ${a.contract} (${a.what}).`,
        `Do zapłaty ${a.total}, termin ${a.due}. Rachunek (IBAN) ${a.iban}.`,
        'Płatność trafia bezpośrednio do Sprzedawcy, nie do RAHTIS ani Aivomaa Oy.',
        '',
        '—',
        `Attached is the payment notice for instalment ${a.n}/${a.months} of instalment sale contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Dokument / Document ${number} · tytuł płatności / reference ${reference}`,
  },
  credit: PL_CANCEL,
  notice: {
    title: 'INFORMACJA O WPŁACIE',
    docName: 'Informacja o płatności przed wydaniem',
    labels: PL_DOC_LABELS,
    noVat: true,
    filePrefix: 'Informacja-o-platnosci',
    number: ({ contract }) => `IP-${contract}`,
    note: PL_NOT_INVOICE_EN.replace('This is not an invoice', 'This document is not an invoice'),
    firstLine: plFirstLine,
    firstNote: plFirstNote,
    firstMailSubject: plFirstMailSubject,
    firstMailText: plFirstMailText,
  },
  handover: {
    line: ({ what, contract }) => `${what} – wydanie pojazdu, cena brutto według umowy nr ${contract} / vehicle handed over, gross price`,
    note: (a) =>
      lines(
        `Pojazd został wydany Kupującemu w dniu ${a.handover ?? ''} (protokół zdawczo-odbiorczy, umowa nr ${a.contract}). Cena: netto ${a.price ?? ''}, VAT ${a.vatPercent ?? ''} % ${a.vat}, brutto ${a.gross ?? ''}. Przed wydaniem Kupujący wpłacił ${a.advance}. Pozostała część ceny ${a.rest} jest płatna w ${a.months} ratach; na podstawie tego dokumentu nic nie jest teraz do zapłaty. Do zapłaty całej ceny właścicielem pojazdu pozostaje Sprzedawca.`,
        `To nie jest faktura: z chwilą wydania pojazdu powstaje obowiązek podatkowy od całej ceny (art. 7 ust. 1 pkt 2 i art. 19a ust. 1 ustawy o podatku od towarów i usług), więc Sprzedawca wystawia w KSeF fakturę na całą cenę – netto ${a.price ?? ''}, VAT ${a.vatPercent ?? ''} % ${a.vat}, brutto ${a.gross ?? ''}, data dostawy ${a.handover ?? ''} – uwzględniając wpłatę przed wydaniem ${a.advance} (zaliczka, w tym VAT ${a.advanceVat ?? ''}), i przekazuje Kupującemu numer faktury w KSeF; na raty Sprzedawca nie wystawia odrębnych faktur (pkt 4.3 umowy), a dokładny sposób rozliczenia zaliczki ustala jego księgowy.`,
        `This is not an invoice. The vehicle was handed over on ${a.handover ?? ''}; VAT on the whole price arises on handover, so the seller issues in KSeF the invoice for the whole price (net ${a.price ?? ''}, VAT ${a.vat}, gross ${a.gross ?? ''}), taking into account the advance of ${a.advance} paid before handover, and gives the buyer its KSeF number. The remainder ${a.rest} is paid in ${a.months} instalments, which are not invoiced; nothing is due on this document now.`,
        PL_ISSUER,
      ),
    payNowLabel: ['Do zapłaty teraz', 'Due now'],
    amountLabel: ['Do zapłaty', 'Amount due'],
    mailSubject: ({ seller, contract }) => `Informacja o wydaniu pojazdu · ${seller} · umowa ${contract}`,
    mailText: (a) =>
      [
        'Dzień dobry,',
        '',
        `w załączeniu informacja o wydaniu pojazdu – umowa sprzedaży na raty ${a.contract} (${a.what}), Sprzedawca: ${a.seller}. Na jej podstawie nic nie jest teraz do zapłaty.`,
        'To nie jest faktura: fakturę na całą cenę Sprzedawca wystawia w KSeF z datą wydania pojazdu.',
        '',
        '—',
        `Attached is the handover statement under instalment sale contract ${a.contract} (${a.what}). Nothing is due on it now. This is not an invoice: the seller issues the invoice for the whole price in KSeF as of the handover date.`,
      ].join('\n'),
  },
  handoverDoc: {
    title: 'INFORMACJA O WYDANIU',
    docName: 'Informacja o wydaniu pojazdu',
    labels: PL_DOC_LABELS,
    noVat: true,
    filePrefix: 'Informacja-o-wydaniu',
    number: ({ contract }) => `IW-${contract}`,
  },
  paymentDoc: {
    title: 'INFORMACJA O RACIE',
    docName: 'Informacja o płatności raty',
    labels: PL_DOC_LABELS,
    noVat: true,
    filePrefix: 'Informacja-o-racie',
    number: ({ contract, n }) => `IP-${contract}-${String(n ?? 0).padStart(2, '0')}`,
  },
  cancel: PL_CANCEL,
};

/* ── Румыния ─────────────────────────────────────────────────────────── */

/*
 * Румыния (23.11.2026, docs/equipment-sale/countries/ro.md). Между румынскими
 * компаниями счётом считается только счёт, переданный через RO e-Factura
 * (Codul fiscal art. 319 alin. (1^1), OUG 120/2021); PDF вне системы — не
 * счёт, штраф 15 % суммы и выставителю, и получателю. RAHTIS к системе не
 * подключён. Документы платформы — notificare de plată со своей нумерацией:
 *   · до передачи (NP-<договор>) — аванс: взнос и НДС всей цены. По договору
 *     (п. 4.2) продавец ДО передачи выставляет в RO e-Factura счёт на всю цену
 *     с НДС 21 % и передаёт его в систему в 5 рабочих дней; НДС — на дату
 *     счёта, если он раньше поставки (art. 282 alin. (2) lit. a));
 *   · при передаче (PV-<договор>) — справка: дата передачи — дата поставки
 *     (art. 281 alin. (6)); если счёт ещё не выставлен, НДС — на эту дату;
 *   · каждый месяц (NP-<договор>-NN) — уведомление о взносе: взносы по цене
 *     счетами не оформляются (цена уже фактурирована, п. 4.3); проценты после
 *     передачи — освобождённый кредит (art. 292 alin. (2) lit. a) pct. 1), их
 *     продавец фактурирует ежемесячно в RO e-Factura (п. 4.4);
 *   · отмена до передачи (…-ANUL) — отмена уведомления; factură de corecție и
 *     письменное соглашение о расторжении (art. 287 lit. b)) — дело продавца.
 * Даты — «дд.мм.гггг», суммы — «10.000,00 lei» (ro-RO); ș и ț — с запятой.
 */
const RO_ISSUER =
  'Document întocmit în numele vânzătorului în serviciul RAHTIS; Aivomaa Oy (RAHTIS) nu este parte la vânzare și nu încasează plăți. / Prepared on behalf of the seller in RAHTIS; Aivomaa Oy (RAHTIS) is not a party to the sale and does not receive payments.';

const RO_LABELS: InvoiceLabels = {
  /* Ни одна подпись не называет документ счётом. */
  docName: 'Notificare de plată',
  creditDocName: 'Anularea notificării de plată',
  title: 'NOTIFICARE DE PLATĂ',
  vatId: 'Cod TVA',
  businessId: 'CUI',
  customer: ['Cumpărător', 'Buyer'],
  number: ['Număr document', 'Document no.'],
  date: ['Data documentului', 'Date'],
  due: ['Scadența', 'Due date'],
  job: ['Obiectul vânzării', 'Item sold'],
  period: ['Perioada', 'Period'],
  colDate: 'Data / Date',
  colText: 'Descriere / Description',
  colQty: 'Cant. / Qty',
  colPrice: 'Preț unitar / Unit',
  colAmount: 'Valoare / Total',
  net: 'Total fără TVA / Total excl. VAT',
  total: 'Total / Total',
  totalDue: 'Total de plată / Total due',
  iban: ['Cont (IBAN)', 'Bank account'],
  reference: ['Referință plată', 'Reference'],
  amountDue: ['De plată', 'Amount due'],
  footer: 'Document întocmit în serviciul RAHTIS',
};

const RO_DOC_LABELS: Partial<InvoiceLabels> = { number: ['Număr document', 'Document no.'], date: ['Data documentului', 'Date'] };

const RO_NOT_INVOICE_EN =
  'This is not an invoice: between Romanian companies only invoices transmitted through RO e-Factura are invoices, and the seller issues them; RAHTIS issues no invoices and is not connected to RO e-Factura.';

const roFirstLine = ({ what, contract }: { what: string; contract: string }) =>
  `${what} – avans înainte de predare (parte din preț și TVA aferentă întregului preț), contract nr. ${contract} / advance before handover`;

const roFirstNote = (a: FirstNote) =>
  lines(
    `Notificare de plată înainte de predarea vehiculului (pct. 3.2 și 4.2 din contractul nr. ${a.contract}): cumpărătorul plătește în contul vânzătorului avansul de ${a.advance ?? ''} – parte din preț ${a.down} și TVA de ${a.vat} aferentă întregului preț. Restul de preț ${a.rest} se plătește în ${a.months} rate. Vehiculul se predă după ce rezerva proprietății este înscrisă în Registrul Național de Publicitate Mobiliară și vânzătorul confirmă încasarea avansului. Dreptul de proprietate rămâne al vânzătorului până la plata integrală a prețului.`,
    `Aceasta nu este o factură: potrivit pct. 4.2 din contract, vânzătorul emite înainte de predare, prin RO e-Factura, factura pentru prețul total – fără TVA ${a.price ?? ''}, TVA ${a.vatPercent ?? ''} % ${a.vat}, total ${a.gross ?? ''} – și o transmite în sistem în termen de 5 zile lucrătoare de la emitere; TVA devine exigibilă la data facturii, dacă aceasta este anterioară predării (art. 282 alin. (2) lit. a) din Codul fiscal), iar ratele din preț nu se facturează.`,
    `${RO_NOT_INVOICE_EN} Due before handover: ${a.advance ?? ''} (down payment ${a.down} plus the VAT on the whole price). Under the contract the seller issues the invoice for the total price (excl. VAT ${a.price ?? ''}, VAT ${a.vat}, total ${a.gross ?? ''}) through RO e-Factura before handover and transmits it within 5 working days of issue; the price instalments are not invoiced. The seller retains ownership until the price is paid in full.`,
    RO_ISSUER,
  );

const roFirstMailSubject = ({ number, seller, contract }: { number: string; seller: string; contract: string }) =>
  `Notificare de plată ${number} · ${seller} · contract ${contract}`;

const roFirstMailText = (a: FirstMail) =>
  [
    'Bună ziua,',
    '',
    `vă transmitem notificarea de plată ${a.number} pentru avansul datorat înainte de predare – contractul de vânzare cu plata prețului în rate ${a.contract} (${a.what}), vânzător: ${a.seller}.`,
    `De plată înainte de predare: ${a.payNow} (parte din preț și TVA aferentă întregului preț), scadență ${a.due}.`,
    `Cont (IBAN) ${a.iban}, referință plată ${a.reference}.`,
    'Plata se face direct vânzătorului, nu către RAHTIS sau Aivomaa Oy.',
    'Aceasta nu este o factură: facturile le emite vânzătorul prin RO e-Factura.',
    '',
    `Întrebări: răspundeți la acest mesaj (${a.sellerEmail}).`,
    '',
    '—',
    `Attached is payment notice ${a.number} for the advance due before handover under instalment sale contract ${a.contract} (${a.what}) from ${a.seller}. Due ${a.payNow} by ${a.due}, IBAN ${a.iban}, reference ${a.reference}. Pay the seller directly, not RAHTIS or Aivomaa Oy. This is not an invoice: the seller issues the invoices through RO e-Factura.`,
  ].join('\n');

const RO_CANCEL: CreditTexts & PlainDocTexts & { number: NumberOf } = {
  title: 'ANULARE NOTIFICARE',
  docName: 'Anularea notificării de plată',
  labels: RO_DOC_LABELS,
  noVat: true,
  filePrefix: 'Anulare',
  number: ({ original }) => `${original}-ANUL`,
  linePrefix: 'Anulat / Cancelled: ',
  job: ({ contract }) => `${contract} · anulat / cancelled`,
  periodLabel: ['Document anulat', 'Cancelled document'],
  payNowLabel: ['De restituit', 'Refund'],
  amountLabel: ['De restituit', 'Refund'],
  note: ({ original, originalDate, contract, refund }) =>
    [
      `Se anulează notificarea de plată nr. ${original} din ${originalDate}, deoarece vânzarea cu plata prețului în rate ${contract} a încetat înainte de predarea vehiculului. ${refund ? `Vânzătorul restituie cumpărătorului suma plătită de ${refund}.` : 'Nu s-a plătit nimic, deci nu există sume de restituit.'}`,
      'Aceasta nu este o factură de corecție: dacă vânzătorul a emis deja factura prin RO e-Factura, tot el emite factura de corecție prin RO e-Factura, iar părțile semnează un acord scris privind desființarea contractului (art. 287 lit. b) din Codul fiscal).',
      `Cancels payment notice ${original} because instalment sale ${contract} ended before handover. ${refund ? `The seller refunds the ${refund} paid to the buyer.` : 'Nothing was paid, so nothing is refunded.'} This is not a correcting invoice: if the seller already issued the invoice through RO e-Factura, he issues the correction there himself, and the parties sign a written termination agreement.`,
      RO_ISSUER,
    ].join('\n'),
  mailSubject: ({ seller, original }) => `Anularea notificării de plată · ${seller} · ${original}`,
  mailText: ({ original, contract }) =>
    [
      'Bună ziua,',
      '',
      `vă transmitem anularea notificării de plată ${original}: vânzarea ${contract} a încetat înainte de predarea vehiculului.`,
      '',
      '—',
      `Attached is the cancellation of payment notice ${original}: sale ${contract} ended before handover.`,
    ].join('\n'),
};

const RO: InstallmentInvoiceTexts = {
  country: 'RO',
  intl: 'ro-RO',
  date: paddedDate,
  unit: 'buc.',
  labels: RO_LABELS,
  filePrefix: 'Notificare-de-plata',
  vatLabel: (percent) => (percent ? `TVA / VAT ${percent} %` : 'TVA / VAT 0 %'),
  /* Первый документ Румынии — всегда уведомление (notice): эти поля — для единообразия типа, тексты те же. */
  first: {
    line: roFirstLine,
    jobLabel: ['Obiectul vânzării', 'Item sold'],
    periodLabel: ['Predare', 'Handover'],
    payNowLabel: ['De plată acum', 'Due now'],
    note: roFirstNote,
    mailSubject: roFirstMailSubject,
    mailText: roFirstMailText,
  },
  payment: {
    jobLabel: ['Contract de vânzare cu plata în rate', 'Instalment sale contract'],
    periodLabel: ['Rata', 'Instalment'],
    line: ({ n, months, contract, what }) => `Rata ${n}/${months}, contract nr. ${contract} (${what}) / Instalment ${n}/${months}`,
    /* Проценты после передачи — освобождённый кредит (ro.md: подтверждено). */
    interestLine: 'Dobândă remuneratorie (pct. 4.4) – scutită de TVA, art. 292 alin. (2) lit. a) pct. 1 din Codul fiscal / Interest, VAT-exempt credit',
    note: ({ hasInterest }) =>
      [
        `Aceasta nu este o factură: rata din preț nu se facturează, deoarece prețul total, cu TVA, este facturat de vânzător prin RO e-Factura (pct. 4.2 și 4.3 din contract)${hasInterest ? '; dobânda remuneratorie din această notificare o facturează vânzătorul lunar, prin RO e-Factura, scutită de TVA (pct. 4.4 din contract)' : ''}.`,
        `This is a payment notice, not an invoice: the price instalment is not invoiced because the seller invoices the total price with VAT through RO e-Factura.${hasInterest ? ' The seller invoices the interest in this notice monthly through RO e-Factura, VAT-exempt.' : ''}`,
        RO_ISSUER,
      ].join('\n'),
    mailSubject: ({ seller, n, months, contract }) => `Notificare de plată · ${seller} · rata ${n}/${months}, contract ${contract}`,
    mailText: (a) =>
      [
        'Bună ziua,',
        '',
        `vă transmitem notificarea de plată pentru rata ${a.n}/${a.months} din contractul de vânzare cu plata prețului în rate ${a.contract} (${a.what}).`,
        `De plată ${a.total}, scadență ${a.due}. Cont (IBAN) ${a.iban}.`,
        'Plata se face direct vânzătorului, nu către RAHTIS sau Aivomaa Oy.',
        '',
        '—',
        `Attached is the payment notice for instalment ${a.n}/${a.months} of instalment sale contract ${a.contract}. Amount ${a.total}, due ${a.due}, IBAN ${a.iban}. Pay the seller directly.`,
      ].join('\n'),
    mailFooter: ({ number, reference }) => `Document ${number} · referință plată / reference ${reference}`,
  },
  credit: RO_CANCEL,
  notice: {
    title: 'NOTIFICARE DE PLATĂ',
    docName: 'Notificare de plată – avans',
    labels: RO_DOC_LABELS,
    noVat: true,
    filePrefix: 'Notificare-de-plata',
    number: ({ contract }) => `NP-${contract}`,
    note: RO_NOT_INVOICE_EN.replace('This is not an invoice', 'This document is not an invoice'),
    firstLine: roFirstLine,
    firstNote: roFirstNote,
    firstMailSubject: roFirstMailSubject,
    firstMailText: roFirstMailText,
  },
  handover: {
    line: ({ what, contract }) => `${what} – predarea vehiculului, prețul total cu TVA conform contractului nr. ${contract} / vehicle handed over, total price`,
    note: (a) =>
      lines(
        `Vehiculul a fost predat cumpărătorului la ${a.handover ?? ''} (proces-verbal de predare-primire, contractul nr. ${a.contract}); data predării este data livrării (art. 281 alin. (6) din Codul fiscal). Preț: fără TVA ${a.price ?? ''}, TVA ${a.vatPercent ?? ''} % ${a.vat}, total ${a.gross ?? ''}. Înainte de predare cumpărătorul a plătit avansul de ${a.advance}. Restul de preț ${a.rest} se plătește în ${a.months} rate; în baza acestui document nu este nimic de plată acum. Dreptul de proprietate rămâne al vânzătorului până la plata integrală a prețului.`,
        `Aceasta nu este o factură: prețul total – fără TVA ${a.price ?? ''}, TVA ${a.vatPercent ?? ''} % ${a.vat}, total ${a.gross ?? ''} – îl facturează vânzătorul prin RO e-Factura înainte de predare (pct. 4.2 din contract), iar dacă factura nu a fost emisă înainte de predare, TVA devine exigibilă la data predării (art. 282 alin. (1) din Codul fiscal); ratele din preț nu se facturează.`,
        `This is not an invoice. The vehicle was handed over on ${a.handover ?? ''}, which is the date of supply. The seller invoices the total price (excl. VAT ${a.price ?? ''}, VAT ${a.vat}, total ${a.gross ?? ''}) through RO e-Factura before handover; if it has not been invoiced yet, VAT is chargeable on the handover date. The remainder ${a.rest} is paid in ${a.months} instalments, which are not invoiced; nothing is due on this document now.`,
        RO_ISSUER,
      ),
    payNowLabel: ['De plată acum', 'Due now'],
    amountLabel: ['De plată', 'Amount due'],
    mailSubject: ({ seller, contract }) => `Situație la predarea vehiculului · ${seller} · contract ${contract}`,
    mailText: (a) =>
      [
        'Bună ziua,',
        '',
        `vă transmitem situația la predarea vehiculului – contractul de vânzare cu plata prețului în rate ${a.contract} (${a.what}), vânzător: ${a.seller}. În baza acesteia nu este nimic de plată acum.`,
        'Aceasta nu este o factură: prețul total îl facturează vânzătorul prin RO e-Factura.',
        '',
        '—',
        `Attached is the handover statement under instalment sale contract ${a.contract} (${a.what}). Nothing is due on it now. This is not an invoice: the seller invoices the total price through RO e-Factura.`,
      ].join('\n'),
  },
  handoverDoc: {
    title: 'SITUAȚIE LA PREDARE',
    docName: 'Situație la predarea vehiculului',
    labels: RO_DOC_LABELS,
    noVat: true,
    filePrefix: 'Situatie-la-predare',
    number: ({ contract }) => `PV-${contract}`,
  },
  paymentDoc: {
    title: 'NOTIFICARE DE PLATĂ',
    docName: 'Notificare de plată – rată',
    labels: RO_DOC_LABELS,
    noVat: true,
    filePrefix: 'Notificare-de-plata',
    number: ({ contract, n }) => `NP-${contract}-${String(n ?? 0).padStart(2, '0')}`,
  },
  cancel: RO_CANCEL,
};

const TEXTS: Record<InvoiceTextCountry, InstallmentInvoiceTexts> = { FI, EE, LV, SE, DK, LT, DE, PL, RO };

/** Есть ли у страны свои тексты счетов — для проверки, что открытую страну можно обслуживать. */
export function invoiceTextsExist(country: string | null | undefined): boolean {
  return Object.prototype.hasOwnProperty.call(TEXTS, (country ?? '').toUpperCase());
}

/**
 * Тексты счетов страны продавца. Страна без своих текстов (и счёт, записанный
 * до 23.11.2026, где страны нет) — финские: до открытия других стран все
 * счета рассрочки были финскими.
 */
export function invoiceTexts(country: string | null | undefined): InstallmentInvoiceTexts {
  const code = (country ?? '').toUpperCase();
  return invoiceTextsExist(code) ? TEXTS[code as InvoiceTextCountry] : FI;
}

/** С этого дня счёт между латвийскими предприятиями обязан быть структурированным электронным (Grāmatvedības likums, pārejas noteikumu 8. pkt.). */
export const LV_E_INVOICE_FROM = '2028-01-01';

/**
 * Германия (23.11.2026): PDF — счёт только за обороты до 31.12.2026 (§ 27
 * Abs. 38 UStG). Продавцу с оборотом прошлого года до 800 000 € можно до
 * 31.12.2027, но оборот платформе неизвестен — для всех ранняя дата.
 */
export const DE_E_INVOICE_FROM = '2027-01-01';

/**
 * Чем является документ, который платформа выпускает за продавца: счётом
 * или платёжным уведомлением. Уведомление — в Латвии с 01.01.2028 и в
 * Германии с 01.01.2027: PDF там перестаёт быть счётом, а структурированных
 * счетов платформа не делает. issuedOn — день выставления (ГГГГ-ММ-ДД) по
 * времени страны. supplyOn — день поставки (передачи машины), если он
 * известен: в Германии правило § 27 Abs. 38 UStG — об оборотах, а поставка
 * совершается при передаче, поэтому уведомление и тогда, когда выставлено
 * раньше, но машина передаётся с 01.01.2027 (осторожный вариант).
 */
export function documentKind(country: string | null | undefined, issuedOn: string, supplyOn?: string | null): 'INVOICE' | 'NOTICE' {
  const code = (country ?? '').toUpperCase();
  if (code === 'LV') return issuedOn >= LV_E_INVOICE_FROM ? 'NOTICE' : 'INVOICE';
  if (code === 'DE') return issuedOn >= DE_E_INVOICE_FROM || (supplyOn != null && supplyOn >= DE_E_INVOICE_FROM) ? 'NOTICE' : 'INVOICE';
  return 'INVOICE';
}

/** Подписи документа: у платёжного уведомления «номер и дата документа», а не счёта. */
export function documentLabels(tx: InstallmentInvoiceTexts, notice: boolean): InvoiceLabels | undefined {
  return notice && tx.labels && tx.notice ? { ...tx.labels, ...tx.notice.labels } : tx.labels;
}

/**
 * Вид документа, записанный со счётом (23.11.2026): по нему при печати
 * выбираются заголовок и подписи. Нет — обычный счёт (или латвийское
 * уведомление, у которого записан docName, как было).
 */
export type PlainDocKind = 'PROFORMA' | 'NOTICE' | 'PAYMENT' | 'CANCEL' | 'HANDOVER';

/** Тексты документа, который не счёт, по его виду; null — у страны такого документа нет. */
export function plainDoc(tx: InstallmentInvoiceTexts, kind: PlainDocKind | null | undefined): PlainDocTexts | null {
  if (kind === 'PROFORMA') return tx.proforma ?? null;
  if (kind === 'NOTICE') return tx.notice ?? null;
  if (kind === 'PAYMENT') return tx.paymentDoc ?? null;
  if (kind === 'CANCEL') return tx.cancel ?? null;
  /* Польша и Румыния (23.11.2026): справка при передаче — не счёт. */
  if (kind === 'HANDOVER') return tx.handoverDoc ?? null;
  return null;
}

/** Подписи документа вида kind: подписи страны с заменами документа. */
export function plainDocLabels(tx: InstallmentInvoiceTexts, kind: PlainDocKind | null | undefined): InvoiceLabels | undefined {
  const doc = plainDoc(tx, kind);
  return doc && tx.labels ? { ...tx.labels, ...doc.labels } : tx.labels;
}

/**
 * Первый документ сделки (23.11.2026):
 *   · INVOICE — счёт со всей ценой и всем НДС (Финляндия и остальные, Германия
 *     до 2027 года, Латвия — и её уведомление с 2028 года, оно с НДС, как было);
 *   · PROFORMA — Литва: предварительный счёт без НДС, счёт с НДС — при передаче;
 *   · NOTICE — Германия с 2027 года: платёжная информация без НДС; Польша и
 *     Румыния — всегда (23.11.2026): счета там выставляет только продавец в
 *     KSeF / RO e-Factura, платформа — уведомление о платеже.
 */
export function firstDocumentKind(country: string | null | undefined, issuedOn: string, handoverOn: string): 'INVOICE' | 'PROFORMA' | 'NOTICE' {
  if (installmentCountryEntry(country)?.vatInvoiceAtHandover === true) return 'PROFORMA';
  if (installmentCountryEntry(country)?.sellerInvoices === true) return 'NOTICE';
  const tx = invoiceTexts(country);
  return tx.notice?.noVat && documentKind(country, issuedOn, handoverOn) === 'NOTICE' ? 'NOTICE' : 'INVOICE';
}

/**
 * Готова ли страна по счетам: есть тексты и решён порядок НДС — весь НДС
 * первым счётом или (Литва) счёт с НДС при передаче, тогда у текстов
 * должны быть предварительный счёт, счёт передачи и платёжное требование.
 */
export function invoicesReady(country: string | null | undefined): boolean {
  if (!invoiceTextsExist(country)) return false;
  const entry = installmentCountryEntry(country);
  if (entry?.vatOnFirstInvoice === true) return true;
  const tx = invoiceTexts(country);
  /*
   * Польша и Румыния (sellerInvoices, 23.11.2026): все документы — уведомления:
   * первое с номером от договора, справка при передаче, ежемесячное и отмена.
   */
  if (entry?.sellerInvoices === true) {
    const n = tx.notice;
    return Boolean(
      n?.noVat && n.number && n.firstLine && n.firstNote && tx.handover && tx.handoverDoc?.noVat && tx.paymentDoc?.noVat && tx.cancel?.noVat,
    );
  }
  return entry?.vatInvoiceAtHandover === true && Boolean(tx.proforma && tx.handover && tx.paymentDoc && tx.cancel);
}
