import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Отказы базы, которые оператор должен увидеть.
 *
 * Раньше все они уходили в console.error, а страница молча
 * перерисовывалась: оператор жал «Jäädytä» у компании с незакрытыми
 * заказами и не понимал, почему ничего не произошло. Кнопка, которая
 * иногда работает без объяснений, хуже кнопки, которой нет.
 *
 * Разбор по кодам SQLSTATE, а не по тексту сообщения. Тексты в базе
 * русские и меняются при первой же переформулировке — на них уже
 * завязаны две проверки в матчинге, и это ошибка, которую здесь не
 * повторяем.
 */

/** Ключ в словаре под t.moderation.* или t.billing.*. */
export type AdminErrorCode =
  | 'freezeBlocked'
  | 'removeBlocked'
  | 'onlyForward'
  | 'notDone'
  | 'inviteNotSent'
  | 'generic';

const BY_SQLSTATE: Record<string, AdminErrorCode> = {
  /* freeze_company: у компании есть незакрытые заказы. */
  '55003': 'freezeBlocked',
  /* delete_company: у компании есть заказы, история не стирается. */
  '55002': 'removeBlocked',
  /* set_billing: рейс ещё не закрыт. */
  '55004': 'notDone',
  /* set_billing: расчёты идут только вперёд. */
  '55005': 'onlyForward',
};

export function explainAdmin(error: PostgrestError | null | undefined): AdminErrorCode | null {
  if (!error) return null;
  return BY_SQLSTATE[error.code ?? ''] ?? 'generic';
}

/**
 * Куда вернуть оператора с отметкой об отказе.
 *
 * Через строку запроса, а не через состояние формы: формы админки —
 * обычные серверные, без useActionState, и делать их клиентскими ради
 * одной надписи значит утащить в браузер половину страницы.
 */
export function withAdminError(path: string, code: AdminErrorCode | null): string {
  return code ? `${path}?error=${code}` : path;
}
