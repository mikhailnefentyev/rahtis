import 'server-only';

import type { Locale } from '@/lib/i18n';

/**
 * Ссылка из письма, которую наш сервер может проверить сам.
 *
 * Раньше в письмо клался action_link, который возвращает generateLink, и
 * это не работало по двум причинам сразу.
 *
 * Первая: action_link ведёт на /auth/v1/verify у Supabase, а тот
 * редиректит на redirect_to — но только если адрес есть в списке
 * разрешённых. Незнакомый адрес молча подменяется на Site URL проекта.
 * Ссылка при этом выглядит правильной и ведёт не туда, куда написано.
 *
 * Вторая, и она глубже: после проверки Supabase отдаёт токены во
 * ФРАГМЕНТЕ адреса — после решётки. Фрагмент никогда не уходит на
 * сервер, его видит только браузер. Наш обработчик /auth/confirm читает
 * строку запроса, ничего в ней не находит и честно отвечает «ссылка
 * недействительна». Человек попадает на вход, вводит старый пароль и
 * получает «неверный пароль» — ровно то, на что жалуются.
 *
 * Поэтому ссылку собираем сами из hashed_token, который generateLink
 * возвращает рядом с action_link. Она ведёт прямо на наш обработчик,
 * токен лежит в строке запроса, и verifyOtp проверяет его на сервере.
 * Список разрешённых адресов в этом пути не участвует вовсе.
 */
export function confirmLink(input: {
  site: string;
  locale: Locale;
  hashedToken: string;
  type: 'invite' | 'recovery';
  /** Куда вести после проверки. Путь внутри сайта, без языка. */
  next: string;
}): string {
  const params = new URLSearchParams({
    token_hash: input.hashedToken,
    type: input.type,
    next: `/${input.locale}${input.next}`,
  });

  return `${input.site}/${input.locale}/auth/confirm?${params.toString()}`;
}
