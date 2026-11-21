import { locales, type Locale } from '@/lib/i18n/config';
import { calc as sv } from './installmentI18n/sv';
import { calc as et } from './installmentI18n/et';
import { calc as lv } from './installmentI18n/lv';
import { calc as lt } from './installmentI18n/lt';
import { calc as pl } from './installmentI18n/pl';
import { calc as de } from './installmentI18n/de';
import { calc as ru } from './installmentI18n/ru';
import { calc as ro } from './installmentI18n/ro';

/**
 * Открытая страница «Kuorma-auton osamaksukauppa» с калькулятором
 * (21.11.2026). Пока только Финляндия: тексты по-фински и по-английски,
 * на остальных языках — английский текст с canonical на английскую
 * версию (pageMetadata textLocales).
 *
 * Только то, что уже работает: калькулятор. Объявлений, договора и счетов
 * в RAHTIS ещё нет — о них здесь не обещаем.
 * Методика и источники: docs/equipment-sale/laskentamalli.md.
 */

/* С 21.11.2026 текст переведён на все языки сайта. */
export const INSTALLMENT_TEXT_LOCALES = locales;

export function installmentPath(locale: Locale): string {
  return locale === 'fi' ? '/kuorma-auto-osamaksulla' : '/truck-installment-sale';
}

export type InstallmentCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lede: string;
  ctaApply: string;
  ctaSignIn: string;
  calcTitle: string;
  calcNote: string;
  groups: { deal: string; seller: string; buyer: string; assumptions: string };
  f: {
    price: string;
    priceHint: string;
    vatMode: string;
    vatModes: Record<'STANDARD' | 'MARGIN' | 'EXEMPT' | 'NONE', string>;
    down: string;
    downHint: string;
    months: string;
    final: string;
    finalHint: string;
    rate: string;
    rateHint: string;
    depreciation: string;
    depreciationHint: string;
    costs: string;
    costsHint: string;
    taxMethod: string;
    taxMethods: Record<'NONE' | 'POOL' | 'ITEM', string>;
    pool: string;
    poolHint: string;
    residual: string;
    residualHint: string;
    revenue: string;
    buyerCosts: string;
    buyerCostsHint: string;
  };
  r: {
    firstInvoice: string;
    firstInvoiceHint: string;
    monthly: string;
    monthlyHint: string;
    finalPayment: string;
    interestTotal: string;
    priceWithVat: string;
    thresholdsTitle: string;
    thresholdsText: string;
    adviceTitle: string;
    adviceProtection: string;
    adviceTax: string;
    adviceMarket: string;
    adviceRecommended: string;
    adviceLow: string;
    taxTitle: string;
    taxIncome: string;
    taxAmount: string;
    taxNone: string;
    taxUnknown: string;
    scenarioTitle: string;
    scenarioText: string;
    colStop: string;
    colPaid: string;
    colValue: string;
    colSettlement: string;
    colSeller: string;
    sellerPays: string;
    buyerPays: string;
    even: string;
    afterMonths: string;
    buyerTitle: string;
    buyerMargin: string;
    buyerNegative: string;
    buyerThin: string;
    buyerOk: string;
    buyerEmpty: string;
  };
  errors: Record<'PRICE' | 'MONTHS' | 'DOWN_PAYMENT' | 'FINAL' | 'RATE' | 'DATES', string>;
  howTitle: string;
  how: { title: string; text: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  disclaimer: string;
  finalTitle: string;
  finalText: string;
};

