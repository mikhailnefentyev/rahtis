/**
 * Публичные переменные окружения Supabase.
 *
 * Секретный ключ здесь намеренно отсутствует — он живёт в env.server.ts,
 * который защищён импортом 'server-only'. Держать оба ключа в одном модуле
 * значит рано или поздно затащить секрет в клиентский бандл.
 *
 * Обращения к NEXT_PUBLIC_* обязаны быть буквальными: Next подставляет их
 * на этапе сборки, поэтому `process.env[name]` с вычисляемым ключом молча
 * вернёт undefined в браузере.
 */

/** Префиксы ключей нового формата Supabase — это не JWT. */
const PUBLISHABLE_PREFIX = 'sb_publishable_';
const SECRET_PREFIX = 'sb_secret_';

export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error(missing('NEXT_PUBLIC_SUPABASE_URL'));
  return value;
}

/**
 * Publishable-ключ (`sb_publishable_…`, ранее назывался anon).
 *
 * Попадает в браузерный бандл — так и задумано. Доступ ограничивают
 * политики RLS, а не секретность ключа.
 */
export function supabasePublishableKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!value) throw new Error(missing('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));

  // Самая дорогая ошибка в этом файле: секретный ключ, вписанный в
  // переменную с префиксом NEXT_PUBLIC_, уедет в браузер к каждому
  // посетителю и откроет всю базу в обход RLS. Стоит одной проверки.
  if (value.startsWith(SECRET_PREFIX)) {
    throw new Error(
      'В NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY лежит секретный ключ (sb_secret_…). ' +
        'Всё с префиксом NEXT_PUBLIC_ попадает в браузер. Впишите сюда publishable-ключ ' +
        '(sb_publishable_…), а секретный — в SUPABASE_SECRET_KEY, и обязательно ' +
        'отзовите засвеченный ключ в панели Supabase.',
    );
  }

  return value;
}

/** Настроен ли Supabase. Позволяет коду работать до подключения проекта. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export { PUBLISHABLE_PREFIX, SECRET_PREFIX };

export function missing(name: string): string {
  return `Не задана переменная окружения ${name}. Скопируйте .env.example в .env.local и заполните значения из панели Supabase (Project Settings → API Keys).`;
}
