'use server';

import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { recordIncident } from '@/lib/incidents/record';
import { getDictionary, isLocale, type Dictionary, type Locale, defaultLocale } from '@/lib/i18n';
import { recordSignIn } from './mfa';
import { cabinetPath, noAccessPath, safeRedirect, signInPath, twoStepSetupPath } from './paths';
import { clientIp, throttleAllowed } from './throttle';
import { getViewer, type Viewer } from './viewer';

/** code — пароль верный, нужен код из приложения (двухэтапный вход). */
export type SignInState = { error: string | null; code?: boolean };

/** Куда вести того, кто только что вошёл. */
function landingFor(locale: Locale, viewer: Viewer): string {
  if (viewer.status === 'ready') return cabinetPath(locale, viewer.role);
  if (viewer.status === 'mfa') return viewer.step === 'code' ? signInPath(locale) : twoStepSetupPath(locale);
  return noAccessPath(locale);
}

/**
 * Вход по почте и паролю.
 *
 * Открытой регистрации нет: пользователь появляется только по приглашению,
 * которое оператор отправляет при одобрении компании. Пароль пользователь
 * задаёт сам по ссылке из письма — мы его не видим и не храним.
 */
export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getDictionary(locale);

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: t.auth.fillBoth };
  }

  /*
   * Перебор пароля. Вход идёт с сервера, поэтому Supabase видит один и тот
   * же адрес для всех посетителей: его собственный лимит по IP не отличает
   * перебирающего от остальных — либо не срабатывает, либо закрывает вход
   * всем сразу (прогон 12.10.2026: восемь неверных входов подряд без
   * задержки). Считаем сами: по паре «адрес почты + адрес посетителя» —
   * так чужой перебор не запирает владельца учётной записи, — и по
   * адресу посетителя в целом.
   */
  const ip = await clientIp();
  const allowed =
    (await throttleAllowed(`signin:${email}:${ip}`, { limit: 8, seconds: 900 })) &&
    (await throttleAllowed(`signin-ip:${ip}`, { limit: 40, seconds: 900 }));
  if (!allowed) return { error: t.auth.tooManyAttempts };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    /*
     * Отказ в доступе и отказ службы — разные вещи, и путать их дорого.
     *
     * Раньше здесь на любую ошибку отвечали «неверный пароль». Однажды
     * на боевом сайте оказался неверный адрес Supabase: запросы уходили
     * в никуда, и сайт всем подряд сообщал, что у них неправильный
     * пароль. Люди меняли пароли, пароли не помогали, а причина была не
     * в них. Полдня ушло на то, что видно из одной строки лога.
     *
     * Различаем по коду: 400 и 422 — это ответ Supabase «не сходится
     * логин или пароль», всё остальное означает, что мы до него не
     * доехали.
     */
    const refused = error.status === 400 || error.status === 422;

    if (!refused) {
      void recordIncident({ source: 'action', path: '/signin', error });
      return { error: t.auth.serviceDown };
    }

    /*
     * Ответ намеренно одинаковый для «нет такого пользователя» и «неверный
     * пароль». Разные формулировки позволили бы перебором выяснить, какие
     * компании зарегистрированы на площадке.
     */
    return { error: t.auth.invalidCredentials };
  }

  const viewer = await getViewer();

  /* Двухэтапный вход включён — та же форма спрашивает код. */
  if (viewer.status === 'mfa' && viewer.step === 'code') return { error: null, code: true };

  await recordSignIn(locale);

  /* Оператор без двухэтапного входа — сначала подключить его, next подождёт. */
  if (viewer.status === 'mfa') redirect(twoStepSetupPath(locale));

  redirect(safeRedirect(String(formData.get('next') ?? ''), landingFor(locale, viewer)));
}

export type SetPasswordState = { error: string | null };

/* Отказ сервиса входа приходит по-английски — пользователю отвечаем из словаря. */
function passwordRefusal(t: Dictionary, code: string | undefined): string {
  if (code === 'weak_password') return t.invite.weak;
  if (code === 'same_password') return t.account.sameAsOld;
  return t.error.generic;
}

/**
 * Пароль после приглашения.
 *
 * Сюда попадают уже с сессией: ссылка из письма её создала. Пароль
 * задаётся один раз самим пользователем — оператор его не видит и не
 * пересылает, поэтому и утечь по почте нечему.
 */
export async function setPasswordAction(
  _previous: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getDictionary(locale);

  const password = String(formData.get('password') ?? '');
  const repeat = String(formData.get('repeat') ?? '');

  if (password.length < 8) return { error: t.invite.tooShort };
  if (password !== repeat) return { error: t.invite.mismatch };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: passwordRefusal(t, error.code) };

  const viewer = await getViewer();
  redirect(landingFor(locale, viewer));
}

export type ChangePasswordState = { error: string | null; done: boolean };

/**
 * Смена пароля вошедшим пользователем.
 *
 * Текущий пароль спрашивается не для проформы. Сессия живёт в куке и
 * переживает закрытие вкладки: без этой проверки любой, кто добрался до
 * незапертого компьютера диспетчера, сменил бы пароль и забрал доступ к
 * заказам компании. Проверка стоит один вход по паролю — Supabase другого
 * способа подтвердить владельца сессии паролем не даёт.
 *
 * Успешный вход заодно обновляет куки сессии. Это не побочный эффект, а
 * то, что нужно: дальше пароль меняется у того же пользователя.
 */
export async function changePasswordAction(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getDictionary(locale);

  const current = String(formData.get('current') ?? '');
  const password = String(formData.get('password') ?? '');
  const repeat = String(formData.get('repeat') ?? '');

  if (password.length < 8) return { error: t.invite.tooShort, done: false };
  if (password !== repeat) return { error: t.invite.mismatch, done: false };
  if (password === current) return { error: t.account.sameAsOld, done: false };

  const viewer = await getViewer();
  if (viewer.status === 'guest' || viewer.status === 'mfa' || !viewer.email) {
    return { error: t.error.forbidden, done: false };
  }

  /*
   * Текущий пароль проверяется отдельным клиентом без кук (6.11.2026).
   * Вход тем же клиентом подменял сессию новой, aal1, — у кого включён
   * двухэтапный вход, после этого Supabase отказывал в смене пароля
   * (insufficient_aal), а сам человек оказывался на шаге кода. Пробная
   * сессия тут же гасится.
   */
  const probe = createSupabaseClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: wrong } = await probe.auth.signInWithPassword({
    email: viewer.email,
    password: current,
  });
  if (wrong) return { error: t.account.wrongCurrent, done: false };
  await probe.auth.signOut({ scope: 'local' });

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: passwordRefusal(t, error.code), done: false };

  return { error: null, done: true };
}

export async function signOutAction(formData: FormData): Promise<void> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect(signInPath(locale));
}

/**
 * Уводит уже вошедшего пользователя со страницы входа в его кабинет.
 * true — пароль или ссылка уже пройдены, ждём код: страница входа
 * показывает шаг кода.
 */
export async function redirectIfSignedIn(locale: Locale): Promise<boolean> {
  const viewer = await getViewer();

  if (viewer.status === 'mfa') {
    if (viewer.step === 'code') return true;
    redirect(twoStepSetupPath(locale));
  }

  if (viewer.status === 'ready') {
    redirect(cabinetPath(locale, viewer.role));
  }
  if (viewer.status === 'orphan') {
    redirect(noAccessPath(locale));
  }
  return false;
}
