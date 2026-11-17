import { bearerMatches } from '@/lib/auth/bearer';
import { runWeeklyFreightInvoices } from '@/lib/invoices/weekly';
import { runScheduledSiteInvoices } from '@/lib/sites/invoicing';

/**
 * Понедельник утром (app.run_site_invoices через pg_net): недельные счета
 * перевозчиков — по объектам и по прямым заказам прошлой недели
 * (17.11.2026). Счёт выставляет перевозчик; Aivomaa в нём не сторона.
 * Защита — общий секрет планировщика REPORTS_CRON_SECRET.
 */
export const maxDuration = 120;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }
  const sites = await runScheduledSiteInvoices();
  const freight = await runWeeklyFreightInvoices();
  const errors = [...sites.errors, ...freight.errors];
  return Response.json({ sites, freight }, { status: errors.length > 0 ? 207 : 200 });
}
