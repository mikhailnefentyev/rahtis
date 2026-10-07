import { bearerMatches } from '@/lib/auth/bearer';
import { sendDailyOutreach } from '@/lib/outreach/daily';

/**
 * Ежедневные приглашения от платформы: 5 заказчикам и 5 перевозчикам.
 *
 * Зовёт база по будним дням (app.run_outreach через pg_net). Защита —
 * общий секрет планировщика REPORTS_CRON_SECRET, как у остальных.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) {
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  const result = await sendDailyOutreach();
  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
