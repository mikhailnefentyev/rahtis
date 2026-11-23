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
  installmentInterestOffered,
  installmentMoney,
  installmentTimeZone,
  installmentToday,
  openInstallmentCountries,
  vatRateText,
} from './countries.ts';
import { COUNTRY_CONTRACTS, contractTemplateExists } from './contractText/index.ts';
import { bare, bareKr, contractPlainText } from './contractText/blocks.ts';
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
import {
  DE_E_INVOICE_FROM,
  documentKind,
  documentLabels,
  firstDocumentKind,
  invoiceTexts,
  invoiceTextsExist,
  invoicesReady,
  plainDoc,
  plainDocLabels,
} from './invoiceTexts.ts';
import { INSTALLMENT_RULES } from './rules.ts';

/*
 * Сумма так, как её печатает createFormat(intl).money (src/lib/format.ts):
 * узкий знак валюты, копейки — только когда они есть. Сам модуль format.ts
 * тесты не грузят (он тянет настройки приложения), поэтому правило повторено.
 */
const createFormat = (intl) => ({
  money: (cents, currency) =>
    new Intl.NumberFormat(intl, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100),
});

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
    /* У страны, кроме Финляндии, — свой текст на каждом из десяти языков и договор на её языке. */
    if (code !== 'FI') {
      assert.equal(lawCountry(code), code);
      for (const l of locales) assert.ok(LAW_TEXTS[code][l]?.intro, `${code}/${l}: нет текста кабинета`);
      assert.ok(COUNTRY_CONTRACTS[c.contract], `${code}: нет текста договора`);
      assert.equal(COUNTRY_CONTRACTS[c.contract].intl.slice(0, 2), c.contractLanguage, `${code}: язык чисел договора`);
    }
  }
  assert.deepEqual(openInstallmentCountries().sort(), ['DE', 'DK', 'EE', 'FI', 'LT', 'LV', 'SE']);
  /* Закрытая страна без текстов — не «готова», даже если её вписать в реестр. */
  assert.equal(countryTextsExist('NO'), false);
  assert.equal(invoiceTextsExist('NO'), false);
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
  for (const country of ['FI', 'fi', null, undefined, '', 'NO']) {
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
  for (const country of [null, undefined, '', 'NO', 'toString']) assert.equal(invoiceTexts(country).country, 'FI', String(country));
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

/* ── Швеция и Дания (23.11.2026) ──────────────────────────────────────── */

test('реестр: Швеция и Дания — свои правила, договор на своём языке, кроны, весь НДС первым счётом', () => {
  assert.deepEqual(INSTALLMENT_COUNTRIES.SE, {
    open: true,
    rules: 'SE_AVBL',
    contract: 'SE_AVBETALNING',
    contractLanguage: 'sv',
    vatOnFirstInvoice: true,
    interestOffered: false,
  });
  assert.deepEqual(INSTALLMENT_COUNTRIES.DK, { open: true, rules: 'DK_KAL', contract: 'DK_KREDITKOEB', contractLanguage: 'da', vatOnFirstInvoice: true });
  assert.equal(installmentCountry('SE').currency, 'SEK');
  assert.equal(installmentCountry('DK').currency, 'DKK');
  assert.equal(installmentCountry('SE').vatStandardBps, 2500);
  assert.equal(installmentCountry('DK').vatStandardBps, 2500);
  assert.equal(installmentTimeZone('SE'), 'Europe/Stockholm');
  assert.equal(installmentTimeZone('DK'), 'Europe/Copenhagen');
  /* 22:30 UTC 31 декабря: в Хельсинки уже 1 января, в Стокгольме и Копенгагене ещё 31-е. */
  const at = '2026-12-31T22:30:00Z';
  assert.equal(installmentDay('FI', at), '2027-01-01');
  assert.equal(installmentDay('SE', at), '2026-12-31');
  assert.equal(installmentDay('DK', at), '2026-12-31');
});

test('Швеция: проценты не предлагаются — в коде и в базе одно правило', () => {
  assert.equal(installmentInterestOffered('SE'), false);
  assert.equal(installmentInterestOffered('se'), false);
  for (const country of ['FI', 'EE', 'LV', 'DK', 'NO', 'XX', '', null, undefined]) assert.equal(installmentInterestOffered(country), true, String(country));
  /* В базе — список стран без процентов; он совпадает с реестром. */
  const sql = latestSql('create or replace function app.installment_interest_allowed(');
  assert.ok(sql, 'функция app.installment_interest_allowed не найдена в миграциях');
  const list = /not in\s*\(([^)]*)\)/.exec(sql.slice(sql.indexOf('$$')));
  assert.ok(list, 'в теле функции нет списка стран');
  const inDb = [...list[1].matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort();
  const inCode = Object.keys(INSTALLMENT_COUNTRIES).filter((code) => !installmentInterestOffered(code)).sort();
  assert.deepEqual(inDb, inCode);
  assert.ok(/set search_path = ''/.test(sql));
  /* Правило действует на объявление и на сделку — триггером, какой бы функцией условия ни писались. */
  const guard = latestSql('create or replace function app.installment_interest_guard(');
  assert.ok(guard.includes('app.installment_interest_allowed(') && guard.includes('new.annual_rate_bps <> 0'));
  assert.ok(/security definer/.test(guard) && /set search_path = ''/.test(guard) && !/end case/i.test(guard));
  const migration = readFileSync(new URL('../../../supabase/migrations/20261130100000_installment_open_se_dk.sql', import.meta.url), 'utf8');
  for (const table of ['equipment_listings', 'installment_deals']) {
    assert.ok(new RegExp(`before insert or update of annual_rate_bps, seller_company_id on public\\.${table}`).test(migration), table);
  }
  assert.ok(migration.includes('revoke all on function app.installment_interest_guard() from public, anon, authenticated;'));
  assert.ok(migration.includes('revoke all on function app.installment_country_open(text) from public, anon, authenticated;'));
  /* Договор Швеции без варианта с процентами: сделка с процентами договора не получает. */
  assert.equal(COUNTRY_CONTRACTS.SE_AVBETALNING.interest, false);
  assert.equal(COUNTRY_CONTRACTS.DK_KREDITKOEB.interest, undefined);
});

test('тексты кабинета Швеции и Дании: все поля на каждом языке, термины страны, ничего финского', () => {
  for (const code of ['SE', 'DK']) {
    const keys = Object.keys(LAW_TEXTS[code].en).sort();
    for (const l of locales) {
      const t = LAW_TEXTS[code][l];
      assert.deepEqual(Object.keys(t).sort(), keys, `${code}/${l}`);
      for (const [k, v] of Object.entries(t)) {
        for (const text of Array.isArray(v) ? v : [v]) {
          assert.ok(typeof text === 'string' && text.trim().length > 10, `${code}/${l}/${k}`);
          assert.ok(!/Traficom|91\/1966|osamaksukauppalaki|ulosottomies|undefined/i.test(text), `${code}/${l}/${k}: финский термин`);
          /* Суммы в текстах — только подстановками: ни «€», ни «евро» в кронных странах. */
          assert.ok(!/€|\beur\b|евро|euro[ans]?\b/i.test(text), `${code}/${l}/${k}: евро в тексте`);
        }
      }
      assert.ok(t.thresholdTitle.includes('{plate}'), `${code}/${l}`);
      for (const ph of ['{tenth}', '{twentieth}', '{needed}']) assert.ok(t.thresholdsText.includes(ph), `${code}/${l}: ${ph}`);
      assert.ok(typeof t.rateHint === 'string', `${code}/${l}: нет подсказки у процентов`);
    }
  }
  for (const l of locales) {
    const se = LAW_TEXTS.SE[l];
    /* Швеция: закон и его термины; порог — от kreditfordran; покупатель записан владельцем. */
    assert.ok(/1978:599/.test(se.intro) && se.intro.includes('återtaganderätt'), `SE/${l}: закон`);
    assert.ok(se.thresholdsText.includes('kreditfordran') && /14/.test(se.thresholdsText), `SE/${l}: база порога`);
    assert.ok(se.threshold.includes('Kronofogden') && se.threshold.includes('handräckning') && se.threshold.includes('avräkning'), `SE/${l}`);
    assert.ok(/8/.test(se.threshold) && se.threshold.includes('dröjsmålsränta'), `SE/${l}: право покупателя погасить просрочку`);
    assert.ok(se.checkRegister.includes('ägare') && se.checkRegister.includes('kreditgivare') && se.checkRegister.includes('Transportstyrelsen'), `SE/${l}`);
    assert.ok(se.nextSteps.includes('ägare') && se.nextSteps.includes('10'), `SE/${l}: реестр и срок`);
    assert.ok(se.checkInsurance.toLowerCase().includes('trafikförsäkring'), `SE/${l}`);
    assert.ok(se.afterPaid.includes('Transportstyrelsen'), `SE/${l}`);
    assert.ok(se.invoiceNote.includes('RF') && se.invoiceNote.includes('OCR'), `SE/${l}: ссылка платежа`);
    assert.ok(se.rateHint.includes('0'), `SE/${l}`);
    assert.ok(se.checkBefore === undefined, `SE/${l}`);
    const dk = LAW_TEXTS.DK[l];
    /* Дания: закон, 30 дней, Bilbogen до передачи, fogedretten, 14 дней на выкуп. */
    assert.ok(dk.intro.includes('kreditaftaleloven') && dk.intro.includes('ejendomsforbehold') && dk.intro.includes('Bilbogen'), `DK/${l}: закон`);
    assert.ok(/30/.test(dk.thresholdsText) && !/14/.test(dk.thresholdsText), `DK/${l}: 30 дней`);
    assert.ok(dk.threshold.includes('fogedretten') && dk.threshold.includes('§ 37') && dk.threshold.includes('indløsning') && /14/.test(dk.threshold), `DK/${l}`);
    assert.equal(dk.checkBefore.length, 1, `DK/${l}`);
    assert.ok(dk.checkBefore[0].includes('Bilbogen') && dk.checkBefore[0].includes('tinglysning'), `DK/${l}: Bilbogen в чек-листе`);
    assert.ok(dk.nextSteps.includes('Bilbogen') && /1[.,]5 %/.test(dk.nextSteps) && /1[ ,.]?850/.test(dk.nextSteps), `DK/${l}: сбор`);
    assert.ok(dk.checkRegister.includes('bruger') && dk.checkRegister.includes('ejer') && dk.checkRegister.includes('5.3'), `DK/${l}: реестр нейтрально`);
    assert.ok(dk.checkInsurance.includes('ansvarsforsikring'), `DK/${l}`);
    assert.ok(dk.afterPaid.includes('aflysning') && dk.afterPaid.includes('Bilbogen'), `DK/${l}`);
    assert.ok(dk.invoiceNote.includes('RF') && dk.invoiceNote.includes('§ 27'), `DK/${l}: счёт`);
    assert.ok(dk.rateHint.includes('§ 27'), `DK/${l}`);
  }
  /* Швеция: ни на одном языке не сказано, что продавец остаётся владельцем в реестре. */
  assert.ok(!/seller (stays|remains) the (registered )?owner/i.test(LAW_TEXTS.SE.en.nextSteps + LAW_TEXTS.SE.en.checkRegister));
  assert.ok(!/продавец остаётся (собственником|владельцем)/i.test(LAW_TEXTS.SE.ru.nextSteps + LAW_TEXTS.SE.ru.checkRegister));
  assert.ok(!/säljaren (är fortfarande|står kvar som|förblir) ägare/i.test(LAW_TEXTS.SE.sv.nextSteps + LAW_TEXTS.SE.sv.checkRegister));
  /* Неподтверждённое названо неподтверждённым. */
  assert.ok(/not confirmed/.test(LAW_TEXTS.SE.en.nextSteps) && /not been confirmed/.test(LAW_TEXTS.SE.en.thresholdsText));
  assert.ok(/not confirmed/.test(LAW_TEXTS.DK.en.nextSteps) && /not confirmed|has not confirmed/.test(LAW_TEXTS.DK.en.invoiceNote));
  assert.ok(/не подтвержд/.test(LAW_TEXTS.DK.ru.nextSteps) && /не подтвердило/.test(LAW_TEXTS.DK.ru.invoiceNote));
});

test('тексты по стране: шведская и датская компания получают свои; у Дании в чек-листе на пункт больше', () => {
  const b = base();
  for (const code of ['SE', 'DK']) {
    for (const l of locales) {
      const law = LAW_TEXTS[code][l];
      const t = withCountryTexts(b, l, code);
      assert.notEqual(t, b);
      assert.equal(t.intro, law.intro);
      assert.equal(t.deal.contract, law.contract);
      assert.equal(t.deal.nextSteps, law.nextSteps);
      assert.equal(t.notify.thresholdBody, law.threshold);
      assert.equal(t.stage3.remedy, law.threshold);
      assert.ok(t.notify.paidOffBody.endsWith(law.afterPaid));
      assert.equal(t.termination.settlement, law.settlement);
      assert.deepEqual(t.termination.reasons, { REPOSSESSED: law.reasonRepossessed, AGREEMENT: 'FI agr' });
      /* Подсказка у процентов — своя у страны, остальное общее — как у Эстонии и Латвии. */
      assert.deepEqual(t.country, {
        code,
        thresholdsText: law.thresholdsText,
        rateHint: law.rateHint,
        invoiceNote: law.invoiceNote,
        legalNotice: LEGAL_NOTICE[l],
      });
      assert.equal(t.stage3.payoff, COMMON_TEXTS[l].payoff);
    }
  }
  /* Швеция: чек-лист той же длины. Дания: перед реестром — Bilbogen; остальные пункты на своих местах. */
  assert.deepEqual(withCountryTexts(b, 'en', 'SE').stage3.checklist, ['c0', 'c1', LAW_TEXTS.SE.en.checkRegister, LAW_TEXTS.SE.en.checkInsurance, 'c4']);
  assert.deepEqual(withCountryTexts(b, 'da', 'DK').stage3.checklist, [
    'c0',
    'c1',
    LAW_TEXTS.DK.en.checkBefore[0],
    LAW_TEXTS.DK.en.checkRegister,
    LAW_TEXTS.DK.en.checkInsurance,
    'c4',
  ]);
  /* Эстония и Латвия: без своих пунктов и своей подсказки — как были. */
  for (const code of ['EE', 'LV']) {
    assert.equal(withCountryTexts(b, 'en', code).stage3.checklist.length, 5);
    assert.equal(withCountryTexts(b, 'en', code).country.rateHint, COMMON_TEXTS.en.rateHint);
    assert.equal(LAW_TEXTS[code].en.rateHint, undefined);
  }
  assert.deepEqual(b, base());
  /* Уведомления: свой код страны и язык компании. */
  assert.equal(countryEventCode('threshold', 'SE'), 'installment.threshold.se');
  assert.equal(countryEventCode('paid_off', 'dk'), 'installment.paid_off.dk');
  assert.equal(countryNoticeLocale('sv', 'SE'), 'sv');
  assert.equal(countryNoticeLocale('da', 'DK'), 'en');
  assert.equal(countryNoticeLocale('ru', 'DK'), 'ru');
  const fi = readFileSync(new URL('../i18n/dictionaries/fi.ts', import.meta.url), 'utf8');
  for (const code of ['installment.threshold.se', 'installment.threshold.dk', 'installment.paid_off.se', 'installment.paid_off.dk']) {
    assert.ok(!fi.includes(`'event.${code}'`), code);
  }
});

/* Данные договора в кронах — в том виде, в каком их отдаёт contract.ts для sv-SE и da-DK. */
function kronorInput(intl, over = {}) {
  const f = createFormat(intl);
  const cur = intl === 'sv-SE' ? 'SEK' : 'DKK';
  const kr = (cents) => f.money(cents, cur);
  const date = (y, m, d) => (intl === 'sv-SE' ? `${y}-${m}-${d}` : `${d}.${m}.${y}`);
  let balance = 60_000_000;
  const plan = Array.from({ length: 24 }, (_, i) => {
    balance -= 2_500_000;
    return {
      n: i + 1,
      due: date(i < 12 ? 2027 : 2028, String((i % 12) + 1).padStart(2, '0'), '01'),
      principal: kr(2_500_000),
      interest: '–',
      total: kr(2_500_000),
      balance: kr(balance),
    };
  });
  return {
    ...contractInput(),
    number: 'OS-2026-00031',
    date: date(2026, 11, 23),
    seller: { name: 'Säljaren Åkeri AB', businessId: '556123-4567', address: 'Hamngatan 1, 411 14 Göteborg', vatRegistered: true, email: 'a@exempel.se', phone: '' },
    buyer: { name: 'Køber Transport Øster Å A/S', businessId: '87654321', address: 'Åboulevarden 9, 5000 Odense C', vatRegistered: true, email: 'b@eksempel.dk', phone: '' },
    price: {
      net: kr(75_000_000),
      vatLabel: '',
      vat: kr(18_750_000),
      gross: kr(93_750_000),
      downGross: kr(33_750_000),
      rest: kr(60_000_000),
      interestTotal: null,
      installmentPrice: kr(93_750_000),
      tenth: kr(intl === 'sv-SE' ? 6_000_000 : 9_375_000),
      twentieth: kr(intl === 'sv-SE' ? 3_000_000 : 4_687_500),
      creditClaim: kr(60_000_000),
      totalPayable: kr(93_750_000),
    },
    vatPercent: '25',
    down: kr(15_000_000),
    handover: date(2026, 12, '01'),
    firstInvoiceNumber: '2026-0007',
    plan,
    planTotals: { principal: kr(60_000_000), interest: '–', all: kr(93_750_000) },
    ...over,
  };
}

test('суммы в кронах: знак валюты страны, число без знака для договора', () => {
  const se = createFormat('sv-SE').money(75_000_000, 'SEK');
  const dk = createFormat('da-DK').money(75_000_000, 'DKK');
  assert.ok(/kr$/.test(se) && !se.includes('€'), se);
  assert.ok(/kr\.$/.test(dk) && !dk.includes('€'), dk);
  assert.equal(bareKr(se).replace(/\s/g, ' '), '750 000');
  assert.equal(bareKr(dk), '750.000');
  assert.equal(bareKr(createFormat('da-DK').money(4_687_550, 'DKK')), '46.875,50');
  assert.equal(bareKr('–'), '–');
  /* Кабинет: сумма в валюте сделки на любом языке, без евро. */
  for (const l of locales) {
    assert.ok(!installmentMoney(l, 'SEK')(75_000_000).includes('€'), l);
    assert.ok(!installmentMoney(l, 'DKK', true)(75_000_000).includes('€'), l);
  }
  /* Строка «НДС» у сделки не из Финляндии — ставка сделки, а не финские 25,5 %. */
  assert.equal(vatRateText(2500, 'sv'), '25 %');
  assert.equal(vatRateText(2400, 'en'), '24 %');
  /* Финляндия не тронута: «евро» по-прежнему убирает bare. */
  assert.equal(bare('12 345,67 €'), '12 345,67');
});

test('договор Швеции: величины закона, пороги от kreditfordran, покупатель — владелец в реестре, без процентов', () => {
  assert.equal(COUNTRY_CONTRACTS.SE_AVBETALNING.intl, 'sv-SE');
  assert.equal(COUNTRY_CONTRACTS.SE_AVBETALNING.isoDates, true);
  const doc = COUNTRY_CONTRACTS.SE_AVBETALNING.build(kronorInput('sv-SE'));
  const text = contractPlainText(doc).replace(/[\u00a0\u202f]/g, ' ');
  assert.equal(doc.pages.length, 2);
  assert.ok(text.includes('AVTAL OM AVBETALNINGSKÖP'));
  assert.ok(text.includes('SÄLJAREN FÖRBEHÅLLER SIG RÄTTEN ATT ÅTERTA FORDONET') && text.includes('ÄGANDERÄTTEN ÖVERGÅR TILL KÖPAREN FÖRST NÄR HELA KREDITFORDRAN ÄR BETALD.'));
  assert.ok(text.includes('Avtal nr OS-2026-00031 · Datum 2026-11-23'));
  assert.ok(text.includes('Organisationsnummer: 556123-4567'));
  /* Четыре величины закона (11 §) — в п. 4.1. */
  assert.ok(text.includes('Kontantpris (inklusive mervärdesskatt): 937 500'));
  assert.ok(text.includes('innehåller ingen mervärdesskatt): 600 000'));
  assert.ok(text.includes('inga andra avgifter): ingen kreditkostnad'));
  assert.ok(text.includes('Kreditfordran (kreditbelopp och kreditkostnad): 600 000'));
  assert.ok(text.includes('Mervärdesskatt 25 % på 750 000: 187 500'));
  assert.ok(text.includes('Avbetalning 1–23: vardera 25 000 kronor, förfallodag den 1 i varje månad, första gången 2027-01-01.'));
  assert.ok(text.includes('Sista avbetalningen 24: 25 000 kronor, förfallodag 2028-12-01.'));
  assert.ok(text.includes('den första fakturan nr 2026-0007.'));
  assert.ok(text.includes('Ingen ränta tas ut på kreditbeloppet.'));
  /* Пороги — от kreditfordran: 60 000 и 30 000, а не 93 750 от цены. */
  assert.ok(text.includes('En tiondel av kreditfordran enligt detta avtal är 60 000 kronor och en tjugondel 30 000 kronor.'));
  assert.ok(text.includes('sedan mer än fjorton dagar') && text.includes('till mer än en tiondel av hela kreditfordran'));
  assert.ok(!text.includes('93 750 kronor'));
  /* Право покупателя погасить просрочку, обязательный расчёт, только Kronofogden. */
  assert.ok(text.includes('(8 § avbetalningsköplagen)') && text.includes('ska avräkning göras mellan parterna'));
  assert.ok(text.includes('Säljaren får inte på egen hand ta fordonet i besittning mot köparens vilja.'));
  assert.ok(text.includes('ansöker säljaren om handräckning hos Kronofogdemyndigheten'));
  /* Реестр: владельцем записывается покупатель; срок — десять дней. */
  assert.ok(text.includes('Köparen registreras därmed som fordonets ägare i vägtrafikregistret'));
  assert.ok(text.includes('inom tio dagar från dagen för ägarbytet'));
  /* Финского пункта о счёте покупателя при возврате нет. */
  assert.ok(text.includes('köparen utfärdar ingen faktura för återtagandet'));
  assert.ok(text.includes('Aivomaa Oy (RAHTIS) är inte part i detta avtal.'));
  assert.ok(text.includes('Bilaga 1. Betalningsplan') && text.includes('Bilaga 2. Överlämnandeprotokoll'));
  assert.ok(text.includes('Kreditfordran (kreditbelopp och kreditkostnad): 600 000 kr. En tiondel: 60 000 kr. En tjugondel: 30 000 kr.'));
  /* Ни евро, ни заполнителей шаблона, ни финских слов. */
  assert.ok(!/€|\beuro|\bEUR\b/i.test(text), 'евро в шведском договоре');
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/kyllä|merkki, malli|pp\.kk\.vvvv|määrä|luettelo|nimi\b|klo |Alternativ|Valfritt/i.test(text), 'остался заполнитель шаблона');
  /* Все буквы шведского алфавита на месте. */
  for (const ch of 'åäöÅÄÖ') assert.ok(text.includes(ch), ch);
});

