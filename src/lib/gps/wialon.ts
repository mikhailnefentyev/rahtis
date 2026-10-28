import 'server-only';

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';

/**
 * Wialon Remote API: вход по токену и последние точки машин.
 *
 * Перевозчик даёт либо токен, либо ссылку Locator
 * (hosting.wialon.com/locator/index.html?t=…) — в ссылке тот же токен.
 * Сервер API — hst-api.wialon.com или сервер реселлера (white-label
 * Wialon отвечает на /wialon/ajax.html того же домена).
 *
 * Хост приходит от пользователя, поэтому запросы идут только по https,
 * без перенаправлений и только на публичные адреса — проверка адреса
 * в момент соединения (guardedLookup), а не до него.
 */

export const WIALON_DEFAULT_HOST = 'hst-api.wialon.com';

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const TOKEN_RE = /^[A-Za-z0-9]{20,200}$/;
const BLOCKED_SUFFIXES = ['.local', '.localhost', '.internal', '.lan', '.home', '.corp'];

/* Базовые свойства, последняя точка, поля профиля (номер, VIN). */
const UNIT_FLAGS = 1 | 1024 | 8388608;

export type WialonInput = { token: string; hosts: string[] };

export type WialonUnit = {
  externalId: string;
  name: string;
  plate: string | null;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  course: number | null;
  positionAt: string | null;
};

export class WialonError extends Error {
  constructor(public readonly kind: 'KEY' | 'UNREACHABLE' | 'INPUT', detail: string) {
    super(detail);
  }
}

function cleanHost(raw: string): string | null {
  const host = raw.trim().toLowerCase().replace(/\.$/, '');
  if (!HOST_RE.test(host) || isIP(host) || host === 'localhost') return null;
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return null;
  /* Последняя часть — буквы: домен, а не число. */
  if (!/[a-z]/.test(host.split('.').pop() ?? '')) return null;
  return host;
}

/** Веб-интерфейс hosting.wialon.X → сервер API hst-api.wialon.X. */
function apiHostFor(host: string): string {
  const m = /^(?:hosting|locator|apps)\.(wialon\.[a-z]+)$/.exec(host);
  return m ? `hst-api.${m[1]}` : host;
}

/**
 * Ключ из того, что вставил перевозчик: ссылка Locator, ссылка с
 * access_token или сам токен. Сервер — из ссылки или указанный отдельно.
 */
export function parseWialonInput(raw: string, serverRaw = ''): WialonInput {
  const value = raw.trim();
  const server = serverRaw.trim() ? cleanHost(serverRaw.replace(/^https?:\/\//i, '').split('/')[0]) : null;
  if (serverRaw.trim() && !server) throw new WialonError('INPUT', 'server');

  let token: string | null = null;
  let host: string | null = null;

  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new WialonError('INPUT', 'url');
    }
    if (url.port) throw new WialonError('INPUT', 'port');
    token =
      url.searchParams.get('t') ??
      url.searchParams.get('token') ??
      url.searchParams.get('access_token') ??
      new URLSearchParams(url.hash.replace(/^#/, '')).get('access_token');
    const fromUrl = cleanHost(url.hostname);
    if (fromUrl) host = apiHostFor(fromUrl);
  } else {
    token = value;
  }

  if (!token || !TOKEN_RE.test(token)) throw new WialonError('INPUT', 'token');

  const hosts = [server, host, WIALON_DEFAULT_HOST].filter((h): h is string => !!h);
  return { token, hosts: [...new Set(hosts)] };
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

function post(host: string, path: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host,
        servername: host,
        path,
        method: 'POST',
        lookup: guardedLookup,
        timeout: 12_000,
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) },
      },
      (res) => {
        /* Перенаправления не идём: ответ должен прийти с этого же сервера. */
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return reject(new Error(`http ${res.statusCode}`));
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 5 * 1024 * 1024) req.destroy(new Error('too large'));
          else chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

async function call<T>(host: string, svc: string, params: unknown, sid?: string): Promise<T> {
  if (!cleanHost(host)) throw new WialonError('INPUT', 'host');
  const body = new URLSearchParams({ params: JSON.stringify(params) });
  if (sid) body.set('sid', sid);
  let text: string;
  try {
    text = await post(host, `/wialon/ajax.html?svc=${encodeURIComponent(svc)}`, body.toString());
  } catch {
    throw new WialonError('UNREACHABLE', 'request');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new WialonError('UNREACHABLE', 'json');
  }
  const error = (json as { error?: number }).error;
  if (typeof error === 'number' && error !== 0) {
    /* 1 сессия, 4 ввод, 7 доступ, 8 токен/пароль. */
    throw new WialonError([1, 4, 7, 8].includes(error) ? 'KEY' : 'UNREACHABLE', `wialon ${error}`);
  }
  return json as T;
}

type RawUnit = {
  id: number;
  nm: string;
  pos?: { t: number; y: number; x: number; s?: number; c?: number } | null;
  pflds?: Record<string, { n: string; v: string }>;
};

function toUnit(raw: RawUnit): WialonUnit {
  const plateField = Object.values(raw.pflds ?? {}).find((f) => f?.n === 'registration_plate')?.v?.trim();
  const pos = raw.pos && Number.isFinite(raw.pos.y) && Number.isFinite(raw.pos.x) && raw.pos.t > 0 ? raw.pos : null;
  return {
    externalId: String(raw.id),
    name: String(raw.nm ?? '').slice(0, 200) || String(raw.id),
    plate: plateField ? plateField.slice(0, 32) : null,
    lat: pos ? pos.y : null,
    lon: pos ? pos.x : null,
    speedKmh: pos && Number.isFinite(pos.s) ? Math.round(pos.s!) : null,
    course: pos && Number.isFinite(pos.c) ? Math.round(pos.c!) : null,
    positionAt: pos ? new Date(pos.t * 1000).toISOString() : null,
  };
}

/**
 * Вход, все машины с последней точкой, выход. Возвращает сервер, который
 * ответил: его запоминаем, чтобы не перебирать каждый раз.
 */
export async function fetchWialonUnits(
  token: string,
  hosts: string[],
): Promise<{ host: string; account: string | null; units: WialonUnit[] }> {
  let lastError: WialonError | null = null;

  for (const host of hosts) {
    try {
      const login = await call<{ eid: string; au?: string; user?: { nm?: string } }>(host, 'token/login', {
        token,
        fl: 1,
      });
      try {
        const found = await call<{ items?: RawUnit[] }>(
          host,
          'core/search_items',
          {
            spec: { itemsType: 'avl_unit', propName: 'sys_name', propValueMask: '*', sortType: 'sys_name' },
            force: 1,
            flags: UNIT_FLAGS,
            from: 0,
            to: 500,
          },
          login.eid,
        );
        return {
          host,
          account: (login.au ?? login.user?.nm ?? null)?.slice(0, 200) ?? null,
          units: (found.items ?? []).map(toUnit),
        };
      } finally {
        await call(host, 'core/logout', {}, login.eid).catch(() => undefined);
      }
    } catch (e) {
      lastError = e instanceof WialonError ? e : new WialonError('UNREACHABLE', 'unknown');
      /* Неверный ключ на сервере, который ответил, — дальше не перебираем. */
      if (lastError.kind === 'KEY') break;
    }
  }

  throw lastError ?? new WialonError('UNREACHABLE', 'no host');
}

/** Номер для сравнения: без пробелов и дефисов, заглавными. */
export function normalizePlate(value: string | null | undefined): string {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9ÅÄÖ]/g, '');
}
