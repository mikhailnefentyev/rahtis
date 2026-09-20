import type { MessageFn } from '@/lib/i18n';

/**
 * Что стоит в городе — словами.
 *
 * Раньше список писал «3 vetoa · 1 pika»: первое обрубок слова
 * vetoauto, второе название ветки витрины, а не машины, и в нём фургон
 * и грузовик были одним. Заказчик по такой строке не мог понять, приедет
 * ли пакетти или кузов на четыре тонны.
 *
 * Классы называются целиком и по отдельности. Ноль не печатается: город
 * без фургонов пишет только то, что в нём есть.
 */

export type PresenceCounts = { tractors: number; trucks: number; vans: number };

export function presenceParts(counts: PresenceCounts, m: MessageFn): string[] {
  return [
    counts.tractors > 0 ? m('presence.tractorCount', { count: counts.tractors }) : null,
    counts.trucks > 0 ? m('presence.truckCount', { count: counts.trucks }) : null,
    counts.vans > 0 ? m('presence.vanCount', { count: counts.vans }) : null,
  ].filter((part): part is string => Boolean(part));
}

/** Всего машин в точке — для размера кружка на карте. */
export function presenceTotal(counts: PresenceCounts): number {
  return counts.tractors + counts.trucks + counts.vans;
}
