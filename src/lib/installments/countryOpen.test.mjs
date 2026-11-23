/*
 * Открытые страны рассрочки (23.11.2026): у каждой есть правила, договор,
 * тексты счетов и тексты кабинета на всех языках; договор, счёт и тексты
 * выбираются по стране; финские тексты счетов не изменились.
 * Запуск: npm test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { COUNTRY_PACKS } from '../country/index.ts';
import { locales } from '../i18n/config.ts';
import { finnishReference, paymentReference } from '../sites/invoice.ts';
import { FI_INVOICE_LABELS } from '../sites/invoiceLabels.ts';
import {
  INSTALLMENT_COUNTRIES,
  installmentCountry,
  installmentDay,
  installmentTimeZone,
  installmentToday,
  openInstallmentCountries,
} from './countries.ts';
import { COUNTRY_CONTRACTS, contractTemplateExists } from './contractText/index.ts';
import { bare, contractPlainText } from './contractText/blocks.ts';
import {
  COMMON_TEXTS,
  LAW_TEXTS,
  LEGAL_NOTICE,
  countryEventCode,
  countryNoticeLocale,
  countryTextsExist,
  lawCountry,
  withCountryTexts,
} from './countryTexts/index.ts';
import { documentKind, documentLabels, invoiceTexts, invoiceTextsExist, invoicesReady } from './invoiceTexts.ts';
import { INSTALLMENT_RULES } from './rules.ts';

test('у каждой открытой страны есть правила, договор, тексты счетов и тексты кабинета на всех десяти языках', () => {
  assert.equal(locales.length, 10);
  for (const code of openInstallmentCountries()) {
    const c = installmentCountry(code);
    assert.ok(INSTALLMENT_RULES[c.rules], `${code}: нет правил ${c.rules}`);
    assert.ok(contractTemplateExists(c.contract), `${code}: нет шаблона договора ${c.contract}`);
    assert.ok(invoiceTextsExist(code), `${code}: нет текстов счетов`);
    assert.ok(invoicesReady(code), `${code}: не решён порядок первого счёта`);
    assert.ok(countryTextsExist(code), `${code}: нет текстов кабинета на всех языках`);
    assert.equal(invoiceTexts(code).country, code);
  }
  /* Закрытая страна без текстов — не «готова», даже если её вписать в реестр. */
  assert.equal(countryTextsExist('SE'), false);
  assert.equal(invoiceTextsExist('SE'), false);
  assert.equal(contractTemplateExists(null), false);
  assert.equal(contractTemplateExists('toString'), false);
});

test('реестр: Эстония и Латвия — свои правила, свой договор на своём языке, весь НДС первым счётом', () => {
  assert.deepEqual(INSTALLMENT_COUNTRIES.EE, { open: true, rules: 'EE_VOS', contract: 'EE_JARELMAKS', contractLanguage: 'et', vatOnFirstInvoice: true });
  assert.deepEqual(INSTALLMENT_COUNTRIES.LV, { open: true, rules: 'LV_CL2070', contract: 'LV_NOMAKSA', contractLanguage: 'lv', vatOnFirstInvoice: true });
  assert.deepEqual(INSTALLMENT_COUNTRIES.FI, { open: true, rules: 'FI_OSKL', contract: 'FI_OSAMAKSU', contractLanguage: 'fi', vatOnFirstInvoice: true });
  assert.equal(installmentCountry('EE').vatStandardBps, 2400);
  assert.equal(installmentCountry('LV').vatStandardBps, 2100);
  assert.equal(installmentCountry('EE').currency, 'EUR');
  assert.equal(installmentCountry('LV').currency, 'EUR');
});

