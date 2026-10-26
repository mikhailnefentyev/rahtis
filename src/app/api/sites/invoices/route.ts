import { bearerMatches } from '@/lib/auth/bearer';
import { runScheduledSiteInvoices } from '@/lib/sites/invoicing';

/**
 * Счета по объектам по расписанию: понедельник утром (app.run_site_invoices
 * через pg_net). Защита — общий секрет планировщика REPORTS_CRON_SECRET.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }
  const result = await runScheduledSiteInvoices();
  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
