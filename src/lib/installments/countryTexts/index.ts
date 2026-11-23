/**
 * Тексты кабинета по стране сделки (23.11.2026). Финляндия — без записи:
 * её тексты в copy.ts и i18n/* показываются как были. У Эстонии, Латвии,
 * Швеции, Дании, Литвы и Германии — свои (ee.ts, lv.ts, se.ts, dk.ts, lt.ts,
 * de.ts; Литва и Германия — 23.11.2026) на всех десяти языках
 * кабинета: эстонская компания
 * может работать в кабинете по-русски или по-английски и должна читать про
 * своё право, а не про финское.
 *
 * Модуль без зависимостей от приложения: его читают copy.ts и тесты.
 */
import { locales, type Locale } from '../../i18n/config.ts';
import { EE_TEXTS } from './ee.ts';
import { LV_TEXTS } from './lv.ts';
import { SE_TEXTS } from './se.ts';
import { DK_TEXTS } from './dk.ts';
import { LT_TEXTS } from './lt.ts';
import { DE_TEXTS } from './de.ts';
import type { InstallmentCommonCopy, InstallmentLawCopy } from './types.ts';

export type { InstallmentCommonCopy, InstallmentLawCopy } from './types.ts';

export type LawCountry = 'EE' | 'LV' | 'SE' | 'DK' | 'LT' | 'DE';

export const LAW_TEXTS: Record<LawCountry, Record<Locale, InstallmentLawCopy>> = {
  EE: EE_TEXTS,
  LV: LV_TEXTS,
  SE: SE_TEXTS,
  DK: DK_TEXTS,
  LT: LT_TEXTS,
  DE: DE_TEXTS,
};

/*
 * Общее для стран, кроме Финляндии. Досрочное погашение во всех четырёх
 * договорах — п. 4.6: остаток цены и проценты по день оплаты. У Швеции и
 * Дании подсказка у процентов своя (rateHint в текстах страны). О процентах: в Эстонии
 * освобождение подтверждено (KMS § 12 lg 8), в Латвии разъяснения VID нет,
 * поэтому подсказка ничего не обещает и отсылает к бухгалтеру.
 */
export const COMMON_TEXTS: Record<Locale, InstallmentCommonCopy> = {
  fi: {
    payoff: 'Koko jäännösvelka tänään: {sum} (sopimuksen kohta 4.6).',
    rateHint: '0 = ei korkoa. Korko laskutetaan omana rivinään, erillään kauppahinnasta; varmista sen arvonlisäverokäsittely kirjanpitäjältäsi.',
    paidOn: 'Kauppa on maksettu {date}.',
    allPaid: 'Kaikki erät on maksettu.',
  },
  en: {
    payoff: 'Amount to pay off in full today: {sum} (clause 4.6 of the contract).',
    rateHint: '0 = no interest. Interest is invoiced on a separate line, apart from the price; check its VAT treatment with your accountant.',
    paidOn: 'Paid off on {date}.',
    allPaid: 'All instalments are paid.',
  },
  sv: {
    payoff: 'Hela restskulden i dag: {sum} (avtalets punkt 4.6).',
    rateHint: '0 = ingen ränta. Räntan faktureras på en egen rad, skild från priset; kontrollera momsbehandlingen med din redovisare.',
    paidOn: 'Köpet är betalt {date}.',
    allPaid: 'Alla delbetalningar är betalda.',
  },
  et: {
    payoff: 'Kogu jääk täna: {sum} (lepingu punkt 4.6).',
    rateHint: '0 = intressi ei arvestata. Intress esitatakse arvel eraldi real, hinnast lahus; selle käibemaksukäsitlus kontrollige oma raamatupidajaga.',
    paidOn: 'Tehing on tasutud {date}.',
    allPaid: 'Kõik osamaksed on tasutud.',
  },
  lv: {
    payoff: 'Viss atlikums šodien: {sum} (līguma 4.6. punkts).',
    rateHint: '0 = procenti netiek aprēķināti. Procentus rēķinā norāda atsevišķā rindā, nošķirti no cenas; PVN piemērošanu pārbaudiet pie sava grāmatveža.',
    paidOn: 'Darījums apmaksāts {date}.',
    allPaid: 'Visi maksājumi ir samaksāti.',
  },
  lt: {
    payoff: 'Visas likutis šiandien: {sum} (sutarties 4.6 punktas).',
    rateHint: '0 = be palūkanų. Palūkanos sąskaitoje nurodomos atskira eilute, atskirai nuo kainos; PVM taikymą pasitikrinkite su savo buhalteriu.',
    paidOn: 'Sandoris apmokėtas {date}.',
    allPaid: 'Visos įmokos sumokėtos.',
  },
  pl: {
    payoff: 'Cała pozostała kwota na dziś: {sum} (pkt 4.6 umowy).',
    rateHint: '0 = bez odsetek. Odsetki są fakturowane w osobnej pozycji, oddzielnie od ceny; sposób ujęcia w VAT sprawdź u swojego księgowego.',
    paidOn: 'Transakcja spłacona {date}.',
    allPaid: 'Wszystkie raty zostały zapłacone.',
  },
  de: {
    payoff: 'Gesamte Restschuld heute: {sum} (Ziffer 4.6 des Vertrags).',
    rateHint: '0 = keine Zinsen. Zinsen werden in einer eigenen Zeile, getrennt vom Kaufpreis, berechnet; klären Sie die umsatzsteuerliche Behandlung mit Ihrem Buchhalter.',
    paidOn: 'Der Kauf ist seit {date} vollständig bezahlt.',
    allPaid: 'Alle Raten sind bezahlt.',
  },
  ru: {
    payoff: 'Полное погашение сегодня: {sum} (п. 4.6 договора).',
    rateHint: '0 — без процентов. Проценты выставляются отдельной строкой, отдельно от цены; как они облагаются НДС, уточните у своего бухгалтера.',
    paidOn: 'Сделка полностью оплачена {date}.',
    allPaid: 'Все платежи внесены.',
  },
  ro: {
    payoff: 'Întregul rest de plată astăzi: {sum} (punctul 4.6 din contract).',
    rateHint: '0 = fără dobândă. Dobânda se facturează pe un rând separat, distinct de preț; verificați tratamentul de TVA cu contabilul dumneavoastră.',
    paidOn: 'Vânzarea a fost achitată integral la {date}.',
    allPaid: 'Toate ratele sunt plătite.',
  },
};

