import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { chooseOffer } from '@/lib/api/lifecycle';

/** POST /api/v1/orders/{ref}/offers/{id}/choose — выбрать отклик перевозчика. */
export const dynamic = 'force-dynamic';

export const POST = withApi<{ ref: string; id: string }>('WRITE', async (ctx, request, p) => {
  const raw = await request.text();
  parseJson(raw, false);
  const ref = decodeURIComponent(p.ref).toUpperCase();
  return idempotent(ctx, request, raw, async () => ({ status: 200, body: await chooseOffer(ctx, ref, decodeURIComponent(p.id)) }));
});
