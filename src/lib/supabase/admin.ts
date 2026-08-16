import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseServiceRoleKey, supabaseUrl } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Клиент под service_role: обходит RLS полностью.
 *
 * Импорт 'server-only' в первой строке — не украшение: он превращает любую
 * попытку затащить этот модуль в клиентский бандл в ошибку сборки, а не в
 * утёкший ключ.
 *
 * Допустимые сценарии:
 *   - модерация заявок и выдача допуска машинам (действия оператора);
 *   - серверные задания: таймауты матчинга, ночные отчёты;
 *   - вебхуки n8n, приходящие без пользовательской сессии.
 *
 * Всё остальное обязано идти через `lib/supabase/server.ts` под правами
 * пользователя. Каждый вызов отсюда — это место, где RLS вас не спасёт,
 * и проверку прав нужно писать руками.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
