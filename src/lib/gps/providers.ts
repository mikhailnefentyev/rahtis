import 'server-only';

import { GpsError, cleanHost, getJson, httpsCall } from './http';
import { ABAX_API, abaxAccess } from './abax';
import { PROVIDER_CATALOG, type ProviderInfo } from './catalog';
import { fetchWialonUnits, parseWialonInput } from './wialon';
import {
  coord,
  int,
  iso,
  num,
  pct,
  positive,
  stateFromSpeed,
  text,
  type GpsFetch,
  type GpsProvider,
  type GpsRefuel,
  type GpsState,
  type GpsUnit,
} from './types';

/**
 * Провайдеры GPS с ключом, который перевозчик создаёт сам в своём
 * кабинете, — как Wialon (docs/telematics/research-api-tokens.md).
 *
 * Адаптеры написаны по документации провайдеров 29.10.2026; на живых
 * аккаунтах, кроме Wialon, не проверены. Разбор поэтому терпимый: чего
 * нет — то null, единицы проверяются на правдоподобие (метры или
 * километры, секунды или часы).
 *
 * Хост: у Wialon и Navixy бывает свой сервер реселлера, у Samsara — свой
 * для ЕС; остальные — один адрес.
 */

export type ProviderInput = { token: string; hosts: string[] };

export type ProviderSpec = ProviderInfo & {
  /** Провайдер сам отдаёт события заправки — по скачку уровня тогда не ищем, иначе одна заправка записалась бы дважды. */
  refuelEvents?: boolean;
  parse(raw: string, server: string): ProviderInput;
  fetch(input: { token: string; host: string; accountRef: string | null; cursor: string | null }): Promise<GpsFetch>;
};

const plainToken = (min: number, re = /^[A-Za-z0-9_\-.:]+$/) => (raw: string) => {
  const token = raw.trim().replace(/^(Bearer|Token|NVX)\s+/i, '');
  if (token.length < min || token.length > 400 || !re.test(token)) throw new GpsError('INPUT', 'token');
  return token;
};

const hostsFor = (server: string, fallback: string): string[] => {
  if (!server.trim()) return [fallback];
  const host = cleanHost(server);
  if (!host) throw new GpsError('INPUT', 'server');
  return [host];
};

/** Расстояние в км: провайдеры отдают то метры, то километры — грузовик не проедет 10 млн км. */
const km = (value: unknown): number | null => {
  const n = positive(value);
  if (n == null) return null;
  return Math.round(n > 10_000_000 ? n / 1000 : n);
};

/** Моточасы: секунды или часы. */
const hours = (value: unknown): number | null => {
  const n = positive(value);
  if (n == null) return null;
  return Math.round((n > 1_000_000 ? n / 3600 : n) * 10) / 10;
};

const stateFromWord = (value: unknown): GpsState | null => {
  const s = String(value ?? '').toLowerCase();
  if (!s) return null;
  if (/driv|mov|towing/.test(s)) return 'MOVING';
  if (/park/.test(s)) return 'PARKED';
  if (/offline|no.?signal/.test(s)) return 'OFFLINE';
  if (/stand|stop|idl/.test(s)) return 'STOPPED';
  return null;
};

const list = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  const v = value as { results?: unknown; data?: unknown; items?: unknown; list?: unknown } | null;
  for (const key of ['results', 'data', 'items', 'list'] as const) {
    if (Array.isArray(v?.[key])) return v![key] as Record<string, unknown>[];
  }
  return [];
};

const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/* Заправки забираем не чаще раза в 15 минут: это отдельные запросы на каждую машину. */
const REFUEL_EVERY_MS = 15 * 60_000;
const refuelWindow = (cursor: string | null): { from: Date; till: Date } | null => {
  const till = new Date();
  const last = cursor ? new Date(cursor) : null;
  if (last && Number.isFinite(last.getTime()) && till.getTime() - last.getTime() < REFUEL_EVERY_MS) return null;
  /* Первый раз — за сутки назад, дальше — с прошлого раза, но не больше чем за трое суток. */
  const from = last && Number.isFinite(last.getTime()) ? last : new Date(till.getTime() - 24 * 3600_000);
  return { from: new Date(Math.max(from.getTime(), till.getTime() - 3 * 24 * 3600_000)), till };
};

