'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { flashError } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { syncGpsConnection } from './sync';
import { fetchWialonUnits, parseWialonInput, WialonError } from './wialon';

/**
 * GPS в кабинете перевозчика: подключить Wialon, обновить, отключить,
 * привязать машину. Входит в подписку — та же проверка, что у топлива.
 */

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

async function carrier(locale: Locale) {
  const viewer = await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const { data: access } = await supabase.rpc('own_orders_access');
  return { viewer, supabase, allowed: !!access };
}

export type GpsConnectState = { error: string | null; done: boolean };

export async function connectWialonAction(_prev: GpsConnectState, formData: FormData): Promise<GpsConnectState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).gps;
  const { viewer, allowed } = await carrier(locale);
  if (!allowed) return { error: t.locked, done: false };

  let input;
  try {
    input = parseWialonInput(str(formData, 'key'), str(formData, 'server'));
  } catch {
    return { error: t.errInput, done: false };
  }

  /* Сначала проверяем ключ: в базу попадает только работающий. */
  let checked;
  try {
    checked = await fetchWialonUnits(input.token, input.hosts);
  } catch (e) {
    const kind = e instanceof WialonError ? e.kind : 'UNREACHABLE';
    return { error: kind === 'KEY' ? t.errKey : kind === 'INPUT' ? t.errInput : t.errUnreachable, done: false };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('gps_connections')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', viewer.company!.id);
  if ((count ?? 0) >= 5) return { error: t.errTooMany, done: false };

  const { data: id, error } = await admin.rpc('gps_connection_create', {
    p_company_id: viewer.company!.id,
    p_user_id: viewer.userId,
    p_api_host: checked.host,
    p_token: input.token,
    p_label: str(formData, 'label').slice(0, 80),
    p_account_name: checked.account ?? '',
  });
  if (error || !id) return { error: t.errGeneric, done: false };

  await syncGpsConnection(id, viewer.company!.id);
  revalidatePath(`/${locale}/carrier/gps`);
  return { error: null, done: true };
}

export async function refreshGpsAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const { viewer, supabase, allowed } = await carrier(locale);
  if (!allowed) return;
  const { data: conns } = await supabase.from('gps_connections').select('id').eq('company_id', viewer.company!.id);
  await Promise.all((conns ?? []).map((c) => syncGpsConnection(c.id, viewer.company!.id)));
  revalidatePath(`/${locale}/carrier/gps`);
}

export async function deleteGpsConnectionAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await requireRole(locale, 'CARRIER');
  const { error } = await createAdminClient().rpc('gps_connection_delete', {
    p_id: str(formData, 'id'),
    p_company_id: viewer.company!.id,
  });
  if (error) await flashError((await getDictionary(locale)).gps.errGeneric);
  revalidatePath(`/${locale}/carrier/gps`);
}

export async function mapGpsUnitAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireRole(locale, 'CARRIER');
  const supabase = await createClient();
  const vehicle = str(formData, 'vehicle_id');
  const { error } = await supabase.rpc('carrier_gps_map_unit', {
    p_unit_id: str(formData, 'unit_id'),
    p_vehicle_id: vehicle || (null as unknown as string),
  });
  if (error) await flashError((await getDictionary(locale)).gps.errGeneric);
  revalidatePath(`/${locale}/carrier/gps`);
}
