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

/** Читает одно поле точки. Для доп.точек — по позиции в массиве. */
export type FieldReader = (field: string) => string;

/**
 * Город точки.
 *
 * Отдельного поля в форме нет: заказчик пишет адрес целиком — улица,
 * дом, индекс, город, — а название города приходит из ответа геокодера
 * вместе с координатами. Так город всегда совпадает с точкой на карте, а
 * не с тем, что человек выбрал в списке из шести штук.
 *
 * Запасной разбор нужен, когда адрес набран руками и подсказка не
 * выбрана: город в базе NOT NULL, по нему работает фильтр стола, и
 * ронять из-за этого публикацию нельзя. Финский формат предсказуем —
 * «Satamakatu 1, 10900 Hanko», — поэтому берётся то, что стоит после
 * почтового индекса.
 */
export function cityOf(read: FieldReader): string {
  const fromSuggestion = read('address_city');
  if (fromSuggestion) return fromSuggestion;

  const address = read('address');
  const afterPostcode = /\d{5}\s+([^,]+)$/.exec(address);
  if (afterPostcode) return afterPostcode[1].trim();

  /* Ни индекса, ни подсказки — берём последнюю часть после запятой. */
  const parts = address.split(',').map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

/**
 * Все поля точки по роли, одним ответом.
 *
 * Форме публикации это не нужно: там три секции с известными ролями, и
 * флаги стоят прямо в разметке, где их видно рядом с полями. А правка
 * маршрута (ТЗ §8) открывается для любой точки идущего рейса, и роль
 * становится известна только в момент нажатия — вычислять по ней набор
 * полей приходится и разметке, и сборке патча на сервере.
 *
 * Отдельные предикаты выше остаются: их вызывает сам StopFields.
 */
export type StopFieldFlags = {
  placeName: boolean;
  company: boolean;
  contact: boolean;
  cargo: boolean;
  consignee: boolean;
  externalRef: boolean;
  trailerState: boolean;
};

export function stopFieldFlags(role: StopRole): StopFieldFlags {
  /* Название площадки спрашивается там же, где состояние прицепа: на
   * концах рейса. «Hanko Port, Terminal 2» — это про ворота, в которые
   * заезжают за железом, а не про склад получателя. */
  const ends = hasTrailerState(role);

  return {
    placeName: ends,
    company: !ends,
    contact: !ends,
    cargo: hasCargo(role),
    consignee: hasConsignee(role),
    externalRef: hasExternalRef(role),
    trailerState: ends,
  };
}
