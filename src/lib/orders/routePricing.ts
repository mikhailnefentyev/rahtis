/**
 * Цена за км после правки маршрута — то же правило, что
 * public.apply_route_distance (20261106170000_trust_quick_wins). Без
 * импортов из приложения: читают сервер, клиент и тесты.
 *
 *   · FIXED — цена не меняется (стороны договариваются предложением);
 *   · пробег неправдоподобен (> 3× прежнего или > +1500 км) — не
 *     применяется, только оператор вручную;
 *   · правка заказчика (он платит) или оператора — применяется сразу;
 *   · правка перевозчика — предложение цены, заказчик принимает или нет.
 */

export type PricingMode = 'FIXED' | 'PER_KM';
export type OrderSide = 'SHIPPER' | 'CARRIER' | 'OPERATOR';
export type RouteRepriceDecision = 'NONE' | 'APPLY' | 'PROPOSE' | 'OUT_OF_BOUNDS';

export const MAX_DISTANCE_FACTOR = 3;
export const MAX_DISTANCE_ADD_KM = 1500;

/** Новый пробег правдоподобен рядом с прежним. Прежнего нет — любой положительный. */
export function distancePlausible(prevKm: number | null, nextKm: number | null): boolean {
  if (nextKm === null || !(nextKm > 0)) return false;
  if (prevKm === null || prevKm <= 0) return true;
  return nextKm <= prevKm * MAX_DISTANCE_FACTOR && nextKm <= prevKm + MAX_DISTANCE_ADD_KM;
}

/** Цена за км × пробег, в центах, не меньше 1. */
export function perKmTotal(perKmCents: number, km: number): number {
  return Math.max(1, Math.round(perKmCents * km));
}

export function routeRepriceDecision(input: {
  mode: PricingMode;
  side: OrderSide;
  prevKm: number | null;
  nextKm: number | null;
  /** Уже висит предложение цены — второе не подаётся. */
  pendingProposal?: boolean;
}): RouteRepriceDecision {
  const { mode, side, prevKm, nextKm } = input;
  if (mode !== 'PER_KM' || nextKm === null || nextKm === prevKm) return 'NONE';
  if (side !== 'OPERATOR' && !distancePlausible(prevKm, nextKm)) return 'OUT_OF_BOUNDS';
  if (side === 'CARRIER') return input.pendingProposal ? 'NONE' : 'PROPOSE';
  return 'APPLY';
}