test('тексты кабинета: у страны заполнены все поля на каждом языке, подстановки на месте', () => {
  for (const code of ['EE', 'LV']) {
    const keys = Object.keys(LAW_TEXTS[code].en).sort();
    for (const l of locales) {
      const t = LAW_TEXTS[code][l];
      assert.deepEqual(Object.keys(t).sort(), keys, `${code}/${l}`);
      for (const [k, v] of Object.entries(t)) assert.ok(typeof v === 'string' && v.trim().length > 10, `${code}/${l}/${k}`);
      assert.ok(t.thresholdTitle.includes('{plate}'), `${code}/${l}: заголовок сигнала без {plate}`);
      /* Никто не должен прочитать про финский закон или финский реестр. */
      for (const v of Object.values(t)) assert.ok(!/Traficom|91\/1966|osamaksukauppalaki|ulosottomies/i.test(v), `${code}/${l}: финский термин`);
    }
  }
  for (const l of locales) {
    /* Эстония: пороги договора с суммами и числом платежей. */
    for (const ph of ['{tenth}', '{twentieth}', '{needed}']) assert.ok(LAW_TEXTS.EE[l].thresholdsText.includes(ph), `EE/${l}: ${ph}`);
    /* Латвия: ни дней просрочки от срока, ни доли цены — только два срока. */
    assert.ok(!/\{tenth\}|\{twentieth\}/.test(LAW_TEXTS.LV[l].thresholdsText), `LV/${l}`);
    assert.ok(/2070/.test(LAW_TEXTS.LV[l].threshold), `LV/${l}: нет ссылки на 2070`);
    assert.ok(/233/.test(LAW_TEXTS.EE[l].intro), `EE/${l}: нет § 233`);
    /* Термины права страны — на языке страны, из словаря исследования. */
    assert.ok(LAW_TEXTS.EE[l].checkRegister.toLowerCase().includes('vastutav'), `EE/${l}`);
    assert.ok(LAW_TEXTS.EE[l].threshold.includes('kohtutäitur'), `EE/${l}`);
    assert.ok(LAW_TEXTS.LV[l].checkRegister.includes('turētāj'), `LV/${l}`);
    assert.ok(/tiesu izpildītāj/.test(LAW_TEXTS.LV[l].threshold), `LV/${l}`);
    assert.ok(LAW_TEXTS.LV[l].checkInsurance.includes('OCTA'), `LV/${l}`);
    assert.ok(COMMON_TEXTS[l].payoff.includes('{sum}') && COMMON_TEXTS[l].paidOn.includes('{date}'), l);
    assert.ok(LEGAL_NOTICE[l].includes('{country}') && LEGAL_NOTICE[l].includes('RAHTIS'), l);
  }
});

/* Основной набор текстов — в том виде, в каком его держит copy.ts (нужные здесь поля). */
const base = () => ({
  nav: 'NAV',
  intro: 'FI intro',
  introSeller: 'FI introSeller',
  notAllowed: 'FI notAllowed',
  deal: { title: 'T', contract: 'FI contract', nextSteps: 'FI nextSteps' },
  notify: { thresholdTitle: 'FI tt', thresholdBody: 'FI tb', paidOffBody: 'FI pob', overdueTitle: 'OT' },
  termination: { hint: 'FI hint', reasons: { REPOSSESSED: 'FI rep', AGREEMENT: 'FI agr' }, settlement: 'FI set', title: 'TT' },
  stage3: { checklist: ['c0', 'c1', 'FI c2', 'FI c3', 'c4'], remedy: 'FI remedy', payoff: 'FI payoff', paidOff: 'FI paidOff', confirm: 'C' },
});

test('тексты по стране: финская компания получает тот же объект, эстонская и латвийская — свои', () => {
  const b = base();
  /* Финляндия, пусто и страна без текстов — основной набор без копии и без раздела country. */
  for (const country of ['FI', 'fi', null, undefined, '', 'SE']) {
    assert.equal(withCountryTexts(b, 'fi', country), b, String(country));
    assert.equal(withCountryTexts(b, 'ru', country).country, undefined);
  }
  for (const code of ['EE', 'LV']) {
    for (const l of locales) {
      const law = LAW_TEXTS[code][l];
      const t = withCountryTexts(b, l, code);
      assert.notEqual(t, b);
      assert.equal(t.intro, law.intro);
      assert.equal(t.introSeller, law.introSeller);
      assert.equal(t.notAllowed, law.notAllowed);
      assert.equal(t.deal.contract, law.contract);
      assert.equal(t.deal.nextSteps, law.nextSteps);
      assert.equal(t.notify.thresholdTitle, law.thresholdTitle);
      assert.equal(t.notify.thresholdBody, law.threshold);
      assert.equal(t.stage3.remedy, law.threshold);
      assert.ok(t.notify.paidOffBody.endsWith(law.afterPaid));
      assert.ok(t.stage3.paidOff.includes('{date}') && t.stage3.paidOff.endsWith(law.afterPaid));
      assert.equal(t.termination.hint, law.terminationHint);
      assert.equal(t.termination.settlement, law.settlement);
      assert.deepEqual(t.termination.reasons, { REPOSSESSED: law.reasonRepossessed, AGREEMENT: 'FI agr' });
      /* Чек-лист той же длины: действие «передача» требует отметить все пункты. */
      assert.deepEqual(t.stage3.checklist, ['c0', 'c1', law.checkRegister, law.checkInsurance, 'c4']);
      assert.equal(t.stage3.payoff, COMMON_TEXTS[l].payoff);
      assert.deepEqual(t.country, {
        code,
        thresholdsText: law.thresholdsText,
        rateHint: COMMON_TEXTS[l].rateHint,
        invoiceNote: law.invoiceNote,
        legalNotice: LEGAL_NOTICE[l],
      });
      /* Остальное — общее: не тронуто. */
      assert.equal(t.nav, 'NAV');
      assert.equal(t.deal.title, 'T');
      assert.equal(t.notify.overdueTitle, 'OT');
      assert.equal(t.stage3.confirm, 'C');
    }
    /* Неизвестный язык — английский текст страны, а не финский основной. */
    assert.equal(withCountryTexts(b, 'xx', code).intro, LAW_TEXTS[code].en.intro);
  }
  /* Основной набор не испорчен заменами. */
  assert.deepEqual(b, base());
});

