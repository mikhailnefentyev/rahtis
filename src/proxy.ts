import { NextResponse, type NextRequest } from 'next/server';
import { PROTECTED_SEGMENTS, signInPath } from '@/lib/auth/paths';
import { LOCALE_COOKIE, isLocale, matchLocale } from '@/lib/i18n/config';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Проходит перед каждым запросом (в Next 16 это бывшее middleware).
 *
 * Три задачи за один проход:
 *
 *   1. Локаль. Каждый маршрут живёт под префиксом языка (/ru/carrier).
 *      Запрос без префикса получает редирект на подходящий язык — сначала
 *      из куки, затем из Accept-Language, затем дефолт.
 *
 *   2. Сессия. Токен продлевается на каждом запросе, иначе пользователь
 *      разлогинится через час работы.
 *
 *   3. Отсечение неавторизованных от кабинетов.
 *
 * Роль здесь намеренно не проверяется. Для этого нужен запрос к базе, а
 * middleware выполняется на каждый запрос, включая переходы внутри одного
 * кабинета. Роль проверяет layout — один раз на навигацию, с кешированием
 * в пределах запроса.
 *
 * И главное: этот слой не защищает данные. У Next.js была не одна
 * уязвимость с обходом middleware, поэтому доступ к строкам защищает RLS,
 * а здесь решается только навигация.
 */
/** Языки, которые были и ушли. Ссылки на них не должны упираться в 404. */
const RETIRED_LOCALES = ['ru'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first, second] = pathname.split('/');

  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    /*
     * Снятая локаль не должна оставлять битых ссылок: /ru/carrier/desk
     * из закладки ведёт на /fi/carrier/desk, а не на /fi/ru/carrier/desk,
     * которого нет.
     */
    const rest = RETIRED_LOCALES.includes(first ?? '')
      ? pathname.slice(first!.length + 1)
      : pathname === '/'
        ? ''
        : pathname;
    url.pathname = `/${resolveLocale(request)}${rest}`;

    const redirect = NextResponse.redirect(url);
    /*
     * Ответ зависит от языка браузера и от куки, и об этом надо сказать
     * вслух: без Vary любой кэш по дороге вправе запомнить один редирект
     * и отдавать его всем. Тогда финн попадает на английскую страницу
     * или наоборот — в зависимости от того, кто зашёл первым.
     */
    redirect.headers.set('Vary', 'Accept-Language, Cookie');
    return redirect;
  }

  const { response, userId } = await updateSession(request, NextResponse.next({ request }));

  if (!userId && PROTECTED_SEGMENTS.includes(second ?? '')) {
    const url = request.nextUrl.clone();
    url.pathname = signInPath(first);
    /* Куда вернуть после входа — вместе со строкой запроса. */
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

/**
 * На каком языке встречать пришедшего без префикса.
 *
 * Сначала его собственный выбор из куки, потом язык браузера, и только
 * потом запасной. Запасной — английский, а не финский, хотя рынок
 * финский и defaultLocale остался финским.
 *
 * Причина в том, кто именно попадает в эту ветку. Финн и англичанин
 * распознаются по Accept-Language и до неё не доходят. Доходят швед,
 * норвежец, датчанин, эстонец, поляк — то есть ровно те страны, которые
 * платформа обслуживает и в которых финского не знают. Показывать им
 * финскую страницу значило бы встречать три четверти заявленной
 * географии языком, которого они не читают.
 */
function resolveLocale(request: NextRequest): string {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  return matchLocale(request.headers.get('accept-language')) ?? 'en';
}

export const config = {
  /**
   * Мимо проходят статика Next, файлы из /public (у них есть расширение)
   * и /api — у API-маршрутов нет локали, и редирект их сломает.
   */
  matcher: ['/((?!_next/static|_next/image|api/|.*\\.).*)'],
};