/*
 * Оговорка для сторон не из Финляндии — на форме объявления и на странице
 * сделки. Договоры Эстонии, Латвии, Швеции и Дании собраны по исследованию права страны,
 * которое местный юрист не проверял: платформа об этом говорит прямо.
 * Название страны подставляется в именительном падеже (в скобках).
 */
export const LEGAL_NOTICE: Record<Locale, string> = {
  fi: 'Sopimustekstin on laatinut alusta myyjän maan lain pohjalta ({country}). RAHTIS ei ole kaupan osapuoli eikä anna oikeudellista neuvontaa – tarkastuttakaa sopimus omalla juristillanne ennen allekirjoittamista.',
  en: 'The contract text is prepared by the platform on the basis of the law of the seller’s country ({country}). RAHTIS is not a party to the sale and gives no legal advice – have the contract checked by your own lawyer before signing.',
  sv: 'Avtalstexten har tagits fram av plattformen utifrån lagen i säljarens land ({country}). RAHTIS är inte part i köpet och ger ingen juridisk rådgivning – låt er egen jurist granska avtalet innan ni undertecknar.',
  et: 'Lepingu teksti on koostanud platvorm müüja riigi õiguse alusel ({country}). RAHTIS ei ole tehingu pool ega anna õigusnõu – laske leping enne allkirjastamist oma juristil üle vaadata.',
  lv: 'Līguma tekstu platforma ir sagatavojusi, pamatojoties uz pārdevēja valsts tiesībām ({country}). RAHTIS nav darījuma puse un nesniedz juridiskas konsultācijas – pirms parakstīšanas lūdziet līgumu pārbaudīt savam juristam.',
  lt: 'Sutarties tekstą platforma parengė pagal pardavėjo šalies teisę ({country}). RAHTIS nėra sandorio šalis ir neteikia teisinių konsultacijų – prieš pasirašydami duokite sutartį patikrinti savo teisininkui.',
  pl: 'Tekst umowy został przygotowany przez platformę na podstawie prawa kraju sprzedawcy ({country}). RAHTIS nie jest stroną sprzedaży i nie udziela porad prawnych – przed podpisaniem dajcie umowę do sprawdzenia własnemu prawnikowi.',
  de: 'Der Vertragstext wurde von der Plattform auf Grundlage des Rechts des Landes des Verkäufers ({country}) erstellt. RAHTIS ist nicht Partei des Kaufs und leistet keine Rechtsberatung – lassen Sie den Vertrag vor der Unterzeichnung von Ihrem eigenen Anwalt prüfen.',
  ru: 'Текст договора подготовлен платформой по праву страны продавца ({country}). RAHTIS не является стороной сделки и не даёт юридических консультаций — до подписания покажите договор своему юристу.',
  ro: 'Textul contractului este întocmit de platformă pe baza legii țării vânzătorului ({country}). RAHTIS nu este parte la vânzare și nu oferă consultanță juridică – înainte de semnare, dați contractul spre verificare propriului avocat.',
};