/* ── Wialon ───────────────────────────────────────────────────── */

const wialon: ProviderSpec = {
  ...PROVIDER_CATALOG.WIALON,
  parse: (raw, server) => parseWialonInput(raw, server),
  fetch: ({ token, host }) => fetchWialonUnits(token, [...new Set([host, 'hst-api.wialon.com'])]),
};

/* ── Mapon (LV; Прибалтика, Польша, Финляндия, Швеция, Дания) ─── */

const MAPON_HOST = 'mapon.com';

async function maponGet<T>(path: string, token: string, params: Record<string, string | string[]>): Promise<T> {
  const q = new URLSearchParams({ key: token });
  for (const [k, v] of Object.entries(params)) for (const one of [v].flat()) q.append(k, one);
  const { data } = await getJson<T & { error?: { code?: number; msg?: string } }>(MAPON_HOST, `/api/v1/${path}?${q}`);
  const err = (data as { error?: { code?: number; msg?: string } }).error;
  if (err) throw new GpsError(/key|auth|permission|access/i.test(String(err.msg ?? '')) ? 'KEY' : 'UNREACHABLE', `mapon ${err.code}`);
  return data;
}

const mapon: ProviderSpec = {
  ...PROVIDER_CATALOG.MAPON,
  refuelEvents: true,
  docs: 'https://mapon.com/api/',
  parse: (raw) => ({ token: plainToken(16)(raw), hosts: [MAPON_HOST] }),
  async fetch({ token, cursor }) {
    const res = await maponGet<{ data?: { units?: unknown[] } }>('unit/list.json', token, {
      'include[]': ['fuel', 'fuel_tank', 'drivers', 'can', 'ignition'],
    });
    const units: GpsUnit[] = list(res.data?.units).map((u) => {
      const point = coord(u.lat, u.lng);
      const state = obj(u.movement_state ?? u.state);
      const fuel = list(u.fuel)[0] ?? {};
      const fuelValue = positive(fuel.value);
      const isPct = /%|perc/i.test(String(fuel.metrics ?? ''));
      const can = obj(u.can);
      const ignition = obj(u.ignition);
      const ign = ignition.state ?? ignition.value;
      const speedKmh = int(u.speed);
      const drivers = obj(u.drivers);
      const driver = obj(drivers.driver1);
      return {
        externalId: String(u.unit_id ?? u.id ?? ''),
        name: text(u.label, 200) ?? text(u.vehicle_title, 200) ?? String(u.unit_id ?? ''),
        plate: text(u.number, 32),
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
        speedKmh,
        course: int(u.direction),
        positionAt: iso(u.last_update),
        odometerKm: km(can.odom ?? u.mileage),
        engineHours: hours(can.engine_hours),
        ignition: ign == null ? null : ign === true || ign === 1 || /on|1/i.test(String(ign)),
        fuelLevelPct: isPct ? pct(fuelValue) : null,
        fuelLevelL: isPct ? null : fuelValue,
        fuelUsedL: positive(can.fuel_total),
        tankL: positive(obj(u.fuel_tank).total_vol),
        state: stateFromWord(state.name) ?? stateFromSpeed(speedKmh, null),
        stateSince: iso(state.start),
        driver: text([driver.name, driver.surname].filter(Boolean).join(' '), 120),
        address: text(u.address, 200),
      };
    });

    /* Заправки: fuel/changes по каждой машине, положительное изменение — заправка. */
    const window = refuelWindow(cursor);
    const refuels: GpsRefuel[] = [];
    if (window) {
      for (const unit of units.slice(0, 50)) {
        try {
          const res2 = await maponGet<{ data?: unknown }>('fuel/changes.json', token, {
            unit_id: unit.externalId,
            from: window.from.toISOString().replace(/\.\d+Z$/, 'Z'),
            till: window.till.toISOString().replace(/\.\d+Z$/, 'Z'),
          });
          for (const ch of list(res2.data)) {
            const litres = num(ch.fuel_change);
            const at = iso(ch.gmt ?? ch.time);
            if (litres != null && litres >= 10 && at) {
              refuels.push({ ref: `mapon:${unit.externalId}:${at}`, externalId: unit.externalId, at, litres: Math.round(litres * 10) / 10 });
            }
          }
        } catch {
          /* Нет права на топливо у ключа — точки всё равно показываем. */
          break;
        }
      }
    }

    return { host: MAPON_HOST, account: null, units, refuels, cursor: window ? window.till.toISOString() : cursor };
  },
};

