import 'server-only';

import { PUBLISHABLE_PREFIX, missing } from './env';

/**
 * Серверные секреты.
 *
 * 'server-only' в первой строке — не украшение: любая попытка импортировать
 * этот модуль из клиентского компонента станет ошибкой сборки, а не тихо
 * утёкшим ключом. Next и так не подставляет переменные без префикса
 * NEXT_PUBLIC_ в браузерный бандл, но полагаться на это как на единственную
 * защиту нельзя: достаточно одного человека, который добавит префикс,
 * чтобы «починить undefined».
 */

/**
 * Secret-ключ (`sb_secret_…`, ранее назывался service_role).
 *
 * Обходит RLS полностью — это ключ от всей базы. Никогда не должен
 * оказаться в переменной с префиксом NEXT_PUBLIC_.
 */
export function supabaseSecretKey(): string {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) throw new Error(missing('SUPABASE_SECRET_KEY'));

  // Обратная перестановка ключей не опасна, но даёт невнятные 401
  // вместо понятной ошибки: publishable-ключ просто не имеет прав.
  if (value.startsWith(PUBLISHABLE_PREFIX)) {
    throw new Error(
      'В SUPABASE_SECRET_KEY лежит publishable-ключ (sb_publishable_…). ' +
        'Нужен секретный ключ (sb_secret_…): Project Settings → API Keys → Reveal.',
    );
  }

  return value;
}
