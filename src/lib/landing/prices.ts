import {
  ANNUAL_DISCOUNT_BPS,
  ON_REQUEST_FROM,
  SUBSCRIPTION_UNIT_CENTS,
} from "@/lib/config";
import type { Locale } from "@/lib/i18n/config";

/**
 * Подстановка цен в тексты посадочных страниц: {price} — цена машины в
 * месяц без НДС, {from} — с какого числа машин цена по запросу,
 * {discount} — скидка за год вперёд в процентах.
 */
export function fillPrices<T>(value: T, locale: Locale): T {
  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(SUBSCRIPTION_UNIT_CENTS / 100);
  const fill = (v: unknown): unknown => {
    if (typeof v === "string") {
      return v
        .replaceAll("{price}", price)
        .replaceAll("{from}", String(ON_REQUEST_FROM))
        .replaceAll("{discount}", String(ANNUAL_DISCOUNT_BPS / 100));
    }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, fill(x)]),
      );
    return v;
  };
  return fill(value) as T;
}