const fi: InstallmentCopy = {
  metaTitle: 'Kuorma-auton osamaksukauppa yritysten välillä – laskuri',
  metaDescription:
    'Myy tai osta käytetty kuorma-auto osamaksulla: maksuerät, arvonlisävero, osamaksukauppalain rajat, takaisinotto ja myyjän vero yhdellä laskurilla.',
  eyebrow: 'Kaluston osamaksukauppa',
  title: 'Myy kuorma-autosi osamaksulla – laske ennen kuin sovit',
  lede:
    'Eläkkeelle jäävä yrittäjä saa autostaan hyvän hinnan, ja uusi kuljetusliike pääsee alkuun ilman pankkia. Laskuri näyttää maksuerät, ensimmäisen laskun arvonlisäveroineen, osamaksukauppalain rajat ja sen, mitä tapahtuu, jos maksut loppuvat.',
  ctaApply: 'Hae mukaan',
  ctaSignIn: 'Kirjaudu',
  calcTitle: 'Laskuri',
  calcNote: 'Summat ilman arvonlisäveroa, ellei toisin mainita. Laskuri on suuntaa-antava.',
  groups: { deal: 'Kauppa', seller: 'Myyjän vero', buyer: 'Ostajan kannattavuus', assumptions: 'Oletukset' },
  f: {
    price: 'Kauppahinta (alv 0 %)',
    priceHint: 'Auto ja lisävarusteet.',
    vatMode: 'Arvonlisävero',
    vatModes: {
      STANDARD: 'Yleinen verokanta 25,5 %',
      MARGIN: 'Voittomarginaalimenettely (vain jälleenmyyjä)',
      EXEMPT: 'Veroton myynti (AVL 61 §)',
      NONE: 'Myyjä ei ole arvonlisäverovelvollinen',
    },
    down: 'Käsiraha (alv 0 %)',
    downHint: 'Maksetaan ennen luovutusta yhdessä koko arvonlisäveron kanssa.',
    months: 'Maksuerien määrä (kk)',
    final: 'Viimeinen erä',
    finalHint: 'Tyhjä = kaikki erät samansuuruisia.',
    rate: 'Korko, % vuodessa',
    rateHint: '0 = ei korkoa. Korko on veroton rahoituspalvelu.',
    depreciation: 'Auton arvon lasku, % vuodessa',
    depreciationHint: 'Oma arviosi. Vertaa samanlaisiin, eri-ikäisiin autoihin myynti-ilmoituksissa.',
    costs: 'Takaisinoton kulut',
    costsHint: 'Siirto, arviointi ja ulosotto. Oma arviosi.',
    taxMethod: 'Auton poistot',
    taxMethods: {
      NONE: 'En tiedä vielä',
      POOL: 'Menojäännös (EVL 30 §)',
      ITEM: 'Ammattiliikenteen auto (EVL 33 §)',
    },
    pool: 'Menojäännös verovuoden alussa',
    poolHint: 'Kirjanpitäjältä. Mukaan myös vuoden aikana käyttöön otetut hankinnat.',
    residual: 'Auton poistamaton hankintameno',
    residualHint: 'Kirjanpitäjältä.',
    revenue: 'Auton liikevaihto kuukaudessa',
    buyerCosts: 'Kulut kuukaudessa ilman maksuerää',
    buyerCostsHint: 'Polttoaine, kuljettaja, renkaat, korjaukset, tiemaksut, vakuutukset.',
  },
  r: {
    firstInvoice: 'Ensimmäinen lasku',
    firstInvoiceHint: 'Käsiraha {down} + arvonlisävero {vat}. Auto luovutetaan, kun lasku on maksettu. Ostaja vähentää veron.',
    monthly: 'Kuukausierä',
    monthlyHint: 'Ensimmäisen kuukauden korko {interest}.',
    finalPayment: 'Viimeinen erä',
    interestTotal: 'Korot yhteensä',
    priceWithVat: 'Osamaksuhinta (sis. alv)',
    thresholdsTitle: 'Osamaksukauppalain rajat (2 §)',
    thresholdsText:
      'Myyjä saa ottaa auton takaisin tai vaatia loput heti vasta, kun maksu on ollut myöhässä vähintään 14 päivää ja myöhässä on vähintään {tenth} (yksi erä) tai {twentieth} (kaksi tai useampia eriä). Tässä kaupassa se tarkoittaa {needed} erän viivästystä.',
    adviceTitle: 'Suositeltu käsiraha',
    adviceProtection: 'Auton arvon lasku 6 kk + takaisinoton kulut',
    adviceTax: 'Myyjän vero, jota erät eivät ehdi kattaa',
    adviceMarket: 'Markkinoiden tavallinen taso 20 %',
    adviceRecommended: 'Suositus',
    adviceLow: 'Käsiraha on suositusta pienempi.',
    taxTitle: 'Myyjän vero luovutusvuonna',
    taxIncome: 'Veronalainen tulo',
    taxAmount: 'Yhteisövero 20 %',
    taxNone: 'Kauppahinta ei ylitä menojäännöstä: veronalaista tuloa ei synny, mutta tulevat poistot pienenevät.',
    taxUnknown: 'Kysy kirjanpitäjältä auton poistotapa ja menojäännös. Osamaksu ei lykkää veroa: koko hinta tuloutetaan luovutusvuonna.',
    scenarioTitle: 'Jos maksut loppuvat',
    scenarioText:
      'Ostaja maksaa ensimmäiset kuukaudet ja lopettaa. Myyjä ottaa auton takaisin, kun lain raja täyttyy, ja osapuolet tekevät tilityksen: auton arvo luetaan ostajan hyväksi (3–4 §).',
    colStop: 'Maksut loppuvat',
    colPaid: 'Ostaja maksanut',
    colValue: 'Auton arvo',
    colSettlement: 'Tilitys',
    colSeller: 'Myyjä saa yhteensä',
    sellerPays: 'myyjä maksaa {sum}',
    buyerPays: 'ostaja maksaa {sum}',
    even: 'tasan',
    afterMonths: '{n} kk jälkeen',
    buyerTitle: 'Riittääkö auton tulo maksuun',
    buyerMargin: 'Jää kuukaudessa',
    buyerNegative: 'Auto ei näillä luvuilla kata maksuerää.',
    buyerThin: 'Pieni puskuri: seisokkikuukausi vaarantaa maksun.',
    buyerOk: 'Tulo kattaa maksuerän.',
    buyerEmpty: 'Syötä liikevaihto ja kulut.',
  },
  errors: {
    PRICE: 'Syötä kauppahinta.',
    MONTHS: 'Erien määrä 1–120.',
    DOWN_PAYMENT: 'Käsirahan on oltava pienempi kuin kauppahinta.',
    FINAL: 'Viimeisen erän on oltava pienempi kuin loppuosa.',
    RATE: 'Korko 0–50 %.',
    DATES: 'Tarkista päivämäärät.',
  },
  howTitle: 'Näin osamaksukauppa toimii',
  how: [
    { title: 'Sopimus ennen luovutusta', text: 'Osamaksusopimus tehdään kirjallisesti ja allekirjoitetaan ennen kuin auto luovutetaan. Omistuksenpidätys on sovittava ennen luovutusta, muuten se ei suojaa myyjää ostajan konkurssissa.' },
    { title: 'Ensimmäinen lasku', text: 'Koko kauppahinnan arvonlisävero laskutetaan käsirahan kanssa ennen luovutusta. Ostaja vähentää veron omassa ilmoituksessaan, joten myyjälle ei synny kassavajetta.' },
    { title: 'Rekisteri ja vakuutus', text: 'Myyjä pysyy omistajana, ostaja merkitään haltijaksi ja liittää auton liikenneluvalleen. Liikennevakuutus on voimassa luovutuspäivästä, ja myyjä merkitään kaskovakuutukseen nimeltä.' },
    { title: 'Kuukausierät', text: 'Erät ilman arvonlisäveroa, korko omana rivinään. Ostaja saa maksaa loput milloin tahansa.' },
    { title: 'Viimeinen erä', text: 'Kun kaikki on maksettu, myyjä tekee luovutusilmoituksen ja ostaja rekisteröi itsensä omistajaksi.' },
  ],
  faqTitle: 'Kysymyksiä',
  faq: [
    { q: 'Koskeeko osamaksukauppalaki yritysten välistä kauppaa?', a: 'Koskee. Laki ei koske vain kauppaa, jossa elinkeinonharjoittaja myy kuluttajalle (1 a §). Ostajan suojaa koskevista säännöksistä ei voi sopia ostajan vahingoksi (19 §).' },
    { q: 'Milloin myyjä saa ottaa auton takaisin?', a: 'Kun maksu on ollut myöhässä vähintään 14 päivää ja myöhässä on vähintään kymmenesosa osamaksuhinnasta, kahdesta tai useammasta erästä kahdeskymmenesosa, tai koko loppusaatava (2 §). Takaisinotto tehdään ulosottomiehen kautta tai sopimalla, ja siinä tehdään tilitys auton arvosta.' },
    { q: 'Lykkääkö osamaksu myyjän veroa?', a: 'Ei. Kauppahinta tuloutetaan luovutusvuonna. Jos auto on menojäännöksessä, hinta vähennetään menojäännöksestä, ja vain ylittävä osa on veronalaista tuloa (EVL 30 §).' },
    { q: 'Voiko myyjä estää auton käynnistyksen, jos maksut loppuvat?', a: 'Ei maksujen perimiseksi. Takaisinotto tapahtuu lain mukaan ulosottomiehen avulla; oma-aloitteinen pakottaminen voi olla omankädenoikeutta. Käynnistyksenestoa voi käyttää anastuksen jälkeen poliisin kanssa tai ostajan suostumuksella.' },
    { q: 'Kuka maksaa ajoneuvoveron ja vakuutuksen?', a: 'Ajoneuvoveron maksaa rekisteriin merkitty haltija eli ostaja. Liikennevakuutuksesta omistaja ja haltija vastaavat yhteisvastuullisesti; käytännössä sen ottaa ostaja.' },
  ],
  disclaimer:
    'Laskuri on suuntaa-antava eikä korvaa veroneuvontaa tai oikeudellista neuvontaa. Lähteet: laki osamaksukaupasta 91/1966, arvonlisäverolaki 1501/1993, elinkeinotulon verottamisesta annettu laki 360/1968 ja Verohallinnon ohjeet.',
  finalTitle: 'Kuljetusliikkeen järjestelmä samasta paikasta',
  finalText: 'RAHTIS on kuljetusten hallintajärjestelmä ja rahtipörssi. Kalusto, huollot, kuljettajat, polttoaine ja auton kannattavuus yhdessä paikassa.',
};

