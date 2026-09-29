import { getClaim } from '@/lib/api/claims';
import { withApi } from '@/lib/api/handler';

/** GET /api/v1/claims/{ref} — претензия с перепиской и вложениями. */
export const dynamic = 'force-dynamic';

export const GET = withApi<{ ref: string }>('READ', async (ctx, _request, { ref }) =>
  Response.json(await getClaim(ctx, decodeURIComponent(ref).toUpperCase())),
);
