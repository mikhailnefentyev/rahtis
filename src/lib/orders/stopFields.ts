import type { StopRole } from '@/types/db';

/**
 * Какое поле точки применимо к какой роли.
 *
 * Те же правила записаны ограничениями в миграции
 * 20260817140100_stop_details.sql. Здесь они существуют, чтобы форма не
 * показывала поле, которое база всё равно отвергнет, а не вместо проверки:
 * граница остаётся в базе, форма лишь не заводит человека в тупик.
 *
 *   поле             PICKUP  EXTRA_LOAD  EXTRA_UNLOAD  DELIVERY  CONT  RETURN
 *   note                ○         ○           ○           ○       ○      ○
 *   booking_ref         ○         ○           ○           ○       ○      ○
 *   cargo_weight_kg     ○         ○           —           —       ○      —
 *   consignee           —         ○           —           —       ○      —
 *   seal_required       ○         ○           —           —       ○      —
 *   external_ref        —         ○           —           —       ○      —
 *   trailer_loaded      ●         —           —           —       —      ●
 *
 * Тип места из формы убран: подсказка адреса и так возвращает и порты, и
 * терминалы, и обычные склады. Бронь спрашивается везде — где её требуют
 * на воротах, знает заказчик, а не схема.
 */

/** Роли, на которых груз берут на борт. */
const LOAD_ROLES: readonly StopRole[] = ['PICKUP', 'EXTRA_LOAD', 'CONTINUATION'];

/**
 * Вес и пломба — свойства груза, значит только там, где его берут.
 * PICKUP в списке потому, что прицеп из порта забирают уже гружёным:
 * точки загрузки в маршруте нет, она была за морем.
 */
export const hasCargo = (role: StopRole): boolean => LOAD_ROLES.includes(role);

/**
 * Получателя называют на загрузке. На выгрузке получатель — это
 * company_name самой точки, отдельное поле там означало бы двух разных
 * получателей у одной выгрузки.
 */
export const hasConsignee = (role: StopRole): boolean =>
  role === 'EXTRA_LOAD' || role === 'CONTINUATION';

/** Номер заказа, по которому груз выдают на загрузке. */
export const hasExternalRef = (role: StopRole): boolean =>
  role === 'EXTRA_LOAD' || role === 'CONTINUATION';

/**
 * Состояние прицепа — с грузом или пустой — осмысленно только на концах
 * рейса: там, где его цепляют и где оставляют. Между ними прицеп уже
 * прицеплен, и вопрос не стоит.
 */
export const hasTrailerState = (role: StopRole): boolean =>
  role === 'PICKUP' || role === 'TRAILER_RETURN';

/** Верхняя граница — финская: 76 тонн для сцепок HCT, по ЕС предел 40. */
export const MAX_CARGO_KG = 76_000;

/** Тонны из формы в килограммы базы: вес хранится целым, как и деньги. */
export function tonnesToKg(value: string): number | null {
  const normalised = value.replace(/\s/g, '').replace(',', '.');
  const tonnes = Number.parseFloat(normalised);
  if (!Number.isFinite(tonnes) || tonnes <= 0) return null;

  const kg = Math.round(tonnes * 1000);
  return kg >= 1 && kg <= MAX_CARGO_KG ? kg : null;
}
