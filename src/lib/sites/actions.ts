'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { flashFailure } from '@/lib/forms/flash';
import type { SitePricing } from '@/types/db';
import { isMaterialCode } from './work';
import { checkBusinessId } from '@/lib/country';
import { lookupCompany } from '@/lib/registry/prh';

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const text = (form: FormData, key: string): string | null => {
  const value = String(form.get(key) ?? '').trim();
  return value.length > 0 ? value : null;
};

const PRICING: readonly SitePricing[] = ['HOUR', 'LOAD', 'TONNE'];

export type SiteJobState = { error: string | null; done: boolean; id?: string };

export type CustomerLookup =
  | { found: true; businessId: string; name: string; street: string; postalCode: string; city: string }
  | { found: false };

/**
 * Клиент по Y-tunnus из открытых данных PRH/YTJ — для автозаполнения формы
 * объекта. Только для перевозчика: это не открытый прокси к реестру.
 * NULL — номер не похож на Y-tunnus, запрос не нужен.
 */
export async function lookupCustomerAction(localeRaw: string, raw: string): Promise<CustomerLookup | null> {
  const locale = isLocale(localeRaw) ? localeRaw : defaultLocale;
  await requireRole(locale, 'CARRIER');
  const { normalized, valid } = checkBusinessId('FI', raw);
  if (!valid) return null;
  const company = await lookupCompany(normalized);
  if (!company) return { found: false };
  return {
    found: true,
    businessId: normalized,
    name: company.name,
    street: company.address?.street ?? '',
    postalCode: company.address?.postalCode ?? '',
    city: company.address?.city ?? '',
  };
}

/** Объект клиента: создать или поправить. Пишет перевозчик своей компании (RLS). */
export async function saveSiteJobAction(_previous: SiteJobState, formData: FormData): Promise<SiteJobState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const name = text(formData, 'name');
  const customer = text(formData, 'customer_name');
  const pricing = String(formData.get('pricing') ?? 'HOUR') as SitePricing;
  const material = String(formData.get('material_code') ?? '170504');
  const rateRaw = String(formData.get('rate') ?? '0').replace(/\s/g, '').replace(',', '.');
  const rate = Number.parseFloat(rateRaw || '0');
  const buffer = Number.parseInt(String(formData.get('buffer_minutes') ?? '30'), 10);

  if (!name || !customer || !PRICING.includes(pricing) || !isMaterialCode(material) || !Number.isFinite(rate) || rate < 0) {
    return { error: t.validation.required, done: false };
  }

  const values = {
    name,
    address: text(formData, 'address'),
    customer_name: customer,
    customer_business_id: text(formData, 'customer_business_id'),
    customer_email: text(formData, 'customer_email'),
    customer_street: text(formData, 'customer_street'),
    customer_postal_code: text(formData, 'customer_postal_code'),
    customer_city: text(formData, 'customer_city'),
    customer_country: /^[A-Z]{2}$/.test(String(formData.get('customer_country') ?? '')) ? String(formData.get('customer_country')) : 'FI',
    invoice_schedule: ['MANUAL', 'WEEKLY', 'BIWEEKLY'].includes(String(formData.get('invoice_schedule'))) ? String(formData.get('invoice_schedule')) : 'BIWEEKLY',
    payment_term_days: Math.min(90, Math.max(0, Number.parseInt(String(formData.get('payment_term_days') ?? '14'), 10) || 14)),
    pricing,
    rate_cents: Math.round(rate * 100),
    material_code: material,
    receiving_site_id: text(formData, 'receiving_site_id'),
    buffer_minutes: Number.isFinite(buffer) ? Math.min(180, Math.max(0, buffer)) : 30,
  };

  const supabase = await createClient();
  const id = text(formData, 'id');
  const { data, error } = id
    ? await supabase.from('site_jobs').update(values).eq('id', id).select('id').single()
    : await supabase.from('site_jobs').insert({ ...values, company_id: company.id }).select('id').single();

  if (error || !data) return { error: t.error.generic, done: false };

  revalidatePath(`/${locale}/carrier/sites`);
  return { error: null, done: true, id: data.id };
}

export async function setSiteJobStatusAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const status = formData.get('status') === 'CLOSED' ? 'CLOSED' : 'ACTIVE';
  const supabase = await createClient();
  const { error } = await supabase.from('site_jobs').update({ status }).eq('id', String(formData.get('id') ?? ''));
  if (error) await flashFailure(locale, error);
  revalidatePath(`/${locale}/carrier/sites`, 'layout');
}

