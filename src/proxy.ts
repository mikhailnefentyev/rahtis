import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, defaultLocale, isLocale, matchLocale } from '@/lib/i18n/config';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Проходит перед каждым запросом (в Next 16 это бывшее middleware).
 *
 * Решает две задачи за один проход:
 *
 *   1. Локаль. Каждый маршрут живёт под префиксом языка (/ru/carrier/desk).
 *      Запрос без префикса получает редирект на подходящий язык — сначала
 *      из куки, затем из Accept-Language, затем дефолт.
 *
 *   2. Сессия Supabase. Токен продлевается на каждом запросе, иначе
 *      пользователь разлогинится через час работы.
 *
 * Защита маршрутов по ролям появится на Этапе 1 — она встанет между этими
 * двумя шагами, когда сессия уже разобрана, но ответ ещё не отдан.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${resolveLocale(request)}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request });
  return updateSession(request, response);
}

function resolveLocale(request: NextRequest): string {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return matchLocale(request.headers.get('accept-language')) ?? defaultLocale;
}

export const config = {
  /**
   * Мимо проходят статика Next, файлы из /public (у них есть расширение)
   * и /api — у API-маршрутов нет локали, и редирект их сломает.
   */
  matcher: ['/((?!_next/static|_next/image|api/|.*\\.).*)'],
};
