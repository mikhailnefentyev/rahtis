import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { loadDeal } from '@/lib/installments/contract';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Счета сделки (22–23.11.2026): первый счёт, счета взносов, кредит-нота;
 * у Литвы — ещё счёт с НДС, выписанный при передаче (vat_invoice_id).
 * Сделку видят только стороны (RLS в loadDeal); счёт должен принадлежать
 * этой сделке. Подписанная ссылка на пять минут.
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return new NextResponse('Unauthorized', { status: 401 });

  const loaded = await loadDeal(id);
  if (!loaded) return new NextResponse('Not found', { status: 404 });
  const wanted = new URL(request.url).searchParams.get('inv') ?? loaded.deal.first_invoice_id;
  if (!wanted) return new NextResponse('Not found', { status: 404 });

  const admin = createAdminClient();
  const { data: payments } = await admin.from('installment_payments').select('invoice_id').eq('deal_id', id);
  /* Столбец vat_invoice_id (миграция 20261201100000) ещё не в src/types/database.ts. */
  const vatInvoiceId = (loaded.deal as { vat_invoice_id?: string | null }).vat_invoice_id ?? null;
  const own = new Set(
    [loaded.deal.first_invoice_id, loaded.deal.credit_note_id, vatInvoiceId, ...(payments ?? []).map((p) => p.invoice_id)].filter(
      (v): v is string => Boolean(v),
    ),
  );
  if (!own.has(wanted)) return new NextResponse('Not found', { status: 404 });

  const { data: invoice } = await admin.from('carrier_invoices').select('file_path').eq('id', wanted).maybeSingle();
  if (!invoice?.file_path) return new NextResponse('Not found', { status: 404 });
  const { data } = await admin.storage.from('reports').createSignedUrl(invoice.file_path, 300);
  if (!data?.signedUrl) return new NextResponse('Not found', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
