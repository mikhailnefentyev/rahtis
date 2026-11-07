import 'server-only';

/*
 * Соединение с реестром SIIRTO (SYKE): OAuth2 client_credentials, scope
 * siirto.shippingdocuments, API v4. По умолчанию — тестовая среда; рабочая
 * включается переменными, когда SYKE выдаст ключи по договору.
 *
 *   SIIRTO_CLIENT_ID, SIIRTO_CLIENT_SECRET — ключи (без них отправка выключена);
 *   SIIRTO_API_URL   — по умолчанию https://testbed.ymparisto.fi/siirtoasiakirjarekisteri/api,
 *                      рабочий: https://wwwp5.ymparisto.fi/siirto/api;
 *   SIIRTO_TOKEN_URL — по умолчанию https://identitytest.ymparisto.fi/connect/token.
 */

const TEST_API = 'https://testbed.ymparisto.fi/siirtoasiakirjarekisteri/api';
const TEST_TOKEN = 'https://identitytest.ymparisto.fi/connect/token';

export type SiirtoConfig = { clientId: string; clientSecret: string; apiUrl: string; tokenUrl: string; test: boolean };

export function siirtoConfig(): SiirtoConfig | null {
  const clientId = process.env.SIIRTO_CLIENT_ID?.trim();
  const clientSecret = process.env.SIIRTO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const apiUrl = (process.env.SIIRTO_API_URL?.trim() || TEST_API).replace(/\/+$/, '');
  return { clientId, clientSecret, apiUrl, tokenUrl: process.env.SIIRTO_TOKEN_URL?.trim() || TEST_TOKEN, test: apiUrl === TEST_API };
}

let cached: { token: string; until: number; key: string } | null = null;

async function token(config: SiirtoConfig): Promise<string> {
  const key = `${config.tokenUrl}|${config.clientId}`;
  if (cached && cached.key === key && cached.until > Date.now() + 30_000) return cached.token;
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: 'siirto.shippingdocuments',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new SiirtoError(`token HTTP ${response.status}`, response.status);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new SiirtoError('token: no access_token', 0);
  cached = { token: data.access_token, until: Date.now() + (data.expires_in ?? 300) * 1000, key };
  return data.access_token;
}

export class SiirtoError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Ответ реестра об ошибке — коротко, для журнала и экрана (ProblemDetails / ошибки проверки). */
async function problem(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  try {
    const p = JSON.parse(text) as { title?: string; detail?: string; errors?: Record<string, string[]> };
    const fields = p.errors ? Object.entries(p.errors).map(([k, v]) => `${k}: ${v.join(' ')}`).join('; ') : '';
    return [p.title, p.detail, fields].filter(Boolean).join(' — ').slice(0, 900) || `HTTP ${response.status}`;
  } catch {
    return (text || `HTTP ${response.status}`).slice(0, 900);
  }
}

async function call(config: SiirtoConfig, method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<string> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${await token(config)}`,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new SiirtoError(await problem(response), response.status);
  return (await response.text()).replace(/^"|"$/g, '');
}

/** Новый документ → его id в реестре. */
export function createShippingDocument(config: SiirtoConfig, body: Record<string, unknown>): Promise<string> {
  return call(config, 'POST', '/api/v4/shippingdocuments', body);
}

/** Правка (до 90 дней после приёма). */
export function updateShippingDocument(config: SiirtoConfig, id: string, body: Record<string, unknown>): Promise<string> {
  return call(config, 'PUT', `/api/v4/shippingdocuments/${encodeURIComponent(id)}`, body);
}

/** Удаление (те же 90 дней). */
export async function deleteShippingDocument(config: SiirtoConfig, id: string): Promise<void> {
  await call(config, 'DELETE', `/api/v4/shippingdocuments/${encodeURIComponent(id)}`);
}
