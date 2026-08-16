import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from '@/lib/env';

export type SessionCheck = {
  response: NextResponse;
  /** null — пользователь не вошёл либо Supabase ещё не подключён. */
  userId: string | null;
};

/**
 * Продлевает сессию Supabase и сообщает, кто пришёл.
 *
 * Access-токен живёт около часа. Без этого шага пользователь, открывший
 * вкладку с утра, к обеду обнаружит себя разлогиненным посреди рейса.
 *
 * Пока проект Supabase не подключён, запрос пропускается дальше без
 * пользователя: каркас должен запускаться без ключей.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<SessionCheck> {
  if (!isSupabaseConfigured()) return { response, userId: null };

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Именно getUser, а не getSession: он проверяет токен на сервере Supabase.
  // getSession читает куку на доверии, и подделанную сессию не заметит.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, userId: user?.id ?? null };
}
