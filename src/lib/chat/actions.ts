'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import type { Chat } from './langs';
import { translateMessage } from './translate';

/**
 * Переписка рейса. Права решает база (order_chat): участник рейса, а
 * оператор — только при претензии. Действия общие для кабинета и
 * приложения водителя: сессия у обоих своя, роль база выводит сама.
 */
export async function loadChatAction(orderId: string): Promise<Chat | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('order_chat', { p_order_id: orderId });
  if (error || !data) return null;
  return data as unknown as Chat;
}

export type PostResult = { error: 'closed' | 'tooMany' | 'forbidden' | 'failed' | null };

/**
 * Сообщение и его перевод. Перевод ждётся (до 15 с), чтобы собеседник с
 * другим языком сразу увидел текст на своём; не вышло — останется
 * оригинал, сообщение от этого не теряется.
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
