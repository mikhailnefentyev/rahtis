import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Подпись вебхука и правила адреса получателя — без серверных
 * зависимостей, чтобы их проверяли тесты (signature.test.mjs).
 *
 * Подпись как у Stripe: заголовок Rahtis-Signature: t=<unix>,v1=<hex>,
 * где v1 = HMAC-SHA256(секрет, "<t>.<тело>").
 */

export function sign(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

/**
 * Проверка на стороне получателя — та же, что в примере в кабинете и в
 * документации. Старше tolerance секунд — отказ: старое событие не
 * переиграть.
 */
export function verify(secret: string, header: string, body: string, nowS: number, toleranceS = 300): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(nowS - t) > toleranceS) return false;
  return timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(sign(secret, t, body), 'hex'));
}

/** Частные, служебные, локальные и групповые IPv4. */
export function privateV4(ip: string): boolean {
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

export function privateV6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
  /* IPv4 внутри IPv6: парсер URL пишет ::ffff:127.0.0.1 как ::ffff:7f00:1. */
  const dotted = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return privateV4(dotted[1]);
  const hex = v.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
    return privateV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}

/**
 * Форма адреса без похода в DNS: https, порт 443, без логина в адресе,
 * без локальных имён. Годится — имя хоста для проверки DNS; иначе причина.
 */
export function urlShapeProblem(raw: string): { problem: string } | { host: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { problem: 'not a valid URL' };
  }
  if (url.protocol !== 'https:') return { problem: 'must use https' };
  if (url.username || url.password) return { problem: 'credentials in URL are not allowed' };
  if (url.port && url.port !== '443') return { problem: 'only the standard https port 443 is allowed' };

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { problem: 'private host names are not allowed' };
  }
  return { host };
}
