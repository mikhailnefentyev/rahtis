'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { dispatchToAgent } from './dispatch';

export type ChatState = { error: string | null };

/**
 * Сообщение пользователя в тред агента.
 *
 * Тред заводится при первом вопросе: заставлять человека сначала
 * «создать обращение», а потом писать — лишний шаг в разговоре, который
 * и так начинается с вопроса.
 */
export async function sendAgentMessageAction(
  _previous: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);

  const text = String(formData.get('text') ?? '').trim();
  if (!text) return { error: null };

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company) {
    return { error: t.error.forbidden };
  }

  const supabase = await createClient();

  /* Аудитория треда — роль спрашивающего: она решает, какой воркфлоу ответит. */
  const audience = viewer.role;

  let conversationId = String(formData.get('conversation_id') ?? '');

  if (!conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ company_id: viewer.company.id, audience })
      .select('id')
      .single();

    if (error || !data) {
      console.error('Тред не создан:', error?.message);
      return { error: t.chat.failed };
    }
    conversationId = data.id;
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender: 'USER',
      sender_user_id: viewer.userId,
      body: text,
    })
    .select('id')
    .single();

  if (error || !message) {
    console.error('Сообщение не записано:', error?.message);
    return { error: t.chat.failed };
  }

  await dispatchToAgent(conversationId, message.id);

  revalidatePath(`/${locale}`, 'layout');
  return { error: null };
}
