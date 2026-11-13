'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { eurosToCents } from '@/lib/economics/money';
import { flashError } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { asCurrency } from '@/lib/money/currency';
import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';
import { DEFECT_AREAS, isMaintenanceKind, nextDue, TRAILER_KINDS } from './status';

/**
 * Обслуживание парка: пункты плана, отметка «сделано», дефекты из
 * кабинета. Под сессией перевозчика; компанию и машину проверяет база
 * (RLS и триггер app.fleet_asset_check).
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const date = (value: string): string | null => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);
const UUID = /^[0-9a-f-]{36}$/i;

/** Целое из поля: пусто — null, мусор — undefined (ошибка формы). Пробелы и «км» не мешают. */
function int(value: string, min: number, max: number): number | null | undefined {
  const clean = value.replace(/[\s ]/g, '').replace(/km$/i, '');
  if (!clean) return null;
  const n = Number(clean.replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : undefined;
}

function revalidate(locale: Locale) {
  revalidatePath(`/${locale}/carrier/maintenance`, 'layout');
  revalidatePath(`/${locale}/carrier/fleet`);
  /* Дефект «ехать нельзя», сервис и katsastus меняют, какие машины предлагает стол. */
  revalidatePath(`/${locale}/carrier/desk`);
}

export type MaintenanceFormState = { error: string | null; done: boolean };

/* ── Пункт плана ────────────────────────────────────────────────── */

export async function saveMaintenanceItemAction(_prev: MaintenanceFormState, formData: FormData): Promise<MaintenanceFormState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).maintenance;
  const viewer = await requireRole(locale, 'CARRIER');

  const id = str(formData, 'id');
  const vehicleId = str(formData, 'vehicle_id');
  const trailerId = str(formData, 'trailer_id');
  const isTrailer = UUID.test(trailerId);
  if (!id && !UUID.test(vehicleId) && !isTrailer) return { error: t.errGeneric, done: false };

  const kind = str(formData, 'kind');
  if (!isMaintenanceKind(kind) || (isTrailer && !TRAILER_KINDS.includes(kind))) return { error: t.errGeneric, done: false };
  const title = str(formData, 'title').slice(0, 80) || null;
  if (kind === 'OTHER' && (!title || title.length < 2)) return { error: t.errTitle, done: false };

  const intervalMonths = int(str(formData, 'interval_months'), 1, 120);
  const intervalKm = isTrailer ? null : int(str(formData, 'interval_km'), 500, 1_000_000);
  const lastDoneKm = isTrailer ? null : int(str(formData, 'last_done_km'), 0, 9_999_999);
  const nextDueKmField = isTrailer ? null : int(str(formData, 'next_due_km'), 0, 9_999_999);
  if ([intervalMonths, intervalKm, lastDoneKm, nextDueKmField].includes(undefined)) return { error: t.errNumber, done: false };

  const lastDoneOn = date(str(formData, 'last_done_on'));
  const computed = nextDue({
    lastDoneOn,
    lastDoneKm: lastDoneKm ?? null,
    intervalMonths: intervalMonths ?? null,
    intervalKm: intervalKm ?? null,
  });
  /* Своя дата важнее расчётной: у katsastus срок задан регистрацией, а не прошлым разом. */
  const nextDueOn = date(str(formData, 'next_due_on')) ?? computed.on;
  const nextDueKm = nextDueKmField ?? computed.km;
  if (!nextDueOn && nextDueKm == null) return { error: t.errNeedDue, done: false };

  const fields = {
    kind,
    title: kind === 'OTHER' ? title : title && title.length >= 2 ? title : null,
    interval_months: intervalMonths ?? null,
    interval_km: intervalKm ?? null,
    last_done_on: lastDoneOn,
    last_done_km: lastDoneKm ?? null,
    next_due_on: nextDueOn,
    next_due_km: nextDueKm,
    note: str(formData, 'note').slice(0, 300) || null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('maintenance_items').update(fields).eq('id', id).eq('company_id', viewer.company!.id)
    : await supabase.from('maintenance_items').insert({
        ...fields,
        company_id: viewer.company!.id,
        vehicle_id: isTrailer ? null : vehicleId,
        trailer_id: isTrailer ? trailerId : null,
      });
  if (error) return { error: t.errGeneric, done: false };

  revalidate(locale);
  return { error: null, done: true };
}

