'use server';

import { revalidatePath } from 'next/cache';
import { isLocale, defaultLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * Принятие новых редакций из плашки в кабинете.
 *
 * accept_legal принимает разом все действующие редакции, обязательные
 * для вида компании; уже принятые пропускает. Источник REACCEPT отличает
 * такое согласие от данного при активации — при разборе «когда компания
 * согласилась с v8» это видно в журнале.
 */
export async function acceptUpdatedLegalAction(formData: FormData): Promise<void> {
  const raw = String(formData.get('locale') ?? '');
  const locale = isLocale(raw) ? raw : defaultLocale;

  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_legal', { p_source: 'REACCEPT' });
  if (error) console.error('Новые редакции не приняты:', error.message);

  revalidatePath(`/${locale}`, 'layout');
}