test('уведомления: у Финляндии прежний код и язык, у другой страны — свой код и язык компании', () => {
  assert.equal(countryEventCode('threshold', 'FI'), 'installment.threshold');
  assert.equal(countryEventCode('paid_off', null), 'installment.paid_off');
  assert.equal(countryEventCode('threshold', 'EE'), 'installment.threshold.ee');
  assert.equal(countryEventCode('paid_off', 'lv'), 'installment.paid_off.lv');
  assert.equal(countryNoticeLocale('fi', 'FI'), 'fi');
  assert.equal(countryNoticeLocale(null, 'FI'), 'fi');
  assert.equal(countryNoticeLocale('ru', 'FI'), 'en');
  assert.equal(countryNoticeLocale('ru', 'EE'), 'ru');
  assert.equal(countryNoticeLocale('et', 'EE'), 'et');
  assert.equal(countryNoticeLocale('LV', 'LV'), 'lv');
  assert.equal(countryNoticeLocale(null, 'LV'), 'en');
  assert.equal(countryNoticeLocale('xx', 'LV'), 'en');
  assert.equal(lawCountry('FI'), null);
  assert.equal(lawCountry('ee'), 'EE');
});

test('словарь кабинета не знает кодов событий других стран — показывается записанный текст страны', () => {
  const fi = readFileSync(new URL('../i18n/dictionaries/fi.ts', import.meta.url), 'utf8');
  assert.ok(fi.includes("'event.installment.threshold'"));
  for (const code of ['installment.threshold.ee', 'installment.threshold.lv', 'installment.paid_off.ee', 'installment.paid_off.lv']) {
    assert.ok(!fi.includes(`'event.${code}'`), code);
  }
});

/* ── Договор ──────────────────────────────────────────────────────────── */

const party = (name) => ({ name, businessId: '10137319', address: 'Lootsi 13, 10151 Tallinn', vatRegistered: true, email: 'info@naide.ee', phone: '' });

function contractInput(over = {}) {
  const plan = Array.from({ length: 24 }, (_, i) => ({
    n: i + 1,
    due: `01.${String((i % 12) + 1).padStart(2, '0')}.${i < 12 ? 2027 : 2028}`,
    principal: '2 291,67 €',
    interest: '–',
    total: '2 291,67 €',
    balance: i === 23 ? '0 €' : '1 000 €',
  }));
  return {
    number: 'OS-2026-00012',
    date: '23.11.2026',
    seller: party('Müüja OÜ'),
    buyer: party('Vedaja AS'),
    vehicle: { make: 'Volvo FH 500', plate: '123 ABC', odometer: '412 000 km' },
    price: {
      net: '65 000 €',
      vatLabel: '',
      vat: '15 600 €',
      gross: '80 600 €',
      downGross: '25 600 €',
      rest: '55 000 €',
      interestTotal: null,
      installmentPrice: '80 600 €',
      tenth: '8 060 €',
      twentieth: '4 030 €',
    },
    vatMode: 'STANDARD',
    months: 24,
    ratePercent: null,
    handover: '01.12.2026',
    schedule: [],
    vatPercent: '24',
    down: '10 000 €',
    firstInvoiceNumber: '2026-0007',
    plan,
    planTotals: { principal: '55 000 €', interest: '–', all: '80 600 €' },
    dueDay: 1,
    ...over,
  };
}

