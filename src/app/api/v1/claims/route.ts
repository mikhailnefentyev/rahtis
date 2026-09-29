import { listClaims } from '@/lib/api/claims';
import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';
import { fileClaim } from '@/lib/api/lifecycle';

/**
 * GET  /api/v1/claims — претензии, поданные компанией и против неё.
 * POST /api/v1/claims — подать претензию по рейсу.
 */
export const dynamic = 'force-dynamic';

export const GET = withApi('READ', async (ctx, request) => Response.json(await listClaims(ctx, new URL(request.url))));

export const POST = withApi('WRITE', async (ctx, request) => {
  const raw = await request.text();
  const body = parseJson(raw, true);
  return idempotent(ctx, request, raw, async () => ({ status: 201, body: await fileClaim(ctx, body) }));
});
