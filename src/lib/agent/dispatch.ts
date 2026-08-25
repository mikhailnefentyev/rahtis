import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { n8nWebhookUrl, agentSecret, signOutgoing } from './signature';

/**
 * Отправка вопроса во внешний воркфлоу.
 *
 * Пропуск выдаётся здесь и живёт до ответа. Он не защищает от того, кто
 * читает наш трафик — для этого подпись, — а ограничивает
 * скомпрометированный n8n: инструменты откроются ему только по треду,
 * который сейчас в работе, а не по любому, чей идентификатор он когда-то
 * видел.
 *
 * Отсутствие адреса воркфлоу не ошибка: пока n8n не подключён, вопрос
 * остаётся в чате и ждёт оператора. Молчание агента лучше, чем сломанная
 * отправка сообщения.
 */
export async function dispatchToAgent(conversationId: string, messageId: string): Promise<void> {
  const admin = createAdminClient();

  const token = crypto.randomUUID();

  const { data: conversation, error } = await admin
    .from('conversations')
    .update({ dispatch_token: token, pending_since: new Date().toISOString() })
    .eq('id', conversationId)
    .select('id, company_id, audience, channel')
    .single();

  if (error || !conversation) {
    console.error('Тред не помечен ожидающим:', error?.message);
    return;
  }

  const url = n8nWebhookUrl();
  const secret = agentSecret();

  if (!url || !secret) {
    console.info('agent: воркфлоу не настроен, вопрос ждёт в чате');
    return;
  }

  const [{ data: company }, { data: message }] = await Promise.all([
    admin.from('companies').select('name, kind').eq('id', conversation.company_id).single(),
    admin.from('messages').select('body, sender_user_id').eq('id', messageId).single(),
  ]);

  const body = JSON.stringify({
    conversation_id: conversation.id,
    dispatch_token: token,
    audience: conversation.audience,
    channel: conversation.channel,
    company_id: conversation.company_id,
    company_name: company?.name ?? null,
    party_role: company?.kind ?? null,
    message_id: messageId,
    text: message?.body ?? '',
    locale: 'fi',
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signOutgoing(secret, body),
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error('agent: воркфлоу ответил', response.status);
    }
  } catch (cause) {
    /*
     * Недоступный воркфлоу не роняет отправку сообщения: вопрос уже в
     * чате, и человек его видит. Снимать пометку ожидания здесь нельзя —
     * ответ может прийти позже.
     */
    console.error('agent: воркфлоу недоступен:', cause instanceof Error ? cause.message : cause);
  }
}
