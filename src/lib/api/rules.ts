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
];

export function translateRule(message: string): { field: string; message: string } | null {
  const text = message.trim();
  const rule = RULES.find((r) => text.startsWith(r.prefix));
  return rule ? { field: rule.field, message: rule.message } : null;
}
