import type { Locale } from '../i18n/config.ts';
import {
  installmentCountry,
  installmentCountryEntry,
  installmentInterestOffered,
  installmentMaxRateBps,
  installmentSellerInvoices,
  MAX_RATE_BPS,
  openInstallmentCountries,
  vatRateText,
} from '../installments/countries.ts';
import { countryName } from '../installments/countryCopy.ts';
import { COMMON_TEXTS, LAW_TEXTS, LEGAL_NOTICE, lawCountry } from '../installments/countryTexts/index.ts';
import { SELLER_INVOICE_SYSTEMS, SELLER_INVOICE_TEXTS, type SellerInvoiceCountry } from '../installments/countryTexts/sellerInvoices.ts';
import type { InstallmentCopy } from './installment.ts';
import { installmentCountryLandingCopy } from './installmentCountryCopy.ts';

/**
 * Открытая страница калькулятора по стране расчёта (24.11.2026): что
 * показывать в калькуляторе, в шагах, в вопросах и в оговорке.
 *
 * Числа — из реестра (countries.ts: валюта, ставка НДС, предел процентов,
 * предлагаются ли проценты) и из правил порогов (rules.ts, по id) — те же,
 * что в кабинете (TermsFields). Тексты страны — из кабинета (countryTexts/),
 * общие слова — installmentCountryCopy.ts. Финляндия — основной текст
 * страницы как был.
 *
 * Собирается на сервере: в браузер уходят только строки и числа выбранной
 * страны, а не тексты всех стран на всех языках.
 */

/** Что калькулятору нужно знать о стране (только данные — передаётся в клиентский компонент). */
export type InstallmentCalcCountry = {
  code: string;
  /** Финляндия: выбор режима НДС и блок налога продавца как раньше. */
  fi: boolean;
  currency: string;
  vatBps: number;
  /** Набор правил порогов (rules.ts). */
  rules: string;
  /** Швеция: проценты не предлагаются, ставка 0. */
  rateFixed: boolean;
  maxRateBps: number;
  /** Ставка НДС страны словами («25 %») — у других стран режим НДС не выбирается. */
  vatText: string;
  vatHint?: string;
  rateHint: string;
  /** Ошибка ставки, если предел страны ниже общего (Польша — 7 %). */
  rateMaxError?: string;
  firstInvoiceLabel: string;
  firstInvoiceHint: string;
  thresholdsTitle: string;
  thresholdsText: string;
  scenarioText: string;
  /** Не Финляндия: вместо блока налога продавца одна фраза. */
  taxNote?: string;
  /** Польша и Румыния: счета выставляет продавец в KSeF / RO e-Factura. */
  note?: string;
};

export type InstallmentCountryView = {
  calc: InstallmentCalcCountry;
  lede: string;
  how: { title: string; text: string }[];
  faq: { q: string; a: string }[];
  disclaimer: string;
};

const asLocale = (locale: string, fallback: Locale = 'en'): Locale =>
  Object.prototype.hasOwnProperty.call(COMMON_TEXTS, locale) ? (locale as Locale) : fallback;

/** Открытые страны для выбора — с названием на языке страницы. */
export function installmentCountryOptions(locale: string): { code: string; label: string }[] {
  return openInstallmentCountries().map((code) => ({ code, label: countryName(locale, code) }));
}

/**
 * vatFixed — строка «НДС всегда обычный» основного набора кабинета
 * (copy.ts listing.vatFixed): модуль её не импортирует, чтобы остаться
 * без зависимостей от приложения.
 */
