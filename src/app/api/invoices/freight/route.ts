import { bearerMatches } from '@/lib/auth/bearer';
import { runFreightInvoices } from '@/lib/invoices/freight';

/**
 * Счета перевозчиков за прямые перевозки — каждое утро
 * (app.run_freight_invoices через pg_net, 17.11.2026). Пора ли выставлять
 * по каждой паре, решает согласованная сторонами периодичность.
 * Защита — общий секрет планировщика REPORTS_CRON_SECRET.
 */
export const maxDuration = 120;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }
  const result = await runFreightInvoices();
  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
