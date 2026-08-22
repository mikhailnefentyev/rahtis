'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { cabinetPath, noAccessPath, safeRedirect, signInPath } from './paths';
import { getViewer } from './viewer';

export type SignInState = { error: string | null };

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    /*
     * Ответ намеренно одинаковый для «нет такого пользователя» и «неверный
     * пароль». Разные формулировки позволили бы перебором выяснить, какие
     * компании зарегистрированы на площадке.
     */
    return { error: t.auth.invalidCredentials };
  }

  const viewer = await getViewer();
  const fallback =
    viewer.status === 'ready' ? cabinetPath(locale, viewer.role) : noAccessPath(locale);

  redirect(safeRedirect(String(formData.get('next') ?? ''), fallback));
}

export type SetPasswordState = { error: string | null };

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

  if (error) return { error: error.message };

  const viewer = await getViewer();
  redirect(
    viewer.status === 'ready' ? cabinetPath(locale, viewer.role) : noAccessPath(locale),
  );
}

export async function signOutAction(formData: FormData): Promise<void> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect(signInPath(locale));
}

/** Уводит уже вошедшего пользователя со страницы входа в его кабинет. */
export async function redirectIfSignedIn(locale: Locale): Promise<void> {
  const viewer = await getViewer();

  if (viewer.status === 'ready') {
    redirect(cabinetPath(locale, viewer.role));
  }
  if (viewer.status === 'orphan') {
    redirect(noAccessPath(locale));
  }
}
