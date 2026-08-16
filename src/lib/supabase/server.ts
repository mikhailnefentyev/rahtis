import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Клиент для серверных компонентов, Server Actions и route handlers.
 *
 * Права те же, что у пользователя (publishable-ключ + его сессия) — RLS
 * остаётся главной защитой. Создавайте клиент внутри каждой функции: он
 * привязан к куки конкретного запроса и не переживает переиспользования.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component не может писать куки. Это ожидаемо: обновлённую
          // сессию всё равно запишет middleware на следующем запросе.
        }
      },
    },
  });
}
