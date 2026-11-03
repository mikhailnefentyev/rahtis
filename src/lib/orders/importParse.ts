import 'server-only';

import { agentSecret, signOutgoing } from '@/lib/agent/signature';

/**
 * Разбор заказа из письма, PDF или снимка через n8n (workflow
 * rahtis-order-parse.json, узел OpenAI). Подпись та же, что у топлива,
 * перевода и ассистента: AGENT_WEBHOOK_SECRET.
 *
 * Текст и файл уходят только в этот запрос и нигде не сохраняются: ни в
 * базе, ни в хранилище. В n8n рекомендуется не хранить данные успешных
 * запусков этого сценария (Settings → Save successful executions: off).
 *
 * Не настроено — 'not_configured', не ответило или ответило не тем —
 * 'failed': человек видит, что разбор не удался, и заполняет форму сам.
 */

export type ParseResult = { ok: true; draft: unknown } | { ok: false; reason: 'not_configured' | 'failed' };

export type ParseInput = {
  /** Вставленный текст письма. */
  text: string;
  /** Или файл: PDF либо снимок (JPEG/PNG/WebP). */
  file: { name: string; mime: string; bytes: ArrayBuffer } | null;
  /** Сегодня по Хельсинки, YYYY-MM-DD, и день недели — для «huomenna», «ensi maanantaina». */
  today: string;
  weekday: string;
  role: 'SHIPPER' | 'CARRIER';
  country: string;
  /** Подсказки: клиенты перевозчика и знакомые точки компании. */
  clients: string[];
  places: string[];
};

export function orderParseConfigured(): boolean {
  return Boolean(process.env.N8N_ORDER_PARSE_WEBHOOK_URL?.trim() && agentSecret());
}

export async function parseOrderDocument(input: ParseInput): Promise<ParseResult> {
  const url = process.env.N8N_ORDER_PARSE_WEBHOOK_URL?.trim();
  const secret = agentSecret();
  if (!url || !secret) return { ok: false, reason: 'not_configured' };

  const file = input.file;
  const body = JSON.stringify({
    mode: file ? (file.mime === 'application/pdf' ? 'pdf' : 'image') : 'text',
    text: input.text.slice(0, 30_000),
    file_name: file ? file.name.slice(0, 120) : undefined,
    mime: file?.mime,
    data_base64: file ? Buffer.from(file.bytes).toString('base64') : undefined,
    today: input.today,
    weekday: input.weekday,
    timezone: 'Europe/Helsinki',
    role: input.role,
    country: input.country,
    clients: input.clients.slice(0, 200),
    places: input.places.slice(0, 80),
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signOutgoing(secret, body),
      body,
      /* Письмо модель читает за секунды, скан PDF — до минуты. */
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) return { ok: false, reason: 'failed' };
    const data = (await response.json()) as { ok?: boolean; draft?: unknown };
    if (!data.ok || !data.draft || typeof data.draft !== 'object') return { ok: false, reason: 'failed' };
    return { ok: true, draft: data.draft };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
