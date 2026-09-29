import { listClaims } from '@/lib/api/claims';
import { withApi } from '@/lib/api/handler';

/** GET /api/v1/claims — претензии, поданные компанией и против неё. */
export const dynamic = 'force-dynamic';

export const GET = withApi('READ', async (ctx, request) => Response.json(await listClaims(ctx, new URL(request.url))));
