import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { parseEcbXml } from './currency';

/** 90 дней истории ЕЦБ: пропуски догоняются, повтор безвреден (upsert). */
const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';

export async function refreshFxRates(): Promise<{ rows: number; latest: string | null }> {
  const response = await fetch(ECB_URL, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`ECB answered ${response.status}`);
  const rows = parseEcbXml(await response.text());
  if (rows.length === 0) throw new Error('ECB file had no rates');

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('fx_rates')
    .upsert(
      rows.map((r) => ({ ...r, fetched_at: new Date().toISOString() })),
      { onConflict: 'day,currency' },
    );
  if (error) throw new Error(error.message);

  const latest = rows.reduce<string | null>((max, r) => (max === null || r.day > max ? r.day : max), null);
  return { rows: rows.length, latest };
}
