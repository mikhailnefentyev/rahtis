import 'server-only';

import { timingSafeEqual } from 'node:crypto';

/**
 * Запросы шлюза eFTI к RAHTIS (Platform API for Gate).
 *
 * Шлюз Fintraffic приходит со своим клиентским сертификатом (взаимный
 * TLS). Vercel проверять клиентские сертификаты не умеет, поэтому перед
 * приложением стоит прокси (efti.rahtis.eu): он проверяет сертификат
 * шлюза по корню Fintraffic и пересылает запрос сюда с общим секретом
 * в заголовке X-Efti-Proxy-Secret. Без секрета (или если он не задан)
 * маршруты не отвечают — прямой вызов мимо прокси ничего не даст.
 */

export function proxyAuthorized(request: Request): boolean {
  const expected = process.env.EFTI_PROXY_SECRET?.trim();
  const given = request.headers.get('x-efti-proxy-secret')?.trim();
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuidV4 = (value: string | null | undefined): value is string => Boolean(value && UUID.test(value));

const COUNTRY = /^[A-Z]{2}$/;
export const isCountry = (value: string | null | undefined): value is string => Boolean(value && COUNTRY.test(value));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Ошибка в формате RFC 7807 (application/problem+xml), как требует API шлюза. */
export function problem(status: number, title: string, detail?: string): Response {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n<problem xmlns="urn:ietf:rfc:7807">` +
    `<title>${esc(title)}</title><status>${status}</status>${detail ? `<detail>${esc(detail)}</detail>` : ''}</problem>`;
  return new Response(body, { status, headers: { 'Content-Type': 'application/problem+xml; charset=utf-8' } });
}

export function xml(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