/* ── Navirec (EE; Финляндия, Прибалтика) ──────────────────────── */

const NAVIREC_HOST = 'api.navirec.com';
const navirecHeaders = (token: string) => ({
  authorization: `Token ${token}`,
  accept: 'application/json; version=1.54.0',
});

const navirec: ProviderSpec = {
  ...PROVIDER_CATALOG.NAVIREC,
  parse: (raw) => ({ token: plainToken(16)(raw), hosts: [NAVIREC_HOST] }),
  async fetch({ token, accountRef }) {
    let account = accountRef;
    let accountName: string | null = null;
    if (!account) {
      const { data } = await getJson<unknown>(NAVIREC_HOST, '/accounts/', { headers: navirecHeaders(token) });
      const first = list(data)[0];
      if (!first) throw new GpsError('KEY', 'no account');
      account = String(first.id ?? '');
      accountName = text(first.name, 200);
    }
    const q = `?account=${encodeURIComponent(account)}`;
    const [{ data: vehicles }, { data: states }] = await Promise.all([
      getJson<unknown>(NAVIREC_HOST, `/vehicles/${q}`, { headers: navirecHeaders(token) }),
      getJson<unknown>(NAVIREC_HOST, `/last_vehicle_states/${q}`, { headers: navirecHeaders(token) }),
    ]);

    const idOf = (v: unknown) => {
      const s = String(v ?? '');
      const m = /\/([0-9a-f-]{6,})\/?$/i.exec(s);
      return m ? m[1] : s;
    };
    const byId = new Map(list(vehicles).map((v) => [idOf(v.id ?? v.url), v]));

    const units: GpsUnit[] = list(states).map((st) => {
      const id = idOf(st.vehicle);
      const v = byId.get(id) ?? {};
      const coords = obj(st.location).coordinates as unknown[] | undefined;
      const point = Array.isArray(coords) ? coord(coords[1], coords[0]) : null;
      const speedKmh = int(st.speed);
      const ignition = typeof st.ignition === 'boolean' ? st.ignition : null;
      const tanks = Array.isArray(v.fuel_tank_capacities) ? (v.fuel_tank_capacities as unknown[]) : [];
      const tank = tanks.reduce<number>((sum, t) => sum + (positive(t) ?? 0), 0);
      return {
        externalId: id,
        name: text(v.name_display ?? v.name, 200) ?? id,
        plate: text(v.registration, 32),
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
        speedKmh,
        course: int(st.heading),
        positionAt: iso(st.time),
        odometerKm: km(st.total_distance),
        engineHours: hours(st.total_engine_time),
        ignition,
        fuelLevelPct: pct(st.can_fuel_level_percent),
        fuelLevelL: positive(st.fuel_level),
        fuelUsedL: positive(st.total_fuel_used),
        tankL: tank > 0 ? tank : null,
        state: stateFromWord(st.activity) ?? stateFromSpeed(speedKmh, ignition),
        stateSince: iso(st.activity_started_at),
        driver: text([st.driver_name, st.driver_surname].filter(Boolean).join(' '), 120),
      };
    });

    return { host: NAVIREC_HOST, account: accountName, accountRef: account, units };
  },
};

/* ── Ruptela TrustTrack (LT; Польша, Латвия) ──────────────────── */

const RUPTELA_HOST = 'api.fm-track.com';

