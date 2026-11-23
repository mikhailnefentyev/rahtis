/**
 * Страны раздела «Продажа техники в рассрочку» (решение владельца 23.11.2026).
 *
 * Раздел должен работать в каждой стране платформы и расширяться вместе с
 * ней. Страна здесь — запись: открыт ли раздел, по каким правилам считаются
 * пороги просрочки, какой шаблон договора и на каком языке, выставляется ли
 * весь НДС первым счётом. Валюта и ставка НДС берутся из пакета страны
 * (src/lib/country) и здесь не повторяются.
 *
 * Сделка всегда внутри одной страны: продавец и покупатель — компании одной
 * страны (проверяет база, start_installment_deal). Объявления видны всем.
 *
 * Открыты Финляндия, Эстония, Латвия, Швеция, Дания, Литва, Германия, Польша
 * и Румыния (23.11.2026). Для остальных стран (Норвегия) нет ни правил, ни
 * договора (их готовят в docs/equipment-sale/countries/).
 * Открыть страну — заполнить её запись, добавить правила (rules.ts), шаблон
 * договора (contractText/, contractTemplates.ts), тексты счетов
 * (invoiceTexts.ts) и кабинета (countryTexts/) и вписать страну в
 * app.installment_country_open в базе. Что у открытой страны всё это есть,
 * проверяет тест countryOpen.test.mjs.
 *
 * Эстония и Латвия открыты по исследованию docs/equipment-sale/countries/
 * ee.md и lv.md: его не проверял местный юрист, поэтому сторонам в кабинете
 * показывается оговорка (countryCopy.ts, legalNotice), а неподтверждённые
 * правила взяты в осторожном варианте.
 *
 * Швеция и Дания открыты так же, по se.md и dk.md (23.11.2026). Чем они
 * отличаются от остальных:
 *   · валюта — кроны (SEK, DKK), из пакета страны; суммы не пересчитываются;
 *   · Швеция: проценты не предлагаются (interestOffered: false) — как
 *     проценты рассрочки облагаются НДС, не выяснено (два источника
 *     Skatteverket расходятся), и исследование советует не включать их до
 *     ответа бухгалтера. Ставка в форме стоит 0, сервер и база другую не
 *     принимают (app.installment_interest_allowed);
 *   · Швеция: в реестре владельцем записывается ПОКУПАТЕЛЬ, у продавца —
 *     только отметка о kreditköp; Дания: оговорку о собственности надо
 *     зарегистрировать в Bilbogen до передачи. Это в текстах страны
 *     (countryTexts/se.ts, dk.ts) и в чек-листе передачи.
 *
 * Литва и Германия открыты так же, по lt.md и de.md (23.11.2026):
 *   · пороги просрочки — договорные (закон их не даёт), после порога —
 *     письменный срок 14 дней (rules.ts: LT_CK6414, DE_BGB449);
 *   · Литва: НДС со всей цены возникает при передаче, аванс до неё не
 *     облагается — до передачи предварительный счёт (išankstinio mokėjimo
 *     sąskaita), счёт с НДС в день передачи (vatInvoiceAtHandover);
 *     обязательную страховку по закону оформляет записанный собственник, то
 *     есть продавец — это в чек-листе;
 *   · Германия: первый счёт как в Финляндии, но PDF — счёт только до
 *     31.12.2026, дальше платёжная информация без НДС (invoiceTexts.ts);
 *     ежемесячно — Zahlungsaufforderung без НДС; в реестре только держатель
 *     (Halter), продавца защищает Zulassungsbescheinigung Teil II; шаблон —
 *     типовые условия (AGB), оговорка в кабинете усилена.
 *
 * Польша и Румыния открыты так же, по pl.md и ro.md (23.11.2026). Главное
 * отличие — счета (sellerInvoices): счёт между компаниями там существует
 * только в государственной системе (KSeF — обязателен для всех польских
 * компаний с 01.04.2026; RO e-Factura — между румынскими компаниями, PDF вне
 * системы не счёт, штраф 15 % обеим сторонам). Платформа к этим системам не
 * подключена, поэтому по решению владельца она в этих странах не печатает
 * ничего, что называется счётом: только расчёт, договор, график, платёжные
 * уведомления и напоминания со своей нумерацией (серию счетов продавца они не
 * занимают), а каждый счёт продавец выставляет в системе сам. Передача ждёт
 * не «оплаченного счёта», а подтверждения продавца, что платёж до передачи
 * получен (app.mark_installment_first_paid разрешает это и без документа
 * платформы — миграция 20261202100000).
 *   · Польша: пороги договорные (два взноса больше 14 дней или один больше
 *     30 дней, rules.ts PL_KC589), затем срок 14 дней; проценты по договору не
 *     выше odsetki maksymalne (2 × (ставка NBP + 3,5 п.п.)) — ставку NBP
 *     платформа не знает, поэтому разрешает не больше 7 % годовых (maxRateBps):
 *     ниже этого предел опуститься не может, пока ставка NBP не отрицательна;
 *   · Румыния: пороги договорные (1/8 цены и 30 дней или два взноса со
 *     старшим 30 дней, rules.ts RO_CC1755), затем срок 15 дней; оговорку о
 *     собственности надо записать в RNPM до передачи.
 *
 * СПИСОК ОТКРЫТЫХ СТРАН ПОВТОРЁН В БАЗЕ: функция app.installment_country_open
 * (последняя миграция, где она определена). Меняешь open здесь — меняй и там;
 * расхождение ловит тест countries.test.mjs.
 *
 * Без зависимостей от приложения: читают сервер, клиент и тесты.
 */
