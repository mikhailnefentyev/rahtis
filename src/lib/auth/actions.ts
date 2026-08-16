'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDictionary, isLocale, type Locale } from '@/lib/i18n';
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
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'ru';
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

export async function signOutAction(formData: FormData): Promise<void> {
  const rawLocale = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'ru';

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
