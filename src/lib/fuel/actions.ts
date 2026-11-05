'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/guard';
import { operationsLocalToIso } from '@/lib/dates';
import { flashError, flashFailure } from '@/lib/forms/flash';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { stopTimeZone } from '@/lib/country';
import { asCurrency, countryCurrency } from '@/lib/money/currency';
import type { Json } from '@/types/database';
import { extractFuelReport } from './extract';
import { FUEL_MAX_QUANTITY, isFuelProduct, normalizeReport, parseNumber, type ImportRow } from './fuel';

/**
 * Топливо в кабинете перевозчика: месячный отчёт, ручная заправка, удаление.
 *
 * Права решает база (RLS и carrier_fuel_import_confirm). Служебный ключ —
 * только для файлов в fuel-docs, и только после того, как строка под
 * сессией перевозчика подтвердила, что это его компания.
 */

const BUCKET = 'fuel-docs';
/* Vercel не принимает тело запроса больше 4,5 МБ. */
const MAX_REPORT_BYTES = 4 * 1024 * 1024;
const REPORT_TYPES = ['application/pdf', 'text/csv', 'text/plain', 'application/vnd.ms-excel'];

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/**
 * Топливо входит в подписку (как свои рейсы). Страница закрыта, но
 * действия зовутся и напрямую — проверяем в каждом, до любой работы и
 * до вызова OpenAI. База проверяет то же самое (app.own_orders_allowed).
 */
async function hasAccess(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc('own_orders_access');
  return data === true;
}

/** Рабочая валюта компании: ею считается сумма без названной валюты. */
function companyCurrency(company: { currency?: string | null; country?: string | null }) {
  return asCurrency(company.currency, countryCurrency(company.country));
}

function revalidateFuel(locale: Locale) {
  revalidatePath(`/${locale}/carrier/fuel`, 'layout');
}

export type FuelUploadState = { error: string | null };

/**
 * Загрузка месячного отчёта: файл в хранилище, строка отчёта, разбор,
 * переход на проверку. Не распознался — отчёт остаётся со статусом
 * FAILED и объяснением, файл можно удалить.
 */
export async function uploadFuelReportAction(_previous: FuelUploadState, formData: FormData): Promise<FuelUploadState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  if (!(await hasAccess())) return { error: t.fuel.locked };

  const file = formData.get('file');
  const csvByName = file instanceof File && /\.(csv|txt)$/i.test(file.name);
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > MAX_REPORT_BYTES ||
    !(REPORT_TYPES.includes(file.type) || csvByName)
  ) {
    return { error: t.fuel.reportWrongFile };
  }

  const isPdf = file.type === 'application/pdf';
  const id = crypto.randomUUID();
  const path = `${company.id}/reports/${id}.${isPdf ? 'pdf' : 'csv'}`;
  const bytes = await file.arrayBuffer();

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: isPdf ? 'application/pdf' : 'text/csv', upsert: false });
  if (uploadError) return { error: t.error.generic };

  const supabase = await createClient();
  const { error: insertError } = await supabase.from('fuel_imports').insert({
    id,
    company_id: company.id,
    file_path: path,
    file_name: file.name.slice(0, 200),
  });
  if (insertError) {
    await admin.storage.from(BUCKET).remove([path]);
    return { error: t.error.generic };
  }

  const [{ data: vehicles }, { data: cards }] = await Promise.all([
    supabase.from('vehicles').select('id, plate').eq('company_id', company.id),
    supabase.from('fuel_cards').select('card_ref, vehicle_id').eq('company_id', company.id),
  ]);

  const result = await extractFuelReport({
    fileName: file.name,
    mime: isPdf ? 'application/pdf' : 'text/csv',
    bytes,
    plates: (vehicles ?? []).map((v) => v.plate),
    country: company.country ?? 'FI',
    currency: companyCurrency(company),
  });

  if (!result.ok) {
    await supabase.from('fuel_imports').update({ status: 'FAILED', error: result.reason }).eq('id', id);
  } else {
    const rows = normalizeReport(result.rows, vehicles ?? [], cards ?? [], companyCurrency(company));
    await supabase
      .from('fuel_imports')
      .update(
        rows.length > 0
          ? { rows: rows as unknown as Json, supplier: result.supplier }
          : { status: 'FAILED', error: 'empty', supplier: result.supplier },
      )
      .eq('id', id);
  }

  revalidateFuel(locale);
  redirect(`/${locale}/carrier/fuel/import/${id}`);
}

/**
 * Подтверждение отчёта. Строки берутся из базы, а не из формы: форма
 * присылает только выбор — какие строки брать и к какой машине. Сумму
 * и объём браузер подменить не может.
 */
