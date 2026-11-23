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
 * Модуль без зависимостей от сервера: его читают счета и тесты.
 */
import type { VatMode } from './calc.ts';
import { installmentCountryEntry } from './countries.ts';
import type { Bilingual, InvoiceLabels } from '../sites/invoiceLabels.ts';

export type InvoiceTextCountry = 'FI' | 'EE' | 'LV' | 'SE' | 'DK';

type FirstNote = { down: string; vat: string; rest: string; months: number; contract: string; vatMode: VatMode };
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
    note: (a: { firstNumber: string }) => string;
    mailSubject: (a: { seller: string; n: number; months: number; contract: string }) => string;
    mailText: (a: PaymentMail) => string;
    /** Последняя строка письма: номер документа и ссылка платежа. */
    mailFooter: (a: { number: string; reference: string }) => string;
  };
  credit: {
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
  /** Платёжное уведомление вместо счёта (Латвия с 2028 года); null — в стране такого нет. */
  notice: { title: string; docName: string; note: string; labels: Partial<InvoiceLabels> } | null;
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

const TEXTS: Record<InvoiceTextCountry, InstallmentInvoiceTexts> = { FI, EE, LV, SE, DK };

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
 * Чем является документ, который платформа выпускает за продавца: счётом
 * или платёжным уведомлением. Уведомление — только в Латвии с 01.01.2028:
 * PDF там перестаёт быть счётом, а структурированных счетов платформа не
 * делает. issuedOn — день выставления (ГГГГ-ММ-ДД) по времени страны.
 */
export function documentKind(country: string | null | undefined, issuedOn: string): 'INVOICE' | 'NOTICE' {
  return (country ?? '').toUpperCase() === 'LV' && issuedOn >= LV_E_INVOICE_FROM ? 'NOTICE' : 'INVOICE';
}

/** Открыта ли страна по счетам: есть тексты и решён вопрос «весь НДС первым счётом». */
/** Подписи документа: у платёжного уведомления «номер и дата документа», а не счёта. */
export function documentLabels(tx: InstallmentInvoiceTexts, notice: boolean): InvoiceLabels | undefined {
  return notice && tx.labels && tx.notice ? { ...tx.labels, ...tx.notice.labels } : tx.labels;
}

export function invoicesReady(country: string | null | undefined): boolean {
  return invoiceTextsExist(country) && installmentCountryEntry(country)?.vatOnFirstInvoice === true;
}