test('договор выбирается по стране: Эстония — эстонский текст, Латвия — латышский, Финляндия — свой компонент', () => {
  assert.equal(INSTALLMENT_COUNTRIES.EE.contract, 'EE_JARELMAKS');
  assert.equal(INSTALLMENT_COUNTRIES.LV.contract, 'LV_NOMAKSA');
  assert.equal(COUNTRY_CONTRACTS.EE_JARELMAKS.intl, 'et-EE');
  assert.equal(COUNTRY_CONTRACTS.LV_NOMAKSA.intl, 'lv-LV');
  /* Финский договор — не из текстов стран: ContractPdf.tsx. */
  assert.equal(COUNTRY_CONTRACTS.FI_OSAMAKSU, undefined);
  assert.ok(contractTemplateExists('FI_OSAMAKSU'));
});

test('договор Эстонии: данные сделки подставлены, пороги договорные, заполнителей шаблона не осталось', () => {
  const doc = COUNTRY_CONTRACTS.EE_JARELMAKS.build(contractInput());
  const text = contractPlainText(doc);
  assert.equal(doc.pages.length, 2);
  assert.ok(text.includes('VEOKI JÄRELMAKSUGA MÜÜGI LEPING (OMANDIRESERVATSIOONIGA)'));
  assert.ok(text.includes('MÜÜGIESEME OMAND EI LÄHE OSTJALE ÜLE ENNE, KUI OSTUHIND ON TÄIELIKULT TASUTUD.'));
  assert.ok(text.includes('Leping nr OS-2026-00012 · Kuupäev 23.11.2026'));
  assert.ok(text.includes('Müüja OÜ') && text.includes('Vedaja AS') && text.includes('Registrikood: 10137319'));
  assert.ok(text.includes('Käibemaks 24 % summalt 65 000'));
  assert.ok(text.includes('Osamaksed 1–23: igaüks 2 291,67 eurot, maksetähtpäev iga kuu 1. kuupäev, esimene 01.01.2027.'));
  assert.ok(text.includes('Viimane osamakse 24: 2 291,67 eurot, maksetähtpäev 01.12.2028.'));
  assert.ok(text.includes('esitatud esimesel arvel nr 2026-0007.'));
  assert.ok(text.includes('Ostuhinna jäägilt intressi ei arvestata.'));
  /* Пороги — из договора: 1/10 и 1/20, 14 дней, затем дополнительный срок и только потом отказ. */
  assert.ok(text.includes('üks kümnendik 8 060 eurot ja üks kahekümnendik 4 030 eurot'));
  assert.ok(text.includes('vähemalt neljateistkümnepäevase täiendava tähtaja'));
  assert.ok(text.includes('Müüja ei võta sõidukit ostja valdusest ära ostja nõusolekuta'));
  assert.ok(text.includes('Lepingule kohaldatakse Eesti õigust.'));
  assert.ok(text.includes('Lisa 1. Maksegraafik') && text.includes('Lisa 2. Üleandmise-vastuvõtmise akt'));
  /* Ни финских, ни шаблонных заполнителей. */
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/kyllä|merkki, malli|pp\.kk\.vvvv|määrä|osamaksukaup|Traficom/i.test(text));
  /* С процентами — вариант B п. 4.4 и ссылки на KMS. */
  const withRate = contractPlainText(
    COUNTRY_CONTRACTS.EE_JARELMAKS.build(contractInput({ ratePercent: '6,5', price: { ...contractInput().price, interestTotal: '3 210,55 €' } })),
  );
  assert.ok(withRate.includes('fikseeritud intressi 6,5 protsenti aastas'));
  assert.ok(withRate.includes('intressi kogusumma 3 210,55 eurot'));
  assert.ok(withRate.includes('KMS § 12 lg 8') && withRate.includes('KMS § 16 lg 2¹ p 2'));
});

