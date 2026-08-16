/**
 * Доступ к переменным окружения с понятной ошибкой вместо `undefined`,
 * который всплывёт где-нибудь в глубине Supabase SDK.
 *
 * NEXT_PUBLIC_* обращения обязаны быть буквальными: Next подставляет их
 * на этапе сборки, поэтому `process.env[name]` с вычисляемым ключом
 * молча вернёт undefined в браузере.
 */

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error(missing('NEXT_PUBLIC_SUPABASE_URL'));
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error(missing('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  return value;
}

/** Ключ service_role: только серверный код, никогда не в браузер. */
export function supabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error(missing('SUPABASE_SERVICE_ROLE_KEY'));
  return value;
}

/** Настроен ли Supabase. Позволяет коду мягко деградировать до подключения проекта. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function missing(name: string): string {
  return `Не задана переменная окружения ${name}. Скопируйте .env.example в .env.local и заполните значения из панели Supabase (Settings → API).`;
}