export function installmentCountryView(base: InstallmentCopy, locale: string, country: string, vatFixed: string): InstallmentCountryView {
  const l = asLocale(locale);
  const entry = installmentCountry(country) ?? installmentCountry('FI');
  if (!entry) throw new Error('installment country FI closed');
  const code = entry.code;
  const name = countryName(locale, code);
  const maxRateBps = installmentMaxRateBps(code);
  const law = lawCountry(code);
  const lc = installmentCountryLandingCopy(l);

  if (!law) {
    /* Финляндия — всё из основного текста страницы. */
    return {
      calc: {
        code,
        fi: true,
        currency: entry.currency,
        vatBps: entry.vatStandardBps,
        rules: entry.rules,
        rateFixed: !installmentInterestOffered(code),
        maxRateBps,
        vatText: base.f.vatModes.STANDARD,
        rateHint: base.f.rateHint,
        firstInvoiceLabel: base.r.firstInvoice,
        firstInvoiceHint: base.r.firstInvoiceHint,
        thresholdsTitle: base.r.thresholdsTitle,
        thresholdsText: base.r.thresholdsText,
        scenarioText: base.r.scenarioText,
      },
      lede: base.lede,
      how: base.how,
      faq: base.faq,
      disclaimer: base.disclaimer,
    };
  }

  const text = LAW_TEXTS[law][l];
  const sic = installmentSellerInvoices(code) && Object.prototype.hasOwnProperty.call(SELLER_INVOICE_SYSTEMS, code) ? (code as SellerInvoiceCountry) : null;
  const si = SELLER_INVOICE_TEXTS[l];
  /*
   * Сумма до передачи: «первый счёт» — только где платформа его и выставляет
   * с НДС (vatOnFirstInvoice). Польша и Румыния — счёт выставляет продавец в
   * своей системе, Литва — до передачи предварительный счёт: подпись та же,
   * что в кабинете у Польши и Румынии, «платёж до передачи» (24.11.2026).
   */
  const firstOnInvoice = installmentCountryEntry(code)?.vatOnFirstInvoice === true;
  const firstLabel = firstOnInvoice ? base.r.firstInvoice : si.firstPaymentLabel;
  const vatHint = sic ? si.vatFixed.replaceAll('{system}', SELLER_INVOICE_SYSTEMS[sic]) : firstOnInvoice ? vatFixed : undefined;
  const fillName = (s: string) => s.replaceAll('{country}', name);

  return {
    calc: {
      code,
      fi: false,
      currency: entry.currency,
      vatBps: entry.vatStandardBps,
      rules: entry.rules,
      rateFixed: !installmentInterestOffered(code),
      maxRateBps,
      vatText: vatRateText(entry.vatStandardBps, locale),
      vatHint,
      /* Как в кабинете: подсказка страны, иначе общая (COMMON_TEXTS), а не финская «проценты без НДС». */
      rateHint: text.rateHint ?? COMMON_TEXTS[l].rateHint,
      rateMaxError: maxRateBps < MAX_RATE_BPS ? lc.rateMax.replaceAll('{max}', vatRateText(maxRateBps, locale)) : undefined,
      firstInvoiceLabel: firstLabel,
      firstInvoiceHint: lc.firstInvoiceHint,
      thresholdsTitle: fillName(lc.thresholdsTitle),
      thresholdsText: text.thresholdsText,
      scenarioText: lc.scenarioText,
      taxNote: lc.taxNote,
      note: sic ? text.listingNote : undefined,
    },
    lede: lc.lede,
    how: [
      { title: base.how[0].title, text: lc.how.contract },
      { title: firstLabel, text: lc.how.first },
      { title: base.how[2].title, text: lc.how.register },
      base.how[3],
      { title: base.how[4].title, text: lc.how.final },
    ],
    faq: [
      { q: lc.faq.lawQ, a: text.intro },
      { q: lc.faq.thresholdQ, a: lc.faq.thresholdA },
      { q: lc.faq.beforeQ, a: text.nextSteps },
      { q: lc.faq.invoicesQ, a: text.invoiceNote },
      { q: lc.faq.afterQ, a: text.afterPaid },
      { q: lc.faq.taxQ, a: lc.faq.taxA },
    ],
    /* Оговорка без финских источников: «расчёт ориентировочный» и «договор подготовлен платформой, RAHTIS не сторона». */
    disclaimer: [lc.disclaimer, fillName(LEGAL_NOTICE[l]), text.legalNoticeExtra].filter(Boolean).join(' '),
  };
}
