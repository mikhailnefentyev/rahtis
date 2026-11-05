import 'server-only';

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { fxHistory, latestRates, type FxHistory, type FxRates, type FxRow } from './currency';

/**
 * Курсы ЕЦБ из fx_rates.
 *
 * latest — для справки «≈ 2 107 zł» и форм; history — для пересчёта
 * прошлых сумм по курсу их дня (доходность, зарплата, отчёты).
 */

/** Последние курсы: две недели истории с запасом на праздники ЕЦБ. */
export const latestFxRates = cache(async (): Promise<FxRates | null> => {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('fx_rates')
      .select('day, currency, per_eur')
      .gte('day', since)
      .order('day', { ascending: false })
      .limit(200);
    if (error || !data || data.length === 0) return null;
    return latestRates(data as FxRow[]);
  } catch {
    return null;
  }
});

/**
 * История курсов за период (с недельным запасом назад — для выходных).
 * Клиент — любой, у кого есть чтение fx_rates (сессия или служебный).
 */
export async function loadFxHistory(supabase: SupabaseClient, from: string, to: string): Promise<FxHistory> {
  const start = new Date(new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime() - 10 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data } = await supabase
    .from('fx_rates')
    .select('day, currency, per_eur')
    .gte('day', start)
    .lte('day', to.slice(0, 10))
    .order('day', { ascending: true })
    .limit(5000);
  let rows = (data ?? []) as FxRow[];
  if (rows.length === 0) {
    /* Период раньше всей истории — ближайшие известные курсы, как app.fx_per_eur. */
    const { data: first } = await supabase
      .from('fx_rates')
      .select('day, currency, per_eur')
      .order('day', { ascending: true })
      .limit(20);
    rows = (first ?? []) as FxRow[];
  }
  return fxHistory(rows);
}
