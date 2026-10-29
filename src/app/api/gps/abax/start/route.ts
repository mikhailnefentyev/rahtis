import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth/viewer';
import { abaxAuthorizeUrl } from '@/lib/gps/abax';
import { defaultLocale, isLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';

/**
 * «Подключить ABAX»: перевозчика уводим на вход ABAX (OAuth, Authorization
 * Code). state — в куке на 10 минут, только для пути возврата: возврат без
 * неё или с чужим state не примем.
 */
export const dynamic = 'force-dynamic';

const ABAX_STATE_COOKIE = 'rahtis_abax_state';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('locale') ?? '';
  const locale = isLocale(raw) ? raw : defaultLocale;
  const back = (q: string) => NextResponse.redirect(`${siteUrl()}/${locale}/carrier/gps?abax=${q}`);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'CARRIER' || !viewer.company) return back('denied');
  const { data: access } = await (await createClient()).rpc('own_orders_access');
  if (!access) return back('locked');

  const state = randomBytes(24).toString('hex');
  const target = abaxAuthorizeUrl(siteUrl(), state);
  if (!target) return back('unavailable');

  (await cookies()).set(ABAX_STATE_COOKIE, `${state}:${locale}:${viewer.company.id}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/gps/abax',
    maxAge: 600,
  });
  return NextResponse.redirect(target);
}
