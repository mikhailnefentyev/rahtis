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
 * Открыты Финляндия, Эстония, Латвия, Швеция, Дания, Литва и Германия
 * (23.11.2026). Для остальных стран нет ни правил, ни договора (их готовят в
 * docs/equipment-sale/countries/).
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
 * НДС, затем срок 14 дней (договор п. 9.1).
 */
export type InstallmentRulesId = 'FI_OSKL' | 'EE_VOS' | 'LV_CL2070' | 'SE_AVBL' | 'DK_KAL' | 'LT_CK6414' | 'DE_BGB449';

/**
 * Шаблон договора. FI_OSAMAKSU — ContractPdf.tsx, договор по финскому праву;
 * EE_JARELMAKS, LV_NOMAKSA, SE_AVBETALNING и DK_KREDITKOEB — тексты
 * contractText/ee.ts, lv.ts, se.ts и dk.ts, печатает CountryContractPdf.tsx.
 */
export type InstallmentContractId =
  | 'FI_OSAMAKSU'
  | 'EE_JARELMAKS'
  | 'LV_NOMAKSA'
  | 'SE_AVBETALNING'
  | 'DK_KREDITKOEB'
  | 'LT_ISSIMOKETINAI'
  | 'DE_RATENKAUF';

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
  PL: CLOSED,
  /*
   * Германия (23.11.2026): Kauf mit Ratenzahlung und Eigentumsvorbehalt (BGB
   * §§ 433, 449). Весь НДС со всей цены при передаче, с предоплаты — при
   * получении (§ 13 Abs. 1 Nr. 1 Buchst. a UStG): первый счёт как в Финляндии.
   */
  DE: { open: true, rules: 'DE_BGB449', contract: 'DE_RATENKAUF', contractLanguage: 'de', vatOnFirstInvoice: true },
  RO: CLOSED,
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
