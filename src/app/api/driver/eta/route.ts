import { readPhone, readText } from '@/lib/driver/calls';
import { estimateArrival } from '@/lib/driver/eta';
import { gateResponse, openGate } from '@/lib/driver/gate';

/**
 * Когда водитель будет на следующей точке.
 *
 * Номера рейса не принимает, как и остальные эндпоинты водителя: рейс
 * выводится из телефона внутри базы, и подставить чужой некуда.
 *
 * Точка отправления обязательна и приходит словами: «Salo», «Vuosaari»,
 * «заправка на семёрке». Положения водителя платформа не знает, и
 * молчаливая догадка здесь была бы хуже отказа — число выглядело бы
 * настоящим.
 */
export const dynamic = 'force-dynamic';

const PATH = '/api/driver/eta';

export async function POST(request: Request) {
  const gate = await openGate(request, PATH);
  if (!gate.ok) return gateResponse(gate);

  const phone = readPhone(gate.body);
  if (!phone) return Response.json({ error: 'phone is required' }, { status: 400 });

  const origin = readText(gate.body, 'origin', 120);
  if (!origin) return Response.json({ error: 'origin is required' }, { status: 400 });

  const { data, failure } = await estimateArrival(phone, origin);
  if (failure) {
    return Response.json({ error: failure.code, detail: failure.message }, { status: failure.status });
  }

  return Response.json({ ok: true, ...data });
}
