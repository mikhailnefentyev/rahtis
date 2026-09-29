import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { reprice } from '@/lib/api/lifecycle';

/** POST /api/v1/orders/{ref}/reprice — новая ставка и пробег. */
export const dynamic = 'force-dynamic';

export const POST = withApi<{ ref: string }>('WRITE', async (ctx, request, p) => {
  const raw = await request.text();
  const body = parseJson(raw, false);
  const ref = decodeURIComponent(p.ref).toUpperCase();
  return idempotent(ctx, request, raw, async () => ({ status: 200, body: await reprice(ctx, ref, body) }));
});