import { COUNTRY_PACKS, type CountryCode } from '../country/index.ts';

/**
 * Набор правил о просрочке и изъятии (rules.ts).
 * FI_OSKL — финский закон о рассрочке 91/1966 (calc.ts);
 * EE_VOS — Эстония: порогов в законе нет, их задаёт договор (п. 9.1), затем
 * дополнительный срок и отказ от договора (VÕS § 114, § 116, § 233);
 * LV_CL2070 — Латвия: два пропущенных срока платежа (Civillikums 2070. p.);
 * SE_AVBL — Швеция: больше 14 дней и больше 1/10 (1/20) kreditfordran
 * (lag 1978:599, 7 §);
 * DK_KAL — Дания: 30 дней и не меньше 1/10 (1/20) всей суммы к уплате
 * (kreditaftaleloven § 29);
 * LT_CK6414 — Литва: порогов в законе нет (CK 6.414), договорные — больше 30
 * дней и не меньше 1/10 (1/20) цены с НДС, затем срок 14 дней (договор п. 9);
 * DE_BGB449 — Германия: порогов для компаний нет (BGB § 449, § 323),
 * договорные по образцу § 498 BGB — два взноса подряд и 10 % (5 %) цены с
 * НДС, затем срок 14 дней (договор п. 9.1);
 * PL_KC589 — Польша: порогов для компаний нет (KC 587, 589–591), договорные —
 * два взноса больше 14 дней или один больше 30 дней, затем срок 14 дней
 * (договор п. 9.1, KC 491 § 1);
 * RO_CC1755 — Румыния: закон (Codul civil 1756, 1/8 цены) диспозитивен,
 * договорные — 30 дней и 1/8 цены с НДС, или два взноса со старшим 30 дней,
 * или весь остаток, затем срок 15 дней (договор п. 9.2–9.3).
 */
export type InstallmentRulesId =
  | 'FI_OSKL'
  | 'EE_VOS'
  | 'LV_CL2070'
  | 'SE_AVBL'
  | 'DK_KAL'
  | 'LT_CK6414'
  | 'DE_BGB449'
  | 'PL_KC589'
  | 'RO_CC1755';

/**
 * Шаблон договора. FI_OSAMAKSU — ContractPdf.tsx, договор по финскому праву;
 * EE_JARELMAKS, LV_NOMAKSA, SE_AVBETALNING и DK_KREDITKOEB — тексты
 * contractText/ee.ts, lv.ts, se.ts и dk.ts, печатает CountryContractPdf.tsx;
 * LT_ISSIMOKETINAI, DE_RATENKAUF, PL_RATY и RO_RATE — lt.ts, de.ts, pl.ts и ro.ts.
 */
export type InstallmentContractId =
  | 'FI_OSAMAKSU'
  | 'EE_JARELMAKS'
  | 'LV_NOMAKSA'
  | 'SE_AVBETALNING'
  | 'DK_KREDITKOEB'
  | 'LT_ISSIMOKETINAI'
  | 'DE_RATENKAUF'
  | 'PL_RATY'
  | 'RO_RATE';

