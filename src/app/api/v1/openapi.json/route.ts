import { openApi } from '@/lib/api/openapi';
import { siteUrl } from '@/lib/config';

/**
 * GET /api/v1/openapi.json — описание API без ключа: его открывают
 * программисты заказчика до того, как им выдали ключ.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(openApi(siteUrl()), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=3600' },
  });
}
