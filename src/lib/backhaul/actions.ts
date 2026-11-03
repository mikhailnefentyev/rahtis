'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { flashFailure } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { RADII, isRadius } from './radius';

type HaulKind = Database['public']['Enums']['haul_kind'];
const HAUL_KINDS: readonly HaulKind[] = ['TRAILER', 'CONTAINER', 'VAN', 'TRUCK', 'SEMI', 'TIPPER'];

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const text = (form: FormData, key: string): string => String(form.get(key) ?? '').trim();
const date = (form: FormData, key: string): string | null => {
  const value = text(form, key);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};
const radius = (form: FormData, key: string): number => {
  const value = Number.parseInt(text(form, key), 10);
  return isRadius(value) ? value : RADII[2];
};

export type LaneWatchState = { error: string | null; done: boolean };

/**
 * Новая подписка Kuormavahti.
 *
 * Город — только из тех, что RAHTIS уже знает (lane_places): внешнего
 * геокодера здесь нет, и координата берётся из точек заказов. Не
 * найденный город — отказ с просьбой выбрать из списка, а не догадка.
 */
export async function saveLaneWatchAction(_previous: LaneWatchState, formData: FormData): Promise<LaneWatchState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await requireRole(locale, 'CARRIER');
  const company = viewer.company!;

  const fromCity = text(formData, 'from_city');
  const toCity = text(formData, 'to_city');
  if (!fromCity) return { error: t.validation.required, done: false };

  const supabase = await createClient();
  const { data: places } = await supabase.rpc('lane_places');
  const find = (name: string) => (places ?? []).find((p) => p.city.toLowerCase() === name.toLowerCase());

  const from = find(fromCity);
  const to = toCity ? find(toCity) : null;
  if (!from || (toCity && !to)) return { error: t.backhaul.unknownPlace, done: false };

  const kind = text(formData, 'haul_kind') as HaulKind;
  const dateFrom = date(formData, 'date_from');
  const dateTo = date(formData, 'date_to');
  if (dateFrom && dateTo && dateTo < dateFrom) return { error: t.backhaul.badDates, done: false };

  const { error } = await supabase.from('lane_watches').insert({
    company_id: company.id,
    from_city: from.city,
    from_lat: from.lat,
    from_lon: from.lon,
    from_radius_km: radius(formData, 'from_radius_km'),
    to_city: to?.city ?? null,
    to_lat: to?.lat ?? null,
    to_lon: to?.lon ?? null,
    to_radius_km: to ? radius(formData, 'to_radius_km') : null,
    haul_kind: HAUL_KINDS.includes(kind) ? kind : null,
    date_from: dateFrom,
    date_to: dateTo,
    notify_email: formData.get('notify_email') === 'on',
  });

  if (error) {
    return { error: error.code === '54000' ? t.backhaul.limit : t.error.generic, done: false };
  }

  revalidatePath(`/${locale}/carrier/desk/watch`);
  return { error: null, done: true };
}

/** Пауза и продолжение. */
export async function toggleLaneWatchAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase
    .from('lane_watches')
    .update({ active: formData.get('active') === 'true' })
    .eq('id', text(formData, 'id'));
  await flashFailure(locale, error);
  revalidatePath(`/${locale}/carrier/desk/watch`);
}

export async function deleteLaneWatchAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { error } = await supabase.from('lane_watches').delete().eq('id', text(formData, 'id'));
  await flashFailure(locale, error);
  revalidatePath(`/${locale}/carrier/desk/watch`);
}
