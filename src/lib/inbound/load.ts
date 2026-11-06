import 'server-only';

import type { OrderDraft } from '@/lib/orders/importDraft';
import { locateDraft } from '@/lib/orders/importServer';
import { createClient } from '@/lib/supabase/server';
import { inboundConfig, inboxAddressFor } from './config';

/**
 * Адрес пересылки компании для кабинета. Приём не настроен, компании
 * адрес не положен (клиент перевозчика, не активна) или нет миграции —
 * null, и блок не показывается.
 */
export async function loadInboxAddress(): Promise<{ address: string; senders: string[] } | null> {
  if (!inboundConfig()) return null;
  const { data, error } = await (await createClient()).rpc('order_inbox_address');
  const row = error ? null : data?.[0];
  const address = inboxAddressFor(row?.token);
  return row && address ? { address, senders: row.allowed_senders ?? [] } : null;
}

export type EmailDraftInfo = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  /** null — письмо не прочиталось, форма пустая. */
  draft: OrderDraft | null;
};

/**
 * Черновик из письма для формы (?email=<id>). Своя компания — RLS;
 * закрытый (USED, DISMISSED) не открывается повторно. Координаты
 * ищутся здесь: подсказка адреса требует вошедшего человека.
 */
export async function loadEmailDraft(id: string | undefined, locale: string): Promise<EmailDraftInfo | null> {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await (await createClient())
    .from('order_email_drafts')
    .select('id, subject, from_address, received_at, status, draft')
    .eq('id', id)
    .in('status', ['PENDING', 'PARSED', 'FAILED'])
    .maybeSingle();
  if (!data) return null;
  const raw = data.status === 'PARSED' && data.draft && typeof data.draft === 'object' ? (data.draft as unknown as OrderDraft) : null;
  return {
    id: data.id,
    subject: data.subject,
    from: data.from_address,
    receivedAt: data.received_at,
    draft: raw ? await locateDraft(raw, locale) : null,
  };
}
