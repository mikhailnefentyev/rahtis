'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDriverI18n } from '@/lib/driverApp/i18n';
import { FLASH_COOKIE, flashError } from '@/lib/forms/flash';
import { isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { cancelOrderAction } from '@/lib/orders/matching';
import { refineEtaAfter } from '@/lib/orders/eta';
import { recordVehicleCheck } from '@/lib/orders/vehicleCheckServer';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { storeWeighTicket } from '@/lib/weighTicket/store';
import type { Json } from '@/types/database';

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
  /* Словарь водителя: его язык, а не финский кабинета (отказ по коду выходил по-фински на русском экране). */
  const { t } = await getDriverI18n(locale);

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

/**
 * Язык приложения. Пусто — снова по языку телефона.
 *
 * Язык живёт у водителя, поэтому переживает переустановку приложения и
 * смену телефона: вход по коду с нового устройства не должен возвращать
 * язык, которого водитель не знает.
 */
export async function setDriverLanguageAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();

  const { error } = await supabase.rpc('set_driver_language', {
    p_language: String(formData.get('language') ?? ''),
  });
  if (error) {
    console.error('Язык приложения не сохранён:', error.message);
    await flashError((await getDriverI18n(locale)).t.driverApp.failed);
  }

  revalidatePath(`/${locale}/driver`, 'layout');
}

/* ── Рейс ───────────────────────────────────────────────────────── */

export async function acceptTaskAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_order', { p_order_id: str(formData, 'order_id') });
  if (error) await flashError((await getDriverI18n(locale)).t.driverApp.failed);
  revalidateDriver(locale);
}

/**
 * Отказ водителя — тот же откат, что у перевозчика: заказ уходит на стол,
 * а после прямого назначения рассылается как новая публикация.
 */
export async function declineTaskAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const store = await cookies();
  const before = store.get(FLASH_COOKIE)?.value;
  await cancelOrderAction(formData);
  /* Общий откат объясняет отказ языком кабинета — водителю повторяем на его языке. */
  if (store.get(FLASH_COOKIE)?.value !== before) await flashError((await getDriverI18n(locale)).t.driverApp.failed);
  revalidateDriver(locale);
}

export async function reportProblemAction(
  _previous: DriverState,
  formData: FormData,
): Promise<DriverState> {
  const locale = toLocale(formData.get('locale'));
  /* Словарь водителя: его язык, а не финский кабинета (отказ по коду выходил по-фински на русском экране). */
  const { t } = await getDriverI18n(locale);
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
/* 22P02 — число не разобралось (кривое поле с телефона): повтор пришлёт то же самое. */
const FINAL = new Set(['55000', '42501', '22023', 'P0002', '23514', '23P01', '22P02']);

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
      /* Отметка из очереди старше четверти часа пересчёт пропустит сама. */
      if (!error) await refineEtaAfter(supabase, str(formData, 'stop_id'));
      /* Первая погрузка: та ли машина. Номера подтвердил водитель; повтор из очереди сверку не дублирует. */
      if (!error) {
        await recordVehicleCheck(supabase, str(formData, 'stop_id'), {
          plate: str(formData, 'reported_plate') || null,
          trailer: str(formData, 'reported_trailer') || null,
        });
      }
      break;
    }
    case 'SITE': {
      /* Поля рейса — JSON в одном поле: их набор у ARRIVE, LOAD и ADD_SITE разный. */
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(str(formData, 'data') || '{}');
      } catch {
        data = {};
      }
      const { error } = await supabase.rpc('driver_site_action', {
        p_action: str(formData, 'action'),
        p_job_id: str(formData, 'job_id') || undefined,
        p_data: data as Json,
        p_at: at,
        p_event_id: eventId,
      });
      result = outcome(error);
      /*
       * Фото весового талона, снятое без связи, едет с рейсом: рейс уже
       * записан, фото прикрепляется к нему по идентификатору действия.
       * Не дошло — повтор: база рейс второй раз не запишет, а фото ляжет.
       */
      const file = formData.get('file');
      if (result.status === 'ok' && str(formData, 'action') === 'LOAD' && file instanceof File && file.size > 0) {
        const stored = await storeWeighTicket(supabase, {
          id: eventId,
          jobId: str(formData, 'job_id'),
          file,
          read: false,
          expectedPlates: [],
          loadEventId: eventId,
        });
        if (!stored.ok && stored.error === 'retry') result = { status: 'retry' };
      }
      break;
    }
    case 'UPLOAD':
      result = await uploadPhoto(formData);
      break;
    case 'FUEL':
      result = await addFuel(formData);
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
  /* PDF — только скан накладной из сканера приложения (ScanCapture). */
  const pdf = file instanceof File && file.type === 'application/pdf';

  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024 ||
    !(PHOTO_TYPES.includes(file.type) || (pdf && subject === 'DOCUMENT' && formData.get('cmr') === '1')) ||
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

  const ext = pdf ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
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

