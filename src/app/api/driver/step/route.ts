import { completeNextStop, readPhone, readRole, readText } from '@/lib/driver/calls';
import { gateResponse, openGate } from '@/lib/driver/gate';

/**
 * Отметка этапа рейса.
 *
 * Единственная запись во всём наборе агента. Отмечается следующая
 * непройденная точка — выбрать её снаружи нельзя, поэтому движение
 * назад и через одну не запрещены, а невыразимы.
 *
 * expect — роль точки со слов водителя. Не совпала с той, что идёт
 * следующей, — отметки не будет: агент, неверно понявший фразу, не
 * должен продвигать рейс.
 */
export const dynamic = 'force-dynamic';

const PATH = '/api/driver/step';

export async function POST(request: Request) {
  const gate = await openGate(request, PATH);
  if (!gate.ok) return gateResponse(gate);

  const phone = readPhone(gate.body);
  if (!phone) return Response.json({ error: 'phone is required' }, { status: 400 });

  const { data, failure } = await completeNextStop(
    phone,
    readRole(gate.body),
    readText(gate.body, 'damage_note', 500),
  );

  if (failure) {
    return Response.json({ error: failure.code, detail: failure.message }, { status: failure.status });
  }

  return Response.json({ ok: true, ...(data as object) });
}