test('договор Латвии: два пропущенных срока, запрет самоуправства, обязательный взаиморасчёт', () => {
  const input = contractInput({ vatPercent: '21', seller: party('Pārdevējs SIA'), buyer: party('Pārvadātājs SIA') });
  const doc = COUNTRY_CONTRACTS.LV_NOMAKSA.build(input);
  const text = contractPlainText(doc);
  assert.equal(doc.pages.length, 2);
  assert.ok(text.includes('NOMAKSAS PIRKUMA LĪGUMS'));
  assert.ok(text.includes('ĪPAŠUMA TIESĪBAS UZ PIRKUMA PRIEKŠMETU PALIEK PĀRDEVĒJAM'));
  assert.ok(text.includes('Līgums Nr. OS-2026-00012 · Datums 23.11.2026'));
  assert.ok(text.includes('Pievienotās vērtības nodoklis 21 % no summas 65 000'));
  assert.ok(text.includes('Maksājumi 1–23: katrs 2 291,67 EUR, maksājuma diena — katra mēneša 1. datums, pirmais maksājums 01.01.2027.'));
  assert.ok(text.includes('Pircējs ir palaidis garām divus maksājumu termiņus un abi maksājumi joprojām nav samaksāti'));
  assert.ok(text.includes('nosakot vismaz 14 dienu termiņu parāda samaksai'));
  assert.ok(text.includes('Pārdevējs nav tiesīgs pārņemt transportlīdzekli patvaļīgi, pret Pircēja gribu (Civillikuma 1732. pants).'));
  assert.ok(text.includes('savstarpējo norēķinu saskaņā ar Civillikuma 2070. pantu'));
  assert.ok(text.includes('1. pielikums. Maksājumu grafiks') && text.includes('2. pielikums. Pieņemšanas–nodošanas akts'));
  /* В латвийском договоре нет долей цены 1/10 и 1/20 — правило другое. */
  assert.ok(!text.includes('8 060') && !text.includes('4 030'));
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/kyllä|merkki, malli|pp\.kk\.vvvv|määrä|nouto|myyjä|ostaja|ETA-valtiot|kuukauden|klo /i.test(text), 'остался финский заполнитель');
});

test('договор: счёт ещё без номера — прочерк; неравные взносы — отсылка к графику; сумма без знака валюты', () => {
  const noInvoice = contractPlainText(COUNTRY_CONTRACTS.EE_JARELMAKS.build(contractInput({ firstInvoiceNumber: null })));
  assert.ok(noInvoice.includes('esitatud esimesel arvel nr ______________.'));
  const uneven = contractInput();
  uneven.plan[0] = { ...uneven.plan[0], principal: '2 291,68 €' };
  assert.ok(contractPlainText(COUNTRY_CONTRACTS.EE_JARELMAKS.build(uneven)).includes('Osamaksed 1–23: maksegraafiku (lisa 1) kohaselt'));
  assert.ok(contractPlainText(COUNTRY_CONTRACTS.LV_NOMAKSA.build(uneven)).includes('Maksājumi 1–23: saskaņā ar maksājumu grafiku (1. pielikums)'));
  /* Один взнос: строки «взносы 1–0» нет. */
  const single = contractInput({ months: 1, plan: [contractInput().plan[0]] });
  const one = contractPlainText(COUNTRY_CONTRACTS.EE_JARELMAKS.build(single));
  assert.ok(one.includes('Viimane osamakse 1:') && !one.includes('Osamaksed 1–0'));
  assert.equal(bare('12 345,67 €'), '12 345,67');
  assert.equal(bare('12 345,67 €'), '12 345,67');
  assert.equal(bare('–'), '–');
});

/* ── Счета ────────────────────────────────────────────────────────────── */

test('счета: тексты выбираются по стране продавца; счёт без страны (до 23.11.2026) — финский', () => {
  assert.equal(invoiceTexts('FI').country, 'FI');
  assert.equal(invoiceTexts('EE').country, 'EE');
  assert.equal(invoiceTexts('lv').country, 'LV');
  for (const country of [null, undefined, '', 'SE', 'toString']) assert.equal(invoiceTexts(country).country, 'FI', String(country));
  /* Финский счёт — с подписями по умолчанию, остальные — со своими. */
  assert.equal(invoiceTexts('FI').labels, undefined);
  assert.equal(invoiceTexts('EE').labels.title, 'ARVE / INVOICE');
  assert.equal(invoiceTexts('LV').labels.title, 'RĒĶINS / INVOICE');
  for (const code of ['EE', 'LV']) {
    assert.deepEqual(Object.keys(invoiceTexts(code).labels).sort(), Object.keys(FI_INVOICE_LABELS).sort(), code);
  }
  assert.equal(invoiceTexts('EE').intl, 'et-EE');
  assert.equal(invoiceTexts('LV').intl, 'lv-LV');
  assert.equal(invoiceTexts('FI').date('2027-01-05'), '5.1.2027');
  assert.equal(invoiceTexts('EE').date('2027-01-05'), '05.01.2027');
  assert.equal(invoiceTexts('LV').date('2027-01-05'), '05.01.2027');
});

