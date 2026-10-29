import 'server-only';

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

/**
 * Запрос к API провайдера GPS — общий для всех адаптеров.
 *
 * Хост может прийти от пользователя (сервер реселлера Wialon, Navixy под
 * чужой маркой), поэтому: только https, без перенаправлений, ответ не
 * больше 5 МБ и только на публичные адреса — проверка адреса в момент
 * соединения (guardedLookup), а не до него.
 */

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp'];

export class GpsError extends Error {
  constructor(public readonly kind: 'KEY' | 'UNREACHABLE' | 'INPUT', detail: string) {
    super(detail);
  }
}

/** Имя хоста из того, что ввёл человек; служебное и IP — нет. */
export function cleanHost(raw: string): string | null {
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/\.$/, '');
  if (!HOST_RE.test(host) || isIP(host) || host === 'localhost') return null;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return null;
  /* Последняя часть — буквы: домен, а не число. */
  if (!/[a-z]/.test(host.split('.').pop() ?? '')) return null;
  return host;
}

/**
 * Только обычные публичные адреса. Всё служебное — нет: частные сети,
 * loopback, link-local, CGNAT, multicast, документационные и тестовые
 * диапазоны, IPv4 внутри IPv6.
 */
export function publicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6) {
    const v = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return publicAddress(mapped[1]);
    /* Публичный unicast IPv6 — только 2000::/3, без документационного 2001:db8::/32. */
    return /^[23][0-9a-f]{0,3}:/.test(v) && !v.startsWith('2001:db8:') && !v.startsWith('2001:0db8:');
  }
  return false;
}

/**
 * DNS с проверкой в момент соединения: сокет открывается ровно на тот
 * адрес, что прошёл проверку, — подмена DNS между проверкой и запросом
 * не сработает.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = (Array.isArray(addresses) ? addresses : []) as LookupAddress[];
    const bad = list.length === 0 || list.some((a) => !publicAddress(a.address));
    if (bad) return callback(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }), '', 4);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export type HttpResponse = { status: number; headers: Record<string, string | string[] | undefined>; text: string };

export function httpsCall(
  host: string,
  path: string,
  init: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string } = {},
): Promise<HttpResponse> {
  if (!cleanHost(host)) return Promise.reject(new GpsError('INPUT', 'host'));
  const body = init.body ?? '';
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host,
        servername: host,
        path,
        method: init.method ?? 'GET',
        lookup: guardedLookup,
        timeout: 12_000,
        headers: {
          'user-agent': 'RAHTIS/1.0 (+https://www.rahtis.eu)',
          accept: 'application/json',
          ...(body ? { 'content-length': String(Buffer.byteLength(body)) } : {}),
          ...init.headers,
        },
      },
      (res) => {
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 5 * 1024 * 1024) req.destroy(new Error('too large'));
          else chunks.push(chunk);
        });
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body || undefined);
  });
}

/**
 * JSON с сервера провайдера. 401 и 403 — ключ не подходит; всё остальное
 * не 2xx (в том числе перенаправления — не идём) — сервер недоступен.
 */
export async function getJson<T>(
  host: string,
  path: string,
  init: { method?: 'GET' | 'POST'; headers?: Record<string, string>; body?: string } = {},
): Promise<{ data: T; headers: HttpResponse['headers'] }> {
  let res: HttpResponse;
  try {
    res = await httpsCall(host, path, init);
  } catch (e) {
    throw e instanceof GpsError ? e : new GpsError('UNREACHABLE', 'request');
  }
  if (res.status === 401 || res.status === 403) throw new GpsError('KEY', `http ${res.status}`);
  if (res.status < 200 || res.status >= 300) throw new GpsError('UNREACHABLE', `http ${res.status}`);
  try {
    return { data: JSON.parse(res.text) as T, headers: res.headers };
  } catch {
    throw new GpsError('UNREACHABLE', 'json');
  }
}
