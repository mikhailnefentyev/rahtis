import { withApi } from '@/lib/api/handler';
import { listOrders } from '@/lib/api/orders';

/**
 * GET /api/v1/orders — заказы компании ключа.
 *
 * Для синхронизации: сортировка по updated_at, фильтр updated_since и
 * курсор next_cursor. Программа заказчика хранит время последней выгрузки
 * и забирает только изменившееся.
 */
export const dynamic = 'force-dynamic';

export const GET = withApi('READ', async (ctx, request) => Response.json(await listOrders(ctx, new URL(request.url))));
