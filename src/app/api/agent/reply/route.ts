import { createAdminClient } from '@/lib/supabase/admin';
import { verifyIncoming } from '@/lib/agent/signature';

/**
 * Ответ внешнего воркфлоу в чат пользователя.
 *
 * Пропуск обязателен и сверяется с тредом. Знания идентификатора треда
 * недостаточно: без действующего пропуска скомпрометированный воркфлоу
 * не сможет написать в чужой чат от имени агента — а это ровно тот
 * ущерб, который стоило бы дороже всего.
 *
 * Пропуск гасится вместе с записью ответа: он одноразовый.
 */
export async function POST(request: Request) {
  const body = await request.text();

  const check = verifyIncoming(request, body);
  if (!check.ok) {
    return Response.json({ error: check.reason }, { status: 401 });
  }

  let payload: { conversation_id?: string; dispatch_token?: string; text?: string };
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: 'malformed json' }, { status: 400 });
  }

  const { conversation_id: conversationId, dispatch_token: token, text } = payload;

  if (!conversationId || !token || !text?.trim()) {
    return Response.json({ error: 'conversation_id, dispatch_token and text are required' }, { status: 400 });
  }

  const admin = createAdminClient();

  /*
   * Пропуск проверяется тем же обновлением, которое его гасит: между
   * проверкой и записью не остаётся промежутка, в который поместился бы
   * второй ответ с тем же пропуском.
   */
  const { data: conversation, error } = await admin
    .from('conversations')
    .update({ dispatch_token: null, pending_since: null, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('dispatch_token', token)
    .select('id')
    .maybeSingle();

  if (error || !conversation) {
    return Response.json({ error: 'unknown conversation or spent token' }, { status: 403 });
  }

  const { error: insertError } = await admin.from('messages').insert({
    conversation_id: conversationId,
    sender: 'AGENT',
    body: text.trim().slice(0, 8000),
  });

  if (insertError) {
    /* Ответы маршрута читает машина, поэтому по-английски. */
    console.error('agent reply not stored:', insertError.message);
    return Response.json({ error: 'could not store the reply' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
