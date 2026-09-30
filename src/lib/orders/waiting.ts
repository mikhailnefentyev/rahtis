/**
 * Простой площадки в коротком виде: «25 min», «1 h 40 min», «2 h».
 * Одинаково по-фински и по-английски — единицы в обоих языках те же.
 */
export function formatWaitMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

export type SiteWaiting = { samples: number; medianMinutes: number; overHourPct: number };