export type ForemanState = { error: string | null; done: boolean };

/** Прораб подтверждает день по ссылке — без входа, по токену объекта. */
export async function foremanApproveAction(_previous: ForemanState, formData: FormData): Promise<ForemanState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const token = String(formData.get('token') ?? '');
  const name = text(formData, 'name');
  if (!name || name.length < 2) return { error: t.validation.required, done: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('site_foreman_approve', {
    p_token: token,
    p_day_id: String(formData.get('day_id') ?? ''),
    p_name: name,
    p_note: text(formData, 'note') ?? undefined,
  });
  if (error) return { error: t.error.generic, done: false };

  revalidatePath(`/${locale}/site/${token}`);
  return { error: null, done: true };
}

/** Перевозчик подтверждает день сам — по данным водителя о выгрузках. */
export async function carrierApproveDayAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_site_approve_day', { p_day_id: String(formData.get('day_id') ?? '') });
  if (error) await flashFailure(locale, error);
  revalidatePath(`/${locale}/carrier/sites`, 'layout');
}

/**
 * Оператор решает о пункте приёмки, который добавил водитель: одобрить —
 * пункт виден всем; отклонить — остаётся только у компании водителя.
 */
export async function decideScaleSiteAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'ADMIN');
  const approve = formData.get('decision') === 'APPROVE';
  const supabase = await createClient();
  const { error } = await supabase
    .from('scale_sites')
    .update(approve ? { approved_at: new Date().toISOString(), rejected_at: null } : { rejected_at: new Date().toISOString(), approved_at: null })
    .eq('id', String(formData.get('id') ?? ''));
  if (error) await flashFailure(locale, error);
  revalidatePath(`/${locale}/admin/scale-sites`);
}

export type SendInvoiceState = { message: string | null; ok: boolean };

/**
 * «Отправить счёт сейчас»: все подтверждённые и ещё не выставленные дни
 * объекта. Объект сначала читается под RLS — чужой объект не найдётся, и
 * секретным ключом дальше работает только проверенный.
 */
export async function sendSiteInvoiceNowAction(_previous: SendInvoiceState, formData: FormData): Promise<SendInvoiceState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { data: job } = await supabase
    .from('site_jobs')
    .select('id')
    .eq('id', String(formData.get('job_id') ?? ''))
    .eq('company_id', viewer.company!.id)
    .maybeSingle();
  if (!job) return { message: t.error.generic, ok: false };

  const { createSiteInvoice } = await import('./invoicing');
  const { todayInHelsinki } = await import('@/lib/dates');
  try {
    const result = await createSiteInvoice(job.id, todayInHelsinki());
    revalidatePath(`/${locale}/carrier/sites/${job.id}`);
    const s = t.siteInvoice;
    switch (result.status) {
      case 'SENT':
        return { message: `${result.number}: ${s.resultSent}`, ok: true };
      case 'CREATED':
        return { message: `${result.number}: ${s.resultCreated}`, ok: false };
      case 'NO_IBAN':
        return { message: s.resultNoIban, ok: false };
      case 'NO_CUSTOMER_EMAIL':
        return { message: s.resultNoEmail, ok: false };
      case 'NO_CUSTOMER_ADDRESS':
        return { message: s.resultNoAddress, ok: false };
      case 'NOTHING':
      case 'BUSY':
        return { message: s.resultNothing, ok: false };
      default:
        return { message: t.error.generic, ok: false };
    }
  } catch (cause) {
    console.error('счёт по объекту:', cause);
    return { message: t.error.generic, ok: false };
  }
}

/** Ссылка на PDF счёта на пять минут — только своему перевозчику. */
export async function siteInvoicePdfUrlAction(invoiceId: string): Promise<string | null> {
  const viewer = await requireRole(defaultLocale, 'CARRIER');
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from('carrier_invoices')
    .select('file_path')
    .eq('id', invoiceId)
    .eq('company_id', viewer.company!.id)
    .maybeSingle();
  if (!invoice?.file_path) return null;
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { data } = await createAdminClient().storage.from('reports').createSignedUrl(invoice.file_path, 300);
  return data?.signedUrl ?? null;
}