test('договор Дании: 30 дней и доля всей суммы к уплате, Bilbogen до передачи, fogedretten, проценты отдельно', () => {
  assert.equal(COUNTRY_CONTRACTS.DK_KREDITKOEB.intl, 'da-DK');
  const doc = COUNTRY_CONTRACTS.DK_KREDITKOEB.build(kronorInput('da-DK'));
  const text = contractPlainText(doc).replace(/[\u00a0\u202f]/g, ' ');
  assert.equal(doc.pages.length, 2);
  assert.ok(text.includes('KØBEKONTRAKT MED EJENDOMSFORBEHOLD') && text.includes('(kreditkøb mellem erhvervsdrivende)'));
  assert.ok(text.includes('SÆLGER FORBEHOLDER SIG EJENDOMSRETTEN TIL DET SOLGTE, INDTIL HELE KØBESUMMEN MED RENTER OG OMKOSTNINGER ER BETALT.'));
  assert.ok(text.includes('Kontrakt nr. OS-2026-00031 · Dato 23.11.2026'));
  assert.ok(text.includes('CVR-nr.: 87654321'));
  assert.ok(text.includes('Moms 25 % af 750.000: 187.500'));
  assert.ok(text.includes('Kontantpris i alt (inkl. moms): 937.500'));
  assert.ok(text.includes('rente efter punkt 4.4 ved betaling efter betalingsplanen: ingen rente'));
  assert.ok(text.includes('Samlet beløb, der skal betales (udbetaling, afdrag 1–24 og rente): 937.500'));
  assert.ok(text.includes('Afdrag 1–23: hver 25.000 kr., forfalder den 1. i hver måned, første gang 01.01.2027.'));
  assert.ok(text.includes('Sidste afdrag 24: 25.000 kr., forfalder 01.12.2028.'));
  assert.ok(text.includes('Restkøbesummen forrentes ikke.'));
  /* Порог: 30 дней, 1/10 и 1/20 всей суммы к уплате, включая первый взнос. */
  assert.ok(text.includes('udeblevet med et beløb 30 dage efter dets forfaldstid'));
  assert.ok(text.includes('mindst en tiendedel af det samlede beløb, der skal betales, inklusive udbetalingen'));
  assert.ok(text.includes('En tiendedel af det samlede beløb efter denne kontrakt er 93.750 kr., og en tyvendedel er 46.875 kr.'));
  /* Bilbogen — условие передачи; изъятие — только через fogedretten; 14 дней на выкуп. */
  assert.ok(text.includes('3. ejendomsforbeholdet er anmeldt til tinglysning i bilbogen (punkt 5.2);'));
  assert.ok(text.includes('Ejendomsforbeholdet anmeldes af sælger til tinglysning i bilbogen før overgivelsen'));
  assert.ok(text.includes('Sælger tager ikke køretøjet tilbage uden fogedrettens medvirken mod købers vilje.'));
  assert.ok(text.includes('kan køber i 14 dage derefter indløse det'));
  assert.ok(text.includes('(kreditaftalelovens § 37)') && text.includes('Ved tilbagetagelse opgøres parternes mellemværende.'));
  assert.ok(text.includes('Aivomaa Oy (RAHTIS) er ikke part i denne kontrakt.'));
  assert.ok(text.includes('Bilag 1. Betalingsplan') && text.includes('Bilag 2. Overdragelsesprotokol'));
  assert.ok(text.includes('efter at købekontrakt nr. OS-2026-00031 var underskrevet, og ejendomsforbeholdet var anmeldt til tinglysning.'));
  assert.ok(!/€|\beuro|\bEUR\b/i.test(text), 'евро в датском договоре');
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/kyllä|merkki, malli|pp\.kk\.vvvv|määrä|luettelo|nimenselvennys|kunkin hinta|Alternativ|Valgfrit/i.test(text), 'остался заполнитель шаблона');
  for (const ch of 'æøåÆØÅ') assert.ok(text.includes(ch), ch);
  /* С процентами — вариант B п. 4.4: сумма процентов и ссылка на momsloven; база порога с процентами. */
  const f = createFormat('da-DK');
  const withRate = kronorInput('da-DK', { ratePercent: '6,5' });
  withRate.price = { ...withRate.price, interestTotal: f.money(4_100_000, 'DKK'), totalPayable: f.money(97_850_000, 'DKK'), tenth: f.money(9_785_000, 'DKK'), twentieth: f.money(4_892_500, 'DKK') };
  const rated = contractPlainText(COUNTRY_CONTRACTS.DK_KREDITKOEB.build(withRate)).replace(/[\u00a0\u202f]/g, ' ');
  assert.ok(rated.includes('med en fast årlig rente på 6,5 procent'));
  assert.ok(rated.includes('udgør renten i alt 41.000 kr. Renten indgår ikke i momsgrundlaget (momslovens § 27, stk. 3, nr. 4).'));
  assert.ok(rated.includes('(udbetaling, afdrag 1–24 og rente): 978.500'));
  assert.ok(rated.includes('er 97.850 kr., og en tyvendedel er 48.925 kr.'));
});

