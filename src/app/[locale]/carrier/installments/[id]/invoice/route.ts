import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { loadDeal } from '@/lib/installments/contract';
import { createAdminClient } from '@/lib/supabase/admin';

/** Первый счёт сделки (22.11.2026): сторонам сделки, подписанная ссылка на пять минут. */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return new NextResponse('Unauthorized', { status: 401 });

  const loaded = await loadDeal(id);
  const path = loaded?.invoice?.file_path;
  if (!path) return new NextResponse('Not found', { status: 404 });
  const { data } = await createAdminClient().storage.from('reports').createSignedUrl(path, 300);
  if (!data?.signedUrl) return new NextResponse('Not found', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