/**
 * Заправка водителя: строки (топливо, AdBlue), одометр, сумма, фото чека.
 *
 * Фото кладётся служебным ключом в папку компании водителя — компанию
 * называет база по его сессии (driver_fuel_state), а не телефон. Имя
 * файла — идентификатор действия: повтор из очереди кладёт тот же файл
 * по тому же пути. База отказала по существу — файл убирается.
 */
async function addFuel(formData: FormData): Promise<EventResult> {
  const eventId = str(formData, 'event_id');
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { status: 'rejected' };

  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(str(formData, 'data') || '{}');
  } catch {
    return { status: 'rejected' };
  }

  const supabase = await createClient();
  const file = formData.get('file');
  let receipt: string | null = null;
  let created = false;

  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024 || !PHOTO_TYPES.includes(file.type)) return { status: 'rejected' };
    const { data: state, error: stateError } = await supabase.rpc('driver_fuel_state');
    if (stateError) return outcome(stateError);
    const company = (state as { company_id?: string } | null)?.company_id;
    if (!company) return { status: 'rejected' };

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    receipt = `${company}/receipts/${eventId}.${ext}`;
    /*
     * Без перезаписи: повтор того же действия с другим файлом не должен
     * подменить уже сохранённый чек. Файл уже есть — это повтор из
     * очереди (первая попытка положила его и не дождалась ответа базы).
     */
    const { error: uploadError } = await createAdminClient()
      .storage.from('fuel-docs')
      .upload(receipt, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      const exists = /exists|duplicate/i.test(uploadError.message) || (uploadError as { statusCode?: string }).statusCode === '409';
      if (!exists) return { status: 'retry' };
    } else {
      created = true;
    }
  }

  const { error } = await supabase.rpc('driver_fuel_add', {
    p_data: { ...data, receipt_path: receipt } as Json,
    p_at: str(formData, 'pressed_at') || undefined,
    p_event_id: eventId,
  });

  const result = outcome(error);
  /* Убираем только файл, который положил этот запрос: чужой (прежний) чек не трогаем. */
  if (result.status === 'rejected' && receipt && created) await createAdminClient().storage.from('fuel-docs').remove([receipt]);
  return result;
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

/* ── Правки маршрута глазами водителя (6.11.2026) ───────────────── */

/** «Видел»: водитель отметил правки маршрута своего рейса — время видят обе стороны. */
export async function ackRouteChangesAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const supabase = await createClient();
  const { error } = await supabase.rpc('driver_ack_route_changes', { p_order_id: str(formData, 'order_id') });
  if (error) console.error('правки не отмечены:', error.message);
  revalidateDriver(locale);
}

/**
 * «Другой адрес»: водитель сам маршрут не правит, а сообщает —
 * текст, при желании адрес и точка с телефона. Перевозчику и заказчику
 * приходит уведомление, правкой его делают они.
 */
export async function reportDifferentAddressAction(_previous: DriverState, formData: FormData): Promise<DriverState> {
  const locale = toLocale(formData.get('locale'));
  const { t } = await getDriverI18n(locale);
  const message = str(formData, 'message').slice(0, 500);
  if (!message) return { error: t.driverApp.reportFailed, done: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('driver_request_change', {
    p_order_id: str(formData, 'order_id'),
    /* Без точки — null (сообщение о заказе в целом); тип генератора этого не знает. */
    p_stop_id: (str(formData, 'stop_id') || null) as string,
    p_message: message,
    p_address: str(formData, 'address').slice(0, 300) || undefined,
    p_lat: num(formData, 'lat') ?? undefined,
    p_lon: num(formData, 'lon') ?? undefined,
  });
  if (error) {
    console.error('сообщение водителя не записано:', error.message);
    return { error: t.driverApp.reportFailed, done: false };
  }
  revalidateDriver(locale);
  return { error: null, done: true };
}
