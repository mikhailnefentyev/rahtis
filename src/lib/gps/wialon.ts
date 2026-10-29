import 'server-only';

import { cleanHost, GpsError, httpsCall } from './http';
import { int, pct, positive, stateFromSpeed, type GpsFetch, type GpsUnit } from './types';

export { normalizePlate } from './types';
export { GpsError as WialonError } from './http';

/**
 * Wialon Remote API: вход по токену и последнее состояние машин.
 *
 * Перевозчик даёт либо токен, либо ссылку Locator
 * (hosting.wialon.com/locator/index.html?t=…) — в ссылке тот же токен.
 * Сервер API — hst-api.wialon.com или сервер реселлера (white-label
 * Wialon отвечает на /wialon/ajax.html того же домена).
 *
 * Кроме точки: счётчики пробега и моточасов (флаг 8192) и параметры
 * последнего сообщения (флаг 1048576) — уровень топлива и зажигание, если
 * трекер их шлёт. Имена параметров у разных трекеров разные; берём самые
 * частые (FMS/CAN и Teltonika), остальное — null.
 */

export const WIALON_DEFAULT_HOST = 'hst-api.wialon.com';
const TOKEN_RE = /^[A-Za-z0-9]{20,200}$/;

/* Базовые свойства, последняя точка, счётчики, последнее сообщение, поля профиля (номер, VIN). */
const UNIT_FLAGS = 1 | 1024 | 8192 | 1048576 | 8388608;

export type WialonInput = { token: string; hosts: string[] };

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
  const server = serverRaw.trim() ? cleanHost(serverRaw) : null;
  if (serverRaw.trim() && !server) throw new GpsError('INPUT', 'server');

  let token: string | null = null;
  let host: string | null = null;
  if (/^https?:\/\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new GpsError('INPUT', 'url');
    }
    if (url.port) throw new GpsError('INPUT', 'port');
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

  if (!token || !TOKEN_RE.test(token)) throw new GpsError('INPUT', 'token');
  const hosts = [server, host, WIALON_DEFAULT_HOST].filter((h): h is string => !!h);
  return { token, hosts: [...new Set(hosts)] };
}

async function call<T>(host: string, svc: string, params: unknown, sid?: string): Promise<T> {
  if (!cleanHost(host)) throw new GpsError('INPUT', 'host');
  const body = new URLSearchParams({ params: JSON.stringify(params) });
  if (sid) body.set('sid', sid);
  let res;
  try {
    res = await httpsCall(host, `/wialon/ajax.html?svc=${encodeURIComponent(svc)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    throw new GpsError('UNREACHABLE', 'request');
  }
  /* Перенаправления не идём: ответ должен прийти с этого же сервера. */
  if (res.status < 200 || res.status >= 300) throw new GpsError('UNREACHABLE', `http ${res.status}`);
  let json: unknown;
  try {
    json = JSON.parse(res.text);
  } catch {
    throw new GpsError('UNREACHABLE', 'json');
  }
  const error = (json as { error?: number }).error;
  if (typeof error === 'number' && error !== 0) {
    /* 1 сессия, 4 ввод, 7 доступ, 8 токен/пароль. */
    throw new GpsError([1, 4, 7, 8].includes(error) ? 'KEY' : 'UNREACHABLE', `wialon ${error}`);
  }
  return json as T;
}

type RawUnit = {
  id: number;
  nm: string;
  pos?: { t: number; y: number; x: number; s?: number; c?: number } | null;
  pflds?: Record<string, { n: string; v: string }>;
  /* Счётчики: пробег, км; моточасы, ч. */
  cnm?: number;
  cneh?: number;
  lmsg?: { p?: Record<string, unknown> } | null;
};

/* Частые имена параметров: FMS/CAN и Teltonika (io_239 — зажигание, io_89 — уровень топлива %, io_84 — литры). */
const pick = (p: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (p[k] != null) return p[k];
  return null;
};

function toUnit(raw: RawUnit): GpsUnit {
  const plateField = Object.values(raw.pflds ?? {}).find((f) => f?.n === 'registration_plate')?.v?.trim();
  const pos = raw.pos && Number.isFinite(raw.pos.y) && Number.isFinite(raw.pos.x) && raw.pos.t > 0 ? raw.pos : null;
  const p = raw.lmsg?.p ?? {};
  const ignRaw = pick(p, ['ign', 'ignition', 'io_239', 'engine_on']);
  const ignition = ignRaw == null ? null : ignRaw === true || Number(ignRaw) > 0;
  const speedKmh = pos && Number.isFinite(pos.s) ? Math.round(pos.s!) : null;
  return {
    externalId: String(raw.id),
    name: String(raw.nm ?? '').slice(0, 200) || String(raw.id),
    plate: plateField ? plateField.slice(0, 32) : null,
    lat: pos ? pos.y : null,
    lon: pos ? pos.x : null,
    speedKmh,
    course: pos && Number.isFinite(pos.c) ? Math.round(pos.c!) : null,
    positionAt: pos ? new Date(pos.t * 1000).toISOString() : null,
    odometerKm: raw.cnm && raw.cnm > 0 ? int(raw.cnm) : null,
    engineHours: raw.cneh && raw.cneh > 0 ? Math.round(raw.cneh * 10) / 10 : null,
    ignition,
    fuelLevelPct: pct(pick(p, ['can_fls', 'fuel_level_pct', 'io_89'])),
    fuelLevelL: positive(pick(p, ['fuel_lvl', 'fuel_level', 'io_84'])),
    fuelUsedL: positive(pick(p, ['can_fuel_used', 'fuel_used', 'total_fuel_used'])),
    state: stateFromSpeed(speedKmh, ignition),
  };
}

/**
 * Вход, все машины с последним состоянием, выход. Возвращает сервер,
 * который ответил: его запоминаем, чтобы не перебирать каждый раз.
 */
export async function fetchWialonUnits(token: string, hosts: string[]): Promise<GpsFetch> {
  let lastError: GpsError | null = null;

  for (const host of hosts) {
    try {
      const login = await call<{ eid: string; au?: string; user?: { nm?: string } }>(host, 'token/login', { token, fl: 1 });
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
      lastError = e instanceof GpsError ? e : new GpsError('UNREACHABLE', 'unknown');
      /* Неверный ключ на сервере, который ответил, — дальше не перебираем. */
      if (lastError.kind === 'KEY') break;
    }
  }

  throw lastError ?? new GpsError('UNREACHABLE', 'no host');
}
