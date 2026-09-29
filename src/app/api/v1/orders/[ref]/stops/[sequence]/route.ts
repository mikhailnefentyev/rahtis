import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { amendStop, removeStop } from '@/lib/api/lifecycle';

/**
 * PATCH  /api/v1/orders/{ref}/stops/{sequence} — поправить точку в пути.
 * DELETE /api/v1/orders/{ref}/stops/{sequence} — убрать непройденную точку.
 */
export const dynamic = 'force-dynamic';

type Params = { ref: string; sequence: string };

export const PATCH = withApi<Params>('WRITE', async (ctx, request, p) => {
  const raw = await request.text();
  const body = parseJson(raw, true);
  const ref = decodeURIComponent(p.ref).toUpperCase();
  return idempotent(ctx, request, raw, async () => ({ status: 200, body: await amendStop(ctx, ref, p.sequence, body) }));
});

export const DELETE = withApi<Params>('WRITE', async (ctx, _request, p) =>
  Response.json(await removeStop(ctx, decodeURIComponent(p.ref).toUpperCase(), p.sequence)),
);