test('счета Швеции и Дании: свой язык и закон, кроны, RF без OCR и FI-kort, финского текста нет', () => {
  const se = invoiceTexts('SE');
  const dk = invoiceTexts('dk');
  assert.equal(se.country, 'SE');
  assert.equal(dk.country, 'DK');
  assert.equal(se.intl, 'sv-SE');
  assert.equal(dk.intl, 'da-DK');
  assert.equal(se.date('2027-01-05'), '2027-01-05');
  assert.equal(dk.date('2027-01-05'), '05.01.2027');
  assert.equal(se.labels.title, 'FAKTURA / INVOICE');
  assert.equal(dk.labels.title, 'FAKTURA / INVOICE');
  for (const t of [se, dk]) assert.deepEqual(Object.keys(t.labels).sort(), Object.keys(FI_INVOICE_LABELS).sort(), t.country);
  assert.equal(se.vatLabel('25'), 'Moms / VAT 25 %');
  assert.equal(dk.vatLabel(null), 'Moms / VAT 0 %');
  assert.equal(se.unit, 'st');
  assert.equal(dk.unit, 'stk.');
  /* Счёт — всегда счёт: платёжного уведомления в этих странах нет. */
  assert.equal(se.notice, null);
  assert.equal(dk.notice, null);
  for (const code of ['SE', 'DK']) assert.equal(documentKind(code, '2030-01-01'), 'INVOICE', code);
  /* Ссылка платежа — RF, как у Эстонии и Латвии. */
  for (const code of ['SE', 'DK']) assert.match(paymentReference('2026-0007', code), /^RF\d{2}202600075$/, code);
  const kr = (intl, cur) => (cents) => createFormat(intl).money(cents, cur);
  const args = (m) => ({ down: m(15_000_000), vat: m(18_750_000), rest: m(60_000_000), months: 24, contract: 'OS-2026-00031', vatMode: 'STANDARD' });
  const seNote = se.first.note(args(kr('sv-SE', 'SEK'))).replace(/[\u00a0\u202f]/g, ' ');
  const dkNote = dk.first.note(args(kr('da-DK', 'DKK'))).replace(/[  ]/g, ' ');
  assert.ok(seNote.includes('5 kap. 3 § andra stycket 2 och 7 kap. 7 § mervärdesskattelagen (2023:200)'));
  assert.ok(seNote.includes('150 000 kr av priset + mervärdesskatt 187 500 kr') && seNote.includes('Kreditbeloppet 600 000 kr'));
  assert.ok(seNote.includes('inget OCR-nummer och inget bankgiro'));
  assert.ok(dkNote.includes('momslovens § 4, stk. 3, nr. 2, og § 23'));
  assert.ok(dkNote.includes('150.000 kr. af købesummen + moms 187.500 kr.') && dkNote.includes('Restkøbesummen 600.000 kr.'));
  assert.ok(dkNote.includes('anmeldt til tinglysning i bilbogen'));
  /* Дания: обязательность электронного счёта не подтверждена — так и написано, на каждом документе. */
  assert.ok(dkNote.includes('er ikke bekræftet af RAHTIS') && dk.payment.note({ firstNumber: 'f' }).includes('er ikke bekræftet af RAHTIS'));
  assert.ok(dkNote.includes('ingen FI-betalingslinje (+71)'));
  /* Проценты: в Дании — вне базы НДС при отдельной строке; в Швеции о налоге на проценты ничего не утверждается. */
  assert.ok(dk.payment.interestLine.includes('momslovens § 27, stk. 3, nr. 4'));
  assert.ok(!/moms|mervärdesskatt|VAT/i.test(se.payment.interestLine));
  const dump = (t) =>
    [
      t.first.line({ what: 'w', contract: 'c' }),
      t.first.note(args((c) => String(c))),
      t.first.mailSubject({ number: 'n', seller: 's', contract: 'c' }),
      t.first.mailText({ number: 'n', contract: 'c', what: 'w', seller: 's', sellerEmail: 'e', payNow: 'p', due: 'd', iban: 'i', reference: 'r' }),
      t.payment.line({ n: 1, months: 2, contract: 'c', what: 'w' }),
      t.payment.interestLine,
      t.payment.note({ firstNumber: 'f' }),
      t.payment.mailSubject({ seller: 's', n: 1, months: 2, contract: 'c' }),
      t.payment.mailText({ contract: 'c', n: 1, months: 2, what: 'w', total: 't', due: 'd', iban: 'i' }),
      t.payment.mailFooter({ number: 'n', reference: 'r' }),
      t.credit.note({ original: 'o', originalDate: 'd', contract: 'c', refund: null }),
      t.credit.note({ original: 'o', originalDate: 'd', contract: 'c', refund: '1 kr' }),
      t.credit.mailSubject({ seller: 's', original: 'o' }),
      t.credit.mailText({ original: 'o', contract: 'c' }),
      t.credit.title,
      t.credit.linePrefix,
      ...Object.values(t.labels).flat(),
    ].join('\n');
  for (const t of [se, dk]) {
    const all = dump(t);
    assert.ok(!/AVL|arvonlisäver|osamaksu|Lasku|viitenumero|Hyvitys|Y-tunnus|undefined|€|\beuro/i.test(all), `${t.country}: финский текст или евро в счёте`);
    assert.ok(all.includes('RAHTIS (Aivomaa Oy)'), t.country);
    /* Название машины вынимается из строки первого счёта по « – » (firstInvoice.ts). */
    assert.equal(t.first.line({ what: 'Volvo FH ABC 12D', contract: 'c' }).split(' – ')[0], 'Volvo FH ABC 12D');
  }
});

