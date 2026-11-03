import { createClient } from '@/lib/supabase/server';

/**
 * Фото весового талона для кабинета перевозчика.
 *
 * Строка читается под сессией (RLS: только своя компания), ссылка на файл
 * подписывается той же сессией (политика weigh_tickets_read_own) на пять
 * минут. Чужой талон не найдётся ни на одном из двух шагов.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('not found', { status: 404 });

  const supabase = await createClient();
  const { data: ticket } = await supabase.from('weigh_tickets').select('storage_path').eq('id', id).maybeSingle();
  if (!ticket?.storage_path) return new Response('not found', { status: 404 });

  const { data } = await supabase.storage.from('weigh-tickets').createSignedUrl(ticket.storage_path, 300);
  if (!data?.signedUrl) return new Response('not found', { status: 404 });

  return Response.redirect(data.signedUrl, 302);
}
