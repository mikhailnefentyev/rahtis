import { withApi } from '@/lib/api/handler';
import { orderOffers } from '@/lib/api/orders';

/** GET /api/v1/orders/{ref}/offers — отклики перевозчиков на заказ. */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ ref: string }>('READ', async (ctx, _request, { ref }) =>
  Response.json(await orderOffers(ctx, decodeURIComponent(ref).toUpperCase())),
);
