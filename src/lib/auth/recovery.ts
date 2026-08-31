'use server';

import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { sendEmail, operatorInbox } from '@/lib/email';
import { recoveryEmail } from '@/lib/email/templates/recovery';
import { getDictionary, isLocale, defaultLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { supabaseSecretKey } from '@/lib/env.server';

/**
 * Запрос на восстановление пароля.
 *
 * Ссылку делает generateLink, а не resetPasswordForEmail. Разница
 * принципиальная: второй отправляет письмо сам, почтой Supabase — с её
 * лимитом в считанные письма в час, чужим отправителем и репутацией, из
 * которой письма падают в спам. Именно поэтому не доходили приглашения.
 * generateLink делает ссылку и молчит; письмо собираем и шлём мы.
 */

export type RecoveryState = { done: boolean; error: string | null };

/** Три письма в час на адрес: человеку хватает, рассылке — нет. */
const PER_EMAIL = { limit: 3, seconds: 3600 };

/** Десять с адреса — на случай, если перебирают чужие ящики с одной машины. */
const PER_IP = { limit: 10, seconds: 3600 };

/**
 * Ответ не быстрее этого.
 *
 * Одинакового текста мало. Если несуществующий адрес отвечает мгновенно,
 * а существующий — после похода в Supabase и Resend, разница во времени
 * сама сообщает, что адрес зарегистрирован. Утечка не хуже разного
 * текста, и её обычно упускают.
 */
const FLOOR_MS = 900;

/**
 * Отпечаток адреса для счётчика.
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

async function allowed(key: string, rule: { limit: number; seconds: number }): Promise<boolean> {
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

export async function requestPasswordReset(
  _previous: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const started = Date.now();

  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getDictionary(locale);

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();

  /*
   * Ответ один и тот же во всех случаях: нашли адрес, не нашли, упёрлись
   * в лимит. Разный текст рассказал бы любому желающему, какие компании
   * уже в системе, — а список клиентов конкуренту мы не выдаём.
   */
  const same: RecoveryState = { done: true, error: null };

  const wait = async () => {
    const left = FLOOR_MS - (Date.now() - started);
    if (left > 0) await new Promise((r) => setTimeout(r, left));
    return same;
  };

  if (!email || !email.includes('@') || email.length > 254) {
    return { done: false, error: t.recovery.badEmail };
  }

  const forwarded = (await headers()).get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';

  if (!(await allowed(`email:${email}`, PER_EMAIL))) return wait();
  if (!(await allowed(`ip:${ip}`, PER_IP))) return wait();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: {
      redirectTo: `${site}/${locale}/auth/confirm?next=${encodeURIComponent(`/${locale}/set-password`)}`,
    },
  });

  const link = data?.properties?.action_link;

  /* Адреса нет в системе — молчим и отвечаем то же самое. */
  if (error || !link) return wait();

  await sendEmail(recoveryEmail({ to: email, link, operatorEmail: operatorInbox() }));

  return wait();
}
