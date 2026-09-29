import { createOrder } from '@/lib/api/create';
import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { listOrders } from '@/lib/api/orders';

/**
 * GET /api/v1/orders — заказы компании ключа.
 *
 * Для синхронизации: сортировка по updated_at, фильтр updated_since и
 * курсор next_cursor. Программа заказчика хранит время последней выгрузки
 * и забирает только изменившееся.
 *
 * POST /api/v1/orders — новый заказ на стол. Ключ с правом записи;
 * Idempotency-Key защищает от второго заказа при повторе запроса.
 */
export const dynamic = 'force-dynamic';

export const GET = withApi('READ', async (ctx, request) => Response.json(await listOrders(ctx, new URL(request.url))));

export const POST = withApi('WRITE', async (ctx, request) => {
  const raw = await request.text();
  const body = parseJson(raw, true);
  return idempotent(ctx, request, raw, async () => ({ status: 201, body: await createOrder(ctx, body) }));
});
