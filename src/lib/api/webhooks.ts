import 'server-only';

import { randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createAdminClient } from '@/lib/supabase/admin';
import { privateV4, privateV6, sign, urlShapeProblem } from './signature';

/**
 * Вебхуки: подпись, проверка адреса и отправка очереди.
 *
 * Подпись и правила адреса — в signature.ts.
 *
 * Адрес проверяется перед каждой отправкой, а не только при сохранении:
 * имя хоста может начать указывать на внутреннюю сеть позже. Наш сервер
 * не ходит на частные, служебные и локальные адреса и не следует
 * перенаправлениям — иначе вебхук стал бы способом постучаться туда, куда
 * снаружи не достать.
 */

export { WEBHOOK_EVENTS } from './events';

export function generateSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

/** null — адрес годится; иначе причина словами (для кабинета и журнала). */
export async function checkUrl(raw: string): Promise<string | null> {
  const shape = urlShapeProblem(raw);
  if ('problem' in shape) return shape.problem;
  const { host } = shape;

  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) return 'host name does not resolve';
  for (const a of addresses) {
    if (a.family === 4 ? privateV4(a.address) : privateV6(a.address)) return 'private or reserved network addresses are not allowed';
  }
  return null;
}

type Claimed = {
  id: string;
  event: string;
  payload: unknown;
  created_at: string;
  attempts: number;
  url: string;
  secret: string;
};

export type DispatchResult = { claimed: number; sent: number; failed: number };

async function deliver(item: Claimed): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const problem = await checkUrl(item.url);
  if (problem) return { ok: false, status: null, error: problem };

  const body = JSON.stringify({ id: item.id, type: item.event, created_at: item.created_at, data: item.payload });
  const t = Math.floor(Date.now() / 1000);

  try {
    const response = await fetch(item.url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'RAHTIS-Webhooks/1',
        'Rahtis-Event': item.event,
        'Rahtis-Delivery': item.id,
        'Rahtis-Signature': `t=${t},v1=${sign(item.secret, t, body)}`,
      },
      body,
    });
    await response.body?.cancel().catch(() => undefined);
    return response.ok
      ? { ok: true, status: response.status, error: null }
      : { ok: false, status: response.status, error: `HTTP ${response.status}` };
  } catch (cause) {
    const message = cause instanceof Error ? cause.name === 'TimeoutError' ? 'timeout after 10 s' : cause.message : 'network error';
    return { ok: false, status: null, error: message };
  }
}

export async function dispatchWebhooks(): Promise<DispatchResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('api_webhook_claim', { p_limit: 50 });
  if (error) throw error;

  const items = (data ?? []) as Claimed[];
  const results = await Promise.all(
    items.map(async (item) => {
      const outcome = await deliver(item);
      await admin.rpc('api_webhook_report', {
        p_id: item.id,
        p_ok: outcome.ok,
        p_status: outcome.status ?? 0,
        p_error: outcome.error ?? '',
      });
      return outcome.ok;
    }),
  );

  return { claimed: items.length, sent: results.filter(Boolean).length, failed: results.filter((ok) => !ok).length };
}
