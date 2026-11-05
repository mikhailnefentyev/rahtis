import 'server-only';

import { agentSecret, signOutgoing } from '@/lib/agent/signature';

/**
 * Разбор месячного отчёта заправщика через n8n (workflow
 * rahtis-fuel-report.json, узел OpenAI). Подпись та же, что у перевода и
 * ассистента: AGENT_WEBHOOK_SECRET.
 *
 * PDF уходит файлом (base64), CSV — текстом. Номера машин компании идут
 * подсказкой: по ним разбор узнаёт, где в отчёте номер машины.
 *
 * Суммы — в валюте отчёта, у каждой строки свой код валюты (карта DKV
 * польской машины в Германии — евро). Валюта компании идёт подсказкой.
 *
 * Не настроено — 'not_configured', не ответило или ответило не тем —
 * 'failed': перевозчик видит, что отчёт не распознан, и может внести
 * заправки вручную.
 */

export type ExtractResult =
  | { ok: true; supplier: string | null; rows: unknown[] }
  | { ok: false; reason: 'not_configured' | 'failed' };

export async function extractFuelReport(input: {
  fileName: string;
  mime: string;
  bytes: ArrayBuffer;
  plates: string[];
  country: string;
  /** Рабочая валюта компании — подсказка, если в отчёте валюта не названа. */
  currency: string;
}): Promise<ExtractResult> {
  const url = process.env.N8N_FUEL_WEBHOOK_URL?.trim();
  const secret = agentSecret();
  if (!url || !secret) return { ok: false, reason: 'not_configured' };

  const buffer = Buffer.from(input.bytes);
  const isPdf = input.mime === 'application/pdf';
  const body = JSON.stringify({
    file_name: input.fileName.slice(0, 120),
    mime: isPdf ? 'application/pdf' : 'text/csv',
    data_base64: isPdf ? buffer.toString('base64') : undefined,
    /* CSV: кодировку угадываем — Neste отдаёт UTF-8, старые выгрузки бывают в Windows-1252. */
    text: isPdf ? undefined : decodeText(buffer).slice(0, 200_000),
    plates: input.plates.slice(0, 300),
    country: input.country,
    currency: input.currency,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: signOutgoing(secret, body),
      body,
      /* Отчёт на сотню строк модель читает до минуты. */
      signal: AbortSignal.timeout(110_000),
    });
    if (!response.ok) return { ok: false, reason: 'failed' };
    const data = (await response.json()) as { ok?: boolean; supplier?: unknown; rows?: unknown };
    if (!data.ok || !Array.isArray(data.rows)) return { ok: false, reason: 'failed' };
    return {
      ok: true,
      supplier: typeof data.supplier === 'string' ? data.supplier.slice(0, 60) : null,
      rows: data.rows,
    };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

function decodeText(buffer: Buffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  /* Символ замены — признак, что это не UTF-8. */
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buffer) : utf8;
}
