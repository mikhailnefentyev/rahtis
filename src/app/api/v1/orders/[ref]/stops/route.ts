import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { addStop } from '@/lib/api/lifecycle';

/** POST /api/v1/orders/{ref}/stops — добавить загрузку или выгрузку в идущий рейс. */
export const dynamic = 'force-dynamic';

export const POST = withApi<{ ref: string }>('WRITE', async (ctx, request, p) => {
  const raw = await request.text();
  const body = parseJson(raw, false);
  const ref = decodeURIComponent(p.ref).toUpperCase();
  return idempotent(ctx, request, raw, async () => ({ status: 200, body: await addStop(ctx, ref, body) }));
});