export async function deleteMaintenanceItemAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.from('maintenance_items').delete().eq('id', str(formData, 'id')).eq('company_id', viewer.company!.id);
  if (error) await flashError((await getDictionary(locale)).maintenance.errGeneric);
  revalidate(locale);
}

/* ── Сделано: строка сервисной книжки ───────────────────────────── */

export async function recordMaintenanceAction(_prev: MaintenanceFormState, formData: FormData): Promise<MaintenanceFormState> {
  const locale = toLocale(formData.get('locale'));
  const dict = await getDictionary(locale);
  const t = dict.maintenance;
  const viewer = await requireRole(locale, 'CARRIER');

  const doneOn = date(str(formData, 'done_on'));
  if (!doneOn) return { error: t.errDate, done: false };

  const itemId = str(formData, 'item_id');
  const odometer = int(str(formData, 'odometer_km'), 0, 9_999_999);
  const nextKm = int(str(formData, 'next_due_km'), 0, 9_999_999);
  if (odometer === undefined || nextKm === undefined) return { error: t.errNumber, done: false };
  /* Пункт с километровым интервалом без лукемы потерял бы следующий срок по пробегу. */
  if (formData.get('needs_km') === '1' && odometer == null && nextKm == null) return { error: t.errKmNeeded, done: false };

  const amountRaw = str(formData, 'amount');
  const amount = amountRaw ? eurosToCents(amountRaw) : null;
  if (amount === undefined || (amount != null && amount < 0)) return { error: t.errNumber, done: false };

  const kind = str(formData, 'kind') || 'REPAIR';
  const title = str(formData, 'title').slice(0, 80);
  if (!itemId && !(kind === 'REPAIR' || isMaintenanceKind(kind))) return { error: t.errGeneric, done: false };
  if (!itemId && (kind === 'OTHER' || kind === 'REPAIR') && title.length < 2) return { error: t.errTitle, done: false };

  /*
   * Подпись строки расходов — на языке кабинета: в доходности видно, за
   * что сумма. У пункта плана вид — его (форма шлёт готовую подпись), у
   * разового ремонта — выбранный. Мастерская идёт в «поставщика», не сюда.
   */
  const label = str(formData, 'label').slice(0, 120) || (kind in t.kinds ? t.kinds[kind as keyof typeof t.kinds] : '');
  const workshop = str(formData, 'workshop').slice(0, 120);
  const costNote = [label, title && title !== label ? title : ''].filter(Boolean).join(' · ').slice(0, 200);

  const defectIds = formData.getAll('defect_ids').map(String).filter((id) => UUID.test(id));

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_maintenance_done', {
    p_data: {
      item_id: UUID.test(itemId) ? itemId : null,
      vehicle_id: UUID.test(str(formData, 'vehicle_id')) ? str(formData, 'vehicle_id') : null,
      trailer_id: UUID.test(str(formData, 'trailer_id')) ? str(formData, 'trailer_id') : null,
      kind,
      title: title || null,
      done_on: doneOn,
      odometer_km: odometer,
      workshop: workshop || null,
      amount_cents: amount,
      currency: amount != null ? asCurrency(str(formData, 'currency'), asCurrency(viewer.company?.currency, 'EUR')) : null,
      cost_note: costNote || null,
      note: str(formData, 'note').slice(0, 500) || null,
      next_due_on: date(str(formData, 'next_due_on')),
      next_due_km: nextKm,
      defect_ids: defectIds,
    } as Json,
  });
  if (error) return { error: t.errGeneric, done: false };

  revalidate(locale);
  revalidatePath(`/${locale}/carrier/economics`, 'layout');
  return { error: null, done: true };
}