test('счета: ссылка платежа — финскому продавцу viitenumero, эстонскому и латвийскому — RF', () => {
  assert.equal(paymentReference('2026-0007', 'FI'), finnishReference('2026-0007'));
  assert.equal(paymentReference('2026-0007', 'FI'), '202600075');
  for (const code of ['EE', 'LV']) {
    const ref = paymentReference('2026-0007', code);
    assert.match(ref, /^RF\d{2}202600075$/, code);
  }
});

test('счета Финляндии: тексты те же, что были до открытия других стран', () => {
  const fi = invoiceTexts('FI');
  assert.equal(fi.unit, 'kpl');
  assert.equal(fi.filePrefix, 'Lasku');
  assert.equal(fi.vatLabel('25,5'), 'ALV / VAT 25,5 %');
  assert.equal(fi.vatLabel(null), 'ALV / VAT 0 %');
  assert.equal(
    fi.first.line({ what: 'Volvo FH ABC-123', contract: 'OS-2026-00001' }),
    'Volvo FH ABC-123 – kauppahinta, osamaksusopimus nro OS-2026-00001 / purchase price, hire-purchase contract',
  );
  assert.deepEqual(fi.first.jobLabel, ['Kaupan kohde', 'Item sold']);
  assert.deepEqual(fi.first.periodLabel, ['Luovutus', 'Handover']);
  assert.deepEqual(fi.first.payNowLabel, ['Maksettava nyt', 'Due now']);
  assert.equal(
    fi.first.note({ down: '10 000 €', vat: '16 575 €', rest: '55 000 €', months: 24, contract: 'OS-2026-00001', vatMode: 'STANDARD' }),
    [
      'Osamaksukauppa: koko kauppahinnan arvonlisävero laskutetaan tällä laskulla. Maksettava nyt: käsiraha 10 000 € + arvonlisävero 16 575 €. Loppuosa 55 000 € maksetaan 24 erässä osamaksusopimuksen nro OS-2026-00001 mukaisesti; erät eivät sisällä arvonlisäveroa. Omistusoikeus säilyy myyjällä, kunnes kauppahinta on kokonaan maksettu. Ajoneuvo luovutetaan, kun tämä lasku on maksettu.',
      'Hire-purchase: VAT on the whole price is invoiced on this invoice. Due now: down payment + VAT. The remainder is paid in 24 instalments under contract OS-2026-00001, without VAT. The seller retains ownership until the price is paid in full. The vehicle is handed over once this invoice is paid.',
      'Laskuttaja on myyjä; RAHTIS (Aivomaa Oy) ei ole kaupan osapuoli eikä vastaanota maksua. / Issued by the seller; RAHTIS (Aivomaa Oy) is not a party to the sale and does not receive the payment.',
    ].join('\n'),
  );
  /* Старая сделка с маржинальной схемой — пометка на месте. */
  assert.ok(
    fi.first
      .note({ down: 'a', vat: 'b', rest: 'c', months: 2, contract: 'x', vatMode: 'MARGIN' })
      .includes('\nVoittomarginaalijärjestelmä – käytetyt tavarat. / Margin scheme – second-hand goods.\n'),
  );
  assert.equal(fi.first.mailSubject({ number: '2026-0007', seller: 'Myyjä Oy', contract: 'OS-2026-00001' }), 'Lasku 2026-0007 · Myyjä Oy · osamaksusopimus OS-2026-00001');
  assert.equal(fi.payment.interestLine, 'Korko, veroton rahoituspalvelu (AVL 41 §) / Interest, VAT-exempt financial service');
  assert.equal(
    fi.payment.line({ n: 3, months: 24, contract: 'OS-2026-00001', what: 'Volvo FH ABC-123' }),
    'Maksuerä 3/24, osamaksusopimus nro OS-2026-00001 (Volvo FH ABC-123) / Instalment 3/24',
  );
  assert.deepEqual(fi.payment.jobLabel, ['Osamaksusopimus', 'Hire-purchase contract']);
  assert.equal(fi.payment.mailFooter({ number: '2026-0009', reference: '202600091' }), 'Lasku / Invoice 2026-0009 · viitenumero / reference 202600091');
  assert.equal(fi.payment.mailSubject({ seller: 'Myyjä Oy', n: 3, months: 24, contract: 'OS-1' }), 'Lasku · Myyjä Oy · maksuerä 3/24, sopimus OS-1');
  assert.equal(fi.credit.title, 'HYVITYSLASKU / CREDIT NOTE');
  assert.equal(fi.credit.linePrefix, 'Hyvitys / Credit: ');
  assert.ok(fi.credit.note({ original: '2026-0007', originalDate: '1.12.2026', contract: 'OS-1', refund: null }).includes('Laskua ei ollut maksettu, joten palautettavaa ei ole.'));
  assert.ok(fi.credit.note({ original: '2026-0007', originalDate: '1.12.2026', contract: 'OS-1', refund: '26 575 €' }).includes('Myyjä palauttaa ostajalle maksetun 26 575 €.'));
  assert.equal(fi.notice, null);
  /* Подписи счёта по умолчанию — прежние финские с английскими. */
  assert.equal(FI_INVOICE_LABELS.title, 'LASKU / INVOICE');
  assert.equal(FI_INVOICE_LABELS.vatId, 'ALV');
  assert.deepEqual(FI_INVOICE_LABELS.job, ['Työmaa', 'Worksite']);
  assert.deepEqual(FI_INVOICE_LABELS.reference, ['Viitenumero', 'Reference']);
  assert.equal(FI_INVOICE_LABELS.footer, 'Lasku on laadittu RAHTIS-palvelussa');
});

