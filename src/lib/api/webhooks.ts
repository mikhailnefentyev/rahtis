import 'server-only';

import { createHmac, randomBytes } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Вебхуки: подпись, проверка адреса и отправка очереди.
 *
 * Подпись как у Stripe: заголовок Rahtis-Signature: t=<unix>,v1=<hex>,
 * где v1 = HMAC-SHA256(секрет, "<t>.<тело>"). Время в подписи не даёт
 * переиграть старое событие: получатель отвергает t старше пяти минут.
 *
 * Адрес проверяется перед каждой отправкой, а не только при сохранении:
 * имя хоста может начать указывать на внутреннюю сеть позже. Наш сервер
 * не ходит на частные, служебные и локальные адреса и не следует
 * перенаправлениям — иначе вебхук стал бы способом постучаться туда, куда
 * снаружи не достать.
 */

export const WEBHOOK_EVENTS = [
  'order.taken',
  'order.reopened',
  'order.stop_completed',
  'order.closed',
  'order.cancelled',
  'document.added',
] as const;

export function generateSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}

export function sign(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

function privateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateV6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? privateV4(mapped[1]) : false;
}

/** null — адрес годится; иначе причина словами (для кабинета и журнала). */
export async function checkUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'not a valid URL';
  }
  if (url.protocol !== 'https:') return 'must use https';
  if (url.username || url.password) return 'credentials in URL are not allowed';
  if (url.port && url.port !== '443') return 'only the standard https port 443 is allowed';

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'private host names are not allowed';
  }

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
