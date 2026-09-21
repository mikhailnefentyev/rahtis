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

/** Вход по ссылке: страница приглашения, кнопка «Aloita». */
export async function acceptInviteAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const token = str(formData, 'token');
  const back = `/${locale}/driver-invite/${encodeURIComponent(token)}`;

  const admin = createAdminClient();
  const { data } = await admin.rpc('driver_invite_lookup', { p_token: token });
  const invite = data?.[0];
  if (!invite) redirect(`${back}?invalid=1`);

  const result = await signInDriver(invite);
  redirect(result === 'ok' ? `/${locale}/driver` : `${back}?${result}=1`);
}

export type CodeState = { error: string | null };

/**
 * Вход по телефону и коду — прямо из установленного приложения.
 *
 * Нужен там, где ссылка не помогает: на iPhone приложение с экрана
 * «Домой» не видит вход, сделанный в Safari. Код можно ввести в любом
 * порядке — до установки или после.
 */
export async function acceptCodeAction(_previous: CodeState, formData: FormData): Promise<CodeState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('driver_invite_lookup', {
    p_phone: str(formData, 'phone').replace(/[\s()-]/g, ''),
    p_code: str(formData, 'code').replace(/\s/g, ''),
  });

  /* 54000 — пять попыток на номер за пятнадцать минут. */
  if (error?.code === '54000') return { error: t.driverApp.codeThrottled };
  const invite = data?.[0];
  if (error || !invite) return { error: t.driverApp.codeInvalid };

  const result = await signInDriver(invite);
  if (result !== 'ok') return { error: t.driverApp.inviteFailed };

  redirect(`/${locale}/driver`);
}

/**
 * Общий конец обоих входов: новый пользователь, привязка, сессия.
 *
 * Каждое приглашение заводит нового пользователя, а прежний удаляется.
 * Так потерянный телефон выходит сам: перевозчик отправляет новое
 * приглашение, и старая сессия перестаёт обновляться.
 *
 * Почта пользователя — служебная, на домене платформы, и письма на неё не
 * уходят никогда: вход подтверждается здесь же одноразовым токеном
 * generateLink → verifyOtp, без SMS и без письма.
 */
async function signInDriver(invite: {
  invite_id: string;
  driver_id: string;
  auth_user_id: string | null;
}): Promise<'ok' | 'invalid' | 'failed'> {
  const admin = createAdminClient();

  const email = `${invite.driver_id}.${Date.now()}@driver.rahtis.eu`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { driver_id: invite.driver_id },
  });
  if (createError || !created.user) return 'failed';

  const { error: claimError } = await admin.rpc('claim_driver_invite', {
    p_invite_id: invite.invite_id,
    p_user_id: created.user.id,
  });
  if (claimError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return 'invalid';
  }

  /* Прежний вход водителя — на другом телефоне — гасится. */
  if (invite.auth_user_id) await admin.auth.admin.deleteUser(invite.auth_user_id);

  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = link?.properties?.hashed_token;
  if (!hashed) return 'failed';

  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: hashed });
  return sessionError ? 'failed' : 'ok';
}

