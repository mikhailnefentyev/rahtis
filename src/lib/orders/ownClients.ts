'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { isValidBusinessId } from '@/lib/format';
import { getDictionary, isLocale, type Locale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Справочник клиентов перевозчика: правка и удаление.
 *
 * Клиент заводится вместе с первым своим рейсом, и до 12.10.2026 это был
 * единственный способ его тронуть: опечатка в названии оставалась
 * навсегда, а дубль — рядом с оригиналом. Права и правила — в базе
 * (carrier_update_client, carrier_delete_client); здесь только перевод
 * формы в вызов и отказов базы в слова.
 */

export type ClientState = { error: string | null; done: boolean };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();

export async function saveClientAction(_previous: ClientState, formData: FormData): Promise<ClientState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'CARRIER');

  const name = str(formData, 'name').replace(/\s+/g, ' ');
  if (name.length < 2) return { error: t.own.clientRequired, done: false };

  const businessId = str(formData, 'business_id');
  if (businessId && !isValidBusinessId(businessId)) return { error: t.own.clientInvalid, done: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_update_client', {
    p_client_id: str(formData, 'client_id'),
    p_name: name,
    p_business_id: businessId,
    p_email: str(formData, 'email').toLowerCase(),
  });

  if (error) {
    if (error.code === '23505') return { error: t.own.clientDuplicate, done: false };
    if (error.code === '22023') return { error: t.own.clientInvalid, done: false };
    return { error: t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier`, 'layout');
  return { error: null, done: true };
}

export async function deleteClientAction(_previous: ClientState, formData: FormData): Promise<ClientState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  await requireRole(locale, 'CARRIER');

  const supabase = await createClient();
  const { error } = await supabase.rpc('carrier_delete_client', { p_client_id: str(formData, 'client_id') });

  if (error) {
    /* 55000 — у клиента есть рейсы: они остаются в отчётах и документах. */
    return { error: error.code === '55000' ? t.own.clientHasJobs : t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier`, 'layout');
  return { error: null, done: true };
}
