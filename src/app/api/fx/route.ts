import { bearerMatches } from '@/lib/auth/bearer';
import { refreshFxRates } from '@/lib/money/refresh';

/**
 * Загрузка курсов ЕЦБ в fx_rates.
 *
 * Зовёт база (app.run_fx_refresh через pg_net): по будням после
 * публикации курсов и каждое утро повтором. Берётся 90-дневная история —
 * пропущенный день догоняется сам. Защита — общий секрет планировщика
 * REPORTS_CRON_SECRET, как у остальных маршрутов будильника.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) {
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  try {
    const result = await refreshFxRates();
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'fx refresh failed' }, { status: 502 });
  }
}
