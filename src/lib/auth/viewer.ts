import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Company, PartyRole, Profile } from '@/types/db';

/**
 * Кто смотрит на страницу.
 *
 * Состояний три, и все три встречаются в жизни:
 *
 *   guest  — не вошёл;
 *   orphan — вошёл, но профиля нет. Схема это допускает намеренно:
 *            триггер on_auth_user_created не создаёт профиль пользователю
 *            без роли в app_metadata, а такой появляется, если завести
 *            его руками в панели Supabase. Роли у него нет, значит и
 *            кабинета нет — но и молча выкидывать его нельзя;
 *   ready  — вошёл, профиль есть.
 */
export type Viewer =
  | { status: 'guest' }
  | { status: 'orphan'; userId: string; email: string | null }
  | {
      status: 'ready';
      userId: string;
      email: string | null;
      profile: Profile;
      role: PartyRole;
      /** У администратора компании нет. */
      company: Company | null;
    };

/**
 * Читает пользователя и его профиль.
 *
 * Обёрнуто в React cache(): в пределах одного запроса функцию вызывают
 * и layout, и страница, и шапка — запрос к базе при этом один.
 *
 * getUser(), а не getSession(): первый проверяет токен на сервере Supabase,
 * второй доверяет куке и подделанную сессию не заметит.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: 'guest' };

  /*
   * Компания подтягивается вместе с профилем одним запросом. Связь
   * составная — (company_id, role) → (id, kind), — поэтому имя внешнего
   * ключа указано явно: без подсказки PostgREST выбирает связь сам, и
   * добавление второй ссылки на companies сломало бы запрос молча.
   */
  const { data, error } = await supabase
    .from('profiles')
    .select('*, company:companies!profiles_company_matches_role(*)')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) {
    return { status: 'orphan', userId: user.id, email: user.email ?? null };
  }

  const { company, ...profile } = data as Profile & { company: Company | null };

  return {
    status: 'ready',
    userId: user.id,
    email: user.email ?? null,
    profile,
    role: profile.role,
    company: company ?? null,
  };
});