export type InstallmentCountryEntry = {
  /** Раздел открыт компаниям этой страны. */
  open: boolean;
  /** Правила порогов; null — для страны ещё не описаны, открыть её нельзя. */
  rules: InstallmentRulesId | null;
  /** Шаблон договора; null — договора для страны ещё нет, открыть её нельзя. */
  contract: InstallmentContractId | null;
  /** Язык договора (код языка сайта). */
  contractLanguage: string | null;
  /** Весь НДС с цены выставляется первым счётом вместе со взносом; null — ещё не выяснено. */
  vatOnFirstInvoice: boolean | null;
  /**
   * true — счёт с НДС на всю цену выставляется в день передачи машины, а до
   * неё — предварительный счёт без НДС на взнос и сумму НДС (Литва,
   * 23.11.2026: PVMĮ 14 str. 4–5 d.). Тогда vatOnFirstInvoice — false.
   */
  vatInvoiceAtHandover?: true;
  /**
   * false — проценты в стране не предлагаются: ставка всегда 0 (Швеция,
   * 23.11.2026). Поля нет — проценты разрешены, как в остальных странах.
   */
  interestOffered?: false;
  /**
   * true — счета выставляет только продавец в государственной системе
   * электронных счетов (KSeF, RO e-Factura), платформа — только платёжные
   * уведомления (Польша и Румыния, 23.11.2026). Тогда vatOnFirstInvoice — false.
   */
  sellerInvoices?: true;
  /**
   * Наибольшая ставка процентов, б. п. (23.11.2026). Польша: проценты по
   * договору не выше odsetki maksymalne — 2 × (ставка NBP + 3,5 п.п.), KC 359
   * § 2¹. Ставку NBP платформа не отслеживает и не зашивает: 700 = 2 × 3,5 —
   * предел, ниже которого максимум не опустится, пока ставка NBP не
   * отрицательна. Поля нет — общий предел калькулятора (50 %).
   */
  maxRateBps?: number;
};

const CLOSED: InstallmentCountryEntry = { open: false, rules: null, contract: null, contractLanguage: null, vatOnFirstInvoice: null };

/*
 * Запись нужна для КАЖДОЙ страны платформы: тип Record не даст собрать
 * проект без неё, а тест сверяет ключи с COUNTRY_PACKS. Новая страна
 * платформы — решение здесь, даже если это «пока закрыта».
 */
export const INSTALLMENT_COUNTRIES: Record<CountryCode, InstallmentCountryEntry> = {
  FI: { open: true, rules: 'FI_OSKL', contract: 'FI_OSAMAKSU', contractLanguage: 'fi', vatOnFirstInvoice: true },
  /*
   * Швеция (23.11.2026): avbetalningsköp по lag (1978:599); фактическая передача
   * по такому договору — поставка товара, НДС со всей цены при передаче, с
   * аванса — при получении (ML 5 kap. 3 §, 7 kap. 4 и 7 §§); первый счёт как в
   * Финляндии. Проценты не предлагаются — см. выше.
   */
  SE: { open: true, rules: 'SE_AVBL', contract: 'SE_AVBETALNING', contractLanguage: 'sv', vatOnFirstInvoice: true, interestOffered: false },
  NO: CLOSED,
  /*
   * Дания (23.11.2026): kreditkøb med ejendomsforbehold по kreditaftaleloven;
   * продажа в кредит с оговоркой — поставка при фактической передаче, весь
   * НДС при передаче, предоплата — в момент оплаты (momsloven § 4, stk. 3,
   * nr. 2; § 23). Проценты вне базы НДС, если показаны отдельно (§ 27, stk. 3, nr. 4).
   */
  DK: { open: true, rules: 'DK_KAL', contract: 'DK_KREDITKOEB', contractLanguage: 'da', vatOnFirstInvoice: true },
  /* Эстония (23.11.2026): НДС со всей цены при передаче, аванс — в оплаченной части (KMS § 11); первый счёт как в Финляндии. */
  EE: { open: true, rules: 'EE_VOS', contract: 'EE_JARELMAKS', contractLanguage: 'et', vatOnFirstInvoice: true },
  /* Латвия (23.11.2026): nomaksas pirkums — поставка товара, PVN со всей цены при передаче (PVN likums 1. p. 13. pkt., 34. p. 8. d.). */
  LV: { open: true, rules: 'LV_CL2070', contract: 'LV_NOMAKSA', contractLanguage: 'lv', vatOnFirstInvoice: true },
  /*
   * Литва (23.11.2026): pirkimas–pardavimas išsimokėtinai по Civilinis kodeksas
   * 6.411–6.416. НДС со всей цены — при передаче (PVMĮ 4 str. 2 d., 14 str.
   * 5 d.), аванс до передачи не облагается: первый документ — предварительный
   * счёт, PVM sąskaita faktūra — в день передачи (payments.ts).
   */
  LT: { open: true, rules: 'LT_CK6414', contract: 'LT_ISSIMOKETINAI', contractLanguage: 'lt', vatOnFirstInvoice: false, vatInvoiceAtHandover: true },
  /*
   * Польша (23.11.2026): sprzedaż z zastrzeżeniem własności (KC 589–591), особых
   * правил рассрочки для компаний нет (KC 587). НДС со всей цены — при
   * передаче, платёж до неё — аванс, облагаемый при получении (ustawa o VAT
   * art. 7 ust. 1 pkt 2, art. 19a ust. 1 и 8). Счета — только в KSeF и только
   * продавцом (sellerInvoices).
   */
  PL: {
    open: true,
    rules: 'PL_KC589',
    contract: 'PL_RATY',
    contractLanguage: 'pl',
    vatOnFirstInvoice: false,
    sellerInvoices: true,
    maxRateBps: 700,
  },
  /*
   * Германия (23.11.2026): Kauf mit Ratenzahlung und Eigentumsvorbehalt (BGB
   * §§ 433, 449). Весь НДС со всей цены при передаче, с предоплаты — при
   * получении (§ 13 Abs. 1 Nr. 1 Buchst. a UStG): первый счёт как в Финляндии.
   */
  DE: { open: true, rules: 'DE_BGB449', contract: 'DE_RATENKAUF', contractLanguage: 'de', vatOnFirstInvoice: true },
  /*
   * Румыния (23.11.2026): vânzarea cu plata prețului în rate și rezerva
   * proprietății (Codul civil 1755–1757). По договору (п. 4.2) продавец
   * выставляет счёт на всю цену с НДС до передачи (Codul fiscal art. 282),
   * взносы по цене счетами не оформляются, проценты — ежемесячным счётом без
   * НДС (art. 292). Все счета — только в RO e-Factura и только продавцом.
   */
  RO: { open: true, rules: 'RO_CC1755', contract: 'RO_RATE', contractLanguage: 'ro', vatOnFirstInvoice: false, sellerInvoices: true },
};

