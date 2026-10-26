'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { flashFailure } from '@/lib/forms/flash';
import type { SitePricing } from '@/types/db';
import { isMaterialCode } from './work';

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
