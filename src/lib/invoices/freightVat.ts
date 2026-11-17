/**
 * НДС в недельном счёте перевозчика заказчику (17.11.2026).
 *
 * Перевозка груза для предприятия облагается там, где покупатель
 * (Директива 2006/112/EC, ст. 44; в Финляндии AVL 65 §):
 *   · продавец и покупатель из одной страны — обычная ставка страны;
 *   · из разных стран ЕС — 0 %, налог платит покупатель (reverse charge,
 *     ст. 196); в счёте обязательны пометка и ALV-номер покупателя. Без
 *     номера автоматически не выставляем — это решает перевозчик сам;
 *   · одна из сторон вне ЕС (Норвегия) — тоже 0 % с пометкой: налог
 *     начисляет покупатель по своей стране.
 *
 * Без импортов из приложения: модуль читают сервер и тесты. Обычная
 * ставка страны продавца приходит параметром (standardVatBps в sites/invoice).
 */
const EU = new Set(['FI', 'SE', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE', 'RO']);

export const REVERSE_CHARGE_NOTE =
  'Käännetty verovelvollisuus – ostaja on verovelvollinen (AVL 65 §, direktiivi 2006/112/EY 196 art.). / Reverse charge – VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC).';

export const OUTSIDE_EU_NOTE =
  'Ei Suomen/myyjämaan arvonlisäveroa – ostaja on verovelvollinen omassa maassaan. / No VAT charged – VAT to be accounted for by the recipient in its own country.';

export type FreightVat =
  | { ok: true; vatBps: number; note: string | null }
  | { ok: false; reason: 'NO_VAT_RATE' | 'NO_BUYER_VAT' };

export function freightVat(
  sellerCountry: string | null | undefined,
  buyerCountry: string | null | undefined,
  buyerVatNumber: string | null | undefined,
  /** Обычная ставка страны продавца, б. п.; null — неизвестна. */
  sellerStandardBps: number | null,
): FreightVat {
  const seller = (sellerCountry ?? '').toUpperCase();
  const buyer = (buyerCountry ?? seller).toUpperCase();

  if (seller === buyer) {
    const bps = sellerStandardBps;
    return bps === null ? { ok: false, reason: 'NO_VAT_RATE' } : { ok: true, vatBps: bps, note: null };
  }

  if (EU.has(seller) && EU.has(buyer)) {
    /* Номер НДС покупателя — его страны: «DE…» у немецкой фирмы, не чужой. */
    const vatId = (buyerVatNumber ?? '').replace(/\s+/g, '').toUpperCase();
    if (!vatId || !vatId.startsWith(buyer)) return { ok: false, reason: 'NO_BUYER_VAT' };
    return { ok: true, vatBps: 0, note: REVERSE_CHARGE_NOTE };
  }

  return { ok: true, vatBps: 0, note: OUTSIDE_EU_NOTE };
}
