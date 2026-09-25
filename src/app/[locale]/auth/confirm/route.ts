import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isLocale, defaultLocale, type Locale } from '@/lib/i18n';
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
 *
 * ПОЧЕМУ token_hash ТРАТИТСЯ ТОЛЬКО ПО POST. Почтовые сервисы — Outlook и
 * Hotmail в первую очередь — открывают ссылки из писем сами, проверяя их
 * на безопасность, раньше человека. Пока токен тратился по GET, такая
 * проверка съедала одноразовую ссылку, и человек видел «ссылка
 * недействительна» при первом же нажатии. Первый клиент платформы пришёл
 * с hotmail.com.
 *
 * Теперь GET только ведёт на страницу /auth/continue с кнопкой «Jatka».
 * Сканеры ссылки открывают, но форм не отправляют; токен тратится, когда
 * человек нажал кнопку и форма пришла сюда POST'ом. Адрес ссылки в письмах
 * прежний, поэтому уже отправленные приглашения тоже идут этим путём.
 */

function localeOf(raw: string): Locale {
  return isLocale(raw) ? raw : defaultLocale;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const locale = localeOf((await params).locale);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    /*
     * PKCE-код сканеру не страшен: без verifier из cookie браузера,
     * начавшего вход, он бесполезен. Поэтому этот путь остаётся на GET.
     */
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? linkFailed(locale, url.origin) : landing(locale, url, url.searchParams.get('next'));
  }

  const continueUrl = new URL(`/${locale}/auth/continue`, url.origin);
  for (const key of ['token_hash', 'type', 'next']) {
    const value = url.searchParams.get(key);
    if (value) continueUrl.searchParams.set(key, value);
  }
  return NextResponse.redirect(continueUrl);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const locale = localeOf((await params).locale);
  const url = new URL(request.url);
  const form = await request.formData();

  const tokenHash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '');
  const next = String(form.get('next') ?? '') || null;

  if (!tokenHash || !type) return linkFailed(locale, url.origin);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'invite' | 'signup' | 'recovery' | 'email_change' | 'magiclink',
  });

  return error ? linkFailed(locale, url.origin) : landing(locale, url, next);
}

/* Ссылка просрочена или уже использована — объясняем это на входе. */
function linkFailed(locale: Locale, origin: string) {
  /* 303: после POST браузер обязан прийти следующим запросом GET'ом. */
  return NextResponse.redirect(new URL(`${signInPath(locale)}?reason=link`, origin), 303);
}

/*
 * Профиль создаёт триггер по app_metadata. Если роли там не оказалось,
 * пользователь попадёт в тупик с объяснением, а не в пустой кабинет.
 */
async function landing(locale: Locale, url: URL, rawNext: string | null) {
  const next = safeRedirect(rawNext, `/${locale}`);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(signInPath(locale), url.origin), 303);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.redirect(new URL(profile ? next : noAccessPath(locale), url.origin), 303);
}
