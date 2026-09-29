import { withApi } from '@/lib/api/handler';
import { orderEvents } from '@/lib/api/orders';

/** GET /api/v1/orders/{ref}/events — хронология: статусы, прибытия и отметки точек. */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ ref: string }>('READ', async (ctx, _request, { ref }) =>
  Response.json(await orderEvents(ctx, decodeURIComponent(ref).toUpperCase())),
);
