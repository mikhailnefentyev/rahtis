import { createBrowserClient } from '@supabase/ssr';
import { supabasePublishableKey, supabaseUrl } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Клиент для браузера (Client Components).
 *
 * Работает под publishable-ключом и правами вошедшего пользователя, поэтому
 * всё, что он может увидеть или изменить, ограничено политиками RLS. Любая
 * операция, которой нужны права выше пользовательских — модерация, допуск
 * машин, выплаты — идёт через серверный код, а не отсюда.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