/* ── Литва и Германия (23.11.2026) ────────────────────────────────────── */

test('реестр: Литва и Германия — договорные пороги, договор на своём языке; у Литвы счёт с НДС при передаче', () => {
  assert.deepEqual(INSTALLMENT_COUNTRIES.LT, {
    open: true,
    rules: 'LT_CK6414',
    contract: 'LT_ISSIMOKETINAI',
    contractLanguage: 'lt',
    vatOnFirstInvoice: false,
    vatInvoiceAtHandover: true,
  });
  assert.deepEqual(INSTALLMENT_COUNTRIES.DE, { open: true, rules: 'DE_BGB449', contract: 'DE_RATENKAUF', contractLanguage: 'de', vatOnFirstInvoice: true });
  assert.equal(installmentCountry('LT').vatStandardBps, 2100);
  assert.equal(installmentCountry('DE').vatStandardBps, 1900);
  assert.equal(installmentCountry('LT').currency, 'EUR');
  assert.equal(installmentCountry('DE').currency, 'EUR');
  /* Проценты в обеих странах предлагаются (с оговорками в кабинете). */
  assert.equal(installmentInterestOffered('LT'), true);
  assert.equal(installmentInterestOffered('DE'), true);
  /* Литва готова по документам не «весь НДС первым счётом», а предварительным счётом и счётом при передаче. */
  assert.equal(invoicesReady('LT'), true);
  assert.equal(invoicesReady('DE'), true);
  assert.equal(INSTALLMENT_RULES.LT_CK6414.source, 'CONTRACT');
  assert.equal(INSTALLMENT_RULES.DE_BGB449.source, 'CONTRACT');
  assert.equal(COUNTRY_CONTRACTS.LT_ISSIMOKETINAI.intl, 'lt-LT');
  assert.equal(COUNTRY_CONTRACTS.LT_ISSIMOKETINAI.isoDates, true);
  assert.equal(COUNTRY_CONTRACTS.DE_RATENKAUF.intl, 'de-DE');
  /* Пояса стран — из пакетов: Вильнюс и Берлин. */
  assert.equal(installmentTimeZone('LT'), 'Europe/Vilnius');
  assert.equal(installmentTimeZone('DE'), 'Europe/Berlin');
  const at = '2026-12-31T22:30:00Z';
  assert.equal(installmentDay('LT', at), '2027-01-01');
  assert.equal(installmentDay('DE', at), '2026-12-31');
});

