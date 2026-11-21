import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { contractInput, loadDeal } from '@/lib/installments/contract';
import { ContractPdf } from '@/lib/installments/ContractPdf';

/**
 * Договор рассрочки в PDF (22.11.2026) — только сторонам сделки (RLS) и
 * только после согласия. Собирается при каждом скачивании из
 * согласованных условий: условия после согласия не меняются.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return new NextResponse('Unauthorized', { status: 401 });

  const loaded = await loadDeal(id);
  if (!loaded || loaded.deal.status !== 'AGREED') return new NextResponse('Not found', { status: 404 });
  const input = contractInput(loaded);
  if (!input) return new NextResponse('Not found', { status: 404 });

  const buffer = await renderToBuffer(ContractPdf(input));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Osamaksusopimus-${input.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
