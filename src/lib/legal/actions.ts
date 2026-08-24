'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { explainAdmin, withAdminError } from '@/lib/admin/errors';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Kind = Database['public']['Enums']['legal_kind'];

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

async function requireAdmin() {
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'ADMIN') throw new Error('forbidden');
}

/**
 * Новая редакция копией предыдущей.
 *
 * Копирование делает база: между редакциями меняются два-три пункта из
 * полусотни, и набирать документ заново юрист не станет. Нумерация при
 * этом сохраняется — ссылка «п. 5.2» из старого договора должна вести в
 * тот же пункт.
 */
export async function newLegalVersionAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc('new_legal_version', {
    p_kind: String(formData.get('kind') ?? '') as Kind,
  });

  revalidatePath(`/${locale}/admin/legal`);

  if (error) {
    console.error('Редакция не создана:', error.message);
    redirect(withAdminError(`/${locale}/admin/legal`, explainAdmin(error)));
  }
}

export async function activateLegalVersionAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.rpc('activate_legal_version', {
    p_document_id: String(formData.get('document_id') ?? ''),
  });

  revalidatePath(`/${locale}/admin/legal`);

  if (error) {
    console.error('Редакция не активирована:', error.message);
    redirect(withAdminError(`/${locale}/admin/legal`, explainAdmin(error)));
  }
}
