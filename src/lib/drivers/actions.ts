'use server';

import { asCurrency, isCurrency, type Currency } from '@/lib/money/currency';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { operationsLocalToIso } from '@/lib/dates';
import { stopTimeZone } from '@/lib/country';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { flashFailure } from '@/lib/forms/flash';
import type { PayModel } from '@/types/db';
import type { Json } from '@/types/database';

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

/**
 * Сумма из поля формы в центы: «1,25» → 125, «18,50 zł» → 1850. Валюта —
 * у строки (её впишет база), знак в поле не важен. Пусто и мусор — null.
 */
function cents(form: FormData, key: string): number | null {
  return amountCents(str(form, key));
}

/** То же для строки — строки ставок суточных приходят JSON-ом. */
function amountCents(text: string): number | null {
  const raw = text
    .trim()
    .replace(/[\s  ]/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.');
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

/*
 * Не исключение, а увод — как на страницах кабинета. Сессия в открытой
 * вкладке может смениться: истекла, вошли под другой ролью, в этом же
 * браузере открыли приглашение водителя. Исключение здесь показывало
 * перевозчику «страница не загрузилась» (сбой 2.10.2026).
 */
async function requireCarrier(locale: Locale) {
  return requireRole(locale, 'CARRIER');
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
  const viewer = await requireCarrier(locale);

  const values = {
    full_name: str(formData, 'full_name'),
    phone: str(formData, 'phone').replace(/[\s()-]/g, ''),
    email: str(formData, 'email').toLowerCase() || null,
    languages: formData.getAll('languages').map(String),
  };

  if (values.full_name.length < 2 || values.languages.length === 0) {
    return { error: t.validation.required, done: false };
  }
  if (!/^\+[1-9][0-9]{6,14}$/.test(values.phone)) {
    return { error: t.drivers.phoneInvalid, done: false };
  }
  if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    return { error: t.validation.email, done: false };
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
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_vehicle_driver', {
    p_vehicle_id: str(formData, 'vehicle_id'),
    /* Пустое значение снимает водителя с машины; тип RPC этого не знает. */
    p_driver_id: (opt(formData, 'driver_id') ?? null) as string,
  });
  await flashFailure(locale, error);

  revalidateDrivers(locale);
}

export async function archiveDriverAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);

  const supabase = await createClient();
  const id = str(formData, 'id');
  const restore = Boolean(formData.get('restore'));

  /*
   * Архив отвязывает вход в базе, но пользователь приложения при этом
   * оставался: сессия на телефоне уволенного водителя жила дальше. Удаляем
   * его так же, как при «отвязать телефон». Строку читаем под сессией
   * перевозчика — чужого водителя RLS не отдаст.
   */
  const { data: before } = restore
    ? { data: null }
    : await supabase.from('drivers').select('auth_user_id').eq('id', id).maybeSingle();

  const { error } = await supabase.rpc(restore ? 'restore_driver' : 'archive_driver', {
    p_driver_id: id,
  });

  if (!error && before?.auth_user_id) {
    await createAdminClient().auth.admin.deleteUser(before.auth_user_id);
  }
  await flashFailure(locale, error);

  revalidateDrivers(locale, id);
}

/* ── Модель оплаты ──────────────────────────────────────────────── */

