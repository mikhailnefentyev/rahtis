import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Что из документов рейса видит клиент по ссылке отслеживания.
 *
 * Ссылка открывается без входа и может уйти дальше по почте, поэтому
 * правило узкое: только подтверждение доставки и только после неё —
 * CMR (с подписью получателя) и фото выгрузки. Фото повреждений сюда не
 * идут: это материал претензии, и показывать его решает перевозчик в
 * кабинете, а не ссылка. Фото погрузки клиенту не нужны.
 */

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export type CustomerDocument = {
  id: string;
  kind: 'CMR' | 'UNLOADING_PHOTO';
  file_name: string;
  mime_type: string;
  signer_name: string | null;
  created_at: string;
  storage_path: string;
};

/** Доставлен ли рейс: все точки пройдены (или рейс уже закрыт). */
export function isDelivered(
  status: string,
  stops: { completed_at: string | null }[],
): boolean {
  if (status !== 'IN_PROGRESS' && status !== 'DONE') return false;
  return stops.length > 0 && stops.every((s) => s.completed_at);
}

export async function customerDocuments(orderId: string): Promise<CustomerDocument[]> {
  const { data } = await createAdminClient()
    .from('order_documents')
    .select('id, kind, phase, file_name, mime_type, signer_name, created_at, storage_path')
    .eq('order_id', orderId)
    .in('kind', ['CMR', 'UNLOADING_PHOTO'])
    .order('created_at');

  return (data ?? [])
    .filter((d) => d.kind === 'CMR' || d.phase !== 'PICKUP')
    .map((d) => ({
      id: d.id,
      kind: d.kind as CustomerDocument['kind'],
      file_name: d.file_name,
      mime_type: d.mime_type,
      signer_name: d.signer_name,
      created_at: d.created_at,
      storage_path: d.storage_path,
    }));
}
