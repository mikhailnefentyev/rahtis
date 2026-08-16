import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '@/lib/env';

/**
 * Продлевает сессию Supabase на каждом запросе.
 *
 * Access-токен живёт около часа. Без этого шага пользователь, открывший
 * вкладку с утра, к обеду обнаружит себя разлогиненным посреди рейса.
 *
 * Пока проект Supabase не подключён, функция просто пропускает запрос
 * дальше: каркас должен собираться и запускаться без ключей.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
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
  await supabase.auth.getUser();

  return response;
}
