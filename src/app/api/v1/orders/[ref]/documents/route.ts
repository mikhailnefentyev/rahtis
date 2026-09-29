import { withApi } from '@/lib/api/handler';
import { orderDocuments } from '@/lib/api/orders';

/** GET /api/v1/orders/{ref}/documents — CMR и снимки со ссылками на 5 минут. */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ ref: string }>('READ', async (ctx, _request, { ref }) =>
  Response.json(await orderDocuments(ctx, decodeURIComponent(ref).toUpperCase())),
);