test('тексты кабинета Литвы и Германии: все поля на каждом языке, термины страны, ничего финского', () => {
  for (const code of ['LT', 'DE']) {
    const keys = Object.keys(LAW_TEXTS[code].en).sort();
    for (const l of locales) {
      const t = LAW_TEXTS[code][l];
      assert.deepEqual(Object.keys(t).sort(), keys, `${code}/${l}`);
      for (const [k, v] of Object.entries(t)) {
        for (const text of Array.isArray(v) ? v : [v]) {
          assert.ok(typeof text === 'string' && text.trim().length > 10, `${code}/${l}/${k}`);
          assert.ok(!/Traficom|91\/1966|osamaksukauppalaki|ulosottomies|undefined/i.test(text), `${code}/${l}/${k}: финский термин`);
        }
      }
      assert.ok(t.thresholdTitle.includes('{plate}'), `${code}/${l}`);
      assert.equal(t.checkBefore.length, 1, `${code}/${l}`);
    }
  }
  for (const l of locales) {
    const lt = LAW_TEXTS.LT[l];
    /* Пороги — договорные: 30 дней, 1/10 и 1/20 цены, потом 14 дней. */
    for (const ph of ['{tenth}', '{twentieth}', '{needed}', '30', '14']) assert.ok(lt.thresholdsText.includes(ph), `LT/${l}: ${ph}`);
    assert.ok(lt.threshold.includes('antstolis') && lt.threshold.includes('9.3'), `LT/${l}: суд и пункт о половине цены`);
    assert.ok(lt.checkInsurance.includes('TPVCAPDĮ'), `LT/${l}: страховка — обязанность собственника`);
    assert.ok(lt.checkRegister.includes('savininkas') && lt.checkRegister.includes('valdytojas') && lt.checkRegister.includes('Regitr'), `LT/${l}`);
    assert.ok(lt.checkBefore[0].includes('Sutarčių ir teisių suvaržymų registr'), `LT/${l}: реестр договоров`);
    assert.ok(lt.invoiceNote.includes('išankstinio mokėjimo sąskaita') && lt.invoiceNote.includes('PVM sąskaita faktūra'), `LT/${l}`);
    assert.ok(/5/.test(lt.afterPaid), `LT/${l}: 5 рабочих дней`);
    assert.ok(lt.checkFirstPaid, `LT/${l}: пункт об оплате предварительного счёта`);
    assert.equal(lt.legalNoticeExtra, undefined);

    const de = LAW_TEXTS.DE[l];
    for (const ph of ['{tenth}', '{needed}', '14']) assert.ok(de.thresholdsText.includes(ph), `DE/${l}: ${ph}`);
    assert.ok(!de.thresholdsText.includes('{twentieth}'), `DE/${l}: у Германии одна доля`);
    assert.ok(de.threshold.includes('Gerichtsvollzieher') && de.threshold.includes('Rücktritt') && de.threshold.includes('§ 858'), `DE/${l}`);
    assert.ok(de.checkRegister.includes('Zulassungsbescheinigung Teil II') && de.checkRegister.includes('Halter') && de.checkRegister.includes('§ 932'), `DE/${l}`);
    assert.ok(de.checkBefore[0].includes('§ 513'), `DE/${l}: Existenzgründer`);
    for (const w of ['31.12.2026', 'XRechnung', 'ZUGFeRD', 'Zahlungsaufforderung']) assert.ok(de.invoiceNote.includes(w), `DE/${l}: ${w}`);
    assert.ok(de.legalNoticeExtra.includes('§ 307') && de.legalNoticeExtra.includes('AGB'), `DE/${l}: AGB`);
    assert.ok(de.rateHint.includes('§ 4 Nr. 8'), `DE/${l}: проценты`);
    assert.equal(de.checkFirstPaid, undefined);
    /* Базовую ставку нельзя записывать числом навсегда; Gutschrift в UStG — счёт покупателя. */
    for (const v of Object.values(de)) for (const text of Array.isArray(v) ? v : [v]) assert.ok(!/1,52|10,52|1\.52|10\.52|Gutschrift/.test(text), `DE/${l}`);
  }
  /* Неподтверждённое не подаётся как точное. */
  assert.ok(/not confirmed/.test(LAW_TEXTS.LT.en.nextSteps));
  assert.ok(/не подтвержд/.test(LAW_TEXTS.LT.ru.nextSteps));
  assert.ok(/not confirmed/.test(LAW_TEXTS.DE.en.nextSteps + LAW_TEXTS.DE.en.checkRegister));
  assert.ok(/не подтвержд/.test(LAW_TEXTS.DE.ru.nextSteps + LAW_TEXTS.DE.ru.checkRegister));
  /* Пороги — не «по закону»: в английском тексте Литвы и Германии они названы условиями договора. */
  assert.ok(/contract/i.test(LAW_TEXTS.LT.en.thresholdsText) && /contract/i.test(LAW_TEXTS.DE.en.thresholdsText));
});