export async function driverSignOutAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/driver`);
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

/* ── Очередь действий ───────────────────────────────────────────── */

/**
 * Ответ очереди: принято, отклонено по делу или не дошло.
 *
 * ok — событие применено (или уже было применено раньше) и уходит из
 * очереди. rejected — база отказала по существу: точка уже пройдена,
 * смена уже идёт. Повторять такое бессмысленно, и оно тоже уходит, а
 * водитель видит, что одно действие не принято. retry — не дошло до
 * базы или она не ответила: событие остаётся и уйдёт со следующей
 * попыткой.
 */
export type EventResult = { status: 'ok' | 'rejected' | 'retry' };

/* Коды, при которых повтор ничего не изменит. */
const FINAL = new Set(['55000', '42501', '22023', 'P0002', '23514', '23P01']);

const outcome = (error: { code?: string } | null): EventResult => ({
  status: !error ? 'ok' : error.code && FINAL.has(error.code) ? 'rejected' : 'retry',
});

/**
 * Одно действие из очереди телефона.
 *
 * Все виды идут одним входом: очередь отправляет их строго по порядку
 * нажатия, и отметка точки не должна обогнать прибытие на неё только
 * потому, что ушла другим запросом.
 */
export async function applyDriverEventAction(formData: FormData): Promise<EventResult> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  const eventId = str(formData, 'event_id');
  const at = str(formData, 'pressed_at') || undefined;

  let result: EventResult;

  switch (str(formData, 'kind')) {
    case 'SHIFT': {
      const { error } = await supabase.rpc('driver_shift_action', {
        p_action: str(formData, 'action'),
        p_lat: num(formData, 'lat') ?? undefined,
        p_lon: num(formData, 'lon') ?? undefined,
        p_at: at,
        p_event_id: eventId,
      });
      result = outcome(error);
      break;
    }
    case 'ARRIVE': {
      const { error } = await supabase.rpc('driver_arrive_stop', {
        p_stop_id: str(formData, 'stop_id'),
        p_lat: num(formData, 'lat') ?? undefined,
        p_lon: num(formData, 'lon') ?? undefined,
        p_at: at,
        p_event_id: eventId,
      });
      result = outcome(error);
      break;
    }
    case 'COMPLETE': {
      const accuracy = num(formData, 'accuracy');
      const { error } = await supabase.rpc('driver_complete_stop', {
        p_stop_id: str(formData, 'stop_id'),
        p_damage_note: str(formData, 'damage_note') || undefined,
        p_lat: num(formData, 'lat') ?? undefined,
        p_lon: num(formData, 'lon') ?? undefined,
        p_accuracy_m: accuracy != null ? Math.round(accuracy) : undefined,
        p_at: at,
        p_event_id: eventId,
      });
      result = outcome(error);
      break;
    }
    case 'UPLOAD':
      result = await uploadPhoto(formData);
      break;
    default:
      result = { status: 'rejected' };
  }

  if (result.status === 'ok') revalidateDriver(locale);
  return result;
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SUBJECTS = ['TRAILER', 'CARGO', 'SEAL', 'DOCUMENT', 'OTHER', 'SIGNATURE'] as const;
const ANGLES = ['FRONT', 'BACK', 'LEFT', 'RIGHT'];

/**
 * Снимок осмотра, подпись или накладная.
 *
 * Порядок важен. Сначала сессия водителя подтверждает, что рейс его, —
 * иначе служебный ключ положил бы файл за любого вошедшего. Потом файл
 * кладётся в папку рейса, и только после этого строка регистрируется
 * функцией базы под той же сессией. Не записалась строка — файл убирается:
 * файл без строки не виден никому и только занимает место.
 *
 * Имя файла — идентификатор действия с телефона: повтор из очереди кладёт
 * тот же объект по тому же пути, а база возвращает прежнюю строку.
 */
async function uploadPhoto(formData: FormData): Promise<EventResult> {
  const file = formData.get('file');
  const orderId = str(formData, 'order_id');
  const stopId = str(formData, 'stop_id');
  const eventId = str(formData, 'event_id');
  const subject = str(formData, 'subject') as (typeof SUBJECTS)[number];
  const angle = str(formData, 'angle');

  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024 ||
    !PHOTO_TYPES.includes(file.type) ||
    /* Все три идут в путь файла — только идентификаторы, без «../». */
    ![eventId, orderId, stopId].every((id) => /^[0-9a-f-]{36}$/i.test(id)) ||
    !SUBJECTS.includes(subject) ||
    (angle && !ANGLES.includes(angle))
  ) {
    return { status: 'rejected' };
  }

  const supabase = await createClient();
  const { data: tasks, error: tasksError } = await supabase.rpc('driver_tasks');
  if (tasksError) return { status: 'retry' };
  const task = (tasks ?? []).find((x) => x.id === orderId);
  if (!task || (task.status !== 'IN_PROGRESS' && task.status !== 'DONE')) return { status: 'rejected' };

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${orderId}/app/${stopId}/${eventId}.${ext}`;

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from('trip-docs')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) return { status: 'retry' };

  const { error } = await supabase.rpc('driver_register_photo', {
    p_order_id: orderId,
    p_stop_id: stopId,
    p_storage_path: path,
    p_mime_type: file.type,
    p_size_bytes: file.size,
    p_subject: subject,
    p_angle: angle || undefined,
    p_damage: formData.get('damage') === '1',
    p_cmr: formData.get('cmr') === '1',
    p_signer_name: str(formData, 'signer_name') || undefined,
    p_captured_at: str(formData, 'pressed_at') || undefined,
    p_lat: num(formData, 'lat') ?? undefined,
    p_lon: num(formData, 'lon') ?? undefined,
    p_external_id: eventId,
  });

  if (error) {
    const result = outcome(error);
    if (result.status === 'rejected') await admin.storage.from('trip-docs').remove([path]);
    return result;
  }

  return { status: 'ok' };
}

/* ── Push-уведомления ───────────────────────────────────────────── */

/**
 * Подписать это устройство на push. Подписку браузер уже выдал — здесь
 * только сохранение: адрес службы push и ключи шифрования сообщения.
 */
export async function pushSubscribeAction(formData: FormData): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('driver_push_subscribe', {
    p_endpoint: str(formData, 'endpoint'),
    p_p256dh: str(formData, 'p256dh'),
    p_auth: str(formData, 'auth'),
    p_locale: toLocale(formData.get('locale')),
  });
  return { ok: !error };
}

export async function pushUnsubscribeAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc('driver_push_unsubscribe', { p_endpoint: str(formData, 'endpoint') });
}
