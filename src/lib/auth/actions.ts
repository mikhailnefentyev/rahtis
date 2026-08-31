'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { recordIncident } from '@/lib/incidents/record';
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
  if (viewer.status === 'guest' || !viewer.email) {
    return { error: t.error.forbidden, done: false };
  }

  const supabase = await createClient();

  const { error: wrong } = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password: current,
  });
  if (wrong) return { error: t.account.wrongCurrent, done: false };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message, done: false };

  return { error: null, done: true };
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
