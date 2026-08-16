import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isLocale, defaultLocale } from '@/lib/i18n';
import { noAccessPath, safeRedirect, signInPath } from '@/lib/auth/paths';

/**
 * Точка приземления ссылок из писем: приглашение, подтверждение почты,
 * восстановление пароля.
 *
 * Обрабатываются оба формата, которыми Supabase размечает такие ссылки:
 *
 *   code       — обмен кода на сессию, поток PKCE;
 *   token_hash — прямая проверка одноразового токена.
 *
 * Какой из них придёт, зависит от шаблона письма в настройках проекта.
 * Поддерживать оба дешевле, чем ловить потом «ссылка не работает» у
 * половины приглашённых.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : defaultLocale;

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const next = safeRedirect(url.searchParams.get('next'), `/${locale}`);

  const supabase = await createClient();

  let failed = true;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'invite' | 'signup' | 'recovery' | 'email_change' | 'magiclink',
    });
    failed = Boolean(error);
  }

  if (failed) {
    /* Ссылка просрочена или уже использована — объясняем это на входе. */
    return NextResponse.redirect(new URL(`${signInPath(locale)}?reason=link`, url.origin));
  }

  /*
   * Профиль создаёт триггер по app_metadata. Если роли там не оказалось,
   * пользователь попадёт в тупик с объяснением, а не в пустой кабинет.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(signInPath(locale), url.origin));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.redirect(
    new URL(profile ? next : noAccessPath(locale), url.origin),
  );
}
