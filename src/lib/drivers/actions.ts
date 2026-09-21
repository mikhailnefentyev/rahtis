'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { operationsLocalToIso } from '@/lib/dates';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { PayModel } from '@/types/db';

/**
 * Водители, их смены, модели оплаты и правила TES.
 *
 * Всё под сессией перевозчика: права проверяют RLS и функции базы, а
 * здесь — только перевод формы в строки и отказов базы в слова.
 */

export type FormState = { error: string | null; done: boolean };

const idle: FormState = { error: null, done: false };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();
const opt = (form: FormData, key: string): string | null => str(form, key) || null;

/** Евро из поля формы в центы: «1,25» → 125. Пусто и мусор — null. */
function cents(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(/\s/g, '').replace(',', '.');
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

/** Проценты из поля формы в базисные пункты: «50» → 5000. */
function bps(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(',', '.');
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
}

function int(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(/\s/g, '');
  if (!raw) return null;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function requireCarrier() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company) {
    throw new Error('forbidden');
  }
  return viewer;
}

function revalidateDrivers(locale: Locale, driverId?: string) {
  revalidatePath(`/${locale}/carrier/drivers`);
  revalidatePath(`/${locale}/carrier/fleet`);
  if (driverId) revalidatePath(`/${locale}/carrier/drivers/${driverId}`);
}

/* ── Водитель ───────────────────────────────────────────────────── */

export async function saveDriverAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier();

  const values = {
    full_name: str(formData, 'full_name'),
    phone: str(formData, 'phone').replace(/[\s()-]/g, ''),
    languages: formData.getAll('languages').map(String),
  };

  if (values.full_name.length < 2 || values.languages.length === 0) {
    return { error: t.validation.required, done: false };
  }
  if (!/^\+[1-9][0-9]{6,14}$/.test(values.phone)) {
    return { error: t.drivers.phoneInvalid, done: false };
  }

  const supabase = await createClient();
  const id = opt(formData, 'id');

  const { error } = id
    ? await supabase.from('drivers').update(values).eq('id', id)
    : await supabase.from('drivers').insert({ ...values, company_id: viewer.company!.id });

  if (error) {
    /* 23505 — номер уже у действующего водителя, где бы тот ни работал. */
    return { error: error.code === '23505' ? t.drivers.phoneTaken : t.error.generic, done: false };
  }

  revalidateDrivers(locale, id ?? undefined);
  return { error: null, done: true };
}

/** Посадить водителя на машину или снять (пустой водитель). */
export async function assignDriverAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  await supabase.rpc('assign_vehicle_driver', {
    p_vehicle_id: str(formData, 'vehicle_id'),
    /* Пустое значение снимает водителя с машины; тип RPC этого не знает. */
    p_driver_id: (opt(formData, 'driver_id') ?? null) as string,
  });

  revalidateDrivers(locale);
}

export async function archiveDriverAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  const id = str(formData, 'id');
  await supabase.rpc(formData.get('restore') ? 'restore_driver' : 'archive_driver', {
    p_driver_id: id,
  });

  revalidateDrivers(locale, id);
}

/* ── Модель оплаты ──────────────────────────────────────────────── */

const PAY_MODELS: PayModel[] = ['PER_KM', 'TRIP_PERCENT', 'FLAT_HOURLY', 'TES'];

export async function savePayProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireCarrier();

  const model = str(formData, 'model') as PayModel;
  const driverId = str(formData, 'driver_id');
  const validFrom = str(formData, 'valid_from');

  if (!PAY_MODELS.includes(model) || !/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
    return { error: t.validation.required, done: false };
  }

  /*
   * Лишние поля обнуляются здесь: ограничение базы проверяет только поле
   * своей модели, и переключение модели в форме не должно оставить в
   * строке ставку от прошлого выбора.
   */
  const row = {
    driver_id: driverId,
    valid_from: validFrom,
    model,
    per_km_cents: model === 'PER_KM' ? cents(formData, 'per_km') : null,
    hourly_cents: model === 'FLAT_HOURLY' ? cents(formData, 'hourly') : null,
    trip_bps: model === 'TRIP_PERCENT' ? bps(formData, 'trip_percent') : null,
    tes_rule_set_id: model === 'TES' ? opt(formData, 'tes_rule_set_id') : null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from('driver_pay_profiles').insert(row);

  if (error) {
    return {
      error:
        error.code === '23505'
          ? t.pay.sameDay
          : error.code === '23514'
            ? t.validation.positiveNumber
            : t.error.generic,
      done: false,
    };
  }

  revalidateDrivers(locale, driverId);
  return { error: null, done: true };
}

