import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * PDF счёта, выставленного заказчику (17.11.2026). Счёт читается под
 * сессией: RLS отдаёт только счета, где получатель — своя компания (или
 * выставитель). Ссылка на файл — подписанная, на пять минут; сам файл в
 * закрытом хранилище, прямой адрес не выдаётся.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return new NextResponse('Unauthorized', { status: 401 });

  const supabase = await createClient();
  const { data: invoice } = await supabase.from('carrier_invoices').select('file_path').eq('id', id).maybeSingle();
  if (!invoice?.file_path) return new NextResponse('Not found', { status: 404 });

  const { data } = await createAdminClient().storage.from('reports').createSignedUrl(invoice.file_path, 300);
  if (!data?.signedUrl) return new NextResponse('Not found', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
