'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/guard';
import { flashError } from '@/lib/forms/flash';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { syncGpsConnection } from './sync';
import { GpsError } from './http';
import { fetchWithHosts, providerSpec } from './providers';
import { GPS_PROVIDERS, type GpsProvider } from './types';

/**
 * GPS в кабинете перевозчика: подключить провайдера (Wialon, Mapon, Navirec,
 * Ruptela, Navixy, Samsara, Webfleet, ABAX по своим client id), обновить, отключить,
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

export async function connectGpsAction(_prev: GpsConnectState, formData: FormData): Promise<GpsConnectState> {
  const locale = toLocale(formData.get('locale'));
  const t = (await getDictionary(locale)).gps;
  const { viewer, allowed } = await carrier(locale);
  if (!allowed) return { error: t.locked, done: false };

  const providerRaw = str(formData, 'provider') || 'WIALON';
  if (!(GPS_PROVIDERS as readonly string[]).includes(providerRaw)) return { error: t.errInput, done: false };
  const provider = providerRaw as GpsProvider;
  const spec = providerSpec(provider);

  /* Webfleet входит четырьмя полями, ABAX вручную — своими client id и secret: собираем их в один секрет. */
  const raw =
    provider === 'WEBFLEET'
      ? JSON.stringify({ account: str(formData, 'account'), username: str(formData, 'username'), password: String(formData.get('password') ?? ''), apikey: str(formData, 'key') })
      : provider === 'ABAX'
        ? JSON.stringify({ cid: str(formData, 'client_id'), cs: str(formData, 'client_secret') })
        : str(formData, 'key');

  let input;
  try {
    input = spec.parse(raw, spec.customHost ? str(formData, 'server') : '');
  } catch {
    return { error: t.errInput, done: false };
  }

  /* Сначала проверяем ключ: в базу попадает только работающий. */
  let checked;
  try {
    checked = await fetchWithHosts(spec, input, null, null);
  } catch (e) {
    const kind = e instanceof GpsError ? e.kind : 'UNREACHABLE';
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
    p_provider: provider,
    p_api_host: checked.host,
    p_token: input.token,
    p_label: str(formData, 'label').slice(0, 80),
    p_account_name: checked.account ?? '',
    p_account_ref: checked.accountRef ?? '',
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
