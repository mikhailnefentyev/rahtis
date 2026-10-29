import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { siteUrl } from '@/lib/config';
import { abaxRedeemCode } from '@/lib/gps/abax';
import { GpsError } from '@/lib/gps/http';
import { fetchWithHosts, PROVIDERS } from '@/lib/gps/providers';
import { syncGpsConnection } from '@/lib/gps/sync';
import { defaultLocale, isLocale } from '@/lib/i18n';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Возврат от ABAX: проверяем state из куки и сессию перевозчика той же
 * компании, меняем код на refresh token, проверяем, что машины читаются,
 * и только тогда сохраняем подключение (секрет — в Vault).
 */
export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'rahtis_abax_state';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const saved = jar.get(STATE_COOKIE)?.value ?? '';
  jar.delete({ name: STATE_COOKIE, path: '/api/gps/abax' });

  const [state, rawLocale, companyId] = saved.split(':');
  const locale = isLocale(rawLocale ?? '') ? rawLocale! : defaultLocale;
  const back = (q: string) => NextResponse.redirect(`${siteUrl()}/${locale}/carrier/gps?abax=${q}`);

  const code = url.searchParams.get('code');
  const returned = url.searchParams.get('state') ?? '';
  if (url.searchParams.get('error')) return back('cancelled');
  if (!code || !state || !returned || !same(state, returned)) return back('failed');

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company || viewer.company.id !== companyId) return back('denied');
  const { data: access } = await (await createClient()).rpc('own_orders_access');
  if (!access) return back('locked');

  let secret: string;
  let checked;
  try {
    secret = await abaxRedeemCode(code, siteUrl());
    checked = await fetchWithHosts(PROVIDERS.ABAX, { token: secret, hosts: ['api.abax.cloud'] }, null, null);
  } catch (e) {
    return back(e instanceof GpsError && e.kind === 'KEY' ? 'key' : 'failed');
  }

  const admin = createAdminClient();
  const { count } = await admin.from('gps_connections').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
  if ((count ?? 0) >= 5) return back('toomany');

  const { data: id, error } = await admin.rpc('gps_connection_create', {
    p_company_id: companyId,
    p_user_id: viewer.userId,
    p_provider: 'ABAX',
    p_api_host: 'api.abax.cloud',
    /* Проверка уже обновила токен — сохраняем самый свежий. */
    p_token: checked.newToken ?? secret,
    p_label: '',
    p_account_name: '',
  });
  if (error || !id) return back('failed');

  await syncGpsConnection(id, companyId);
  return back('connected');
}
