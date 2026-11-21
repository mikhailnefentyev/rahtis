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

/*
 * Продавец не из Финляндии (21.11.2026, аудит): ссылка на финский AVL 65 § и
 * финская фраза в его счёте неуместны. Пометка «Reverse charge» — та, что
 * требует ст. 226(11a) директивы, со ссылкой на ст. 196.
 */
export const REVERSE_CHARGE_NOTE_EU =
  'Reverse charge – VAT to be accounted for by the recipient (Art. 196 Directive 2006/112/EC).';

export const OUTSIDE_EU_NOTE_EU = 'No VAT charged – VAT to be accounted for by the recipient in its own country.';

export const OUTSIDE_EU_NOTE =
  'Ei Suomen/myyjämaan arvonlisäveroa – ostaja on verovelvollinen omassa maassaan. / No VAT charged – VAT to be accounted for by the recipient in its own country.';

export type FreightVat =
  | { ok: true; vatBps: number; note: string | null }
  | { ok: false; reason: 'NO_VAT_RATE' | 'NO_BUYER_VAT' | 'NO_SELLER_VAT' };

export function freightVat(
  sellerCountry: string | null | undefined,
  buyerCountry: string | null | undefined,
  buyerVatNumber: string | null | undefined,
  /** Обычная ставка страны продавца, б. п.; null — неизвестна. */
  sellerStandardBps: number | null,
  /*
   * Номер НДС продавца (21.11.2026, аудит 2.7). Счёт с reverse charge обязан
   * нести номера НДС обеих сторон (директива 2006/112/EC ст. 226 п. 3 и 4);
   * у EE и LT он из номера компании не выводится и может быть пуст.
   * undefined — не проверять (вызовы, где продавец заведомо известен).
   */
  sellerVatNumber?: string | null,
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
    if (sellerVatNumber !== undefined && !(sellerVatNumber ?? '').replace(/\s+/g, '')) return { ok: false, reason: 'NO_SELLER_VAT' };
    return { ok: true, vatBps: 0, note: seller === 'FI' ? REVERSE_CHARGE_NOTE : REVERSE_CHARGE_NOTE_EU };
  }

  return { ok: true, vatBps: 0, note: seller === 'FI' ? OUTSIDE_EU_NOTE : OUTSIDE_EU_NOTE_EU };
}
