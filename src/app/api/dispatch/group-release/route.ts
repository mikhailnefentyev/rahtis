import { bearerMatches } from '@/lib/auth/bearer';
import { dispatchPublishedOrder } from '@/lib/orders/dispatch';

/**
 * Письма о заказах, которые группа машин заказчика не взяла.
 *
 * Зовёт база раз в минуту (app.run_group_release через pg_net), когда
 * окно группы закрылось: уведомления в кабинеты уже написаны, здесь —
 * почтовый дубль остальным перевозчикам (dispatch_audience без группы).
 */
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const expected = process.env.REPORTS_CRON_SECRET?.trim();
  if (!expected) {
    return Response.json({ error: 'REPORTS_CRON_SECRET is not set' }, { status: 503 });
  }
  if (!bearerMatches(request.headers.get('authorization'), expected)) {
    return Response.json({ error: 'forbidden' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { order_ids?: unknown } | null;
  const ids = Array.isArray(body?.order_ids)
    ? body.order_ids.filter((id): id is string => typeof id === 'string' && UUID.test(id)).slice(0, 50)
    : [];

  /* Последовательно: рассылка сама бережёт лимит почтового провайдера. */
  for (const id of ids) await dispatchPublishedOrder(id);

  return Response.json({ dispatched: ids.length });
}