const PAY_MODELS: PayModel[] = ['PER_KM', 'TRIP_PERCENT', 'FLAT_HOURLY', 'TES'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function savePayProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier(locale);

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
    tes_grade: model === 'TES' ? opt(formData, 'tes_grade') : null,
    tes_experience_since:
      model === 'TES' && /^\d{4}-\d{2}-\d{2}$/.test(str(formData, 'tes_experience_since'))
        ? str(formData, 'tes_experience_since')
        : null,
    /* Суточные — при любой модели; набор только свой (RLS и выбор формы). */
    allowance_rule_set_id: UUID.test(str(formData, 'allowance_rule_set_id')) ? str(formData, 'allowance_rule_set_id') : null,
    /*
     * Премии — только поверх часов или оклада: оплата преимущественно за
     * км или фрахт в ЕС запрещена (Reg. 561/2006 ст. 10), премией — можно.
     * Ноль — без премии.
     */
    bonus_per_km_cents: model === 'TES' || model === 'FLAT_HOURLY' ? cents(formData, 'bonus_per_km') || null : null,
    bonus_trip_bps: model === 'TES' || model === 'FLAT_HOURLY' ? bps(formData, 'bonus_trip_percent') || null : null,
  };

  if ((row.bonus_per_km_cents ?? 0) > 100000 || (row.bonus_trip_bps ?? 0) > 10000) {
    return { error: t.validation.positiveNumber, done: false };
  }

  /*
   * Ставка своей модели обязательна. Ограничение базы пропускало пустое
   * значение (проверка с NULL не срабатывает), и «−1» или буквы в поле
   * сохраняли модель без ставки — «0 € / km» (прогон 12.10.2026).
   */
  const filled =
    (model === 'PER_KM' && row.per_km_cents) ||
    (model === 'FLAT_HOURLY' && row.hourly_cents) ||
    (model === 'TRIP_PERCENT' && row.trip_bps) ||
    (model === 'TES' && row.tes_rule_set_id);
  if (!filled) return { error: t.validation.positiveNumber, done: false };

  const supabase = await createClient();
  /* Валюта ставки: у TES — валюта набора (копия финского шаблона — евро), иначе — валюта компании. */
  const { data: tesSet } = row.tes_rule_set_id
    ? await supabase.from('tes_rule_sets').select('currency').eq('id', row.tes_rule_set_id).maybeSingle()
    : { data: null };
  const currency = asCurrency(tesSet?.currency ?? viewer.company?.currency);
  /* Набор суточных — только свой (база ещё раз проверит триггером driver_pay_profiles_allowance_check). */
  if (row.allowance_rule_set_id) {
    const { data: own } = await supabase
      .from('allowance_rule_sets')
      .select('id')
      .eq('id', row.allowance_rule_set_id)
      .eq('company_id', viewer.company?.id ?? '')
      .maybeSingle();
    if (!own) return { error: t.validation.required, done: false };
  }
  const { error } = await supabase.from('driver_pay_profiles').insert({ ...row, currency });

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
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.from('driver_pay_profiles').delete().eq('id', str(formData, 'id'));
  await flashFailure(locale, error);

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
  const viewer = await requireCarrier(locale);
  /* Время с формы — в поясе компании перевозчика: так его показывает кабинет. */
  const zone = stopTimeZone(viewer.company?.country);
  const at = (key: string) => operationsLocalToIso(str(formData, key), zone);

  const driverId = str(formData, 'driver_id');
  const startedAt = at('started_at');
  const endedAt = opt(formData, 'ended_at') ? at('ended_at') : null;
  const breakStart = opt(formData, 'break_start') ? at('break_start') : null;
  const breakEnd = opt(formData, 'break_end') ? at('break_end') : null;

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
  /* Одометр в конце меньше, чем в начале, — это не «проверьте время». */
  if (code === '23514' && message?.includes('driver_shifts_odometer')) return t.shifts.odometerBack;
  if (code === '23514' || code === '22023') return t.shifts.invalid;
  /* 42501 — политика: смену из приложения руками не правят. */
  if (code === '42501') return t.shifts.appRow;
  return t.error.generic;
}

export async function deleteShiftAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.from('driver_shifts').delete().eq('id', str(formData, 'id'));
  await flashFailure(locale, error);

  revalidateDrivers(locale, str(formData, 'driver_id'));
}

/* ── Правила TES ────────────────────────────────────────────────── */

/** «18:00» или пусто. Окно задаётся целиком — это проверяет и база. */
const time = (form: FormData, key: string): string | null =>
  /^\d{2}:\d{2}$/.test(str(form, key)) ? str(form, key) : null;

