import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Wialon Remote API: вход по токену и последние точки машин.
 *
 * Перевозчик даёт либо токен, либо ссылку Locator
 * (hosting.wialon.com/locator/index.html?t=…) — в ссылке тот же токен.
 * Сервер API — hst-api.wialon.com или сервер реселлера (white-label
 * Wialon отвечает на /wialon/ajax.html того же домена).
 *
 * Хост приходит от пользователя, поэтому запросы идут только по https,
 * без перенаправлений и только на публичные адреса.
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

function privateAddress(address: string): boolean {
  if (address.includes(':')) {
    const a = address.toLowerCase();
    return a === '::1' || a === '::' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80') || a.startsWith('::ffff:');
  }
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

async function assertPublic(host: string): Promise<void> {
  if (!cleanHost(host)) throw new WialonError('INPUT', 'host');
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new WialonError('UNREACHABLE', 'dns');
  }
  if (addresses.length === 0 || addresses.some((a) => privateAddress(a.address))) {
    throw new WialonError('UNREACHABLE', 'private');
  }
}

async function call<T>(host: string, svc: string, params: unknown, sid?: string): Promise<T> {
  const body = new URLSearchParams({ params: JSON.stringify(params) });
  if (sid) body.set('sid', sid);
  let res: Response;
  try {
    res = await fetch(`https://${host}/wialon/ajax.html?svc=${encodeURIComponent(svc)}`, {
      method: 'POST',
      body,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new WialonError('UNREACHABLE', 'fetch');
  }
  if (!res.ok) throw new WialonError('UNREACHABLE', `http ${res.status}`);
  let json: unknown;
  try {
    json = await res.json();
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
      await assertPublic(host);
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