export type InstallmentCountry = {
  code: CountryCode;
  /** Валюта сделок страны — из пакета страны. */
  currency: string;
  /** Обычная ставка НДС страны, базисные пункты — из пакета страны. */
  vatStandardBps: number;
  rules: InstallmentRulesId;
  contract: InstallmentContractId;
  contractLanguage: string;
  vatOnFirstInvoice: boolean;
};

function codeOf(country: string | null | undefined): CountryCode | null {
  const code = (country ?? '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(COUNTRY_PACKS, code) ? (code as CountryCode) : null;
}

/**
 * Запись страны как есть, открыта она или нет: уже идущая сделка ведётся
 * по правилам и договору своей страны до конца, даже если раздел в ней
 * потом закрыли. Неизвестная страна — null.
 */
export function installmentCountryEntry(country: string | null | undefined): InstallmentCountryEntry | null {
  const code = codeOf(country);
  return code ? (INSTALLMENT_COUNTRIES[code] ?? null) : null;
}

/**
 * Открытая страна раздела со всем, что от неё зависит; null — закрыта.
 * Закрыта: нет в реестре, не помечена open, страна не принимает заявки
 * (enabled в пакете) или у неё не заполнены правила, договор либо НДС.
 */
export function installmentCountry(country: string | null | undefined): InstallmentCountry | null {
  const code = codeOf(country);
  if (!code) return null;
  const entry: InstallmentCountryEntry | undefined = INSTALLMENT_COUNTRIES[code];
  const pack = COUNTRY_PACKS[code];
  if (!entry || !entry.open || !pack.enabled) return null;
  if (!entry.rules || !entry.contract || !entry.contractLanguage || entry.vatOnFirstInvoice == null) return null;
  return {
    code,
    currency: pack.currency,
    vatStandardBps: pack.vatStandardBps,
    rules: entry.rules,
    contract: entry.contract,
    contractLanguage: entry.contractLanguage,
    vatOnFirstInvoice: entry.vatOnFirstInvoice,
  };
}

export function installmentCountryOpen(country: string | null | undefined): boolean {
  return installmentCountry(country) !== null;
}

/**
 * Предлагаются ли в стране проценты на остаток цены (23.11.2026). Нет —
 * только в Швеции: ставка там всегда 0. Неизвестная и закрытая страна —
 * как раньше, без ограничения (проверка страны — отдельно).
 * ТО ЖЕ ПРАВИЛО В БАЗЕ: app.installment_interest_allowed; расхождение ловит
 * тест countryOpen.test.mjs.
 */
export function installmentInterestOffered(country: string | null | undefined): boolean {
  return installmentCountryEntry(country)?.interestOffered !== false;
}

/** Общий предел ставки калькулятора, б. п. (calc.ts buildSchedule: 0–50 %). */
export const MAX_RATE_BPS = 5000;

/**
 * Наибольшая ставка процентов в стране сделки, б. п. (23.11.2026): у Польши —
 * 700 (см. maxRateBps), у остальных — общий предел 50 %. Где проценты не
 * предлагаются (Швеция), это решает installmentInterestOffered.
 * ТО ЖЕ ПРАВИЛО В БАЗЕ: app.installment_max_rate_bps; расхождение ловит тест
 * countryOpen.test.mjs.
 */
export function installmentMaxRateBps(country: string | null | undefined): number {
  return installmentCountryEntry(country)?.maxRateBps ?? MAX_RATE_BPS;
}

/**
 * Выставляет ли продавец все счета сам в государственной системе, а
 * платформа — только платёжные уведомления (Польша, Румыния; 23.11.2026).
 * ТО ЖЕ ПРАВИЛО В БАЗЕ: app.installment_seller_invoices.
 */
export function installmentSellerInvoices(country: string | null | undefined): boolean {
  return installmentCountryEntry(country)?.sellerInvoices === true;
}

/**
 * Значение строки «НДС» в условиях сделки не из Финляндии (23.11.2026):
 * ставка сделки — «25 %». В словаре калькулятора подпись обычного режима
 * написана про Финляндию («Soome üldmäär 25,5 %»), и шведский, датский,
 * эстонский или латвийский продавец читал бы чужую ставку. У финской сделки
 * подпись словаря остаётся как была.
 */
export function vatRateText(vatBps: number, locale: string): string {
  const percent = (vatBps / 100).toLocaleString(locale === 'en' ? 'en-GB' : locale, { maximumFractionDigits: 2 });
  return `${percent} %`;
}

/** Коды открытых стран — для фильтров открытой страницы и сверки с базой. */
export function openInstallmentCountries(): CountryCode[] {
  return (Object.keys(INSTALLMENT_COUNTRIES) as CountryCode[]).filter((code) => installmentCountryOpen(code));
}

/** Валюта страны раздела: из пакета страны; у неизвестной страны — евро. */
export function installmentCurrency(country: string | null | undefined): string {
  const code = codeOf(country);
  return code ? COUNTRY_PACKS[code].currency : 'EUR';
}

/**
 * Часовой пояс страны сделки (страны продавца) — из пакета страны
 * (23.11.2026): по нему датируются договор, счета и «сегодня» задания.
 * Неизвестная страна — Хельсинки, как было до открытия других стран.
 */
export function installmentTimeZone(country: string | null | undefined): string {
  const code = codeOf(country);
  return code ? COUNTRY_PACKS[code].timeZone : COUNTRY_PACKS.FI.timeZone;
}

/** Календарный день (ГГГГ-ММ-ДД) метки времени в поясе страны сделки. */
export function installmentDay(country: string | null | undefined, at: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: installmentTimeZone(country) }).format(new Date(at));
}

/** «Сегодня» в стране сделки. */
export function installmentToday(country: string | null | undefined, now: Date = new Date()): string {
  return installmentDay(country, now);
}

/** Сделка возможна только внутри одной страны (23.11.2026): продавец и покупатель — из одной открытой страны. */
export function sameInstallmentCountry(seller: string | null | undefined, buyer: string | null | undefined): boolean {
  const a = codeOf(seller);
  return a !== null && a === codeOf(buyer) && installmentCountryOpen(a);
}

/**
 * Сумма в валюте сделки или объявления. Валюты не пересчитываются: сумма
 * показывается в той валюте, в которой записана. whole — без дробной части
 * (карточки каталога); иначе целые суммы без копеек, дробные — с копейками.
 */
export function installmentMoney(locale: string, currency: string | null | undefined, whole = false): (cents: number) => string {
  const code = /^[A-Z]{3}$/.test(currency ?? '') ? (currency as string) : 'EUR';
  const format = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return (cents: number) => format.format(cents / 100);
}
