import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { dealHasContract } from '@/lib/installments/access';
import { loadDeal } from '@/lib/installments/contract';
import { contractTemplate } from '@/lib/installments/contractTemplates';

/**
 * Договор рассрочки в PDF (22.11.2026) — только сторонам сделки (RLS) и
 * только после согласия. Собирается при каждом скачивании из
 * согласованных условий: условия после согласия не меняются.
 * Доступен весь срок рассрочки и после выплаты: страница сделки даёт
 * ссылку и тогда, а раньше после передачи здесь было 404 (22.11.2026).
 * После прекращения сделки (TERMINATED) договор тоже остаётся доступен.
 * Шаблон договора — по стране продавца из реестра стран раздела
 * (23.11.2026); сейчас он один — финский.
 */

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return new NextResponse('Unauthorized', { status: 401 });

  const loaded = await loadDeal(id);
  if (!loaded || !dealHasContract(loaded.deal.status)) return new NextResponse('Not found', { status: 404 });
  const contract = contractTemplate(loaded.seller.country)?.render(loaded);
  if (!contract) return new NextResponse('Not found', { status: 404 });

  const buffer = await renderToBuffer(contract.document);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${contract.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