export async function deletePayProfileAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  await supabase.from('driver_pay_profiles').delete().eq('id', str(formData, 'id'));

  revalidateDrivers(locale, str(formData, 'driver_id'));
}

/* ── Смены ──────────────────────────────────────────────────────── */

/**
 * Смена, внесённая руками.
 *
 * Перерыв при ручном вводе один: диспетчер переносит с бумаги итог дня,
 * а не хронику. Приложение водителя пишет перерывы сами, сколько их
 * было. Перерыв заменяется целиком при каждой правке — сравнивать старый
 * с новым незачем, журнал правок смены пишет база.
 */
export async function saveShiftAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier();

  const driverId = str(formData, 'driver_id');
  const startedAt = operationsLocalToIso(str(formData, 'started_at'));
  const endedAt = opt(formData, 'ended_at') ? operationsLocalToIso(str(formData, 'ended_at')) : null;
  const breakStart = opt(formData, 'break_start')
    ? operationsLocalToIso(str(formData, 'break_start'))
    : null;
  const breakEnd = opt(formData, 'break_end') ? operationsLocalToIso(str(formData, 'break_end')) : null;

  if (!startedAt || (opt(formData, 'ended_at') && !endedAt)) {
    return { error: t.shifts.invalid, done: false };
  }
  if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
    return { error: t.shifts.invalid, done: false };
  }

  const row = {
    driver_id: driverId,
    vehicle_id: opt(formData, 'vehicle_id'),
    started_at: startedAt,
    ended_at: endedAt,
    odometer_start: int(formData, 'odometer_start'),
    odometer_end: int(formData, 'odometer_end'),
    note: opt(formData, 'note'),
  };

  const supabase = await createClient();
  const id = opt(formData, 'id');

  const { data, error } = id
    ? await supabase.from('driver_shifts').update(row).eq('id', id).select('id').single()
    : await supabase
        .from('driver_shifts')
        .insert({ ...row, source: 'MANUAL', created_by: viewer.userId })
        .select('id')
        .single();

  if (error || !data) return { error: explainShift(t, error?.code, error?.message), done: false };

  await supabase.from('driver_breaks').delete().eq('shift_id', data.id);

  if (breakStart && breakEnd) {
    const { error: breakError } = await supabase
      .from('driver_breaks')
      .insert({ shift_id: data.id, started_at: breakStart, ended_at: breakEnd });

    if (breakError) return { error: t.shifts.invalid, done: false };
  }

  revalidateDrivers(locale, driverId);
  return { error: null, done: true };
}

function explainShift(
  t: Awaited<ReturnType<typeof getDictionary>>,
  code: string | undefined,
  message: string | undefined,
): string {
  /* 23P01 — исключающее ограничение: две смены водителя пересеклись. */
  if (code === '23P01') return t.shifts.overlap;
  if (code === '23514' && message?.includes('driver_shifts_length')) return t.shifts.tooLong;
  if (code === '23514' || code === '22023') return t.shifts.invalid;
  /* 42501 — политика: смену из приложения руками не правят. */
  if (code === '42501') return t.shifts.appRow;
  return t.error.generic;
}

export async function deleteShiftAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  await supabase.from('driver_shifts').delete().eq('id', str(formData, 'id'));

  revalidateDrivers(locale, str(formData, 'driver_id'));
}

