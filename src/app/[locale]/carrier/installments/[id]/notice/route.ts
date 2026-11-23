import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { dealHasContract } from '@/lib/installments/access';
import { loadDeal } from '@/lib/installments/contract';
import { dealDefaultSteps, dealNoticeLetter } from '@/lib/installments/defaultStepsServer';

/**
 * Письмо покупателю о шаге после порога просрочки (24.11.2026): о
 * дополнительном сроке или об отказе от договора — PDF на языке договора.
 * ?step= — id записанного шага. Видят обе стороны сделки (RLS сделки и
 * шагов); подписывает и отправляет письмо продавец.
 */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return new NextResponse('Unauthorized', { status: 401 });

  const loaded = await loadDeal(id);
  if (!loaded || !dealHasContract(loaded.deal.status)) return new NextResponse('Not found', { status: 404 });
  const stepId = new URL(request.url).searchParams.get('step') ?? '';
  const steps = await dealDefaultSteps(id);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return new NextResponse('Not found', { status: 404 });
  /* Отказ ссылается на последнее письмо о сроке, отправленное до него. */
  const grace =
    step.step === 'WITHDRAWAL' ? (steps.filter((s) => s.step === 'GRACE' && s.given_on <= step.given_on).pop() ?? null) : null;
  const letter = dealNoticeLetter(loaded, step, grace);
  if (!letter) return new NextResponse('Not found', { status: 404 });

  const buffer = await renderToBuffer(letter.document);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${letter.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