export async function confirmFuelImportAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  if (!(await hasAccess())) {
    await flashError((await getDictionary(locale)).fuel.locked);
    redirect(`/${locale}/carrier/fuel`);
  }
  const supabase = await createClient();
  const id = str(formData, 'import_id');

  const { data: report } = await supabase
    .from('fuel_imports')
    .select('id, rows, status, company_id')
    .eq('id', id)
    .eq('company_id', viewer.company!.id)
    .maybeSingle();
  if (!report || report.status !== 'REVIEW') {
    await flashError((await getDictionary(locale)).error.generic);
    redirect(`/${locale}/carrier/fuel`);
  }

  const zone = stopTimeZone(viewer.company?.country);
  const rows = (Array.isArray(report.rows) ? report.rows : []) as unknown as ImportRow[];
  const chosen = rows.flatMap((row, index) => {
    if (formData.get(`take_${index}`) !== '1') return [];
    const vehicle = str(formData, `vehicle_${index}`);
    const filledAt = operationsLocalToIso(`${row.date}T${row.time ?? '12:00'}`, zone);
    if (!vehicle || !filledAt) return [];
    return [
      {
        vehicle_id: vehicle,
        filled_at: filledAt,
        product: row.product,
        quantity: row.quantity,
        amount_cents: row.amount_cents,
        /* Отчёт, разобранный до валют, строк с валютой не имеет — тогда решает база (валюта компании). */
        currency: row.currency ?? null,
        odometer_km: row.odometer_km,
        station: row.station,
        card_ref: row.card_ref,
      },
    ];
  });

  const { error } = await supabase.rpc('carrier_fuel_import_confirm', {
    p_import_id: report.id,
    p_rows: chosen as unknown as Json,
  });
  if (await flashFailure(locale, error)) redirect(`/${locale}/carrier/fuel/import/${report.id}`);

  revalidateFuel(locale);
  redirect(`/${locale}/carrier/fuel?imported=${report.id}`);
}

/** Удалить отчёт (не распознан или загружен по ошибке): файл и строку. Заправки остаются. */
export async function deleteFuelImportAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();

  const { data: report } = await supabase
    .from('fuel_imports')
    .delete()
    .eq('id', str(formData, 'import_id'))
    .eq('company_id', viewer.company!.id)
    .select('file_path')
    .maybeSingle();
  /* Служебным ключом — только файл в папке своей компании (база тоже проверяет путь). */
  if (report && report.file_path.startsWith(`${viewer.company!.id}/reports/`) && !report.file_path.includes('..')) {
    await createAdminClient().storage.from(BUCKET).remove([report.file_path]);
  }

  revalidateFuel(locale);
  redirect(`/${locale}/carrier/fuel`);
}

export type FuelEntryState = { error: string | null; done: boolean };

/** Заправка вручную в кабинете: перевозчик вносит то, чего нет ни у водителя, ни в отчёте. */
export async function addFuelEntryAction(_previous: FuelEntryState, formData: FormData): Promise<FuelEntryState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;
  if (!(await hasAccess())) return { error: t.fuel.locked, done: false };

  const product = str(formData, 'product');
  const quantity = parseNumber(str(formData, 'quantity'));
  const amount = parseNumber(str(formData, 'amount'));
  const odometer = parseNumber(str(formData, 'odometer_km'));
  const filledAt = operationsLocalToIso(str(formData, 'filled_at'), stopTimeZone(company.country));
  const vehicle = str(formData, 'vehicle_id');
  /* Валюта чека из формы; мусор — валюта компании. */
  const currency = asCurrency(str(formData, 'currency'), companyCurrency(company));

  if (!vehicle || !filledAt || !isFuelProduct(product) || quantity == null || quantity <= 0 || quantity > FUEL_MAX_QUANTITY) {
    return { error: t.validation.required, done: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_entries').insert({
    company_id: company.id,
    vehicle_id: vehicle,
    filled_at: filledAt,
    product,
    quantity: Math.round(quantity * 100) / 100,
    amount_cents: amount != null && amount >= 0 ? Math.round(amount * 100) : null,
    currency,
    odometer_km: odometer != null && odometer > 0 ? Math.round(odometer) : null,
    full_tank: formData.get('full_tank') === '1',
    station: str(formData, 'station').slice(0, 120) || null,
    source: 'MANUAL',
  });
  if (error) return { error: t.error.generic, done: false };

  revalidateFuel(locale);
  return { error: null, done: true };
}

export async function deleteFuelEntryAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();

  const { data: entry, error } = await supabase
    .from('fuel_entries')
    .delete()
    .eq('id', str(formData, 'id'))
    .eq('company_id', viewer.company!.id)
    .select('receipt_path')
    .maybeSingle();
  if (await flashFailure(locale, error)) return;

  /* Фото чека одно на все строки заправки (дизель + AdBlue) — удаляем, когда ссылок не осталось. */
  if (entry?.receipt_path) {
    const { count } = await supabase
      .from('fuel_entries')
      .select('id', { count: 'exact', head: true })
      .eq('receipt_path', entry.receipt_path);
    if (!count) await createAdminClient().storage.from(BUCKET).remove([entry.receipt_path]);
  }

  revalidateFuel(locale);
}