test('тексты по стране: у Литвы свой пункт об оплате и реестр договоров в чек-листе, у Германии — § 513 и усиленная оговорка (AGB)', () => {
  const b = base();
  const lt = withCountryTexts(b, 'en', 'LT');
  assert.deepEqual(lt.stage3.checklist, [
    'c0',
    LAW_TEXTS.LT.en.checkFirstPaid,
    LAW_TEXTS.LT.en.checkBefore[0],
    LAW_TEXTS.LT.en.checkRegister,
    LAW_TEXTS.LT.en.checkInsurance,
    'c4',
  ]);
  assert.equal(lt.country.legalNotice, LEGAL_NOTICE.en);
  assert.equal(lt.country.rateHint, LAW_TEXTS.LT.en.rateHint);
  const de = withCountryTexts(b, 'de', 'DE');
  assert.deepEqual(de.stage3.checklist, ['c0', 'c1', LAW_TEXTS.DE.de.checkBefore[0], LAW_TEXTS.DE.de.checkRegister, LAW_TEXTS.DE.de.checkInsurance, 'c4']);
  assert.equal(de.country.legalNotice, `${LEGAL_NOTICE.de} ${LAW_TEXTS.DE.de.legalNoticeExtra}`);
  /* У остальных стран оговорка — прежняя, без добавки. */
  for (const code of ['EE', 'LV', 'SE', 'DK']) assert.equal(withCountryTexts(b, 'en', code).country.legalNotice, LEGAL_NOTICE.en, code);
  assert.equal(countryEventCode('threshold', 'LT'), 'installment.threshold.lt');
  assert.equal(countryEventCode('paid_off', 'de'), 'installment.paid_off.de');
  assert.equal(countryNoticeLocale('lt', 'LT'), 'lt');
  assert.equal(countryNoticeLocale('ru', 'DE'), 'ru');
  assert.deepEqual(b, base());
});

