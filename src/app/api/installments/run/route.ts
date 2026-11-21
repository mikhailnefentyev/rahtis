import { bearerMatches } from '@/lib/auth/bearer';
import { runInstallments } from '@/lib/installments/payments';

/**
 * Рассрочка техники — каждое утро (app.run_installments через pg_net,
 * 23.11.2026): график, счета взносов за 14 дней до срока, напоминания о
 * просрочке и сигнал продавцу о пороге OskL 2 §. Защита — общий секрет
 * планировщика REPORTS_CRON_SECRET.
 */
export const maxDuration = 120;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }
  const result = await runInstallments();
  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
