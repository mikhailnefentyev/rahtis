import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { loadConsignment } from './consignment';
import { gateConfig, parseUil, putIdentifiers } from './gateClient';
import { buildUploadIdentifierRequest } from './xml/upload';

/**
 * Набор eFTI заказа: завести (datasetId) и отправить идентификаторы в
 * шлюз (19.11.2026, этап А). Повторный вызов обновляет идентификаторы —
 * например, после фактической доставки: тогда набор становится INACTIVE,
 * а шлюз перестаёт искать его как идущий.
 *
 * Пока шлюз не настроен (нет сертификатов), ничего не отправляется.
 */
export type SyncResult =
  | { status: 'UPLOADED'; datasetId: string; uil: { gateId: string; platformId: string } }
  | { status: 'NOT_CONFIGURED' | 'SKIPPED'; reason?: string }
  | { status: 'FAILED'; datasetId: string; error: string };

export async function syncOrderDataset(orderId: string): Promise<SyncResult> {
  const config = gateConfig();
  if (!config) return { status: 'NOT_CONFIGURED' };

  const admin = createAdminClient();
  /* Набор заводится один раз на заказ; datasetId — его первичный ключ. */
  const { data: existing } = await admin.from('efti_datasets').select('id').eq('order_id', orderId).maybeSingle();
  const dataset = existing ?? (await admin.from('efti_datasets').insert({ order_id: orderId }).select('id').single()).data;
  if (!dataset) return { status: 'SKIPPED', reason: 'dataset not created' };

  const loaded = await loadConsignment(orderId, dataset.id);
  if (!loaded.ok) return { status: 'SKIPPED', reason: loaded.reason };

  const xml = buildUploadIdentifierRequest(loaded.consignment);
  try {
    const res = await putIdentifiers(config, dataset.id, xml);
    const uil = res.status >= 200 && res.status < 300 ? parseUil(res.body) : null;
    if (!uil) {
      const error = `gate ${res.status}: ${res.body.slice(0, 500)}`;
      await admin.from('efti_datasets').update({ last_error: error, updated_at: new Date().toISOString() }).eq('id', dataset.id);
      return { status: 'FAILED', datasetId: dataset.id, error };
    }
    const now = new Date().toISOString();
    await admin
      .from('efti_datasets')
      .update({
        gate_id: uil.gateId,
        platform_id: uil.platformId,
        uploaded_at: now,
        last_error: null,
        updated_at: now,
        ...(loaded.consignment.delivery ? { status: 'INACTIVE', delivery_uploaded_at: now } : {}),
      })
      .eq('id', dataset.id);
    return { status: 'UPLOADED', datasetId: dataset.id, uil: { gateId: uil.gateId, platformId: uil.platformId } };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    await admin.from('efti_datasets').update({ last_error: error, updated_at: new Date().toISOString() }).eq('id', dataset.id);
    return { status: 'FAILED', datasetId: dataset.id, error };
  }
}