/* Договор Литвы и Германии: суммы так, как их печатает createFormat (евро, свой язык). */
function euroInput(intl, over = {}) {
  const m = (cents) => createFormat(intl).money(cents, 'EUR');
  const iso = intl === 'lt-LT';
  const day = (y, mo, d) => (iso ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`);
  const plan = Array.from({ length: 24 }, (_, i) => ({
    n: i + 1,
    due: day(i < 12 ? 2027 : 2028, (i % 12) + 1, 1),
    principal: m(229_167),
    interest: '–',
    total: m(229_167),
    balance: m(Math.max(0, 5_500_000 - 229_167 * (i + 1))),
  }));
  return {
    ...contractInput(),
    number: 'OS-2026-00031',
    date: day(2026, 11, 23),
    seller: { name: 'UAB Šiaurės vežėjas', businessId: '110053842', address: 'Perkėlos g. 10, 93264 Klaipėda', vatRegistered: true, email: 's@pavyzdys.lt', phone: '' },
    buyer: { name: 'Žalgirio transportas UAB', businessId: '136695976', address: 'Straße 2, 21129 Hamburg', vatRegistered: true, email: 'b@beispiel.de', phone: '' },
    price: {
      net: m(6_500_000),
      vatLabel: '',
      vat: m(intl === 'lt-LT' ? 1_365_000 : 1_235_000),
      gross: m(intl === 'lt-LT' ? 7_865_000 : 7_735_000),
      downGross: m(intl === 'lt-LT' ? 2_365_000 : 2_235_000),
      rest: m(5_500_000),
      interestTotal: null,
      installmentPrice: m(intl === 'lt-LT' ? 7_865_000 : 7_735_000),
      tenth: m(intl === 'lt-LT' ? 786_500 : 773_500),
      twentieth: m(intl === 'lt-LT' ? 393_250 : 773_500),
      creditClaim: m(5_500_000),
      totalPayable: m(intl === 'lt-LT' ? 7_865_000 : 7_735_000),
    },
    vatPercent: intl === 'lt-LT' ? '21' : '19',
    down: m(1_000_000),
    handover: day(2026, 12, 1),
    firstInvoiceNumber: null,
    plan,
    planTotals: { principal: m(5_500_000), interest: '–', all: m(intl === 'lt-LT' ? 7_865_000 : 7_735_000), instalments: m(5_500_000) },
    dueDay: 1,
    ...over,
  };
}

test('договор Литвы: дословный текст шаблона, договорные пороги, счёт с НДС — при передаче, пункт 9.3', () => {
  const doc = COUNTRY_CONTRACTS.LT_ISSIMOKETINAI.build(euroInput('lt-LT'));
  const text = contractPlainText(doc).replace(/[  ]/g, ' ');
  assert.ok(text.includes('TRANSPORTO PRIEMONĖS PIRKIMO–PARDAVIMO IŠSIMOKĖTINAI SUTARTIS'));
  assert.ok(text.includes('NUOSAVYBĖS TEISĖ Į TRANSPORTO PRIEMONĘ PIRKĖJUI PEREINA TIK VISIŠKAI SUMOKĖJUS KAINĄ.'));
  assert.ok(text.includes('Sutartis Nr. OS-2026-00031 · Data 2026-11-23'));
  /* 4.3: номер счёта с НДС неизвестен при подписании — прочерк, а не номер предварительного счёта. */
  assert.ok(text.includes(`PVM sąskaitoje faktūroje Nr. ${'_'.repeat(14)}, išrašytoje perdavimo dieną`));
  assert.ok(!text.includes('IS-OS-2026'));
  /* 9.1 и приложение 1: 1/10 и 1/20 цены с НДС; 9.3 — правило половины цены исключено. */
  assert.ok(text.includes('daugiau kaip 30 dienų'));
  assert.ok(text.includes('Viena dešimtoji šios sutarties Kainos yra 7 865 Eur, viena dvidešimtoji – 3 932,50 Eur.'));
  assert.ok(text.includes('Šalys aiškiai susitaria, kad Pardavėjas turi teisę atsiimti Transporto priemonę 9 skyriuje nustatytomis sąlygomis ir tuo atveju, kai Pirkėjas yra sumokėjęs daugiau kaip pusę Kainos'));
  assert.ok(text.includes('antstolis'));
  assert.ok(text.includes('Aivomaa Oy (RAHTIS) nėra šios sutarties šalis.'));
  assert.ok(text.includes('PVM 21 %'));
  assert.ok(text.includes('Už likusią Kainos dalį palūkanos neskaičiuojamos.'));
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/undefined|NaN/.test(text) && !/kyllä|merkki, malli|pp\.kk\.vvvv|variantas|Pasirinktinai|€/i.test(text), 'заполнитель шаблона или знак евро');
  for (const ch of 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ'.slice(0, 9)) assert.ok(text.includes(ch), ch);
  /* С процентами — вариант B п. 4.4: ставка и освобождение по PVMĮ 28 str. */
  const rated = contractPlainText(COUNTRY_CONTRACTS.LT_ISSIMOKETINAI.build(euroInput('lt-LT', { ratePercent: '6,5', price: { ...euroInput('lt-LT').price, interestTotal: '4 100 €' } })));
  assert.ok(rated.includes('fiksuotos 6,5 procentų metinės palūkanos'));
  assert.ok(rated.includes('Pridėtinės vertės mokesčio įstatymo 28 straipsnio 1 dalis'));
});

test('договор Германии: § 513 в заверении покупателя, 10 % или 5 % Gesamtbetrag, согласие на PDF, Teil II у продавца', () => {
  const text = contractPlainText(COUNTRY_CONTRACTS.DE_RATENKAUF.build(euroInput('de-DE'))).replace(/[  ]/g, ' ');
  assert.ok(text.includes('KAUFVERTRAG ÜBER EIN NUTZFAHRZEUG MIT RATENZAHLUNG UND EIGENTUMSVORBEHALT'));
  assert.ok(text.includes('DAS EIGENTUM AM KAUFGEGENSTAND GEHT ERST MIT VOLLSTÄNDIGER ZAHLUNG DES KAUFPREISES AUF DEN KÄUFER ÜBER.'));
  assert.ok(text.includes('Vertrag Nr. OS-2026-00031 · Datum 23.11.2026'));
  assert.ok(text.includes('nicht zur Aufnahme einer gewerblichen oder selbständigen beruflichen Tätigkeit im Sinne des § 513 BGB erwirbt'));
  assert.ok(text.includes('USt-IdNr. / Steuernummer: DE136695976'));
  assert.ok(text.includes('Der Käufer stimmt zu, dass Rechnungen bis zum Ablauf der Übergangsfristen des § 27 Abs. 38 UStG in einem sonstigen elektronischen Format (PDF) übermittelt werden.'));
  assert.ok(text.includes('Zahlungsaufforderungen zu den einzelnen Raten sind keine Rechnungen im Sinne des § 14 UStG und weisen keine Umsatzsteuer aus.'));
  assert.ok(text.includes('10 Prozent des Gesamtbetrags dieses Vertrags sind 7.735 Euro.'));
  assert.ok(text.includes('Die Zulassungsbescheinigung Teil II ist nach der Umschreibung an den Verkäufer zurückzugeben'));
  assert.ok(text.includes('Gerichtsvollzieher (§ 883 ZPO)'));
  assert.ok(text.includes('Die Aivomaa Oy (RAHTIS) ist nicht Partei dieses Vertrags.'));
  assert.ok(text.includes('Der Restkaufpreis wird nicht verzinst.'));
  /* Номер первого счёта неизвестен — прочерк. */
  assert.ok(text.includes(`mit der Rechnung Nr. ${'_'.repeat(14)} berechnet`));
  assert.ok(!/\[[^\]]*\]/.test(text), 'остался заполнитель в квадратных скобках');
  assert.ok(!/undefined|NaN/.test(text) && !/kyllä|merkki, malli|pp\.kk\.vvvv|Variante|Optional|Gutschrift/i.test(text), 'заполнитель шаблона');
  for (const ch of 'äöüßÄÜ') assert.ok(text.includes(ch), ch);
  /* Срок больше трёх лет — 5 %; с процентами — вариант B п. 4.4 со ссылкой на § 4 Nr. 8 Buchst. a UStG. */
  const long = contractPlainText(COUNTRY_CONTRACTS.DE_RATENKAUF.build(euroInput('de-DE', { months: 48, ratePercent: '6,5', price: { ...euroInput('de-DE').price, tenth: '3.867,50 €', interestTotal: '9.100 €' } })));
  assert.ok(long.includes('5 Prozent des Gesamtbetrags dieses Vertrags sind 3.867,50 Euro.'));
  assert.ok(long.includes('festen Jahreszins von 6,5 Prozent'));
  assert.ok(long.includes('nach § 4 Nr. 8 Buchst. a UStG umsatzsteuerfrei'));
});

test('документы Литвы: до передачи — предварительный счёт без НДС, при передаче — счёт с НДС, взносы — платёжные требования', () => {
  const lt = invoiceTexts('lt');
  assert.equal(lt.country, 'LT');
  assert.equal(lt.intl, 'lt-LT');
  assert.equal(lt.date('2027-01-05'), '2027-01-05');
  assert.deepEqual(Object.keys(lt.labels).sort(), Object.keys(FI_INVOICE_LABELS).sort());
  assert.equal(lt.vatLabel('21'), 'PVM / VAT 21 %');
  assert.equal(lt.labels.title, 'PVM SĄSKAITA FAKTŪRA');
  /* Первый документ Литвы — всегда предварительный счёт: номер от договора, без строк НДС. */
  for (const day of ['2026-11-25', '2030-01-01']) assert.equal(firstDocumentKind('LT', day, day), 'PROFORMA');
  assert.equal(lt.proforma.number({ contract: 'OS-2026-00031' }), 'IS-OS-2026-00031');
  assert.equal(lt.proforma.noVat, true);
  assert.equal(lt.paymentDoc.number({ contract: 'OS-2026-00031', n: 3 }), 'MP-OS-2026-00031-03');
  assert.equal(lt.paymentDoc.noVat, true);
  assert.equal(lt.cancel.number({ contract: 'c', original: 'IS-OS-2026-00031' }), 'IS-OS-2026-00031-ANUL');
  assert.deepEqual(plainDocLabels(lt, 'PAYMENT').number, ['Dokumento numeris', 'Document no.']);
  assert.equal(plainDocLabels(lt, 'PAYMENT').title, lt.labels.title);
  assert.equal(plainDoc(lt, 'PROFORMA').title, 'IŠANKSTINĖ SĄSKAITA');
  const note = lt.first.note({ down: '10 000 €', vat: '13 650 €', rest: '55 000 €', months: 24, contract: 'OS-2026-00031', vatMode: 'STANDARD' });
  assert.ok(note.includes('Tai išankstinio mokėjimo sąskaita, o ne PVM sąskaita faktūra.'));
  assert.ok(note.includes('14 straipsnio 5 dalis'));
  const h = lt.handover.note({ proforma: 'IS-OS-2026-00031', advance: '23 650 €', vat: '13 650 €', rest: '55 000 €', months: 24, contract: 'OS-2026-00031' });
  assert.ok(h.includes('Įskaityta pagal išankstinio mokėjimo sąskaitą Nr. IS-OS-2026-00031 gauta pradinė įmoka 23 650 €'));
  assert.ok(lt.payment.note({ firstNumber: '2026-0008' }).includes('Tai mokėjimo pranešimas, o ne PVM sąskaita faktūra.'));
  assert.ok(lt.payment.interestLine.includes('28 straipsnio 1 dalis'));
  /* Отмена до передачи — аннулирование предварительного счёта, а не кредитный документ. */
  assert.equal(lt.credit, lt.cancel);
  assert.ok(lt.cancel.note({ original: 'IS-1', originalDate: 'd', contract: 'c', refund: null }).includes('kreditinis dokumentas nereikalingas'));
  /* Название машины вынимается из строки первого документа по « – » (firstInvoice.ts). */
  assert.equal(lt.proforma.line({ what: 'Volvo FH ABC 123', contract: 'c' }).split(' – ')[0], 'Volvo FH ABC 123');
  assert.match(paymentReference('IS-OS-2026-00031', 'LT'), /^RF\d{2}\d+$/);
});

test('документы Германии: счёт с USt до 31.12.2026, потом платёжная информация без НДС; взносы — Zahlungsaufforderung', () => {
  const de = invoiceTexts('DE');
  assert.equal(de.country, 'DE');
  assert.equal(de.intl, 'de-DE');
  assert.equal(de.date('2027-01-05'), '05.01.2027');
  assert.deepEqual(Object.keys(de.labels).sort(), Object.keys(FI_INVOICE_LABELS).sort());
  assert.equal(de.vatLabel('19'), 'USt / VAT 19 %');
  /* PDF — счёт только за обороты до 31.12.2026 (ранняя дата для всех: оборот продавца неизвестен). */
  assert.equal(DE_E_INVOICE_FROM, '2027-01-01');
  assert.equal(documentKind('DE', '2026-12-31'), 'INVOICE');
  assert.equal(documentKind('DE', '2027-01-01'), 'NOTICE');
  assert.equal(documentKind('DE', '2026-12-20', '2027-01-05'), 'NOTICE');
  assert.equal(firstDocumentKind('DE', '2026-11-25', '2026-12-01'), 'INVOICE');
  assert.equal(firstDocumentKind('DE', '2026-12-20', '2027-01-05'), 'NOTICE');
  assert.equal(firstDocumentKind('DE', '2027-02-01', '2027-02-10'), 'NOTICE');
  /* Другие страны не тронуты: Латвия — по дню выставления, остальные — всегда счёт. */
  assert.equal(documentKind('LV', '2027-06-01', '2028-02-01'), 'INVOICE');
  for (const code of ['FI', 'EE', 'LV', 'SE', 'DK']) assert.equal(firstDocumentKind(code, '2026-11-25', '2026-12-01'), 'INVOICE', code);
  assert.equal(firstDocumentKind('LV', '2028-02-01', '2028-02-10'), 'INVOICE');
  const first = de.first.note({ down: '10.000 €', vat: '12.350 €', rest: '55.000 €', months: 24, contract: 'OS-2026-00031', vatMode: 'STANDARD' });
  for (const w of ['§ 27 Abs. 38 UStG', '31.12.2026', 'XRechnung', 'ZUGFeRD', 'Zustimmung des Käufers', '§ 14 Abs. 2 Satz 7 UStG']) assert.ok(first.includes(w), w);
  assert.equal(de.notice.noVat, true);
  assert.ok(de.notice.note.includes('keine Rechnung'));
  assert.ok(de.notice.firstNote({ down: 'a', vat: 'b', rest: 'c', months: 2, contract: 'k', vatMode: 'STANDARD' }).includes('Vertrag Ziffer 4.2'));
  assert.equal(de.paymentDoc.number({ contract: 'OS-2026-00031', n: 12 }), 'ZA-OS-2026-00031-12');
  assert.equal(de.paymentDoc.noVat, true);
  assert.ok(de.payment.note({ firstNumber: '2026-0007' }).includes('keine Rechnung im Sinne des § 14 UStG und weist keine Umsatzsteuer aus'));
  assert.ok(de.payment.note({ firstNumber: '' }).includes('mit der Rechnung des Verkäufers über den gesamten Kaufpreis'));
  assert.ok(de.payment.interestLine.includes('steuerfrei nach § 4 Nr. 8 Buchst. a UStG'));
  assert.ok(de.credit.note({ original: 'o', originalDate: 'd', contract: 'c', refund: null }).includes('§ 17 UStG'));
  const all = [
    first,
    de.notice.note,
    de.payment.note({ firstNumber: 'f' }),
    de.credit.note({ original: 'o', originalDate: 'd', contract: 'c', refund: '1 €' }),
    de.cancel.note({ original: 'o', originalDate: 'd', contract: 'c', refund: '1 €' }),
    de.credit.title,
    de.cancel.title,
    ...Object.values(de.labels).flat(),
  ].join('\n');
  assert.ok(!/Gutschrift|AVL|arvonlisäver|Lasku|viitenumero|undefined/i.test(all));
  /* Заголовки короткие: длинный налезает на реквизиты продавца. */
  for (const t of [de.labels.title, de.notice.title, de.paymentDoc.title, de.credit.title, de.cancel.title, invoiceTexts('LT').labels.title, invoiceTexts('LT').proforma.title, invoiceTexts('LT').paymentDoc.title, invoiceTexts('LT').cancel.title]) {
    assert.ok(t.length <= 21, t);
  }
});

test('миграция Литвы и Германии: страны открыты в базе, у сделки столбец счёта с НДС при передаче', () => {
  const sql = latestSql('create or replace function app.installment_country_open(');
  for (const code of ['FI', 'EE', 'LV', 'SE', 'DK', 'LT', 'DE']) assert.ok(sql.includes(`'${code}'`), code);
  assert.ok(!sql.includes("'NO'"));
  const migration = readFileSync(new URL('../../../supabase/migrations/20261201100000_installment_open_lt_de.sql', import.meta.url), 'utf8');
  assert.ok(migration.includes('add column if not exists vat_invoice_id uuid references public.carrier_invoices (id) on delete set null'));
  assert.ok(migration.includes('add column if not exists vat_invoice_started_at timestamptz'));
  assert.ok(migration.includes("set search_path = ''"));
  assert.ok(migration.includes('revoke all on function app.installment_country_open(text) from public, anon, authenticated;'));
  assert.ok(!/end case/i.test(migration));
});
