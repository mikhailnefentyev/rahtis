import { withApi } from '@/lib/api/handler';
import { attachToClaim } from '@/lib/api/lifecycle';

/**
 * POST /api/v1/claims/{ref}/attachments — файл к претензии,
 * multipart/form-data: file (PDF, JPEG, PNG, WebP до 10 МБ) и note.
 */
export const dynamic = 'force-dynamic';

export const POST = withApi<{ ref: string }>('WRITE', async (ctx, request, p) =>
  Response.json(await attachToClaim(ctx, decodeURIComponent(p.ref).toUpperCase(), request), { status: 201 }),
);
