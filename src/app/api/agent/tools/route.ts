import { createAdminClient } from '@/lib/supabase/admin';
import { verifyIncoming } from '@/lib/agent/signature';

/**
 * Инструменты для внешнего воркфлоу.
 *
 * Ни один инструмент не принимает компанию: каждый выводит её из треда
 * внутри базы. У воркфлоу нет поля, в которое можно вписать чужую
 * компанию — не потому что мы это проверяем, а потому что такого поля не
 * существует.
 *
 * Список закрыт намеренно. Открывать сюда произвольный запрос значит
 * отдать наружу то, ради чего и заводился отдельный набор функций.
 */
const TOOLS = {
  order_by_ref: { fn: 'agent_order_by_ref', args: ['ref'] },
  trip_status: { fn: 'agent_trip_status', args: ['ref'] },
  trip_documents: { fn: 'agent_trip_documents', args: ['ref'] },
  company_money: { fn: 'agent_company_money', args: ['weeks'] },
  legal_clause: { fn: 'agent_legal_clause', args: ['number', 'kind', 'locale'] },
  place_guide: { fn: 'agent_place_guide', args: ['query'] },
} as const;

type ToolName = keyof typeof TOOLS;

export async function POST(request: Request) {
  const body = await request.text();

  const check = verifyIncoming(request, body);
  if (!check.ok) {
    return Response.json({ error: check.reason }, { status: 401 });
  }

  let payload: {
    conversation_id?: string;
    dispatch_token?: string;
    tool?: string;
    args?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: 'malformed json' }, { status: 400 });
  }

  const { conversation_id: conversationId, dispatch_token: token, tool, args = {} } = payload;

  if (!conversationId || !token || !tool) {
    return Response.json(
      { error: 'conversation_id, dispatch_token and tool are required' },
      { status: 400 },
    );
  }

  if (!(tool in TOOLS)) {
    return Response.json({ error: `unknown tool: ${tool}`, tools: Object.keys(TOOLS) }, { status: 400 });
  }

  const spec = TOOLS[tool as ToolName];

  /* Только объявленные аргументы: лишнее в базу не уходит. */
  const params: Record<string, unknown> = {
    p_conversation_id: conversationId,
    p_token: token,
  };
  for (const name of spec.args) {
    const value = (args as Record<string, unknown>)[name];
    if (value !== undefined && value !== null) params[`p_${name}`] = value;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(spec.fn, params);

  if (error) {
    /* 42501 — пропуск недействителен: воркфлоу не должен видеть подробностей. */
    const status = error.code === '42501' ? 403 : 400;
    return Response.json({ error: error.message }, { status });
  }

  return Response.json({ tool, rows: data ?? [] });
}
