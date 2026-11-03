import { createAdminClient } from '@/lib/supabase/admin';
import { customerDocuments, isDelivered, TOKEN_PATTERN } from '@/lib/track/documents';

export const dynamic = 'force-dynamic';

/**
 * Документ доставки по ссылке отслеживания.
 *
 * Постоянного адреса у файла нет: бакет trip-docs закрытый. Страница
 * ведёт сюда, а здесь — проверка токена, правила видимости
 * (documents.ts) и подписанная ссылка на минуту. Ссылка на странице
 * поэтому не протухает, сколько бы та ни была открыта, а пересланный
 * адрес файла живёт минуту.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; token: string; id: string }> },
) {
  const { token, id } = await params;
  const missing = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (!TOKEN_PATTERN.test(token) || !/^[0-9a-f-]{36}$/.test(id)) return missing();

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, status').eq('track_token', token).maybeSingle();
  if (!order) return missing();

  const { data: stops } = await admin.from('order_stops').select('completed_at').eq('order_id', order.id);
  if (!isDelivered(order.status, stops ?? [])) return missing();

  const doc = (await customerDocuments(order.id)).find((d) => d.id === id);
  if (!doc) return missing();

  const { data } = await admin.storage.from('trip-docs').createSignedUrl(doc.storage_path, 60);
  if (!data?.signedUrl) return missing();

  return new Response(null, {
    status: 302,
    headers: { Location: data.signedUrl, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
