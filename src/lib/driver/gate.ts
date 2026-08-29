import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { recordIncident } from '@/lib/incidents/record';

/**
 * Вход для агента водителя.
 *
 * Секрет свой, а не общий с инструментами кабинетов. Разница не в
 * паранойе: это два разных воркфлоу у разного круга людей, и утёкший
 * секрет одного не должен открывать второй. Воркфлоу водителя вдобавок
 * умеет писать — единственная запись во всём наборе, — и цена его утечки
 * выше.
 *
 * Секрет не задан — эндпоинт закрыт. Незаполненная настройка означает
 * «не пускать никого», а не «пускать всех»: обратное умолчание однажды
 * открыло бы боевой сайт после переноса окружения.
 */

const WINDOW_SECONDS = 300;

export function driverSecret(): string | null {
  return process.env.DRIVER_WEBHOOK_SECRET?.trim() || null;
}

export type GateResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; reason: string };

/**
 * Проверка подписи и разбор тела.
 *
 * Тело читается один раз строкой и подписывается целиком: подпись
 * обязана считаться от тех же байтов, которые мы потом разбираем. Если
 * сначала распарсить, а подписывать пересобранный JSON, подпись начнёт
 * зависеть от порядка ключей и формата чисел.
 */
export async function openGate(request: Request, path: string): Promise<GateResult> {
  const secret = driverSecret();
  if (!secret) {
    return { ok: false, status: 503, reason: 'DRIVER_WEBHOOK_SECRET is not set' };
  }

  const raw = await request.text();

  const timestamp = request.headers.get('x-rahtis-timestamp');
  const signature = request.headers.get('x-rahtis-signature');

  if (!timestamp || !signature) {
    return refuse(path, 401, 'missing signature headers');
  }

  /*
   * Метка времени входит в подпись, поэтому перехваченный запрос нельзя
   * повторить назавтра. Окно узкое намеренно: у машины нет причин
   * доставлять запрос дольше пяти минут, а у нападающего есть причина
   * ждать.
   */
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > WINDOW_SECONDS) {
    return refuse(path, 401, 'timestamp outside the allowed window');
  }

  const expected = Buffer.from(
    `sha256=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`,
  );
  const given = Buffer.from(signature);

  /*
   * Сравнение постоянного времени: обычное === на строках выходит на
   * первом несовпавшем байте, и по времени ответа подпись подбирается
   * побайтово.
   */
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return refuse(path, 401, 'signature mismatch');
  }

  try {
    return { ok: true, body: raw ? JSON.parse(raw) : {} };
  } catch {
    return refuse(path, 400, 'body is not valid JSON');
  }
}

/**
 * Отказ записывается в журнал сбоев.
 *
 * Не ради охраны — подпись и так не пропустила, — а ради отладки
 * воркфлоу: «n8n молчит» и «n8n стучится с просроченной меткой» это
 * разные поломки, и различить их иначе нечем. Телефон в журнал не
 * попадает: пишется только путь и причина.
 */
function refuse(path: string, status: number, reason: string): GateResult {
  void recordIncident({
    source: 'agent',
    severity: 'WARN',
    path,
    error: Object.assign(new Error(reason), { name: 'DriverGateRefused' }),
  });

  return { ok: false, status, reason };
}

/** Ответ машине, а не человеку, поэтому по-английски и без подробностей. */
export function gateResponse(result: Extract<GateResult, { ok: false }>): Response {
  return Response.json({ error: result.reason }, { status: result.status });
}