/** Страна со своими текстами кабинета; null — Финляндия и страны без текстов (им показывается основной текст). */
export function lawCountry(country: string | null | undefined): LawCountry | null {
  const code = (country ?? '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(LAW_TEXTS, code) ? (code as LawCountry) : null;
}

/** Есть ли у страны тексты кабинета: у Финляндии — основные, у остальных — запись здесь на всех языках. */
export function countryTextsExist(country: string | null | undefined): boolean {
  const code = (country ?? '').toUpperCase();
  if (code === 'FI') return true;
  const law = lawCountry(code);
  return law !== null && locales.every((l) => Boolean(LAW_TEXTS[law]?.[l]) && Boolean(COMMON_TEXTS[l]) && Boolean(LEGAL_NOTICE[l]));
}

/** Добавка к текстам раздела: то, чего в основном наборе нет. */
export type InstallmentCountryExtras = {
  code: LawCountry;
  /** Пороги рядом с расчётом — вместо финского текста калькулятора. */
  thresholdsText: string;
  /** Подсказка у ставки процентов — вместо финской. */
  rateHint: string;
  /** Оговорка о счёте (электронный счёт страны). */
  invoiceNote: string;
  /** Оговорка «договор подготовлен платформой»; {country} — название страны. */
  legalNotice: string;
};

/* Поля основного набора (copy.ts), которые заменяет страна. Тип — по форме, без импорта copy.ts. */
type BaseCopy = {
  intro: string;
  introSeller: string;
  notAllowed: string;
  deal: { contract: string; nextSteps: string };
  notify: { thresholdTitle: string; thresholdBody: string; paidOffBody: string };
  termination: { hint: string; reasons: Record<string, string>; settlement: string };
  stage3: { checklist: string[]; remedy: string; payoff: string; paidOff: string };
};

const asLocale = (locale: string): Locale => ((locales as readonly string[]).includes(locale) ? (locale as Locale) : 'en');

/**
 * Основной набор текстов с заменами страны. Финляндия и неизвестная страна —
 * тот же объект, без копии: финская компания видит ровно то, что видела.
 */
export function withCountryTexts<T extends BaseCopy>(base: T, locale: string, country: string | null | undefined): T & { country?: InstallmentCountryExtras } {
  const code = lawCountry(country);
  if (!code) return base;
  const l = asLocale(locale);
  const law = LAW_TEXTS[code][l];
  const common = COMMON_TEXTS[l];
  /*
   * Чек-лист передачи: договор, первый счёт и акт — общие; реестр и страховка
   * — по стране. У страны могут быть свои пункты перед реестром (Дания —
   * Bilbogen, Литва — реестр договоров, Германия — проверка § 513 BGB): форма
   * передачи требует отметить все пункты, сколько бы их ни было. У Литвы
   * первый документ — предварительный счёт, и пункт об оплате свой
   * (checkFirstPaid, 23.11.2026).
   */
  const checklist = base.stage3.checklist.flatMap((item, i) =>
    i === 1 && law.checkFirstPaid
      ? [law.checkFirstPaid]
      : i === 2
        ? [...(law.checkBefore ?? []), law.checkRegister]
        : i === 3
          ? [law.checkInsurance]
          : [item],
  );
  return {
    ...base,
    intro: law.intro,
    introSeller: law.introSeller,
    notAllowed: law.notAllowed,
    deal: { ...base.deal, contract: law.contract, nextSteps: law.nextSteps },
    notify: {
      ...base.notify,
      thresholdTitle: law.thresholdTitle,
      thresholdBody: law.threshold,
      paidOffBody: `${common.allPaid} ${law.afterPaid}`,
    },
    termination: {
      ...base.termination,
      hint: law.terminationHint,
      reasons: { ...base.termination.reasons, REPOSSESSED: law.reasonRepossessed },
      settlement: law.settlement,
    },
    stage3: {
      ...base.stage3,
      checklist,
      remedy: law.threshold,
      payoff: common.payoff,
      paidOff: `${common.paidOn} ${law.afterPaid}`,
    },
    country: {
      code,
      thresholdsText: law.thresholdsText,
      rateHint: law.rateHint ?? common.rateHint,
      invoiceNote: law.invoiceNote,
      /* Германия (23.11.2026): к общей оговорке — что шаблон является AGB (§ 307 BGB). */
      legalNotice: law.legalNoticeExtra ? `${LEGAL_NOTICE[l]} ${law.legalNoticeExtra}` : LEGAL_NOTICE[l],
    },
  };
}

/**
 * Код события для уведомления, текст которого зависит от страны (порог,
 * полная оплата). У Финляндии — прежний код: страница уведомлений собирает
 * по нему финский текст из словаря. У другой страны — свой код, которого в
 * словаре нет: показывается текст, записанный вместе с уведомлением (он уже
 * про право страны и на языке компании).
 */
export function countryEventCode(event: string, country: string | null | undefined): string {
  const code = lawCountry(country);
  return code ? `installment.${event}.${code.toLowerCase()}` : `installment.${event}`;
}

/**
 * Язык текста, записываемого с уведомлением. У Финляндии — как было
 * (финский или английский: остальное кабинет соберёт по коду). У другой
 * страны записанный текст и есть то, что увидит читатель, — поэтому язык
 * компании, если кабинет на нём есть.
 */
export function countryNoticeLocale(language: string | null | undefined, country: string | null | undefined): Locale {
  if (!lawCountry(country)) return !language || language === 'fi' ? 'fi' : 'en';
  return asLocale((language ?? '').toLowerCase());
}
