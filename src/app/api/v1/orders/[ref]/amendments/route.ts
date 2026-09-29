import { withApi } from '@/lib/api/handler';
import { orderAmendments } from '@/lib/api/orders';

/** GET /api/v1/orders/{ref}/amendments — корректировки маршрута в пути. */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ ref: string }>('READ', async (ctx, _request, { ref }) =>
  Response.json(await orderAmendments(ctx, decodeURIComponent(ref).toUpperCase())),
);
