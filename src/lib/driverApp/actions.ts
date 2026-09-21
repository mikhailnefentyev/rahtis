'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale, type Locale, defaultLocale, getDictionary } from '@/lib/i18n';
import { cancelOrderAction } from '@/lib/orders/matching';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Действия приложения водителя.
 *
 * Права решает база: каждая функция сверяет рейс с app.current_driver_id.
 * Здесь — приём приглашения (единственное место со служебным ключом) и
 * перевод отказов в слова.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const num = (form: FormData, key: string) => {
  const value = Number.parseFloat(str(form, key));
  return Number.isFinite(value) ? value : null;
};

function revalidateDriver(locale: Locale) {
  revalidatePath(`/${locale}/driver`, 'layout');
}

export type DriverState = { error: string | null; done: boolean };

/* ── Приглашение ────────────────────────────────────────────────── */

/**
 * Принять приглашение: новый вход, привязка к водителю, сессия.
 *
 * Каждое приглашение заводит нового пользователя, а прежний удаляется.
 * Так потерянный телефон выходит сам: перевозчик отправляет новую ссылку,
 * и старая сессия перестаёт обновляться.
 *
 * Почта пользователя — служебная, на домене платформы, и письма на неё не
 * уходят никогда: вход подтверждается здесь же одноразовым токеном
 * generateLink → verifyOtp, без SMS и без письма.
 */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const token = str(formData, 'token');
  const back = `/${locale}/driver-invite/${encodeURIComponent(token)}`;

  const admin = createAdminClient();
  const { data: preview } = await admin.rpc('driver_invite_preview', { p_token: token });
  const invite = preview?.[0];
  if (!invite) redirect(`${back}?invalid=1`);

  const email = `${invite.driver_id}.${Date.now()}@driver.rahtis.eu`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { driver_id: invite.driver_id },
  });
  if (createError || !created.user) redirect(`${back}?failed=1`);

  const { error: claimError } = await admin.rpc('claim_driver_invite', {
    p_token: token,
    p_user_id: created.user.id,
  });
  if (claimError) {
    await admin.auth.admin.deleteUser(created.user.id);
    redirect(`${back}?invalid=1`);
  }

  /* Прежний вход водителя — на другом телефоне — гасится. */
  if (invite.auth_user_id) await admin.auth.admin.deleteUser(invite.auth_user_id);

  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = link?.properties?.hashed_token;
  if (!hashed) redirect(`${back}?failed=1`);

  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: hashed });
  if (sessionError) redirect(`${back}?failed=1`);

  redirect(`/${locale}/driver`);
}

export async function driverSignOutAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/driver`);
}

/* ── Смена ──────────────────────────────────────────────────────── */

export async function shiftAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();

  await supabase.rpc('driver_shift_action', {
    p_action: str(formData, 'action'),
    p_lat: num(formData, 'lat') ?? undefined,
    p_lon: num(formData, 'lon') ?? undefined,
  });

  revalidateDriver(locale);
}

/* ── Рейс ───────────────────────────────────────────────────────── */

export async function acceptTaskAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  await supabase.rpc('confirm_order', { p_order_id: str(formData, 'order_id') });
  revalidateDriver(locale);
}

/**
 * Отказ водителя — тот же откат, что у перевозчика: заказ уходит на стол,
 * а после прямого назначения рассылается как новая публикация.
 */
export async function declineTaskAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await cancelOrderAction(formData);
  revalidateDriver(locale);
}

export async function completeStopAction(
  _previous: DriverState,
  formData: FormData,
): Promise<DriverState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const supabase = await createClient();

  const { error } = await supabase.rpc('complete_stop', {
    p_stop_id: str(formData, 'stop_id'),
    p_damage_note: str(formData, 'damage_note') || undefined,
    p_lat: num(formData, 'lat') ?? undefined,
    p_lon: num(formData, 'lon') ?? undefined,
    p_accuracy_m: num(formData, 'accuracy') != null ? Math.round(num(formData, 'accuracy')!) : undefined,
  });

  revalidateDriver(locale);
  return error ? { error: t.driverApp.failed, done: false } : { error: null, done: true };
}

export async function reportProblemAction(
  _previous: DriverState,
  formData: FormData,
): Promise<DriverState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const supabase = await createClient();

  const { error } = await supabase.rpc('driver_report_problem', {
    p_order_id: (str(formData, 'order_id') || null) as string,
    p_text: str(formData, 'text'),
  });

  return error ? { error: t.driverApp.failed, done: false } : { error: null, done: true };
}

/* ── Входящие ───────────────────────────────────────────────────── */

export async function markReadAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();

  await supabase
    .from('driver_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  revalidateDriver(locale);
}
