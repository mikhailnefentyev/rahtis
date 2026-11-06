'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { cabinetPath } from '@/lib/auth/paths';
import { defaultLocale, isLocale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';

/**
 * «Позже»: пункт скрыт на N суток (1–30). Строка своя — RLS
 * inbox_dismissals; user_id ставим явно, политика его же и проверяет.
 */
export async function snoozeInboxItemAction(formData: FormData): Promise<void> {
  const raw = String(formData.get('locale') ?? '');
  const locale = isLocale(raw) ? raw : defaultLocale;
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return;

  const key = String(formData.get('key') ?? '').slice(0, 200);
  const days = Math.min(Math.max(Number(formData.get('days')) || 1, 1), 30);
  if (!key) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from('inbox_dismissals')
    .upsert({ user_id: viewer.userId, item_key: key, until: new Date(Date.now() + days * 86_400_000).toISOString() });
  if (error) console.error('пункт не отложен:', error.message);
  revalidatePath(cabinetPath(locale, viewer.role));
}
