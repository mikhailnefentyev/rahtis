/**
 * Типы схемы Supabase.
 *
 * Файл генерируется, руками его не правят:
 *
 *   npx supabase gen types typescript --linked > src/types/database.ts
 *
 * До появления схемы (Этапы 1–4) здесь стоит заглушка: она позволяет
 * типизировать клиенты как `SupabaseClient<Database>` уже сейчас, чтобы
 * потом не переписывать импорты по всему проекту.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