/* ── Правила TES ────────────────────────────────────────────────── */

/** «18:00» или пусто. Окно задаётся целиком — это проверяет и база. */
const time = (form: FormData, key: string): string | null =>
  /^\d{2}:\d{2}$/.test(str(form, key)) ? str(form, key) : null;

export async function saveTesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier();

  const hours = (key: string) => {
    const raw = str(formData, key).replace(',', '.');
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.round(value * 60) : null;
  };

  const base = cents(formData, 'base_hourly');
  const regular = hours('daily_regular_hours');
  const ot1Minutes = hours('overtime1_hours');

  if (!str(formData, 'name') || !str(formData, 'valid_from') || !base || !regular || ot1Minutes == null) {
    return { error: t.validation.required, done: false };
  }

  const row = {
    name: str(formData, 'name'),
    valid_from: str(formData, 'valid_from'),
    base_hourly_cents: base,
    daily_regular_minutes: regular,
    overtime1_minutes: ot1Minutes,
    overtime1_bps: bps(formData, 'overtime1_pct') ?? 0,
    overtime2_bps: bps(formData, 'overtime2_pct') ?? 0,
    evening_start: time(formData, 'evening_start'),
    evening_end: time(formData, 'evening_end'),
    evening_cents: cents(formData, 'evening') ?? 0,
    night_start: time(formData, 'night_start'),
    night_end: time(formData, 'night_end'),
    night_cents: cents(formData, 'night') ?? 0,
    saturday_bps: bps(formData, 'saturday_pct') ?? 0,
    sunday_bps: bps(formData, 'sunday_pct') ?? 0,
    note: opt(formData, 'note'),
  };

  const supabase = await createClient();
  const id = opt(formData, 'id');

  const { error } = id
    ? await supabase.from('tes_rule_sets').update(row).eq('id', id)
    : await supabase
        .from('tes_rule_sets')
        .insert({ ...row, company_id: viewer.company!.id, created_by: viewer.userId });

  if (error) {
    return { error: error.code === '23514' ? t.validation.positiveNumber : t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier/drivers/tes`);
  return { error: null, done: true };
}

export async function deleteTesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireCarrier();

  const supabase = await createClient();
  const { error } = await supabase.from('tes_rule_sets').delete().eq('id', str(formData, 'id'));

  /* 23503 — набор держит модель оплаты водителя (on delete restrict). */
  if (error) return { error: error.code === '23503' ? t.tes.inUse : t.error.generic, done: false };

  revalidatePath(`/${locale}/carrier/drivers/tes`);
  return { ...idle, done: true };
}

export async function copyTesTemplateAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  await supabase.rpc('copy_tes_template', { p_template_id: str(formData, 'id') });

  revalidatePath(`/${locale}/carrier/drivers/tes`);
}

/* ── Приложение водителя ────────────────────────────────────────── */

export type InviteState = { error: string | null; link: string | null };

/**
 * Приглашение в приложение: одноразовая ссылка на сутки.
 *
 * Ссылку перевозчик отправляет сам — SMS со своего телефона, мессенджер,
 * вслух. Платформа ничего не шлёт водителю, поэтому и провайдер SMS не
 * нужен. Токен показывается один раз: в базе только его хэш.
 */
export async function createInviteAction(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireCarrier();

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc('create_driver_invite', {
    p_driver_id: str(formData, 'driver_id'),
  });

  if (error || !token) return { error: t.error.generic, link: null };

  return { error: null, link: `${siteUrl()}/${locale}/driver-invite/${token}` };
}

/**
 * Отвязать телефон водителя. Пользователь приложения удаляется целиком:
 * только так гаснут его сессии на потерянном телефоне.
 */
export async function detachLoginAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier();

  const supabase = await createClient();
  const id = str(formData, 'driver_id');
  const { data: userId } = await supabase.rpc('detach_driver_login', { p_driver_id: id });

  if (userId) await createAdminClient().auth.admin.deleteUser(userId);

  revalidateDrivers(locale, id);
}