const ruptela: ProviderSpec = {
  ...PROVIDER_CATALOG.RUPTELA,
  refuelEvents: true,
  docs: 'https://api.fm-track.com/swagger.json',
  parse: (raw) => ({ token: plainToken(16)(raw), hosts: [RUPTELA_HOST] }),
  async fetch({ token, cursor }) {
    const units: GpsUnit[] = [];
    let continuation: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const q = new URLSearchParams({ version: '2', api_key: token });
      if (continuation) q.set('continuation_token', continuation);
      const { data } = await getJson<unknown>(RUPTELA_HOST, `/objects-last-coordinate?${q}`);
      for (const o of list(data)) {
        const c = obj(o.last_coordinate);
        const params = obj(o.vehicle_params);
        const point = coord(c.latitude, c.longitude);
        const speedKmh = int(c.speed);
        units.push({
          externalId: String(o.id ?? o.object_id ?? ''),
          name: text(o.name, 200) ?? String(o.id ?? ''),
          plate: text(params.plate_number, 32),
          lat: point?.lat ?? null,
          lon: point?.lon ?? null,
          speedKmh,
          course: int(c.direction),
          positionAt: iso(c.datetime),
          tankL: positive(params.fuel_tank_capacity),
          state: stateFromSpeed(speedKmh, null),
          address: text(c.address, 200),
        });
      }
      continuation = text(obj(data).continuation_token, 400);
      if (!continuation) break;
    }

    const window = refuelWindow(cursor);
    const refuels: GpsRefuel[] = [];
    if (window) {
      for (const unit of units.slice(0, 50)) {
        try {
          const q = new URLSearchParams({
            version: '1',
            api_key: token,
            object_id: unit.externalId,
            from_datetime: window.from.toISOString(),
            to_datetime: window.till.toISOString(),
          });
          const { data } = await getJson<unknown>(RUPTELA_HOST, `/fuel-events?${q}`);
          for (const ev of list(data)) {
            const litres = num(ev.difference);
            const at = iso(ev.start_date);
            if (/refuel/i.test(String(ev.event_type)) && litres != null && litres >= 10 && at) {
              refuels.push({ ref: `ruptela:${unit.externalId}:${at}`, externalId: unit.externalId, at, litres: Math.round(Math.abs(litres) * 10) / 10 });
            }
          }
        } catch {
          break;
        }
      }
    }

    return { host: RUPTELA_HOST, account: null, units, refuels, cursor: window ? window.till.toISOString() : cursor };
  },
};

/* ── Navixy и её реселлеры под своей маркой ───────────────────── */

const NAVIXY_HOST = 'api.eu.navixy.com';

