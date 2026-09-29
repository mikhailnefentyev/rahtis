'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { defaultLocale, getDictionary, isLocale, type Locale } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/server';
import { generateKey } from './key';

/**
 * Выпуск и отзыв ключей API из кабинета заказчика.
 *
 * Ключ создаётся здесь, в базу уходит только его SHA-256, а сам ключ
 * возвращается в ответе действия ровно один раз — чтобы человек его
 * скопировал. Второго показа нет: потерянный ключ отзывают и выпускают
 * новый.
 */

export type CreateKeyState = { error: string | null; key: string | null; name: string | null };

function toLocale(value: FormDataEntryValue | null): Locale {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
}

export async function createApiKeyAction(_previous: CreateKeyState, formData: FormData): Promise<CreateKeyState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);

  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.role !== 'SHIPPER' || !viewer.company) {
    return { error: t.error.forbidden, key: null, name: null };
  }

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 1 || name.length > 60) {
    return { error: t.api.nameRequired, key: null, name: null };
  }
  const scope = formData.get('scope') === 'WRITE' ? 'WRITE' : 'READ';

  const fresh = generateKey(viewer.company.is_test);
  const supabase = await createClient();
  const { error } = await supabase.rpc('api_key_create', {
    p_name: name,
    p_scope: scope,
    p_prefix: fresh.prefix,
    p_hash: fresh.hash,
  });

  if (error) {
    const message =
      error.code === '55001' ? t.api.tooMany : error.code === '55000' ? t.api.needActive : t.api.createFailed;
    return { error: message, key: null, name: null };
  }

  revalidatePath(`/${locale}/shipper/api`);
  return { error: null, key: fresh.key, name };
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const id = String(formData.get('id') ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) return;

  const supabase = await createClient();
  await supabase.rpc('api_key_revoke', { p_id: id });
  revalidatePath(`/${locale}/shipper/api`);
}