/** Удалить строку книжки — вместе с её строкой в расходах машины. Срок пункта не откатывается. */
export async function deleteMaintenanceRecordAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const id = str(formData, 'id');

  const { data: record } = await supabase
    .from('maintenance_records')
    .select('id, cost_id')
    .eq('id', id)
    .eq('company_id', viewer.company!.id)
    .maybeSingle();
  if (!record) return;

  const { error } = await supabase.from('maintenance_records').delete().eq('id', record.id);
  if (!error && record.cost_id) await supabase.from('vehicle_costs').delete().eq('id', record.cost_id);
  if (error) await flashError((await getDictionary(locale)).maintenance.errGeneric);

  revalidate(locale);
  revalidatePath(`/${locale}/carrier/economics`, 'layout');
}

/* ── Дефекты ────────────────────────────────────────────────────── */

export async function reportDefectAction(_prev: MaintenanceFormState, formData: FormData): Promise<MaintenanceFormState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).maintenance;
  const viewer = await requireRole(locale, 'CARRIER');

  const vehicleId = str(formData, 'vehicle_id');
  const trailerId = str(formData, 'trailer_id');
  const area = str(formData, 'area');
  const severity = str(formData, 'severity') === 'UNSAFE' ? 'UNSAFE' : 'CAN_DRIVE';
  const description = str(formData, 'description').slice(0, 1000);
  if (description.length < 3) return { error: t.defects.errDescription, done: false };
  if (!(DEFECT_AREAS as readonly string[]).includes(area)) return { error: t.errGeneric, done: false };
  const odometer = int(str(formData, 'odometer_km'), 0, 9_999_999);
  if (odometer === undefined) return { error: t.errNumber, done: false };

  const isTrailer = UUID.test(trailerId);
  if (!isTrailer && !UUID.test(vehicleId)) return { error: t.errGeneric, done: false };

  const supabase = await createClient();
  const { error } = await supabase.from('vehicle_defects').insert({
    company_id: viewer.company!.id,
    vehicle_id: isTrailer ? null : vehicleId,
    trailer_id: isTrailer ? trailerId : null,
    area,
    severity,
    description,
    odometer_km: isTrailer ? null : odometer,
  });
  if (error) return { error: t.errGeneric, done: false };

  revalidate(locale);
  return { error: null, done: true };
}

export async function resolveDefectAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const status = str(formData, 'status');
  if (!['OPEN', 'FIXED', 'DISMISSED'].includes(status)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_defect_resolve', {
    p_id: str(formData, 'id'),
    p_status: status,
    p_note: str(formData, 'note') || undefined,
  });
  if (error) await flashError((await getDictionary(locale)).maintenance.errGeneric);
  revalidate(locale);
}

/* ── Машина вне работы ──────────────────────────────────────────── */

/** Сервис по датам: машина не выходит на рейсы с первого дня по последний включительно. */
export async function scheduleServiceAction(_prev: MaintenanceFormState, formData: FormData): Promise<MaintenanceFormState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).maintenance;
  const viewer = await requireRole(locale, 'CARRIER');

  const vehicleId = str(formData, 'vehicle_id');
  const trailerId = str(formData, 'trailer_id');
  const isTrailer = UUID.test(trailerId);
  const startsOn = date(str(formData, 'starts_on'));
  const endsOn = date(str(formData, 'ends_on'));
  if ((!isTrailer && !UUID.test(vehicleId)) || !startsOn) return { error: t.errDate, done: false };
  if (endsOn && endsOn < startsOn) return { error: t.downtime.errDates, done: false };

  const supabase = await createClient();
  const { error } = await supabase.from('vehicle_downtime').insert({
    company_id: viewer.company!.id,
    vehicle_id: isTrailer ? null : vehicleId,
    trailer_id: isTrailer ? trailerId : null,
    reason: 'SERVICE',
    starts_on: startsOn,
    ends_on: endsOn,
    note: str(formData, 'note').slice(0, 300) || null,
  });
  if (error) return { error: t.errGeneric, done: false };

  revalidate(locale);
  return { error: null, done: true };
}

/** «Palauta ajoon»: снять ограничение (или отменить будущий сервис). Дефект и срок остаются как есть. */
export async function endDowntimeAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_downtime_end', {
    p_id: str(formData, 'id'),
    p_note: str(formData, 'note') || undefined,
  });
  if (error) await flashError((await getDictionary(locale)).maintenance.errGeneric);
  revalidate(locale);
}
