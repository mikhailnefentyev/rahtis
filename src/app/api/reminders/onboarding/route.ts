import { bearerMatches } from '@/lib/auth/bearer';
import { sendOnboardingReminders } from '@/lib/companies/onboarding';

/**
 * Напоминания застрявшим на пути к первой работе.
 *
 * Зовёт база раз в день (app.run_onboarding_reminders через pg_net).
 * Защита — общий секрет планировщика REPORTS_CRON_SECRET, как у остальных.
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

  const result = await sendOnboardingReminders();
  return Response.json(result, { status: result.errors.length > 0 ? 207 : 200 });
}