export async function saveTesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier(locale);

  const hours = (key: string) => {
    const raw = str(formData, key).replace(',', '.');
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.round(value * 60) : null;
  };

  const monthly = cents(formData, 'base_monthly') || null;
  const regular = hours('daily_regular_hours');
  const ot1Minutes = hours('overtime1_hours');
  /*
   * Ставка часа или оклад. С окладом калькулятор берёт ставку часа из
   * оклада и нормы месяца страны; поле часа базе всё равно нужно — без
   * него пишем оценку: оклад ÷ (21 рабочий день × дневная норма).
   */
  const base =
    cents(formData, 'base_hourly') ||
    (monthly && regular ? Math.max(1, Math.round((monthly * 60) / (21 * regular))) : null);

  if (!str(formData, 'name') || !str(formData, 'valid_from') || !base || !regular || ot1Minutes == null) {
    return { error: t.validation.required, done: false };
  }

  const holiday = bps(formData, 'holiday_pct') ?? 0;
  if (holiday > 30000) return { error: t.validation.positiveNumber, done: false };

  const country = str(formData, 'country').toUpperCase();

  const row = {
    name: str(formData, 'name'),
    valid_from: str(formData, 'valid_from'),
    base_hourly_cents: base,
    country: /^[A-Z]{2}$/.test(country) ? country : (viewer.company?.country ?? 'FI'),
    base_monthly_cents: monthly,
    min_monthly_cents: cents(formData, 'min_monthly') || null,
    holiday_bps: holiday,
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
    evening_bps: bps(formData, 'evening_pct') ?? 0,
    night_bps: bps(formData, 'night_pct') ?? 0,
    overtime_basis: str(formData, 'overtime_basis') === 'PERIOD' ? 'PERIOD' : 'DAY',
    period_regular_minutes: hours('period_regular_hours') ?? 4800,
    /* Отсчёт периодов — понедельник; база это проверит. */
    period_anchor: /^\d{4}-\d{2}-\d{2}$/.test(str(formData, 'period_anchor'))
      ? str(formData, 'period_anchor')
      : '2026-01-05',
    holidays_as_sunday: formData.get('holidays_as_sunday') === 'on',
    min_paid_minutes: hours('min_paid_hours') ?? 0,
    note: opt(formData, 'note'),
  };

  const supabase = await createClient();
  const id = opt(formData, 'id');

  const { error } = id
    ? await supabase.from('tes_rule_sets').update(row).eq('id', id)
    : await supabase
        .from('tes_rule_sets')
        /* Свой набор с нуля — в валюте компании; копия шаблона идёт через copyTesTemplateAction. */
        .insert({ ...row, company_id: viewer.company!.id, created_by: viewer.userId, currency: asCurrency(viewer.company!.currency) });

  if (error) {
    return { error: error.code === '23514' ? t.validation.positiveNumber : t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier/drivers/tes`);
  return { error: null, done: true };
}

export async function deleteTesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.from('tes_rule_sets').delete().eq('id', str(formData, 'id'));

  /* 23503 — набор держит модель оплаты водителя (on delete restrict). */
  if (error) return { error: error.code === '23503' ? t.tes.inUse : t.error.generic, done: false };

  revalidatePath(`/${locale}/carrier/drivers/tes`);
  return { ...idle, done: true };
}

export async function copyTesTemplateAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);

  const supabase = await createClient();
  const templateId = str(formData, 'id');
  const { data: copyId, error } = await supabase.rpc('copy_tes_template', { p_template_id: templateId });

  /*
   * Шаблон оператора — финский TES в евро. Копия остаётся в валюте
   * шаблона: суммы договора в злотые не переводятся. Функция базы валюту
   * не передаёт, и триггер вписал бы валюту компании — поправляем здесь.
   */
  if (!error && copyId) {
    const { data: template } = await supabase
      .from('tes_rule_sets')
      .select('currency')
      .eq('id', templateId)
      .maybeSingle();
    await supabase
      .from('tes_rule_sets')
      .update({ currency: template?.currency ?? 'EUR' })
      .eq('id', copyId);
  }
  await flashFailure(locale, error);

  revalidatePath(`/${locale}/carrier/drivers/tes`);
}

/* ── Суточные ───────────────────────────────────────────────────── */

const ALLOWANCE_RULES = ['PL_DOMESTIC', 'PL_INTERNATIONAL', 'EE_ABROAD', 'LV_TRIP', 'LT_ABROAD', 'GENERIC'] as const;
type AllowanceRuleCode = (typeof ALLOWANCE_RULES)[number];

/** Параметры правила из формы; пустое поле — ключ не пишется, движок возьмёт значение по умолчанию. */
function allowanceParams(rule: AllowanceRuleCode, form: FormData): Record<string, Json> {
  const out: Record<string, Json> = {};
  const put = (key: string, value: number | null) => {
    if (value != null) out[key] = value;
  };
  switch (rule) {
    case 'PL_DOMESTIC':
      put('day_cents', cents(form, 'day'));
      put('lodging_cents', cents(form, 'lodging'));
      out.cab_lodging = form.get('cab_lodging') === 'on';
      break;
    case 'PL_INTERNATIONAL':
      put('day_cents', cents(form, 'day'));
      out.day_currency = str(form, 'day_currency') === 'PLN' ? 'PLN' : 'EUR';
      put('pit_relief_cents', cents(form, 'pit_relief'));
      put('zus_relief_cents', cents(form, 'zus_relief'));
      break;
    case 'EE_ABROAD':
      put('first_days', int(form, 'first_days'));
      put('first_cents', cents(form, 'first'));
      put('later_cents', cents(form, 'later'));
      break;
    case 'LV_TRIP':
      put('cap_bps', bps(form, 'cap_pct'));
      break;
    case 'LT_ABROAD': {
      /* Коэффициент «1,65» → 16500 б.п. */
      const coef = bps(form, 'coef');
      put('coef_bps', coef == null ? null : coef * 100);
      put('mma_cents', cents(form, 'mma'));
      put('half_bps', bps(form, 'half_pct'));
      break;
    }
    case 'GENERIC':
      break;
  }
  return out;
}

type RateRow = { country: string; currency: Currency; day_cents: number; hotel_limit_cents: number | null };

/** Ставки по странам — JSON из формы: [{country, currency, day, hotel}]. Мусор — null. */
function parseRates(raw: string): RateRow[] | null {
  let list: unknown;
  try {
    list = JSON.parse(raw || '[]');
  } catch {
    return null;
  }
  if (!Array.isArray(list) || list.length > 300) return null;
  const rows: RateRow[] = [];
  for (const item of list) {
    const r = (item ?? {}) as Record<string, unknown>;
    const country = String(r.country ?? '').trim().toUpperCase();
    const day = amountCents(String(r.day ?? ''));
    const hotelRaw = String(r.hotel ?? '').trim();
    const hotel = hotelRaw ? amountCents(hotelRaw) : null;
    if (!/^[A-Z]{2}$/.test(country) || !isCurrency(r.currency) || day == null || day > 1000000) return null;
    if (hotelRaw && (hotel == null || hotel > 10000000)) return null;
    if (rows.some((x) => x.country === country)) return null;
    rows.push({ country, currency: r.currency, day_cents: day, hotel_limit_cents: hotel });
  }
  return rows;
}

export async function saveAllowanceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireCarrier(locale);

  const name = str(formData, 'name');
  const validFrom = str(formData, 'valid_from');
  const country = str(formData, 'country').toUpperCase();
  const rule = str(formData, 'rule') as AllowanceRuleCode;

  if (
    !name ||
    name.length > 120 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(validFrom) ||
    !/^[A-Z]{2}$/.test(country) ||
    !ALLOWANCE_RULES.includes(rule)
  ) {
    return { error: t.validation.required, done: false };
  }

  const rates = parseRates(str(formData, 'rates'));
  if (!rates) return { error: t.allowanceSetup.badRate, done: false };

  const supabase = await createClient();
  const id = opt(formData, 'id');

  /*
   * Параметры, которых нет в форме (польский порог ZUS и т. п.), остаются
   * от прежней строки — если правило то же.
   */
  let params: Record<string, Json> = allowanceParams(rule, formData);
  if (id) {
    const { data: before } = await supabase.from('allowance_rule_sets').select('rule, params').eq('id', id).maybeSingle();
    if (!before) return { error: t.error.generic, done: false };
    if (before.rule === rule && before.params && typeof before.params === 'object' && !Array.isArray(before.params)) {
      params = { ...(before.params as Record<string, Json>), ...params };
    }
  }

  const row = {
    name,
    valid_from: validFrom,
    country,
    rule,
    params,
    currency: isCurrency(str(formData, 'currency'))
      ? str(formData, 'currency')
      : asCurrency(viewer.company?.currency),
  };

  const saved = id
    ? await supabase.from('allowance_rule_sets').update(row).eq('id', id).select('id').single()
    : await supabase
        .from('allowance_rule_sets')
        .insert({ ...row, company_id: viewer.company!.id, created_by: viewer.userId })
        .select('id')
        .single();

  if (saved.error || !saved.data) {
    return { error: saved.error?.code === '23514' ? t.validation.positiveNumber : t.error.generic, done: false };
  }

  /* Ставки заменяются целиком: таблица небольшая, сравнивать незачем. */
  const setId = saved.data.id;
  const { error: clearError } = await supabase.from('allowance_rates').delete().eq('rule_set_id', setId);
  if (clearError) return { error: t.error.generic, done: false };
  if (rates.length > 0) {
    const { error: ratesError } = await supabase
      .from('allowance_rates')
      .insert(rates.map((r) => ({ ...r, rule_set_id: setId })));
    if (ratesError) return { error: t.allowanceSetup.badRate, done: false };
  }

  revalidatePath(`/${locale}/carrier/drivers/allowances`);
  return { error: null, done: true };
}

export async function deleteAllowanceAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.from('allowance_rule_sets').delete().eq('id', str(formData, 'id'));

  /* 23503 — набор держит модель оплаты водителя (on delete restrict). */
  if (error) return { error: error.code === '23503' ? t.allowanceSetup.inUse : t.error.generic, done: false };

  revalidatePath(`/${locale}/carrier/drivers/allowances`);
  return { ...idle, done: true };
}

/** Копия шаблона суточных — со ставками по странам и в валюте шаблона (функция базы). */
export async function copyAllowanceTemplateAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);

  const supabase = await createClient();
  const { error } = await supabase.rpc('copy_allowance_template', { p_template_id: str(formData, 'id') });
  await flashFailure(locale, error);

  revalidatePath(`/${locale}/carrier/drivers/allowances`);
}

/* ── Приложение водителя ────────────────────────────────────────── */

export type InviteState = { error: string | null; link: string | null; code: string | null };

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
  await requireCarrier(locale);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_driver_invite', {
    p_driver_id: str(formData, 'driver_id'),
  });
  const invite = data?.[0];

  if (error || !invite) return { error: t.error.generic, link: null, code: null };

  return {
    error: null,
    link: `${siteUrl()}/${locale}/driver-invite/${invite.token}`,
    code: invite.code,
  };
}

/**
 * Отвязать телефон водителя. Пользователь приложения удаляется целиком:
 * только так гаснут его сессии на потерянном телефоне.
 */
export async function detachLoginAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireCarrier(locale);

  const supabase = await createClient();
  const id = str(formData, 'driver_id');
  const { data: userId, error } = await supabase.rpc('detach_driver_login', { p_driver_id: id });
  await flashFailure(locale, error);

  if (userId) await createAdminClient().auth.admin.deleteUser(userId);

  revalidateDrivers(locale, id);
}