test('счета Эстонии и Латвии: закон своей страны, проценты отдельной строкой, финского закона нет', () => {
  const args = { down: '10 000 €', vat: '15 600 €', rest: '55 000 €', months: 24, contract: 'OS-2026-00012', vatMode: 'STANDARD' };
  const ee = invoiceTexts('EE');
  const lv = invoiceTexts('LV');
  const eeNote = ee.first.note(args);
  const lvNote = lv.first.note(args);
  assert.ok(eeNote.includes('KMS § 2 lg 5') && eeNote.includes('sissemakse 10 000 € + käibemaks 15 600 €') && eeNote.includes('e-arve'));
  assert.ok(lvNote.includes('Pievienotās vērtības nodokļa likuma 1. panta 13. punkts') && lvNote.includes('pirmā iemaksa 10 000 € + PVN 15 600 €'));
  assert.ok(ee.payment.interestLine.includes('KMS § 12 lg 8') && ee.payment.interestLine.includes('KMS § 16 lg 2¹ p 2'));
  assert.ok(lv.payment.interestLine.includes('34. panta astotā daļa'));
  assert.equal(ee.vatLabel('24'), 'Käibemaks / VAT 24 %');
  assert.equal(lv.vatLabel('21'), 'PVN / VAT 21 %');
  assert.equal(ee.unit, 'tk');
  assert.equal(lv.unit, 'gab.');
  const dump = (t) =>
    [
      t.first.line({ what: 'w', contract: 'c' }),
      t.first.note(args),
      t.first.mailSubject({ number: 'n', seller: 's', contract: 'c' }),
      t.first.mailText({ number: 'n', contract: 'c', what: 'w', seller: 's', sellerEmail: 'e', payNow: 'p', due: 'd', iban: 'i', reference: 'r' }),
      t.payment.line({ n: 1, months: 2, contract: 'c', what: 'w' }),
      t.payment.interestLine,
      t.payment.note({ firstNumber: 'f' }),
      t.payment.mailSubject({ seller: 's', n: 1, months: 2, contract: 'c' }),
      t.payment.mailText({ contract: 'c', n: 1, months: 2, what: 'w', total: 't', due: 'd', iban: 'i' }),
      t.payment.mailFooter({ number: 'n', reference: 'r' }),
      t.credit.note({ original: 'o', originalDate: 'd', contract: 'c', refund: null }),
      t.credit.note({ original: 'o', originalDate: 'd', contract: 'c', refund: '1 €' }),
      t.credit.mailSubject({ seller: 's', original: 'o' }),
      t.credit.mailText({ original: 'o', contract: 'c' }),
      t.credit.title,
      ...Object.values(t.labels).flat(),
    ].join('\n');
  for (const t of [ee, lv]) {
    const all = dump(t);
    assert.ok(!/AVL|arvonlisäver|osamaksu|Lasku|viitenumero|Hyvitys|Y-tunnus|undefined/i.test(all), `${t.country}: финский текст в счёте`);
    assert.ok(all.includes('RAHTIS (Aivomaa Oy)'), t.country);
  }
});

