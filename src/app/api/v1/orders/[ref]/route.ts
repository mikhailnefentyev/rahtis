import { withApi } from '@/lib/api/handler';
import { getOrder } from '@/lib/api/orders';

/** GET /api/v1/orders/{ref} — заказ, точки, прогресс и машина. */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ ref: string }>('READ', async (ctx, _request, { ref }) =>
  Response.json(await getOrder(ctx, decodeURIComponent(ref).toUpperCase())),
);
