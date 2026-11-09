import 'server-only';

import { headers } from 'next/headers';
import { after } from 'next/server';
import { APP, siteUrl } from '@/lib/config';
import { operatorInbox, sendEmail } from '@/lib/email';
import { signInAlertEmail } from '@/lib/email/templates/signInAlert';
import { emailLocaleOf } from '@/lib/email/text';
import { createFormat } from '@/lib/format';
import { getDictionary, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { clientIp, throttleAllowed } from './throttle';
import {
  cityName,
  countryCode,
  describeDevice,
  deviceFingerprint,
  ipPrefix,
  shouldAlert,
} from './twoStep';
import type { Viewer } from './viewer';

/*
 * Двухэтапный вход на сервере (6.11.2026): проверка кода, «подтвердите
 * кодом» перед важными действиями и запись устройств входа.
 */

export type CodeResult = 'ok' | 'wrong' | 'throttled' | 'failed';

/** Первый подтверждённый TOTP-фактор вошедшего — по ответу сервера Supabase. */
export async function verifiedTotpFactor(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const factor = (user?.factors ?? []).find((f) => f.status === 'verified' && f.factor_type === 'totp');
  return factor?.id ?? null;
}

/**
 * Проверка кода из приложения: новая сессия aal2 ложится в куки. Перебор
 * шести цифр — ограничен: десять попыток за 15 минут на пользователя.
 */
export async function verifyCode(code: string, factorId?: string | null): Promise<CodeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 'failed';

  if (!(await throttleAllowed(`mfa:${user.id}`, { limit: 10, seconds: 900 }))) return 'throttled';

  const id = factorId ?? (user.factors ?? []).find((f) => f.status === 'verified' && f.factor_type === 'totp')?.id;
  if (!id) return 'failed';

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code });
  if (!error) return 'ok';
  if (error.code === 'mfa_verification_failed' || error.code === 'mfa_challenge_expired' || error.status === 422) return 'wrong';
  console.error('mfa verify:', error.code, error.message);
  return 'failed';
}

/**
 * Важное действие (счёт, почта, люди компании, сам двухэтапный вход):
 * у кого он включён — код не старше 15 минут. Без двухэтапного входа —
 * как раньше, пароль уже проверен входом.
 */
export async function stepUpRequired(viewer: Viewer): Promise<boolean> {
  // Двухэтапный вход убран 09.11.2026: важные действия — по паролю входа.
  void viewer;
  return false;
}

/**
 * Вход состоялся: запомнить устройство и, если оно новое, сказать
 * человеку — письмом и в кабинете. Устройство — отпечаток браузера
 * (sha256), адрес — только префикс /24, страна — по заголовку Vercel.
 * Ошибки здесь вход не ломают.
 */
export async function recordSignIn(locale: Locale): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const h = await headers();
    const ua = h.get('user-agent');
    const fingerprint = deviceFingerprint(ua, h.get('accept-language'));
    const label = describeDevice(ua) ?? '—';
    const prefix = ipPrefix(await clientIp());
    const country = countryCode(h.get('x-vercel-ip-country'));
    const city = cityName(h.get('x-vercel-ip-city'));

    const { data: rows, error } = await supabase
      .from('sign_in_devices')
      .select('id, fingerprint')
      .eq('user_id', user.id)
      .limit(200);
    /* До миграции таблицы нет — вход без записи. */
    if (error) return;

    const now = new Date().toISOString();
    const same = (rows ?? []).find((r) => r.fingerprint === fingerprint);
    const write = same
      ? await supabase.from('sign_in_devices').update({ last_seen: now, ip_prefix: prefix, country, label }).eq('id', same.id)
      : await supabase.from('sign_in_devices').insert({ user_id: user.id, fingerprint, label, ip_prefix: prefix, country });
    if (write.error) console.error('устройство входа не записано:', write.error.message);

    if (!shouldAlert((rows ?? []).map((r) => r.fingerprint), fingerprint)) return;

    const userId = user.id;
    const email = user.email ?? null;
    after(() => alertNewDevice({ userId, email, locale, device: label, country, city, at: now }));
  } catch (cause) {
    console.error('запись входа:', cause);
  }
}

async function alertNewDevice(input: {
  userId: string;
  email: string | null;
  locale: Locale;
  device: string;
  country: string | null;
  city: string | null;
  at: string;
}): Promise<void> {
  const t = await getDictionary(input.locale);
  const intl = t.meta.intl;
  const region = (code: string) => {
    try {
      return new Intl.DisplayNames([intl], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const place = input.country ? [input.city, region(input.country)].filter(Boolean).join(', ') : t.twoStep.unknownPlace;

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('company_id').eq('id', input.userId).maybeSingle();

  /* В кабинете — лично этому человеку; заголовок по коду, на языке читающего. */
  if (profile?.company_id) {
    const { error } = await admin.from('notifications').insert({
      company_id: profile.company_id,
      user_id: input.userId,
      kind: 'SECURITY',
      code: 'auth.newDevice',
      params: { device: input.device, place },
      title: t.twoStep.alertTitle,
      body: t.twoStep.alertAdvice,
      link: '/account',
    });
    if (error) console.error('уведомление о входе не записано:', error.message);
  }

  if (!input.email) return;
  const mailLocale = emailLocaleOf(input.locale);
  const mailIntl = mailLocale === 'fi' ? 'fi-FI' : 'en-GB';
  const mailPlace = input.country
    ? [input.city, new Intl.DisplayNames([mailIntl], { type: 'region' }).of(input.country) ?? input.country].filter(Boolean).join(', ')
    : mailLocale === 'fi'
      ? 'tuntematon'
      : 'unknown';
  await sendEmail(
    signInAlertEmail({
      to: input.email,
      locale: mailLocale,
      device: input.device,
      place: mailPlace,
      when: createFormat(mailIntl).dateTime(input.at),
      link: `${siteUrl()}/${input.locale}/account`,
      support: APP.operator.email,
      operatorEmail: operatorInbox(),
    }),
  );
}
