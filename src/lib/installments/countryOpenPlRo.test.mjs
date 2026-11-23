/*
 * Польша и Румыния (23.11.2026): раздел открыт, но платформа там не выставляет
 * НИ ОДНОГО счёта — счета только в KSeF / RO e-Factura у продавца. Проверяется:
 * реестр и база в согласии; все документы — уведомления со своей нумерацией
 * (серию счетов продавца не занимают); слово «счёт» на языке страны стоит
 * только в предложениях «это не счёт»; договоры — дословный текст шаблона с
 * подставленными данными; тексты кабинета на десяти языках; предел ставки
 * Польши. Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { locales } from '../i18n/config.ts';
import { paymentReference } from '../sites/invoice.ts';
import {
  INSTALLMENT_COUNTRIES,
  MAX_RATE_BPS,
  installmentCountry,
  installmentInterestOffered,
  installmentMaxRateBps,
  installmentSellerInvoices,
  installmentTimeZone,
  openInstallmentCountries,
} from './countries.ts';
import { COUNTRY_CONTRACTS, contractTemplateExists } from './contractText/index.ts';
import { contractPlainText } from './contractText/blocks.ts';
import { bareZl } from './contractText/pl.ts';
import { bareLei } from './contractText/ro.ts';
import { COMMON_TEXTS, LAW_TEXTS, LEGAL_NOTICE, countryEventCode, countryTextsExist, sellerInvoiceCountry, withCountryTexts } from './countryTexts/index.ts';
import { SELLER_INVOICE_SYSTEMS, SELLER_INVOICE_TEXTS } from './countryTexts/sellerInvoices.ts';
import { firstDocumentKind, invoiceTexts, invoiceTextsExist, invoicesReady, plainDoc, plainDocLabels } from './invoiceTexts.ts';
import { INSTALLMENT_RULES, installmentRules } from './rules.ts';

const COUNTRIES = ['PL', 'RO'];
/* Слово «счёт» на языке страны и фраза «это не счёт», в которой ему только и можно стоять. */
const INVOICE_WORD = { PL: /faktur/i, RO: /factur/i };
const NOT_INVOICE = { PL: /nie jest faktur/i, RO: /nu este o factur/i };

