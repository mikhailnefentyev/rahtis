import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { commentClaim } from '@/lib/api/lifecycle';

/** POST /api/v1/claims/{ref}/comments — сообщение в претензию { body }. */
export const dynamic = 'force-dynamic';

export const POST = withApi<{ ref: string }>('WRITE', async (ctx, request, p) => {
  const raw = await request.text();
  const body = parseJson(raw, true);
  const ref = decodeURIComponent(p.ref).toUpperCase();
  return idempotent(ctx, request, raw, async () => ({ status: 201, body: await commentClaim(ctx, ref, body) }));
});
