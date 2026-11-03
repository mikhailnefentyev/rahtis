/** Радиусы «рядом» для обратного груза и Kuormavahti, км. 75 — по умолчанию. */
export const RADII = [25, 50, 75, 150] as const;

export type Radius = (typeof RADII)[number];

export const DEFAULT_RADIUS: Radius = 75;

export function isRadius(value: unknown): value is Radius {
  return RADII.includes(value as Radius);
}
