import 'server-only';

import { agentSecret, signOutgoing } from '@/lib/agent/signature';
import { CHAT_LANGS, type ChatLang } from './langs';

export type Translation = { source: string | null; translations: Partial<Record<ChatLang, string>> };

/**
 * Перевод сообщения переписки через n8n (workflow rahtis-translate.json,
 * узел OpenAI). Подпись та же, что у ассистента: AGENT_WEBHOOK_SECRET.
 *
 * Не настроено, не ответило или ответило не тем — null: переписка
 * работает и без перевода, читатель видит оригинал.
 */
export async function translateMessage(text: string, targets: string[]): Promise<Translation | null> {
  const url = process.env.N8N_TRANSLATE_WEBHOOK_URL?.trim();
  const secret = agentSecret();
  const langs = targets.filter((l): l is ChatLang => (CHAT_LANGS as readonly string[]).includes(l));
  if (!url || !secret || langs.length === 0 || !text.trim()) return null;

  const body = JSON.stringify({ text, targets: langs });
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signOutgoing(secret, body),
      body,
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { ok?: boolean; source?: unknown; translations?: unknown };
    if (!data.ok || typeof data.translations !== 'object' || data.translations === null) return null;

    const translations: Partial<Record<ChatLang, string>> = {};
    for (const [lang, value] of Object.entries(data.translations as Record<string, unknown>)) {
      if ((CHAT_LANGS as readonly string[]).includes(lang) && typeof value === 'string' && value.length <= 2000) {
        translations[lang as ChatLang] = value;
      }
    }
    const source = typeof data.source === 'string' && /^[a-z]{2}$/.test(data.source) ? data.source : null;
    return { source, translations };
  } catch {
    return null;
  }
}