test('Латвия с 01.01.2028: документ платформы — платёжное уведомление, а не счёт', () => {
  assert.equal(documentKind('LV', '2027-12-31'), 'INVOICE');
  assert.equal(documentKind('LV', '2028-01-01'), 'NOTICE');
  assert.equal(documentKind('lv', '2029-05-05'), 'NOTICE');
  for (const country of ['FI', 'EE', null]) assert.equal(documentKind(country, '2030-01-01'), 'INVOICE', String(country));
  assert.equal(invoiceTexts('LV').notice.title, 'MAKSĀJUMA PAZIŅOJUMS');
  assert.deepEqual(documentLabels(invoiceTexts('LV'), true).number, ['Dokumenta numurs', 'Document no.']);
  assert.deepEqual(documentLabels(invoiceTexts('LV'), false).number, ['Rēķina numurs', 'Invoice no.']);
  assert.equal(documentLabels(invoiceTexts('FI'), false), undefined);
  assert.ok(invoiceTexts('LV').notice.note.includes('strukturētu elektronisko rēķinu'));
  assert.equal(invoiceTexts('EE').notice, null);
});

/* ── Время и база ─────────────────────────────────────────────────────── */

test('даты сделки — по часовому поясу страны продавца из пакета страны', () => {
  assert.equal(installmentTimeZone('FI'), 'Europe/Helsinki');
  assert.equal(installmentTimeZone('EE'), 'Europe/Tallinn');
  assert.equal(installmentTimeZone('lv'), 'Europe/Riga');
  assert.equal(installmentTimeZone('DE'), COUNTRY_PACKS.DE.timeZone);
  assert.equal(installmentTimeZone(null), 'Europe/Helsinki');
  assert.equal(installmentTimeZone('XX'), 'Europe/Helsinki');
  /* 22:30 UTC 31 декабря — в Таллине и Риге уже 1 января, в Берлине ещё 31-е. */
  const at = '2026-12-31T22:30:00Z';
  assert.equal(installmentDay('EE', at), '2027-01-01');
  assert.equal(installmentDay('LV', at), '2027-01-01');
  assert.equal(installmentDay('FI', at), '2027-01-01');
  assert.equal(installmentDay('DE', at), '2026-12-31');
  assert.equal(installmentToday('EE', new Date(at)), '2027-01-01');
});

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

test('ставки НДС в базе (app.country_vat_standard_bps) совпадают с пакетами стран', () => {
  const sql = latestSql('create or replace function app.country_vat_standard_bps(');
  assert.ok(sql, 'функция app.country_vat_standard_bps не найдена в миграциях');
  const inDb = Object.fromEntries([...sql.matchAll(/when '([A-Z]{2})' then (\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const inCode = Object.fromEntries(Object.entries(COUNTRY_PACKS).map(([code, pack]) => [code, pack.vatStandardBps]));
  assert.deepEqual(inDb, inCode);
  assert.ok(/set search_path = ''/.test(sql));
});

test('объявление берёт ставку НДС из одной функции; согласие считает время по стране продавца', () => {
  const save = latestSql('create or replace function public.save_equipment_listing(');
  assert.ok(save.includes('app.country_vat_standard_bps(c.country::text)'));
  assert.ok(!/when 'FI' then/.test(save), 'в объявлении остался свой список ставок');
  assert.ok(/security definer/.test(save) && /set search_path = ''/.test(save));
  const accept = latestSql('create or replace function public.accept_installment_terms(');
  assert.ok(accept.includes('app.stop_timezone(c.country::text)'));
  assert.ok(!accept.includes("at time zone 'Europe/Helsinki'"));
  assert.ok(/security definer/.test(accept) && /set search_path = ''/.test(accept));
  /* В plpgsql — без оператора case … end case. */
  assert.ok(!/end case/i.test(save) && !/end case/i.test(accept));
});