const en: InstallmentCopy = {
  metaTitle: 'Truck installment sale between companies – calculator',
  metaDescription:
    'Sell or buy a used truck in instalments in Finland: payments, VAT, Hire-Purchase Act limits, repossession and the seller’s tax in one calculator.',
  eyebrow: 'Equipment installment sale',
  title: 'Sell your truck in instalments – calculate before you agree',
  lede:
    'A retiring haulier gets a fair price for the truck, and a new transport company can start without a bank. The calculator shows the payments, the first invoice with VAT, the limits of the Finnish Hire-Purchase Act and what happens if payments stop.',
  ctaApply: 'Apply',
  ctaSignIn: 'Sign in',
  calcTitle: 'Calculator',
  calcNote: 'Amounts exclude VAT unless stated otherwise. The calculator is indicative.',
  groups: { deal: 'Deal', seller: 'Seller’s tax', buyer: 'Buyer’s profitability', assumptions: 'Assumptions' },
  f: {
    price: 'Price (excl. VAT)',
    priceHint: 'Truck and accessories.',
    vatMode: 'VAT',
    vatModes: {
      STANDARD: 'Standard rate 25.5%',
      MARGIN: 'Margin scheme (dealers only)',
      EXEMPT: 'Exempt sale (VAT Act s. 61)',
      NONE: 'Seller not VAT-registered',
    },
    down: 'Down payment (excl. VAT)',
    downHint: 'Paid before handover together with the full VAT.',
    months: 'Number of instalments (months)',
    final: 'Final instalment',
    finalHint: 'Empty = equal instalments.',
    rate: 'Interest, % a year',
    rateHint: '0 = no interest. Interest is an exempt financial service.',
    depreciation: 'Fall in truck value, % a year',
    depreciationHint: 'Your estimate. Compare similar trucks of different ages in listings.',
    costs: 'Repossession costs',
    costsHint: 'Transfer, valuation and enforcement. Your estimate.',
    taxMethod: 'Depreciation of the truck',
    taxMethods: {
      NONE: 'Not known yet',
      POOL: 'Pooled (Business Income Tax Act s. 30)',
      ITEM: 'Commercial traffic vehicle (s. 33)',
    },
    pool: 'Undepreciated pool at start of year',
    poolHint: 'From your accountant, including assets taken into use during the year.',
    residual: 'Undepreciated cost of the truck',
    residualHint: 'From your accountant.',
    revenue: 'Truck revenue per month',
    buyerCosts: 'Monthly costs without the instalment',
    buyerCostsHint: 'Fuel, driver, tyres, repairs, tolls, insurance.',
  },
  r: {
    firstInvoice: 'First invoice',
    firstInvoiceHint: 'Down payment {down} + VAT {vat}. The truck is handed over once it is paid. The buyer deducts the VAT.',
    monthly: 'Monthly instalment',
    monthlyHint: 'First month’s interest {interest}.',
    finalPayment: 'Final instalment',
    interestTotal: 'Total interest',
    priceWithVat: 'Hire-purchase price (incl. VAT)',
    thresholdsTitle: 'Limits of the Hire-Purchase Act (s. 2)',
    thresholdsText:
      'The seller may repossess the truck or demand the rest at once only after a payment has been overdue for at least 14 days and at least {tenth} (one instalment) or {twentieth} (two or more) is overdue. In this deal that means {needed} overdue instalments.',
    adviceTitle: 'Recommended down payment',
    adviceProtection: 'Fall in value over 6 months + repossession costs',
    adviceTax: 'Seller’s tax not yet covered by instalments',
    adviceMarket: 'Usual market level 20%',
    adviceRecommended: 'Recommendation',
    adviceLow: 'The down payment is below the recommendation.',
    taxTitle: 'Seller’s tax in the year of handover',
    taxIncome: 'Taxable income',
    taxAmount: 'Corporate tax 20%',
    taxNone: 'The price does not exceed the pool: no taxable income now, but future depreciation is smaller.',
    taxUnknown: 'Ask your accountant how the truck is depreciated. Instalments do not defer tax: the whole price is income in the year of handover.',
    scenarioTitle: 'If payments stop',
    scenarioText:
      'The buyer pays the first months and stops. The seller repossesses once the legal limit is met, and the parties settle: the truck’s value is credited to the buyer (s. 3–4).',
    colStop: 'Payments stop',
    colPaid: 'Buyer has paid',
    colValue: 'Truck value',
    colSettlement: 'Settlement',
    colSeller: 'Seller gets in total',
    sellerPays: 'seller pays {sum}',
    buyerPays: 'buyer pays {sum}',
    even: 'even',
    afterMonths: 'after {n} months',
    buyerTitle: 'Does the truck earn the instalment',
    buyerMargin: 'Left per month',
    buyerNegative: 'With these figures the truck does not cover the instalment.',
    buyerThin: 'Thin margin: one idle month puts the payment at risk.',
    buyerOk: 'Revenue covers the instalment.',
    buyerEmpty: 'Enter revenue and costs.',
  },
  errors: {
    PRICE: 'Enter the price.',
    MONTHS: 'Instalments 1–120.',
    DOWN_PAYMENT: 'The down payment must be below the price.',
    FINAL: 'The final instalment must be below the remaining price.',
    RATE: 'Interest 0–50%.',
    DATES: 'Check the dates.',
  },
  howTitle: 'How an installment sale works',
  how: [
    { title: 'Contract before handover', text: 'The hire-purchase contract is made in writing and signed before the truck is handed over. Retention of title must be agreed before handover, or it does not protect the seller in the buyer’s bankruptcy.' },
    { title: 'First invoice', text: 'VAT on the whole price is invoiced with the down payment before handover. The buyer deducts it in its own return, so the seller has no cash gap.' },
    { title: 'Register and insurance', text: 'The seller stays the owner, the buyer is registered as holder and adds the truck to its operating licence. Motor liability insurance runs from handover, and the seller is named in the comprehensive cover.' },
    { title: 'Monthly instalments', text: 'Instalments without VAT, interest on its own line. The buyer may pay off the rest at any time.' },
    { title: 'Final instalment', text: 'Once everything is paid, the seller files the transfer and the buyer registers as owner.' },
  ],
  faqTitle: 'Questions',
  faq: [
    { q: 'Does the Hire-Purchase Act apply between companies?', a: 'Yes. It excludes only sales by a business to a consumer (s. 1 a). Buyer protections cannot be waived to the buyer’s detriment (s. 19).' },
    { q: 'When may the seller repossess?', a: 'When a payment has been overdue for at least 14 days and at least one tenth of the hire-purchase price is overdue, one twentieth for two or more instalments, or the whole balance (s. 2). Repossession goes through an enforcement officer or by agreement, with a settlement on the truck’s value.' },
    { q: 'Do instalments defer the seller’s tax?', a: 'No. The price is income in the year of handover. If the truck is in the depreciation pool, the price is deducted from the pool and only the excess is taxable (Business Income Tax Act s. 30).' },
    { q: 'Can the seller block the engine if payments stop?', a: 'Not to collect payments. Repossession goes through the enforcement officer; self-help may be an offence. A starter block may be used after a theft with the police or with the buyer’s consent.' },
    { q: 'Who pays vehicle tax and insurance?', a: 'Vehicle tax is paid by the registered holder, the buyer. Owner and holder are jointly liable for motor insurance; in practice the buyer takes it out.' },
  ],
  disclaimer:
    'The calculator is indicative and does not replace tax or legal advice. Sources: Finnish Hire-Purchase Act 91/1966, VAT Act 1501/1993, Business Income Tax Act 360/1968 and Finnish Tax Administration guidance.',
  finalTitle: 'A transport management system from the same place',
  finalText: 'RAHTIS is a transport management system and freight exchange. Fleet, maintenance, drivers, fuel and truck profitability in one place.',
};

const BY_LOCALE: Record<Locale, InstallmentCopy> = { fi, en, sv, et, lv, lt, pl, de, ru, ro };

export function installmentCopy(locale: Locale): InstallmentCopy {
  return BY_LOCALE[locale] ?? en;
}
