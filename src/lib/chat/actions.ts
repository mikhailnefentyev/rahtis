'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { CHAT_LANGS, type Chat } from './langs';
import { translateMessage } from './translate';

/** Сколько недостающих переводов делать за одно чтение: дальше — следующим опросом. */
const TRANSLATE_PER_LOAD = 5;

/**
 * Переписка рейса. Права решает база (order_chat): участник рейса, а
 * оператор — только при претензии. Действия общие для кабинета и
 * приложения водителя: сессия у обоих своя, роль база выводит сама.
 *
 * lang — язык читателя. Чужие сообщения без перевода на него
 * переводятся здесь же и сохраняются: язык водителя часто нигде не
 * записан (берётся из браузера), и при отправке сайт его не знал.
 */
export async function loadChatAction(orderId: string, lang?: string): Promise<Chat | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('order_chat', { p_order_id: orderId });
  if (error || !data) return null;
  const chat = data as unknown as Chat;

  if (lang && (CHAT_LANGS as readonly string[]).includes(lang)) {
    const missing = chat.messages
      .filter((m) => !m.mine && !m.quick_code && m.source_lang !== lang && !m.translations?.[lang])
      .slice(-TRANSLATE_PER_LOAD);

    if (missing.length > 0) {
      const admin = createAdminClient();
      await Promise.all(
        missing.map(async (message) => {
          const result = await translateMessage(message.body, [lang]);
          if (!result?.source) return;
          const text = result.translations[lang as keyof typeof result.translations] ?? null;
          /* Язык совпал с исходным — переводить нечего, но язык запоминается, чтобы не спрашивать снова. */
          if (!text && result.source !== lang) return;
          await admin.rpc('merge_message_translation', {
            p_id: message.id,
            p_lang: lang,
            p_text: text ?? '',
            p_source: result.source,
          });
          message.source_lang = message.source_lang ?? result.source;
          if (text && result.source !== lang) message.translations = { ...message.translations, [lang]: text };
        }),
      );
    }
  }

  return chat;
}

export type PostResult = { error: 'closed' | 'tooMany' | 'forbidden' | 'failed' | null };

/**
 * Сообщение и его перевод на известные языки сторон. Перевод ждётся
 * (до 15 с), чтобы собеседник сразу увидел текст на своём языке; не
 * вышло — останется оригинал, а недостающее доделает чтение.
 */
export async function postChatAction(orderId: string, body: string, quick: string | null): Promise<PostResult> {
  const text = body.trim().slice(0, 1000);
  if (!text) return { error: 'failed' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('post_order_message', {
    p_order_id: orderId,
    p_body: text,
    p_quick: quick ?? undefined,
  });
  if (error || !data) {
    if (error?.code === '55000') return { error: 'closed' };
    if (error?.code === '55001') return { error: 'tooMany' };
    if (error?.code === '42501') return { error: 'forbidden' };
    return { error: 'failed' };
  }

  const posted = data as { id: number; langs: string[] | null };
  if (!quick) {
    const result = await translateMessage(text, posted.langs ?? []);
    if (result) {
      const translations = Object.fromEntries(
        Object.entries(result.translations).filter(([lang]) => lang !== result.source),
      );
      await createAdminClient()
        .from('order_messages')
        .update({ source_lang: result.source, translations: translations as Json })
        .eq('id', posted.id);
    }
  }

  return { error: null };
}
