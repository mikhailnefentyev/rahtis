import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { recordIncident } from '@/lib/incidents/record';
import { hashKey, looksLikeKey } from './key';

/**
 * Общая обвязка маршрутов /api/v1: ключ, права, частота, журнал, ошибки.
 *
 * Ответы — JSON с английскими кодами: их читает программа заказчика, а не
 * человек, и код ошибки должен быть стабильным, чтобы по нему ветвиться.
 *
 * Каждый запрос с узнанным ключом пишется в журнал (метод, путь без
 * параметров, код, время). Запрос с неузнанным ключом не пишется: ключа,
 * к которому его привязать, нет, а сами попытки подбора видит хостинг.
 */

export type ApiContext = {
  keyId: string;
  companyId: string;
  userId: string;
  scope: 'READ' | 'WRITE';
  isTest: boolean;
};

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'not_found'
  | 'bad_request'
  | 'internal';

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  rate_limited: 429,
  not_found: 404,
  bad_request: 400,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function apiError(code: ApiErrorCode, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status: STATUS[code], headers });
}

const RATE_LIMIT = 60;

type RouteParams = Record<string, string>;

export function withApi<P extends RouteParams = RouteParams>(
  scope: 'READ' | 'WRITE',
  handler: (ctx: ApiContext, request: Request, params: P) => Promise<Response>,
) {
  return async (request: Request, route: { params: Promise<P> }): Promise<Response> => {
    const started = Date.now();
    const header = request.headers.get('authorization') ?? '';
    const key = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

    if (!looksLikeKey(key)) {
      return apiError('unauthorized', 'Missing or malformed API key. Use: Authorization: Bearer rhs_live_…');
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('api_authenticate', { p_hash: hashKey(key) });
    const row = data?.[0];

    if (error) {
      await recordIncident({ source: 'route', error, path: '/api/v1' });
      return apiError('internal', 'Authentication is temporarily unavailable.');
    }
    if (!row) {
      return apiError('unauthorized', 'Unknown, revoked or inactive API key.');
    }

    const ctx: ApiContext = {
      keyId: row.key_id,
      companyId: row.company_id,
      userId: row.user_id,
      scope: row.scope,
      isTest: row.is_test,
    };
    const path = new URL(request.url).pathname;

    let response: Response;
    if (row.limited) {
      response = apiError('rate_limited', `Limit is ${RATE_LIMIT} requests per minute per key.`, {
        'Retry-After': '60',
      });
    } else if (scope === 'WRITE' && ctx.scope !== 'WRITE') {
      response = apiError('forbidden', 'This key is read-only.');
    } else {
      try {
        response = await handler(ctx, request, await route.params);
      } catch (cause) {
        if (cause instanceof ApiError) {
          response = apiError(cause.code, cause.message);
        } else {
          await recordIncident({ source: 'route', error: cause, path: '/api/v1' });
          response = apiError('internal', 'Unexpected error. The request was not completed.');
        }
      }
    }

    response.headers.set('RateLimit-Limit', String(RATE_LIMIT));
    if (ctx.isTest) response.headers.set('Rahtis-Environment', 'test');

    await admin.rpc('api_log', {
      p_key_id: ctx.keyId,
      p_method: request.method,
      p_path: path,
      p_status: response.status,
      p_duration_ms: Date.now() - started,
    });

    return response;
  };
}
