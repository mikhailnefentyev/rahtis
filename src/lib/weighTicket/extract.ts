import 'server-only';

import { agentSecret, signOutgoing } from '@/lib/agent/signature';
import { sanitizeReading, type TicketReading } from './reading';

/**
 * Чтение фото весового талона через n8n (workflow rahtis-weigh-ticket.json,
 * узел OpenAI). Подпись та же, что у перевода и топлива:
 * AGENT_WEBHOOK_SECRET.
 *
 * Номера машин компании и машины этого рейса идут подсказкой: по ним
 * чтение узнаёт, где на талоне номер машины, — но возвращает то, что
 * напечатано, иначе проверка чужого номера ничего бы не ловила.
 *
 * Не настроено — 'not_configured', не ответило или ответило не тем —
 * 'failed': фото всё равно сохранено, веса вносятся вручную.
 */

export type ExtractTicketResult = { ok: true; reading: TicketReading } | { ok: false; reason: 'not_configured' | 'failed' };

export async function extractWeighTicket(input: {
  mime: string;
  bytes: ArrayBuffer;
  plates: string[];
  expectedPlates: string[];
  country: string;
}): Promise<ExtractTicketResult> {
  const url = process.env.N8N_WEIGH_TICKET_WEBHOOK_URL?.trim();
  const secret = agentSecret();
  if (!url || !secret) return { ok: false, reason: 'not_configured' };

  const body = JSON.stringify({
    mime: input.mime,
    data_base64: Buffer.from(input.bytes).toString('base64'),
    plates: input.plates.slice(0, 300),
    expected_plates: input.expectedPlates.slice(0, 5),
    country: input.country,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signOutgoing(secret, body),
      body,
      /* Талон короткий: модель читает его за секунды. Водитель ждёт у весов — дольше минуты не держим. */
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return { ok: false, reason: 'failed' };
    const data = (await response.json()) as { ok?: boolean; ticket?: unknown };
    const reading = data.ok ? sanitizeReading(data.ticket) : null;
    return reading ? { ok: true, reading } : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
