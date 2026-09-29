import 'server-only';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { supabaseSecretKey } from '@/lib/env.server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Ограничитель частоты для открытых форм: восстановление пароля, заявка.
 *
 * Счётчик — app.auth_throttle через auth_throttle_hit, окно скользящее,
 * записи старше суток чистит задание prune-auth-throttle.
 */

export type ThrottleRule = { limit: number; seconds: number };

/**
 * Отпечаток ключа для счётчика.
 *
 * HMAC с серверным ключом, а не голый хэш: утёкшая таблица со списком
 * sha256 от почты перебирается по словарю адресов за минуты, с ключом —
 * не перебирается вовсе.
 */
function fingerprint(value: string): string {
  return createHmac('sha256', supabaseSecretKey())
    .update(value.trim().toLowerCase())
    .digest('hex')
    .slice(0, 48);
}

export async function throttleAllowed(key: string, rule: ThrottleRule): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc('auth_throttle_hit', {
    p_key_hash: fingerprint(key),
    p_limit: rule.limit,
    p_window_seconds: rule.seconds,
  });

  /*
   * Счётчик недоступен — пускаем. Сломанный ограничитель не должен
   * оставлять людей без возможности войти; злоупотребление в эти минуты
   * дешевле, чем запертый кабинет.
   */
  if (error) {
    console.error('throttle:', error.message);
    return true;
  }

  return data !== false;
}

/** Адрес клиента за прокси Vercel: первый в x-forwarded-for. */
export async function clientIp(): Promise<string> {
  const forwarded = (await headers()).get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
