import { escalate, readPhone, readText } from '@/lib/driver/calls';
import { gateResponse, openGate } from '@/lib/driver/gate';

/**
 * Вопрос, на который агент не берётся отвечать.
 *
 * Уходит в ту же очередь, которую оператор читает в админке. Отдельного
 * канала для водителя нет намеренно: вторая очередь — это вторая
 * очередь, которую однажды перестанут смотреть.
 */
export const dynamic = 'force-dynamic';

const PATH = '/api/driver/escalate';

export async function POST(request: Request) {
  const gate = await openGate(request, PATH);
  if (!gate.ok) return gateResponse(gate);

  const phone = readPhone(gate.body);
  if (!phone) return Response.json({ error: 'phone is required' }, { status: 400 });

  const question = readText(gate.body, 'question', 3000);
  if (!question) return Response.json({ error: 'question is required' }, { status: 400 });

  const { data, failure } = await escalate(phone, question);
  if (failure) {
    return Response.json({ error: failure.code, detail: failure.message }, { status: failure.status });
  }

  return Response.json({ ok: true, ...(data as object) });
}
