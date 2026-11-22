/**
 * Топливо в доходности — без НДС (решение пользователя 22.11.2026).
 *
 * Все суммы раздела подписаны «без НДС», а fuel_entries.amount_cents —
 * итог чека с НДС. Здесь из итога чека получается сумма без налога по
 * общей ставке страны, где куплено топливо. Раздел «Топливо» и его
 * выгрузка показывают чек как он внесён — этот модуль их не касается.
 *
 * Страну покупки запись не хранит: в ней есть только название станции
 * (свободный текст) и валюта чека. Поэтому:
 *   · чек в кронах, злотых или леях — страна этой валюты (финская машина
 *     заправилась в Швеции — шведская ставка);
 *   · чек в евро — страна компании: какая из стран евро на чеке, запись
 *     не говорит;
 *   · валюты нет — страна компании.
 *
 * Без импортов: модуль читают тесты (node --test). Ставку по стране даёт
 * вызывающий код — standardVatBps из lib/sites/invoice.
 */

const CURRENCY_COUNTRY: Readonly<Record<string, string>> = {
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  PLN: 'PL',
  RON: 'RO',
};

/** Страна, по ставке которой снимается НДС с чека. Неизвестна — null. */
export function fuelVatCountry(currency: string | null | undefined, companyCountry: string | null | undefined): string | null {
  const byCurrency = CURRENCY_COUNTRY[(currency ?? '').trim().toUpperCase()];
  if (byCurrency) return byCurrency;
  const country = (companyCountry ?? '').trim().toUpperCase();
  return country || null;
}

/**
 * Сумма без НДС из итога чека: итог × 10000 / (10000 + ставка), до цента.
 * Ставка неизвестна — итог остаётся как есть: выдумывать налог нельзя.
 */
export function fuelNetCents(amountCents: number, vatBps: number | null | undefined): number {
  if (vatBps == null || !(vatBps > 0)) return amountCents;
  return Math.round((amountCents * 10_000) / (10_000 + vatBps));
}
