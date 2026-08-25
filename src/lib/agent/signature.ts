import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Подпись обмена с n8n.
 *
 * Общий секрет, а не ключ к базе. Это принципиально: наружу уходит право
 * позвать шесть наших функций, а не доступ к Postgres. Утёкший секрет
 * стоит дорого, но не стоит базы.
 *
 * Метка времени входит в подпись, поэтому перехваченный запрос нельзя
 * повторить назавтра. Окно намеренно узкое: у машины нет причин
 * доставлять запрос дольше пяти минут, а у нападающего есть причина
 * ждать.
 */

const WINDOW_SECONDS = 300;

export function agentSecret(): string | null {
  return process.env.AGENT_WEBHOOK_SECRET?.trim() || null;
}

export function n8nWebhookUrl(): string | null {
  return process.env.N8N_AGENT_WEBHOOK_URL?.trim() || null;
}

function digest(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

/** Заголовки для исходящего запроса в n8n. */
export function signOutgoing(secret: string, body: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  return {
    'content-type': 'application/json',
    'x-rahtis-timestamp': timestamp,
    'x-rahtis-signature': `sha256=${digest(secret, timestamp, body)}`,
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Проверка входящего запроса от n8n.
 *
 * Сравнение постоянного времени: обычное `===` на строках выходит раньше
 * на первом несовпавшем байте, и по времени ответа подпись подбирается
 * побайтово. На локальной сети это не теория.
 */
export function verifyIncoming(request: Request, body: string): VerifyResult {
  const secret = agentSecret();
  if (!secret) return { ok: false, reason: 'AGENT_WEBHOOK_SECRET is not set' };

  const timestamp = request.headers.get('x-rahtis-timestamp');
  const signature = request.headers.get('x-rahtis-signature');

  if (!timestamp || !signature) return { ok: false, reason: 'missing signature headers' };

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > WINDOW_SECONDS) {
    return { ok: false, reason: 'timestamp outside the allowed window' };
  }

  const expected = Buffer.from(`sha256=${digest(secret, timestamp, body)}`);
  const given = Buffer.from(signature);

  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'signature mismatch' };
  }

  return { ok: true };
}
