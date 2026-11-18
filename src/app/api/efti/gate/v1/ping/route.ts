import { createAdminClient } from '@/lib/supabase/admin';
import { problem, proxyAuthorized } from '@/lib/efti/gateAuth';

/** Шлюз проверяет, что платформа доступна и его сертификат принят (v1GetPing). */
export async function GET(request: Request) {
  if (!proxyAuthorized(request)) return problem(401, 'Unauthorized');
  await createAdminClient()
    .from('efti_requests')
    .insert({ kind: 'PING', request_id: request.headers.get('x-request-id'), http_status: 200 });
  return new Response(null, { status: 200 });
}
