'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';

/**
 * Отметить всё прочитанным.
 *
 * Сессией пользователя, а не служебным ключом: RLS сама ограничит
 * обновление своей компанией, а колоночный грант — единственным полем
 * read_at. Ни то, ни другое нельзя обойти из браузера.
 */
export async function markAllReadAction(formData: FormData): Promise<void> {
  const raw = String(formData.get('locale') ?? '');
  const locale: Locale = isLocale(raw) ? raw : defaultLocale;

  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);

  if (error) {
    console.error('Уведомления не отмечены прочитанными:', error.message);
  }

  revalidatePath(`/${locale}/notifications`, 'layout');
}
