import 'server-only';

import { request } from 'node:https';
import { randomUUID } from 'node:crypto';

/**
 * Обращения RAHTIS к шлюзу eFTI Fintraffic (Gate API for Platform, v1).
 *
 * Взаимный TLS: шлюз узнаёт нас по клиентскому сертификату, который
 * Fintraffic подписывает по нашему запросу (CSR), а мы проверяем шлюз по
 * его корневому сертификату. Ключ и сертификаты — в переменных окружения
 * (PEM), в коде и в базе их нет:
 *   EFTI_GATE_URL     — адрес шлюза (тестовый — из письма Fintraffic);
 *   EFTI_CLIENT_CERT  — наш клиентский сертификат;
 *   EFTI_CLIENT_KEY   — наш закрытый ключ;
 *   EFTI_GATE_CA      — корневой сертификат шлюза.
 * Пока переменных нет, eFTI выключен: вызовы возвращают NOT_CONFIGURED.
 */

export type GateConfig = { url: URL; cert: string; key: string; ca: string };

/* Переводы строк в PEM из переменных окружения часто приходят как «\n». */
const pem = (value: string | undefined) => value?.replace(/\\n/g, '\n').trim() || null;

export function gateConfig(): GateConfig | null {
  const url = process.env.EFTI_GATE_URL?.trim();
  const cert = pem(process.env.EFTI_CLIENT_CERT);
  const key = pem(process.env.EFTI_CLIENT_KEY);
  const ca = pem(process.env.EFTI_GATE_CA);
  if (!url || !cert || !key || !ca) return null;
  return { url: new URL(url), cert, key, ca };
}

export type GateResponse = { status: number; body: string; requestId: string };

function call(config: GateConfig, method: 'GET' | 'PUT', path: string, body?: string): Promise<GateResponse> {
  const requestId = randomUUID();
  const target = new URL(path.replace(/^\//, ''), config.url.href.endsWith('/') ? config.url : new URL(`${config.url.href}/`));
  return new Promise((resolve, reject) => {
    const req = request(
      target,
      {
        method,
        cert: config.cert,
        key: config.key,
        ca: config.ca,
        timeout: 30_000,
        headers: {
          'X-Request-ID': requestId,
          Accept: 'application/xml',
          ...(body ? { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), requestId }));
      },
    );
    req.on('timeout', () => req.destroy(new Error('eFTI gate timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Кто мы для шлюза (проверка подключения). */
export function whoami(config: GateConfig): Promise<GateResponse> {
  return call(config, 'GET', '/v1/whoami');
}

/** Загрузить или обновить идентификаторы перевозки (FTI004). */
export function putIdentifiers(config: GateConfig, datasetId: string, xml: string): Promise<GateResponse> {
  return call(config, 'PUT', `/v1/consignments/${encodeURIComponent(datasetId)}`, xml);
}

/** UIL из ответа шлюза: gateId и platformId (datasetId — наш). Без XML-парсера: три простых тега. */
export function parseUil(xml: string): { gateId: string; platformId: string; datasetId: string } | null {
  const pick = (tag: string) => xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}>\\s*([^<\\s]+)\\s*</(?:[\\w-]+:)?${tag}>`))?.[1] ?? null;
  const gateId = pick('gateId');
  const platformId = pick('platformId');
  const datasetId = pick('datasetId');
  return gateId && platformId && datasetId ? { gateId, platformId, datasetId } : null;
}
