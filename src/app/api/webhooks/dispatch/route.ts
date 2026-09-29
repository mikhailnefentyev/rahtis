import { dispatchWebhooks } from '@/lib/api/webhooks';
import { recordIncident } from '@/lib/incidents/record';

/**
 * Отправка очереди вебхуков заказчикам.
 *
 * Зовёт база раз в минуту (app.run_webhook_dispatch через pg_net), и
 * только когда в очереди что-то есть. Защита — общий секрет планировщика
 * REPORTS_CRON_SECRET, как у отчётов и напоминаний.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) {
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  try {
    return Response.json(await dispatchWebhooks());
  } catch (error) {
    await recordIncident({ source: 'cron', error, path: '/api/webhooks/dispatch' });
    return Response.json({ error: 'dispatch failed' }, { status: 500 });
  }
}
