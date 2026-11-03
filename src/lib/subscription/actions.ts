'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { ANNUAL_MIN_VEHICLES, ON_REQUEST_FROM } from '@/lib/config';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Оплатить год вперёд: N машин (от 2, первая бесплатна) × 12 месяцев минус 10 %. Всё
 * проверяет база (carrier_annual_plan_create): подписка, новые условия,
 * нет ли уже оплаченного года.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export type AnnualState = { error: string | null; done: boolean };

export async function buyAnnualPlanAction(_prev: AnnualState, formData: FormData): Promise<AnnualState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).subscription;
  await requireRole(locale, 'CARRIER');

  const vehicles = Number(String(formData.get('vehicles') ?? '').trim());
  if (!Number.isInteger(vehicles) || vehicles < ANNUAL_MIN_VEHICLES || vehicles >= ON_REQUEST_FROM) return { error: t.errVehicles, done: false };
  if (formData.get('confirm') !== 'on') return { error: t.errConfirm, done: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_annual_plan_create', { p_vehicles: vehicles });
  if (error) {
    const msg =
      error.code === '23505' ? t.errExists : error.code === '55000' ? t.errTerms : error.code === '42501' ? t.errNotSubscriber : t.errGeneric;
    return { error: msg, done: false };
  }

  revalidatePath(`/${locale}/carrier/subscription`);
  return { error: null, done: true };
}
