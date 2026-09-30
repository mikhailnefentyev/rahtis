'use server';

import { createClient } from '@/lib/supabase/server';
import { HAUL_KINDS, type HaulKind } from '@/lib/orders/haul';

export type PriceGuide = { samples: number; median: number; low: number; high: number };

/**
 * Сколько стоили похожие выполненные рейсы — подсказка в форме заказа.
 *
 * Считает база (price_guide): та же единица, расстояние ±30 %, 12 месяцев,
 * пересчёт на это расстояние, от пяти рейсов. Нет данных — null, и форма
 * просто молчит.
 */
export async function priceGuideAction(haulKind: HaulKind, km: number): Promise<PriceGuide | null> {
  if (!HAUL_KINDS.includes(haulKind) || !Number.isInteger(km) || km < 1 || km > 5000) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc('price_guide', { p_haul_kind: haulKind, p_distance_km: km });
  const row = data?.[0];
  if (!row) return null;
  return { samples: row.samples, median: row.median_cents, low: row.low_cents, high: row.high_cents };
}
