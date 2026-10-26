'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { getDictionary, isLocale, defaultLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { isWasteProcedure, normalizeEwc, RECOVERY_CODES } from './shipment';
import { REGISTRATION_COUNTRIES } from './registrations';

export type WasteState = { error: string | null; saved: boolean };

const text = (form: FormData, key: string, max: number): string | null => {
  const value = String(form.get(key) ?? '').trim();
  return value ? value.slice(0, max) : null;
};

/**
 * Отметка «отходы» и данные Приложения VII. Пишут обе стороны заказа
 * (RLS order_waste_write_party): организатор перевозки — обычно заказчик,
 * в своих рейсах — перевозчик. Снятая галочка удаляет строку.
 */
export async function saveOrderWasteAction(_previous: WasteState, formData: FormData): Promise<WasteState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return { error: t.waste.noAccess, saved: false };

  const orderId = String(formData.get('order_id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(orderId)) return { error: t.waste.noAccess, saved: false };
  const supabase = await createClient();

  if (formData.get('is_waste') !== 'on') {
    const { error } = await supabase.from('order_waste').delete().eq('order_id', orderId);
    if (error) return { error: t.waste.noAccess, saved: false };
    revalidatePath(`/${locale}/waste/${orderId}`);
    return { error: null, saved: true };
  }

  const procedure = String(formData.get('procedure') ?? 'ANNEX_VII');
  const recovery = String(formData.get('recovery_code') ?? '');
  const qty = Number.parseInt(String(formData.get('quantity_kg') ?? '').replace(/\s/g, ''), 10);

  const { error } = await supabase.from('order_waste').upsert({
    order_id: orderId,
    procedure: isWasteProcedure(procedure) ? procedure : 'ANNEX_VII',
    ewc_code: normalizeEwc(String(formData.get('ewc_code') ?? '')),
    basel_code: text(formData, 'basel_code', 20)?.toUpperCase() ?? null,
    description: text(formData, 'description', 300),
    quantity_kg: Number.isFinite(qty) && qty > 0 && qty <= 100000 ? qty : null,
    producer_name: text(formData, 'producer_name', 200),
    producer_address: text(formData, 'producer_address', 300),
    consignee_name: text(formData, 'consignee_name', 200),
    consignee_address: text(formData, 'consignee_address', 300),
    consignee_contact: text(formData, 'consignee_contact', 200),
    facility_name: text(formData, 'facility_name', 200),
    facility_address: text(formData, 'facility_address', 300),
    recovery_code: (RECOVERY_CODES as readonly string[]).includes(recovery) ? recovery : null,
    contract_ref: text(formData, 'contract_ref', 120),
    diwass_number: text(formData, 'diwass_number', 80),
  });
  if (error) return { error: t.waste.noAccess, saved: false };

  revalidatePath(`/${locale}/waste/${orderId}`);
  return { error: null, saved: true };
}

export type RegistrationsState = { error: string | null; saved: boolean };

/**
 * Номера регистраций перевозчика отходов — правит сама компания
 * (grant update (waste_registrations), RLS компании на companies).
 */
export async function saveWasteRegistrationsAction(_previous: RegistrationsState, formData: FormData): Promise<RegistrationsState> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || !viewer.company) return { error: t.waste.noAccess, saved: false };

  const regs: Record<string, string> = {};
  for (const c of REGISTRATION_COUNTRIES) {
    const value = String(formData.get(`reg_${c}`) ?? '').trim().slice(0, 80);
    if (value) regs[c] = value;
  }

  const supabase = await createClient();
  const { error } = await supabase.from('companies').update({ waste_registrations: regs }).eq('id', viewer.company.id);
  if (error) return { error: t.waste.noAccess, saved: false };
  revalidatePath(`/${locale}/account`);
  return { error: null, saved: true };
}
