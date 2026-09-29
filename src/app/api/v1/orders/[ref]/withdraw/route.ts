import { withdrawOrder } from '@/lib/api/create';
import { withApi } from '@/lib/api/handler';
import { idempotent, parseJson } from '@/lib/api/idempotency';

/**
 * POST /api/v1/orders/{ref}/withdraw — снять заказ.
 *
 * Тело необязательно: { "reason": "…" }. Снять нельзя выполненный рейс;
 * снятый уже заказ отвечает 409.
 */
export const dynamic = 'force-dynamic';

export const POST = withApi<{ ref: string }>('WRITE', async (ctx, request, { ref }) => {
  const raw = await request.text();
  const body = parseJson(raw, false);
  const orderRef = decodeURIComponent(ref).toUpperCase();
  return idempotent(ctx, request, raw, async () => ({ status: 200, body: await withdrawOrder(ctx, orderRef, body) }));
});
