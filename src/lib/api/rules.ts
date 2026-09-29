/**
 * Отказы create_order словами для программы заказчика.
 *
 * База объясняет отказ по-русски — это текст для формы в кабинете. Через
 * API его читает чужая программа и её программист, поэтому каждому отказу
 * сопоставлены английский текст и поле, к которому он относится. Сверка —
 * по началу сообщения: хвост у некоторых фраз длинный и может меняться.
 *
 * Текст без перевода не показывается как есть: вызывающий отдаёт общий
 * ответ и записывает инцидент, чтобы перевод добавили.
 */

type Rule = { prefix: string; field: string; message: string };

const RULES: Rule[] = [
  { prefix: 'Укажите длину контейнера', field: 'container_feet', message: 'container_feet is required for a container haul.' },
  { prefix: 'Укажите погрузочные метры', field: 'ldm', message: 'ldm (loading metres) is required for VAN and TRUCK hauls.' },
  { prefix: 'Маршрут неполон: нужна точка забора прицепа', field: 'stops', message: 'The route needs a PICKUP stop where the trailer or container is collected.' },
  { prefix: 'Укажите адрес, где забрать груз', field: 'stops', message: 'The route needs a PICKUP stop.' },
  { prefix: 'Добавьте хотя бы одно действие', field: 'stops', message: 'The route needs at least one DELIVERY, EXTRA_UNLOAD or EXTRA_LOAD stop.' },
  {
    prefix: 'Перецеп заканчивается отцепкой',
    field: 'stops',
    message: 'A TRAILER_SWAP order must end with a TRAILER_RETURN stop where the trailer is left.',
  },
  { prefix: 'Укажите номер контейнера', field: 'trailer_plate', message: 'trailer_plate must carry the container number.' },
  { prefix: 'Укажите регистрационный номер прицепа', field: 'trailer_plate', message: 'trailer_plate (the trailer registration number) is required.' },
  { prefix: 'Укажите адрес доставки', field: 'stops', message: 'The route needs a DELIVERY stop.' },
  { prefix: 'Укажите вес груза', field: 'stops', message: 'cargo_weight_kg must be given on at least one stop; it is used to match the vehicle.' },
  { prefix: 'Укажите пробег и ставку', field: 'rate.amount', message: 'Distance and rate must both be positive.' },

  /* Действия с заказом в пути и после (этап 2 полного цикла). */
  { prefix: 'Выбор больше недоступен', field: 'status', message: 'Offers can no longer be chosen in the order\'s current status.' },
  { prefix: 'Откат возможен только до начала рейса', field: 'status', message: 'The assignment can only be cancelled before the trip starts.' },
  { prefix: 'Сначала опубликуйте заказ', field: 'status', message: 'The order must be on the desk before it can be assigned.' },
  { prefix: 'Живая корректировка возможна только в идущем рейсе', field: 'status', message: 'The route can only be amended while the trip is in progress.' },
  { prefix: 'Точка уже пройдена', field: 'stop', message: 'This stop is already completed and cannot be changed.' },
  { prefix: 'В идущий рейс добавляется только загрузка или выгрузка', field: 'role', message: 'Only EXTRA_LOAD or EXTRA_UNLOAD stops can be added to a trip in progress.' },
  { prefix: 'Перед забором точку не добавить', field: 'before_sequence', message: 'A stop cannot be added before the pickup; insert it after the pickup.' },
  { prefix: 'Забор и отцепку прицепа из маршрута не убирают', field: 'stop', message: 'PICKUP and TRAILER_RETURN stops cannot be removed.' },
  { prefix: 'Пересчёт недоступен', field: 'status', message: 'Distance and rate cannot be changed in the order\'s current status.' },
  { prefix: 'Нужны и пробег, и ставка', field: 'rate.amount', message: 'Both distance and rate are required.' },
  { prefix: 'Оценка ставится по шкале от 1 до 5', field: 'score', message: 'score must be an integer from 1 to 5.' },
  { prefix: 'Оценка ставится после закрытия рейса', field: 'status', message: 'An order can be rated only after the trip is closed.' },
  { prefix: 'У рейса нет перевозчика', field: 'status', message: 'The order has no carrier to rate.' },
  { prefix: 'Опишите, что произошло', field: 'description', message: 'description is required.' },
  { prefix: 'Пустой комментарий', field: 'body', message: 'body must not be empty.' },
  { prefix: 'Точка не из этого рейса', field: 'stop_sequence', message: 'The stop does not belong to this order.' },
  { prefix: 'Claim подаётся по идущему или выполненному рейсу', field: 'order_ref', message: 'A claim can be filed only for a trip in progress or completed.' },
  { prefix: 'Claim закрыт', field: 'status', message: 'The claim is closed.' },
  { prefix: 'Вторая сторона ведёт claim с оператором по почте', field: 'claim', message: 'This claim is handled by the operator by email; reply to the operator\'s message.' },
];

export function translateRule(message: string): { field: string; message: string } | null {
  const text = message.trim();
  const rule = RULES.find((r) => text.startsWith(r.prefix));
  return rule ? { field: rule.field, message: rule.message } : null;
}
