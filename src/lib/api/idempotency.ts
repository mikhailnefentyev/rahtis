import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { bodyHash } from './create';
import { ApiError, type ApiContext } from './handler';

/**
 * Idempotency-Key: повтор того же запроса возвращает тот же ответ.
 *
 * Связь оборвалась после того, как заказ создан, программа заказчика
 * повторяет запрос — и получает первый заказ, а не второй. Строка
 * занимается до работы (PENDING), поэтому два одновременных повтора не
 * создадут два заказа: второй получит 409 и повторит позже.
 *
 * Если работа закончилась ошибкой, строка удаляется: исправленный запрос
 * с тем же ключом должен пройти. Ключ помнится сутки.
 */
export async function idempotent(
  ctx: ApiContext,
  request: Request,
  raw: string,
  run: () => Promise<{ status: number; body: unknown }>,
): Promise<Response> {
  const idemKey = request.headers.get('idempotency-key')?.trim();
  if (!idemKey) {
    const result = await run();
    return Response.json(result.body, { status: result.status });
  }
  if (idemKey.length > 100) throw new ApiError('bad_request', 'Idempotency-Key must be at most 100 characters.');

  const admin = createAdminClient();
  const hash = bodyHash(`${request.method} ${new URL(request.url).pathname}\n${raw}`);

  const { error: claimError } = await admin
    .from('api_idempotency')
    .insert({ key_id: ctx.keyId, idem_key: idemKey, request_hash: hash });

  if (claimError) {
    if (claimError.code !== '23505') throw claimError;

    const { data: seen, error: seenError } = await admin
      .from('api_idempotency')
      .select('request_hash,status,http_status,response')
      .eq('key_id', ctx.keyId)
      .eq('idem_key', idemKey)
      .maybeSingle();
    if (seenError) throw seenError;
    if (!seen) throw new ApiError('conflict', 'The same Idempotency-Key is being processed. Retry shortly.');
    if (seen.request_hash !== hash) {
      throw new ApiError('unprocessable', 'This Idempotency-Key was already used with a different request.');
    }
    if (seen.status !== 'DONE') {
      throw new ApiError('conflict', 'The same Idempotency-Key is being processed. Retry shortly.');
    }
    return Response.json(seen.response, {
      status: seen.http_status ?? 200,
      headers: { 'Idempotent-Replayed': 'true' },
    });
  }

  try {
    const result = await run();
    await admin
      .from('api_idempotency')
      .update({ status: 'DONE', http_status: result.status, response: result.body as never })
      .eq('key_id', ctx.keyId)
      .eq('idem_key', idemKey);
    return Response.json(result.body, { status: result.status });
  } catch (cause) {
    await admin.from('api_idempotency').delete().eq('key_id', ctx.keyId).eq('idem_key', idemKey);
    throw cause;
  }
}

/** Тело запроса — JSON-объект или пусто; иначе 400. */
export function parseJson(raw: string, required: boolean): unknown {
  if (!raw.trim()) {
    if (required) throw new ApiError('bad_request', 'Request body must be a JSON object.');
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError('bad_request', 'Request body is not valid JSON.');
  }
}