async function navixyCall<T>(host: string, token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  /* Navixy отвечает на ошибки HTTP 400 с телом {success:false, status:{code}} — читаем тело и тогда. */
  let res;
  try {
    res = await httpsCall(host, `/v2/${method}`, {
      method: 'POST',
      headers: { authorization: `NVX ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw e instanceof GpsError ? e : new GpsError('UNREACHABLE', 'request');
  }
  let data: T & { success?: boolean; status?: { code?: number } };
  try {
    data = JSON.parse(res.text);
  } catch {
    throw new GpsError('UNREACHABLE', `http ${res.status}`);
  }
  if (data.success === false || res.status < 200 || res.status >= 300) {
    /* 3 — неверный ключ, 4 — ключ не найден или сессия кончилась, 7 — нет прав, 11 — доступ запрещён. */
    const code = data.status?.code ?? 0;
    throw new GpsError([3, 4, 7, 11].includes(code) || res.status === 401 || res.status === 403 ? 'KEY' : 'UNREACHABLE', `navixy ${code}`);
  }
  return data;
}

const navixy: ProviderSpec = {
  ...PROVIDER_CATALOG.NAVIXY,
  parse: (raw, server) => ({ token: plainToken(16)(raw), hosts: hostsFor(server, NAVIXY_HOST) }),
  async fetch({ token, host }) {
    const trackers = list((await navixyCall<{ list?: unknown }>(host, token, 'tracker/list')).list);
    const vehicles = await navixyCall<{ list?: unknown }>(host, token, 'vehicle/list').catch(() => ({ list: [] }));
    const plateOf = new Map(list(vehicles.list).map((v) => [String(v.tracker_id ?? ''), text(v.reg_number, 32)]));
    const statesRes = await navixyCall<{ states?: Record<string, unknown> }>(host, token, 'tracker/get_states', {
      trackers: trackers.map((t) => t.id).slice(0, 2000),
    });
    const states = obj(statesRes.states);

    const units: GpsUnit[] = trackers.map((t) => {
      const id = String(t.id ?? '');
      const st = obj(states[id]);
      const gps = obj(st.gps);
      const loc = obj(gps.location);
      const point = coord(loc.lat, loc.lng);
      const speedKmh = int(gps.speed);
      const ignition = typeof st.ignition === 'boolean' ? st.ignition : null;
      return {
        externalId: id,
        name: text(t.label, 200) ?? id,
        plate: plateOf.get(id) ?? null,
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
        speedKmh,
        course: int(gps.heading),
        /* Navixy отдаёт время в часовом поясе аккаунта без зоны; считаем его UTC — ошибка не больше пары часов в «когда видели». */
        positionAt: iso(String(gps.updated ?? st.last_update ?? '').replace(' ', 'T') + (gps.updated || st.last_update ? 'Z' : '')),
        ignition,
        state: stateFromWord(st.movement_status) ?? stateFromSpeed(speedKmh, ignition),
        stateSince: iso(String(st.movement_status_update ?? '').replace(' ', 'T') + (st.movement_status_update ? 'Z' : '')),
      };
    });

    return { host, account: null, units };
  },
};

/* ── Samsara ──────────────────────────────────────────────────── */

const SAMSARA_HOST = 'api.samsara.com';

async function samsaraPages(host: string, token: string, path: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let after: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const sep = path.includes('?') ? '&' : '?';
    const { data }: { data: { data?: unknown; pagination?: { endCursor?: string; hasNextPage?: boolean } } } = await getJson<{ data?: unknown; pagination?: { endCursor?: string; hasNextPage?: boolean } }>(
      host,
      `${path}${after ? `${sep}after=${encodeURIComponent(after)}` : ''}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    out.push(...list(data.data));
    if (!data.pagination?.hasNextPage || !data.pagination.endCursor) break;
    after = data.pagination.endCursor;
  }
  return out;
}

const samsara: ProviderSpec = {
  ...PROVIDER_CATALOG.SAMSARA,
  parse: (raw, server) => ({ token: plainToken(16)(raw), hosts: hostsFor(server, SAMSARA_HOST) }),
  async fetch({ token, host }) {
    /* types — не больше трёх за запрос. */
    const [vehicles, a, b] = await Promise.all([
      samsaraPages(host, token, '/fleet/vehicles'),
      samsaraPages(host, token, '/fleet/vehicles/stats?types=gps,fuelPercents,engineStates'),
      samsaraPages(host, token, '/fleet/vehicles/stats?types=obdOdometerMeters,obdEngineSeconds,fuelConsumedMilliliters'),
    ]);
    const statsB = new Map(b.map((s) => [String(s.id), s]));
    const plateOf = new Map(vehicles.map((v) => [String(v.id), text(v.licensePlate, 32)]));

    const units: GpsUnit[] = a.map((s) => {
      const id = String(s.id ?? '');
      const gps = obj(s.gps);
      const extra = statsB.get(id) ?? {};
      const point = coord(gps.latitude, gps.longitude);
      const mph = num(gps.speedMilesPerHour);
      const speedKmh = mph == null ? null : Math.round(mph * 1.609344);
      const engine = String(obj(s.engineState).value ?? '');
      const ignition = engine ? engine !== 'Off' : null;
      const meters = num(obj(extra.obdOdometerMeters).value);
      const seconds = num(obj(extra.obdEngineSeconds).value);
      const ml = num(obj(extra.fuelConsumedMilliliters).value);
      return {
        externalId: id,
        name: text(s.name, 200) ?? id,
        plate: plateOf.get(id) ?? null,
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
        speedKmh,
        course: int(gps.headingDegrees),
        positionAt: iso(gps.time),
        odometerKm: meters == null ? null : Math.round(meters / 1000),
        engineHours: seconds == null ? null : Math.round((seconds / 3600) * 10) / 10,
        ignition,
        fuelLevelPct: pct(obj(s.fuelPercent).value),
        fuelUsedL: ml == null ? null : Math.round(ml / 100) / 10,
        state: engine === 'Idle' ? 'STOPPED' : stateFromSpeed(speedKmh, ignition),
        address: text(obj(gps.reverseGeo).formattedLocation, 200),
      };
    });

    return { host, account: null, units };
  },
};

/* ── Webfleet (WEBFLEET.connect) ──────────────────────────────── */

const WEBFLEET_HOST = 'csv.webfleet.com';

type WebfleetCreds = { account: string; username: string; password: string; apikey: string };

/* Ошибки: 1106 — неверный аккаунт, пользователь или пароль; 1143 — неверный API-ключ; 45 — нет прав; 8014 — у пользователя нет права WEBFLEET.connect. */
const WEBFLEET_KEY_ERRORS = [45, 1101, 1105, 1106, 1143, 8014];

async function webfleetCall(creds: WebfleetCreds, action: string): Promise<Record<string, unknown>[]> {
  const q = new URLSearchParams({
    account: creds.account,
    username: creds.username,
    password: creds.password,
    apikey: creds.apikey,
    lang: 'en',
    action,
    outputformat: 'json',
    useISO8601: 'true',
    useUTF8: 'true',
  });
  const { data } = await getJson<unknown>(WEBFLEET_HOST, `/extern?${q}`);
  const err = obj(data);
  if (typeof err.errorCode === 'number') {
    /* 63 — данных нет: пустой список, не ошибка. */
    if (err.errorCode === 63) return [];
    throw new GpsError(WEBFLEET_KEY_ERRORS.includes(err.errorCode) ? 'KEY' : 'UNREACHABLE', `webfleet ${err.errorCode}`);
  }
  return list(data);
}

const webfleet: ProviderSpec = {
  ...PROVIDER_CATALOG.WEBFLEET,
  parse(raw) {
    let creds: Partial<WebfleetCreds>;
    try {
      creds = JSON.parse(raw) as Partial<WebfleetCreds>;
    } catch {
      throw new GpsError('INPUT', 'webfleet');
    }
    const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const c = { account: clean(creds.account, 100), username: clean(creds.username, 100), password: clean(creds.password, 200), apikey: clean(creds.apikey, 100) };
    if (!c.account || !c.username || !c.password || c.apikey.length < 8) throw new GpsError('INPUT', 'webfleet');
    return { token: JSON.stringify(c), hosts: [WEBFLEET_HOST] };
  },
  async fetch({ token }) {
    const creds = JSON.parse(token) as WebfleetCreds;
    /* Отчёт по объектам — 6 запросов в минуту, по машинам — 10: раз в минуту по одному укладываемся. */
    const objects = await webfleetCall(creds, 'showObjectReportExtern');
    const vehicles = await webfleetCall(creds, 'showVehicleReportExtern').catch(() => []);
    const byNo = new Map(vehicles.map((v) => [String(v.objectno ?? ''), v]));

    const units: GpsUnit[] = objects
      .filter((o) => !o.deleted)
      .map((o) => {
        const id = String(o.objectno ?? o.objectuid ?? '');
        const v = byNo.get(id) ?? {};
        const lat = num(o.latitude_mdeg);
        const lon = num(o.longitude_mdeg);
        const point = lat != null && lon != null ? coord(lat / 1e6, lon / 1e6) : null;
        const speedKmh = int(o.speed);
        const ignition = o.ignition == null ? null : Number(o.ignition) === 1;
        const standstill = o.standstill == null ? null : Number(o.standstill) === 1;
        const meters = num(o.odometer_long);
        const hundreds = num(o.odometer);
        const perMill = num(o.fuellevel);
        const ml = num(o.fuellevel_milliliters);
        const seconds = num(o.engine_operation_time);
        return {
          externalId: id,
          name: text(o.objectname, 200) ?? id,
          plate: text(v.licenseplatenumber, 32),
          lat: point?.lat ?? null,
          lon: point?.lon ?? null,
          speedKmh,
          course: int(o.course),
          positionAt: iso(o.pos_time),
          odometerKm: meters != null ? Math.round(meters / 1000) : hundreds != null ? Math.round(hundreds / 10) : null,
          engineHours: seconds != null ? Math.round((seconds / 3600) * 10) / 10 : null,
          ignition,
          fuelLevelPct: perMill != null ? pct(perMill / 10) : null,
          fuelLevelL: ml != null ? Math.round(ml / 100) / 10 : null,
          tankL: positive(v.fueltanksize),
          state: standstill === false ? 'MOVING' : standstill === true ? (ignition === false ? 'PARKED' : 'STOPPED') : stateFromSpeed(speedKmh, ignition),
          driver: text(o.drivername, 120),
          address: text(o.postext, 200),
        };
      });

    return { host: WEBFLEET_HOST, account: creds.account, units };
  },
};

/* ── ABAX (OAuth; Норвегия, Швеция, Дания, Финляндия) ─────────── */

const abax: ProviderSpec = {
  ...PROVIDER_CATALOG.ABAX,
  /* Запасной путь — свои client id и secret перевозчика (Client Credentials). */
  parse(raw) {
    let c: { cid?: string; cs?: string };
    try {
      c = JSON.parse(raw) as { cid?: string; cs?: string };
    } catch {
      throw new GpsError('INPUT', 'abax');
    }
    const cid = String(c.cid ?? '').trim();
    const cs = String(c.cs ?? '').trim();
    if (cid.length < 8 || cs.length < 8 || cid.length > 200 || cs.length > 400) throw new GpsError('INPUT', 'abax');
    return { token: JSON.stringify({ cid, cs }), hosts: [ABAX_API] };
  },
  async fetch({ token }) {
    const { access, newSecret } = await abaxAccess(token);
    const items: Record<string, unknown>[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const { data } = await getJson<{ items?: unknown; page_size?: number }>(ABAX_API, `/v1/vehicles?page=${page}&page_size=1500`, {
        headers: { authorization: `Bearer ${access}` },
      });
      const batch = list(data.items);
      items.push(...batch);
      if (batch.length < (data.page_size ?? 1500)) break;
    }

    const units: GpsUnit[] = items.map((v) => {
      const loc = obj(v.location);
      const point = coord(loc.latitude, loc.longitude);
      const speedKmh = int(loc.speed);
      const moving = typeof loc.in_movement === 'boolean' ? loc.in_movement : null;
      const id = String(v.id ?? '');
      return {
        externalId: id,
        name: text(v.alias, 200) ?? text(obj(v.license_plate).number, 200) ?? id,
        plate: text(obj(v.license_plate).number, 32),
        lat: point?.lat ?? null,
        lon: point?.lon ?? null,
        speedKmh,
        course: int(loc.course),
        positionAt: iso(loc.timestamp),
        state: moving === true ? 'MOVING' : moving === false ? 'STOPPED' : stateFromSpeed(speedKmh, null),
        driver: text(obj(v.driver).name, 120),
      };
    });

    return { host: ABAX_API, account: null, units, newToken: newSecret };
  },
};

export const PROVIDERS: Record<GpsProvider, ProviderSpec> = {
  WIALON: wialon,
  MAPON: mapon,
  NAVIREC: navirec,
  RUPTELA: ruptela,
  NAVIXY: navixy,
  SAMSARA: samsara,
  WEBFLEET: webfleet,
  ABAX: abax,
};

export function providerSpec(id: string | null | undefined): ProviderSpec {
  return PROVIDERS[(id ?? 'WIALON') as GpsProvider] ?? wialon;
}

/** Проверка ключа и первое чтение: по очереди хосты, неверный ключ — сразу ошибка. */
export async function fetchWithHosts(spec: ProviderSpec, input: ProviderInput, accountRef: string | null, cursor: string | null) {
  if (spec.id === 'WIALON') return fetchWialonUnits(input.token, input.hosts);
  let last: GpsError | null = null;
  for (const host of input.hosts) {
    try {
      return await spec.fetch({ token: input.token, host, accountRef, cursor });
    } catch (e) {
      last = e instanceof GpsError ? e : new GpsError('UNREACHABLE', 'unknown');
      if (last.kind === 'KEY') break;
    }
  }
  throw last ?? new GpsError('UNREACHABLE', 'no host');
}
