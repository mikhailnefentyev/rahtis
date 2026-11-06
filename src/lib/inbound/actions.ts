'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth/viewer';
import { cabinetPath } from '@/lib/auth/paths';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { parseSenderList } from './email';

/*
 * Адрес пересылки заказов: новый адрес, дополнительные отправители,
 * «черновик не нужен». Права — в функциях базы (главный пользователь,
 * своя компания).
 */

const toLocale = (value: FormDataEntryValue | null): Locale => {
  const raw = String(value ?? '');
  return isLocale(raw) ? raw : defaultLocale;
};

export type InboxSettingsState = { error: string | null; saved: boolean };

/** Новый адрес: старый перестаёт принимать письма сразу. */
export async function rotateInboxAddressAction(_previous: InboxSettingsState, formData: FormData): Promise<InboxSettingsState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.profile.member_kind === 'DISPATCHER') return { error: t.emailInbox.ownerOnly, saved: false };

  const { error } = await (await createClient()).rpc('rotate_order_inbox_address');
  if (error) return { error: t.error.generic, saved: false };
  revalidatePath(`/${locale}`, 'layout');
  return { error: null, saved: true };
}

export async function saveInboxSendersAction(_previous: InboxSettingsState, formData: FormData): Promise<InboxSettingsState> {
  const locale = toLocale(formData.get('locale'));
  const t = await getDictionary(locale);
  const viewer = await getViewer();
  if (viewer.status !== 'ready' || viewer.profile.member_kind === 'DISPATCHER') return { error: t.emailInbox.ownerOnly, saved: false };

  const { list, invalid } = parseSenderList(String(formData.get('senders') ?? '').slice(0, 6000));
  if (invalid.length > 0) return { error: t.emailInbox.sendersInvalid.replace('{value}', invalid[0].slice(0, 80)), saved: false };
  if (list.length > 20) return { error: t.emailInbox.sendersTooMany, saved: false };

  const { error } = await (await createClient()).rpc('set_order_inbox_senders', { p_senders: list });
  if (error) return { error: error.code === '22023' ? t.emailInbox.sendersInvalid.replace('{value}', '') : t.error.generic, saved: false };
  revalidatePath(`/${locale}/account`);
  return { error: null, saved: true };
}

/** «Не нужно» из списка «Требует действия». */
export async function dismissEmailDraftAction(formData: FormData): Promise<void> {
  const locale = toLocale(formData.get('locale'));
  const viewer = await getViewer();
  if (viewer.status !== 'ready') return;
  const id = String(formData.get('draft_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await (await createClient()).rpc('close_order_email_draft', { p_id: id });
  if (error) console.error('черновик из письма не закрыт:', error.message);
  revalidatePath(cabinetPath(locale, viewer.role));
}
