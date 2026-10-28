import { createClient } from '@/lib/supabase/server';

/**
 * Фото чека заправки для кабинета перевозчика.
 *
 * Строка читается под сессией (RLS: только своя компания), ссылка на файл
 * подписывается той же сессией (политика fuel_docs_read_own) на пять
 * минут. Чужой чек не найдётся ни на одном из двух шагов.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('not found', { status: 404 });

  const supabase = await createClient();
  const { data: entry } = await supabase.from('fuel_entries').select('receipt_path').eq('id', id).maybeSingle();
  if (!entry?.receipt_path) return new Response('not found', { status: 404 });

  const { data } = await supabase.storage.from('fuel-docs').createSignedUrl(entry.receipt_path, 300);
  if (!data?.signedUrl) return new Response('not found', { status: 404 });

  return Response.redirect(data.signedUrl, 302);
}