/** Предложения текста: конец — точка, «!» или «?» и пробел перед заглавной буквой (сокращения «art. 7», «alin. (2)» не режут). */
const sentences = (text) => text.split(/\n|(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻĂÂÎȘȚ„"])/).filter((x) => x.trim());

/** Слово «счёт» — только в предложениях «это не счёт». */
function onlyNotInvoice(code, text, where) {
  /* Название системы «RO e-Factura» — не слово «счёт». */
  for (const s of sentences(text.replace(/e-Factura/g, 'e-SYSTEM'))) {
    if (INVOICE_WORD[code].test(s)) assert.ok(NOT_INVOICE[code].test(s), `${code} ${where}: «${s.slice(0, 120)}…»`);
  }
}

function latestSql(marker) {
  const dir = new URL('../../../supabase/migrations/', import.meta.url);
  let found = null;
  for (const f of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(f, dir), 'utf8');
    const at = sql.lastIndexOf(marker);
    if (at < 0) continue;
    const end = sql.indexOf('$$;', sql.indexOf('$$', at) + 2);
    found = sql.slice(at, end < 0 ? undefined : end);
  }
  return found;
}

test('реестр: Польша и Румыния открыты, свои правила и договор, счета — только у продавца; Норвегия закрыта', () => {
  assert.deepEqual(INSTALLMENT_COUNTRIES.PL, {
    open: true,
    rules: 'PL_KC589',
    contract: 'PL_RATY',
    contractLanguage: 'pl',
    vatOnFirstInvoice: false,
    sellerInvoices: true,
    maxRateBps: 700,
  });
  assert.deepEqual(INSTALLMENT_COUNTRIES.RO, { open: true, rules: 'RO_CC1755', contract: 'RO_RATE', contractLanguage: 'ro', vatOnFirstInvoice: false, sellerInvoices: true });
  assert.equal(installmentCountry('PL').currency, 'PLN');
  assert.equal(installmentCountry('RO').currency, 'RON');
  assert.equal(installmentCountry('PL').vatStandardBps, 2300);
  assert.equal(installmentCountry('RO').vatStandardBps, 2100);
  assert.equal(installmentTimeZone('PL'), 'Europe/Warsaw');
  assert.equal(installmentTimeZone('RO'), 'Europe/Bucharest');
  assert.equal(installmentCountry('NO'), null);
  for (const code of COUNTRIES) assert.equal(installmentSellerInvoices(code), true, code);
  for (const code of ['FI', 'EE', 'LV', 'SE', 'DK', 'LT', 'DE', 'NO']) assert.equal(installmentSellerInvoices(code), false, code);
  assert.equal(sellerInvoiceCountry('pl'), 'PL');
  assert.equal(sellerInvoiceCountry('LT'), null);
  assert.deepEqual(SELLER_INVOICE_SYSTEMS, { PL: 'KSeF', RO: 'RO e-Factura' });
});

test('каждая открытая страна: правила, договор, тексты документов и кабинета на всех десяти языках', () => {
  assert.equal(locales.length, 10);
  for (const code of openInstallmentCountries()) {
    const c = installmentCountry(code);
    assert.ok(INSTALLMENT_RULES[c.rules], code);
    assert.ok(contractTemplateExists(c.contract), code);
    assert.ok(invoiceTextsExist(code) && invoicesReady(code), code);
    assert.ok(countryTextsExist(code), code);
    if (code !== 'FI') for (const l of locales) assert.ok(LAW_TEXTS[code][l]?.intro, `${code}/${l}`);
  }
  assert.ok(openInstallmentCountries().includes('PL') && openInstallmentCountries().includes('RO'));
  assert.ok(!openInstallmentCountries().includes('NO'));
});

test('база: страны открыты, счета у продавца, предел ставки — то же, что в коде', () => {
  const open = latestSql('create or replace function app.installment_country_open(');
  for (const code of ['FI', 'EE', 'LV', 'SE', 'DK', 'LT', 'DE', 'PL', 'RO']) assert.ok(open.includes(`'${code}'`), code);
  assert.ok(!open.includes("'NO'"));
  const seller = latestSql('create or replace function app.installment_seller_invoices(');
  assert.ok(seller.includes("in ('PL', 'RO')"));
  const max = latestSql('create or replace function app.installment_max_rate_bps(');
  assert.ok(max.includes(`= 'PL' then ${installmentMaxRateBps('PL')} else ${MAX_RATE_BPS} end`));
  assert.equal(installmentMaxRateBps('RO'), 5000);
  assert.equal(installmentMaxRateBps('FI'), 5000);
  /* Польша: проценты разрешены, но не выше 7 %; Румыния — разрешены. */
  assert.equal(installmentInterestOffered('PL'), true);
  assert.equal(installmentInterestOffered('RO'), true);
  const guard = latestSql('create or replace function app.installment_interest_guard(');
  assert.ok(guard.includes('app.installment_max_rate_bps(v_country)'));
  /* Передача без счёта платформы: продавец подтверждает платёж и без документа, правило передачи — то же поле. */
  const first = latestSql('create or replace function public.mark_installment_first_paid(');
  assert.ok(first.includes('v_deal.first_invoice_id is null and not app.installment_seller_invoices(v_country)'));
  const cancel = latestSql('create or replace function public.cancel_installment_deal(');
  assert.ok(cancel.includes('v_deal.first_invoice_paid_at is not null and v_me <> v_deal.seller_company_id'));
  const handover = latestSql('create or replace function public.confirm_installment_handover(');
  assert.ok(handover.includes('if v_deal.first_invoice_paid_at is null then'));
  const migration = readFileSync(new URL('../../../supabase/migrations/20261202100000_installment_open_pl_ro.sql', import.meta.url), 'utf8');
  assert.ok(!/end case/i.test(migration));
  assert.equal(migration.match(/security definer/g).length, 3);
  for (const fn of ['installment_country_open(text)', 'installment_seller_invoices(text)', 'installment_max_rate_bps(text)', 'installment_interest_guard()']) {
    assert.ok(migration.includes(`revoke all on function app.${fn} from public, anon, authenticated;`), fn);
  }
  assert.equal((migration.match(/set search_path = ''/g) ?? []).length, 6);
});

test('документы без счёта: всё — уведомления со своей нумерацией от договора, серию счетов продавца не занимают', () => {
  for (const code of COUNTRIES) {
    const tx = invoiceTexts(code);
    assert.equal(tx.country, code);
    for (const day of ['2026-11-25', '2027-06-01', '2030-01-01']) assert.equal(firstDocumentKind(code, day, day), 'NOTICE', code);
    const c = 'OS-2026-00031';
    const numbers = [
      tx.notice.number({ contract: c }),
      tx.paymentDoc.number({ contract: c, n: 3 }),
      tx.handoverDoc.number({ contract: c }),
      tx.cancel.number({ contract: c, original: tx.notice.number({ contract: c }) }),
    ];
    for (const n of numbers) assert.ok(n.includes(c), `${code}: ${n}`);
    assert.equal(new Set(numbers).size, 4);
    /* Отмена — не кредит-нота; все виды — без строк НДС. */
    assert.equal(tx.credit, tx.cancel);
    for (const kind of ['NOTICE', 'PAYMENT', 'HANDOVER', 'CANCEL']) {
      const doc = plainDoc(tx, kind);
      assert.ok(doc?.noVat, `${code} ${kind}`);
      assert.ok(doc.title.length <= 21, doc.title);
      assert.ok(!INVOICE_WORD[code].test(doc.title) && !INVOICE_WORD[code].test(doc.docName), `${code} ${kind}`);
      assert.ok(!/invoice/i.test(plainDocLabels(tx, kind).number.join(' ')), `${code} ${kind}`);
    }
    /* Ни одна подпись документа не называет его счётом. */
    for (const v of Object.values(tx.labels).flat()) assert.ok(!INVOICE_WORD[code].test(v) && !/invoice/i.test(v), `${code}: ${v}`);
    assert.match(paymentReference(numbers[1], code), /^RF\d{2}/);
  }
  assert.deepEqual(
    ['PL', 'RO'].map((c) => invoiceTexts(c).notice.number({ contract: 'X' })),
    ['IP-X', 'NP-X'],
  );
  /* У немецкой платёжной информации номера в текстах нет — она по-прежнему из серии. */
  assert.equal(invoiceTexts('DE').notice.number, undefined);
});

test('документы без счёта: «faktura» / «factură» — только в предложениях «это не счёт»; суммы и что должен содержать счёт продавца', () => {
  const args = {
    down: '10 000 zł', vat: '14 950 zł', rest: '55 000 zł', months: 24, contract: 'OS-2026-00031', vatMode: 'STANDARD',
    price: '65 000 zł', vatPercent: '23', gross: '79 950 zł', advance: '24 950 zł', advanceVat: '4 665,45 zł', handover: '01.12.2026',
  };
  for (const code of COUNTRIES) {
    const tx = invoiceTexts(code);
    const first = [tx.notice.note, tx.notice.firstNote(args)].join('\n');
    const hv = tx.handover.note({ proforma: 'x', advance: args.advance, vat: args.vat, rest: args.rest, months: 24, contract: args.contract, price: args.price, gross: args.gross, vatPercent: '23', advanceVat: args.advanceVat, handover: args.handover });
    const docs = {
      first,
      firstLine: tx.notice.firstLine({ what: 'Volvo', contract: 'c' }),
      firstMail: tx.notice.firstMailSubject({ number: 'n', seller: 's', contract: 'c' }) + '\n' + tx.notice.firstMailText({ number: 'n', contract: 'c', what: 'w', seller: 's', sellerEmail: 'e', payNow: 'p', due: 'd', iban: 'i', reference: 'r' }),
      payment: tx.payment.note({ firstNumber: '', hasInterest: true }) + '\n' + tx.payment.note({ firstNumber: '' }),
      paymentLines: tx.payment.line({ n: 1, months: 2, contract: 'c', what: 'w' }) + '\n' + tx.payment.interestLine,
      paymentMail: tx.payment.mailSubject({ seller: 's', n: 1, months: 2, contract: 'c' }) + '\n' + tx.payment.mailText({ contract: 'c', n: 1, months: 2, what: 'w', total: 't', due: 'd', iban: 'i' }) + '\n' + tx.payment.mailFooter({ number: 'n', reference: 'r' }),
      handover: hv,
      handoverLine: tx.handover.line({ what: 'w', contract: 'c' }),
      handoverMail: tx.handover.mailSubject({ seller: 's', contract: 'c' }) + '\n' + tx.handover.mailText({ contract: 'c', what: 'w', seller: 's' }),
      cancel: tx.cancel.note({ original: 'o', originalDate: 'd', contract: 'c', refund: '1 zł' }) + '\n' + tx.cancel.note({ original: 'o', originalDate: 'd', contract: 'c', refund: null }),
      cancelMail: tx.cancel.mailSubject({ seller: 's', original: 'o' }) + '\n' + tx.cancel.mailText({ original: 'o', contract: 'c' }),
    };
    for (const [where, text] of Object.entries(docs)) {
      onlyNotInvoice(code, text, where);
      assert.ok(!/undefined|NaN/.test(text), `${code} ${where}`);
    }
    /* Каждый документ прямо говорит, что он не счёт, и называет систему. */
    for (const where of ['first', 'payment', 'handover', 'cancel']) {
      assert.ok(NOT_INVOICE[code].test(docs[where]), `${code} ${where}`);
      assert.ok(docs[where].includes(SELLER_INVOICE_SYSTEMS[code]), `${code} ${where}`);
    }
    /* Что должен содержать счёт продавца: цена без НДС, НДС, цена с НДС. */
    for (const v of [args.price, args.gross, args.vat]) {
      assert.ok(first.includes(v), `${code} first ${v}`);
      assert.ok(hv.includes(v), `${code} handover ${v}`);
    }
  }
  const pl = invoiceTexts('PL');
  /* Польша: платёж до передачи — аванс, НДС при получении (art. 19a ust. 8), счёт на всю цену — при передаче (art. 7, 19a ust. 1). */
  const plFirst = pl.notice.firstNote(args);
  assert.ok(plFirst.includes('art. 19a ust. 8') && plFirst.includes(args.advanceVat));
  assert.ok(pl.handover.note({ proforma: '', advance: 'a', vat: 'v', rest: 'r', months: 1, contract: 'c', handover: 'h' }).includes('art. 7 ust. 1 pkt 2 i art. 19a ust. 1'));
  assert.ok(pl.payment.note({ firstNumber: '' }).includes('nie wystawia odrębnych faktur na raty'));
  /* Проценты в Польше — без вывода о НДС (не подтверждено). */
  assert.ok(!/zwolnion/i.test(pl.payment.interestLine));
  assert.ok(pl.payment.note({ firstNumber: '', hasInterest: true }).includes('nie został potwierdzony'));
  const ro = invoiceTexts('RO');
  /* Румыния: цена фактурируется до передачи (п. 4.2), взносы по цене — нет, проценты — ежемесячно без НДС. */
  assert.ok(ro.notice.firstNote(args).includes('5 zile lucrătoare'));
  assert.ok(ro.payment.note({ firstNumber: '' }).includes('rata din preț nu se facturează'));
  assert.ok(ro.payment.note({ firstNumber: '', hasInterest: true }).includes('scutită de TVA'));
  assert.ok(ro.payment.interestLine.includes('art. 292 alin. (2) lit. a) pct. 1'));
  /* Буквы страны: польские и румынские с запятой снизу, без седили. */
  const roAll = Object.values(ro).filter((v) => typeof v === 'string').join('') + ro.notice.firstNote(args) + ro.handover.note({ proforma: '', advance: '', vat: '', rest: '', months: 1, contract: '' });
  assert.ok(!/[şţŞŢ]/.test(roAll));
  for (const ch of 'ăâîșț') assert.ok(roAll.toLowerCase().includes(ch), ch);
  for (const ch of 'ąćęłńóśż') assert.ok((plFirst + pl.handover.note({ proforma: '', advance: '', vat: '', rest: '', months: 1, contract: '' }) + pl.cancel.note({ original: '', originalDate: '', contract: '', refund: null }) + pl.payment.mailText({ contract: '', n: 1, months: 1, what: '', total: '', due: '', iban: '' })).includes(ch), ch);
});

/* Договор: суммы так, как их печатает createFormat (злотые, леи). */
function money(intl, currency) {
  return (cents) =>
    new Intl.NumberFormat(intl, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
}

function input(code, over = {}) {
  const m = code === 'PL' ? money('pl-PL', 'PLN') : money('ro-RO', 'RON');
  const vat = code === 'PL' ? 1_495_000 : 1_365_000;
  const day = (y, mo, d) => `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`;
  const plan = Array.from({ length: 24 }, (_, i) => ({
    n: i + 1,
    due: day(i < 12 ? 2027 : 2028, (i % 12) + 1, 1),
    principal: m(229_167),
    interest: '–',
    total: m(229_167),
    balance: m(Math.max(0, 5_500_000 - 229_167 * (i + 1))),
  }));
  return {
    number: 'OS-2026-00031',
    date: day(2026, 11, 23),
    seller: { name: code === 'PL' ? 'Przewóz Łódź Sp. z o.o.' : 'Transport Constanța SRL', businessId: '5260250995', address: 'ul. Kwiatkowskiego 60, 81-127 Gdynia', vatRegistered: true, email: 's@przyklad.pl', phone: '' },
    buyer: { name: code === 'PL' ? 'Żuraw Trans S.A.' : 'Șoseaua Transport SRL', businessId: '14399840', address: 'Strada Portului 1, 900900 Constanța', vatRegistered: true, email: 'b@exemplu.ro', phone: '' },
    vehicle: { make: 'Volvo FH', plate: 'GD 12345', odometer: '420 000 km' },
    price: {
      net: m(6_500_000),
      vatLabel: '',
      vat: m(vat),
      gross: m(6_500_000 + vat),
      downGross: m(1_000_000 + vat),
      rest: m(5_500_000),
      interestTotal: null,
      installmentPrice: m(6_500_000 + vat),
      tenth: m(code === 'PL' ? 0 : 983_125),
      twentieth: m(code === 'PL' ? 0 : 983_125),
      creditClaim: m(5_500_000),
      totalPayable: m(6_500_000 + vat),
    },
    vatMode: 'STANDARD',
    months: 24,
    ratePercent: null,
    handover: day(2026, 12, 1),
    schedule: [],
    vatPercent: code === 'PL' ? '23' : '21',
    down: m(1_000_000),
    firstInvoiceNumber: null,
    plan,
    planTotals: { principal: m(5_500_000), interest: '–', all: m(6_500_000 + vat), instalments: m(5_500_000) },
    dueDay: 1,
    ...over,
  };
}

test('договор Польши: дословный текст шаблона, data pewna, договорные пороги, счета — у продавца в KSeF', () => {
  assert.equal(bareZl('79 950 zł'), '79 950');
  const text = contractPlainText(COUNTRY_CONTRACTS.PL_RATY.build(input('PL'))).replace(/[  ]/g, ' ');
  assert.ok(text.includes('UMOWA SPRZEDAŻY POJAZDU NA RATY Z ZASTRZEŻENIEM WŁASNOŚCI'));
  assert.ok(text.includes('WŁASNOŚĆ PRZEDMIOTU SPRZEDAŻY NIE PRZECHODZI NA KUPUJĄCEGO PRZED ZAPŁATĄ CAŁEJ CENY.'));
  assert.ok(text.includes('Umowa nr OS-2026-00031 · zawarta w dniu 23.11.2026'));
  assert.ok(text.includes('Podatek od towarów i usług 23 % od kwoty 65 000: 14 950'));
  assert.ok(text.includes('Cena brutto wynosi 79 950 zł'));
  assert.ok(text.includes('co najmniej dwóch rat dłużej niż 14 dni albo z zapłatą jednej raty dłużej niż 30 dni'));
  assert.ok(text.includes('przy użyciu Krajowego Systemu e-Faktur'));
  assert.ok(text.includes(`objętej fakturą nr ${'_'.repeat(14)}; Sprzedawca nie wystawia odrębnych faktur`));
  assert.ok(text.includes('nie wystawia faktur i nie odpowiada za wykonanie zobowiązań Stron'));
  assert.ok(text.includes('kwalifikowanym elektronicznym znacznikiem czasu') && text.includes('datę pewną'));
  assert.ok(text.includes('( ) posiada ( ) nie posiada status dużego przedsiębiorcy'));
  assert.ok(text.includes('komornik sądowy') && text.includes('art. 777 § 1 pkt 4'));
  assert.ok(text.includes('Odroczona część ceny nie jest oprocentowana.'));
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/undefined|NaN|pp\.kk\.vvvv|Opcjonalnie|Wariant|€/.test(text));
  for (const ch of 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ'.slice(0, 9)) assert.ok(text.includes(ch), ch);
  const rated = contractPlainText(COUNTRY_CONTRACTS.PL_RATY.build(input('PL', { ratePercent: '6,5', price: { ...input('PL').price, interestTotal: '4 100 zł' } })));
  assert.ok(rated.includes('stałej stopy 6,5 % w stosunku rocznym') && rated.includes('odsetki maksymalne'));
});

test('договор Румынии: дословный текст шаблона, RNPM до передачи, 1/8 цены, PDF RAHTIS — не счета', () => {
  assert.equal(bareLei('79.950 lei'), '79.950');
  const text = contractPlainText(COUNTRY_CONTRACTS.RO_RATE.build(input('RO'))).replace(/[  ]/g, ' ');
  assert.ok(text.includes('CONTRACT DE VÂNZARE CU PLATA PREȚULUI ÎN RATE ȘI REZERVA PROPRIETĂȚII'));
  assert.ok(text.includes('DREPTUL DE PROPRIETATE ASUPRA VEHICULULUI NU SE TRANSFERĂ CUMPĂRĂTORULUI PÂNĂ LA PLATA INTEGRALĂ A PREȚULUI.'));
  assert.ok(text.includes('Contract nr. OS-2026-00031 · Data 23.11.2026'));
  assert.ok(text.includes('TVA 21 % aplicată la 65.000: 13.650'));
  assert.ok(text.includes('respectiv 9.831,25 lei'));
  assert.ok(text.includes('Documentele în format PDF puse la dispoziție prin serviciul RAHTIS au caracter informativ și nu sunt facturi.'));
  assert.ok(text.includes('rezerva proprietății a fost înscrisă în Registrul Național de Publicitate Mobiliară'));
  assert.ok(text.includes('numai cu concursul executorului judecătoresc ori în temeiul unei hotărâri judecătorești'));
  assert.ok(text.includes('instanța poate reduce sumele reținute de vânzător (art. 1.757 alin. (2) din Codul civil)'));
  assert.ok(text.includes(`facturată prin factura nr. ${'_'.repeat(14)}`));
  assert.ok(text.includes('un termen de 15 zile'));
  assert.ok(text.includes('Pentru restul de preț nu se percepe dobândă.'));
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  /* Финские заполнители шаблона заменены по-румынски. */
  assert.ok(!/undefined|NaN|€/.test(text));
  assert.ok(!/\b(nimi|kyllä|merkki|luettelo|nouto|myyjä|ostaja|kuukauden|törmäys|kotipaikan|nimenselvennys|määrä|klo)\b/i.test(text));
  assert.ok(!/[şţŞŢ]/.test(text));
  for (const ch of 'ăâîșțĂÂÎȘȚ') assert.ok(text.includes(ch), ch);
});

test('тексты кабинета Польши и Румынии: все поля на каждом языке, термины страны, ничего финского', () => {
  for (const code of COUNTRIES) {
    const keys = Object.keys(LAW_TEXTS[code].en).sort();
    for (const l of locales) {
      const t = LAW_TEXTS[code][l];
      assert.deepEqual(Object.keys(t).sort(), keys, `${code}/${l}`);
      for (const [k, v] of Object.entries(t)) {
        const list = Array.isArray(v) ? v : [v];
        for (const x of list) assert.ok(typeof x === 'string' && x.trim().length > 10, `${code}/${l}/${k}`);
        for (const x of list) assert.ok(!/Traficom|91\/1966|osamaksukauppalaki|ulosottomies/i.test(x), `${code}/${l}/${k}: финский термин`);
        for (const x of list) assert.ok(!/[şţŞŢ]/.test(x), `${code}/${l}/${k}: седиль`);
      }
      assert.ok(t.thresholdTitle.includes('{plate}'), `${code}/${l}`);
      assert.ok(t.listingNote.includes(SELLER_INVOICE_SYSTEMS[code]), `${code}/${l}: нет системы в оговорке`);
      assert.ok(t.invoiceNote.includes(SELLER_INVOICE_SYSTEMS[code]), `${code}/${l}`);
    }
  }
  for (const l of locales) {
    const pl = LAW_TEXTS.PL[l];
    assert.equal(pl.checkBefore.length, 3, l);
    assert.ok(/data pewna|datę pewną|daty pewnej/.test(pl.checkBefore[0]), `PL/${l}`);
    assert.ok(/2\.?\s?a/.test(pl.checkBefore[1]) && pl.checkBefore[1].includes('60'), `PL/${l}`);
    assert.ok(pl.checkBefore[2].includes('777'), `PL/${l}`);
    assert.ok(/komornik/.test(pl.threshold) && pl.threshold.includes('554'), `PL/${l}`);
    assert.ok(pl.checkRegister.includes('CEPiK') || pl.checkRegister.includes('dowód rejestracyjny'), `PL/${l}`);
    assert.ok(pl.rateHint.includes('7'), `PL/${l}`);
    assert.ok(pl.afterPaid.includes('30'), `PL/${l}`);
    assert.ok(!/\{tenth\}|\{twentieth\}|\{needed\}/.test(pl.thresholdsText), `PL/${l}`);
    const ro = LAW_TEXTS.RO[l];
    assert.equal(ro.checkBefore.length, 1, l);
    assert.ok(ro.checkBefore[0].includes('RNPM'), `RO/${l}`);
    assert.ok(ro.threshold.includes('executor judecătoresc'), `RO/${l}`);
    assert.ok(/1\.?757/.test(ro.settlement), `RO/${l}`);
    assert.ok(ro.thresholdsText.includes('{tenth}') && ro.thresholdsText.includes('{needed}') && !ro.thresholdsText.includes('{twentieth}'), `RO/${l}`);
    assert.ok(ro.legalNoticeExtra.includes('2016'), `RO/${l}`);
    assert.ok(ro.afterPaid.includes('90'), `RO/${l}`);
    /* Общие слова «уведомление вместо счёта» — на всех языках, с системой. */
    const si = SELLER_INVOICE_TEXTS[l];
    assert.deepEqual(Object.keys(si).sort(), Object.keys(SELLER_INVOICE_TEXTS.en).sort(), l);
    assert.ok(si.vatFixed.includes('{system}') && si.agreedBody.includes('{number}') && si.firstUnpaid.includes('{system}'), l);
    assert.ok(si.noIbanTitle.includes('{n}') && si.noIbanTitle.includes('{plate}') && si.firstPaid.includes('{date}'), l);
    assert.ok(si.overdueBody.includes('{date}') && si.overdueBody.includes('{days}') && si.invoiceMissing.includes('{reason}'), l);
  }
});

const fullBase = () => ({
  nav: 'NAV',
  intro: 'FI intro',
  introSeller: 'FI introSeller',
  notAllowed: 'FI notAllowed',
  listing: { vatFixed: 'FI vat', price: 'P' },
  deal: { title: 'T', contract: 'FI contract', nextSteps: 'FI nextSteps', invoice: 'First invoice (PDF)', invoiceMissing: 'FI missing {reason}' },
  invoiceReasons: { NO_IBAN: 'no iban', UNSENT: 'FI unsent' },
  notify: {
    thresholdTitle: 'FI tt', thresholdBody: 'FI tb', paidOffBody: 'FI pob', overdueTitle: 'OT',
    agreedBody: 'FI agreed', overdueBody: 'FI overdue', noIbanTitle: 'FI nit', noIbanBody: 'FI nib', terminatedBody: 'FI term',
  },
  termination: {
    hint: 'FI hint', reasons: { REPOSSESSED: 'FI rep', AGREEMENT: 'FI agr' }, settlement: 'FI set', title: 'TT',
    confirm: 'FI conf', stopped: 'FI stop', paidFirst: 'FI pf', invoicedUnpaid: 'FI iu', notInvoiced: 'FI ni',
  },
  stage3: {
    checklist: ['c0', 'c1', 'FI c2', 'FI c3', 'c4'], remedy: 'FI remedy', payoff: 'FI payoff', paidOff: 'FI paidOff', confirm: 'C',
    firstPaid: 'FI fp', firstUnpaid: 'FI fu', markFirstPaid: 'FI mfp', cancelCredit: 'FI cc', creditNote: 'FI cn', creditMissing: 'FI cm', makeCredit: 'FI mc', colInvoice: 'FI ci',
  },
});

test('кабинет Польши и Румынии: слова о счетах платформы заменены, чек-лист с data pewna и RNPM, оговорка о документах', () => {
  const b = fullBase();
  for (const code of COUNTRIES) {
    for (const l of locales) {
      const c = withCountryTexts(b, l, code);
      const si = SELLER_INVOICE_TEXTS[l];
      const sys = SELLER_INVOICE_SYSTEMS[code];
      assert.equal(c.deal.invoice, si.dealInvoice);
      assert.equal(c.stage3.markFirstPaid, si.markFirstPaid);
      assert.equal(c.stage3.firstUnpaid, si.firstUnpaid.replaceAll('{system}', sys));
      assert.equal(c.listing.vatFixed, si.vatFixed.replaceAll('{system}', sys));
      assert.equal(c.notify.agreedBody, si.agreedBody.replaceAll('{system}', sys));
      assert.equal(c.invoiceReasons.UNSENT, si.unsent);
      assert.equal(c.invoiceReasons.NO_IBAN, 'no iban');
      assert.equal(c.termination.paidFirst, si.paidFirst);
      assert.equal(c.stage3.creditNote, si.creditNote);
      assert.ok(!JSON.stringify(c).includes('{system}'), `${code}/${l}`);
      assert.equal(c.country.sellerInvoices.system, sys);
      assert.equal(c.country.sellerInvoices.listingNote, LAW_TEXTS[code][l].listingNote);
      assert.equal(c.country.sellerInvoices.handoverDoc, si.handoverDoc);
      assert.equal(c.country.legalNotice, LAW_TEXTS[code][l].legalNoticeExtra ? `${LEGAL_NOTICE[l]} ${LAW_TEXTS[code][l].legalNoticeExtra}` : LEGAL_NOTICE[l]);
      assert.equal(c.stage3.payoff, COMMON_TEXTS[l].payoff);
    }
  }
  const pl = withCountryTexts(b, 'en', 'PL');
  const L = LAW_TEXTS.PL.en;
  assert.deepEqual(pl.stage3.checklist, ['c0', L.checkFirstPaid, ...L.checkBefore, L.checkRegister, L.checkInsurance, 'c4']);
  const ro = withCountryTexts(b, 'ro', 'RO');
  const R = LAW_TEXTS.RO.ro;
  assert.deepEqual(ro.stage3.checklist, ['c0', R.checkFirstPaid, R.checkBefore[0], R.checkRegister, R.checkInsurance, 'c4']);
  /* У других стран слова о счетах остаются прежними. */
  for (const code of ['EE', 'LV', 'SE', 'DK', 'LT', 'DE']) {
    const c = withCountryTexts(b, 'en', code);
    assert.equal(c.deal.invoice, 'First invoice (PDF)', code);
    assert.equal(c.stage3.markFirstPaid, 'FI mfp', code);
    assert.equal(c.country.sellerInvoices, undefined, code);
  }
  assert.equal(withCountryTexts(b, 'fi', 'FI'), b);
  assert.equal(countryEventCode('threshold', 'PL'), 'installment.threshold.pl');
  assert.equal(countryEventCode('paid_off', 'ro'), 'installment.paid_off.ro');
  assert.deepEqual(b, fullBase());
});

test('правила Польши и Румынии подключены к стране', () => {
  assert.equal(installmentRules('PL').id, 'PL_KC589');
  assert.equal(installmentRules('RO').id, 'RO_CC1755');
  assert.equal(installmentRules('NO'), null);
});
