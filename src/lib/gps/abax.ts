import 'server-only';

import { GpsError, httpsCall } from './http';

/**
 * ABAX: вход по OAuth 2 (identity.abax.cloud) и Open API (api.abax.cloud).
 *
 * Два способа:
 *  · «Подключить ABAX» — Authorization Code: перевозчик входит у ABAX
 *    администратором и даёт доступ приложению RAHTIS. Нужны ABAX_CLIENT_ID
 *    и ABAX_CLIENT_SECRET приложения RAHTIS с портала разработчиков ABAX и
 *    адрес возврата https://www.rahtis.eu/api/gps/abax/callback там же.
 *    Секрет подключения — refresh token; ABAX выдаёт новый при каждом
 *    обновлении, его надо сохранить (newToken).
 *  · Свои client id и secret перевозчика — Client Credentials, если ABAX
 *    включил этот способ для его организации (по умолчанию выключен).
 *
 * Пример ABAX: github.com/abax-as/abax-api-samples; поля машин — из
 * спецификации на developers.abax.cloud (29.10.2026).
 */

export const ABAX_IDENTITY = 'identity.abax.cloud';
export const ABAX_API = 'api.abax.cloud';

/* offline_access — чтобы получить refresh token. */
export const ABAX_SCOPES = 'openid abax_profile open_api open_api.vehicles offline_access';
const CLIENT_SCOPES = 'open_api open_api.vehicles';

export type AbaxSecret = { rt: string } | { cid: string; cs: string };

export function abaxApp(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.ABAX_CLIENT_ID?.trim();
  const clientSecret = process.env.ABAX_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function abaxRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/gps/abax/callback`;
}

export function abaxAuthorizeUrl(origin: string, state: string): string | null {
  const app = abaxApp();
  if (!app) return null;
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: app.clientId,
    scope: ABAX_SCOPES,
    redirect_uri: abaxRedirectUri(origin),
    state,
  });
  return `https://${ABAX_IDENTITY}/connect/authorize?${q}`;
}

type TokenResponse = { access_token?: string; refresh_token?: string; error?: string };

async function token(form: Record<string, string>): Promise<TokenResponse> {
  let res;
  try {
    res = await httpsCall(ABAX_IDENTITY, '/connect/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
  } catch {
    throw new GpsError('UNREACHABLE', 'abax token');
  }
  let data: TokenResponse = {};
  try {
    data = JSON.parse(res.text) as TokenResponse;
  } catch {
    /* ниже — по коду ответа */
  }
  /* 400 invalid_grant / invalid_client — ключ больше не годится. */
  if (res.status === 400 || res.status === 401) throw new GpsError('KEY', `abax ${data.error ?? res.status}`);
  if (res.status < 200 || res.status >= 300 || !data.access_token) throw new GpsError('UNREACHABLE', `abax http ${res.status}`);
  return data;
}

/** Код из возврата → refresh token (для Vault). */
export async function abaxRedeemCode(code: string, origin: string): Promise<string> {
  const app = abaxApp();
  if (!app) throw new GpsError('INPUT', 'abax app not configured');
  const t = await token({
    grant_type: 'authorization_code',
    code,
    client_id: app.clientId,
    client_secret: app.clientSecret,
    redirect_uri: abaxRedirectUri(origin),
  });
  if (!t.refresh_token) throw new GpsError('KEY', 'abax no refresh token');
  return JSON.stringify({ rt: t.refresh_token } satisfies AbaxSecret);
}

/** Секрет подключения → access token (и новый секрет, если ABAX его сменил). */
export async function abaxAccess(secretRaw: string): Promise<{ access: string; newSecret: string | null }> {
  let secret: AbaxSecret;
  try {
    secret = JSON.parse(secretRaw) as AbaxSecret;
  } catch {
    throw new GpsError('INPUT', 'abax secret');
  }
  if ('cid' in secret) {
    const t = await token({ grant_type: 'client_credentials', scope: CLIENT_SCOPES, client_id: secret.cid, client_secret: secret.cs });
    return { access: t.access_token!, newSecret: null };
  }
  const app = abaxApp();
  if (!app) throw new GpsError('UNREACHABLE', 'abax app not configured');
  const t = await token({ grant_type: 'refresh_token', refresh_token: secret.rt, client_id: app.clientId, client_secret: app.clientSecret });
  const rotated = t.refresh_token && t.refresh_token !== secret.rt ? JSON.stringify({ rt: t.refresh_token } satisfies AbaxSecret) : null;
  return { access: t.access_token!, newSecret: rotated };
}
