import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { ForwarderStatus, ReviewStatus } from './policy';

export type ForwarderState = {
  status: ForwarderStatus | null;
  /** Решение по последнему загруженному полису. */
  latestInsurance: ReviewStatus | null;
};

const NONE: ForwarderState = { status: null, latestInsurance: null };

/**
 * Полис своей компании для /account (public.forwarder_status). С
 * 6.11.2026 это отметка для перевозчика, а не допуск к прямому договору.
 */
export async function loadForwarderState(): Promise<ForwarderState> {
  try {
    const supabase = await createClient();
    const [{ data: rows, error }, { data: docs }] = await Promise.all([
      supabase.rpc('forwarder_status'),
      supabase
        .from('company_documents')
        .select('review_status')
        .eq('kind', 'FORWARDER_INSURANCE')
        .order('uploaded_at', { ascending: false })
        .limit(1),
    ]);
    const status = rows?.[0];
    if (error || !status) return NONE;
    const latest = (docs?.[0]?.review_status ?? null) as ReviewStatus | null;
    return { status, latestInsurance: latest };
  } catch {
    return NONE;
  }
}

/**
 * «Полис экспедитора проверен до …» для стола перевозчика: по заказам,
 * которые сервер страницы уже отобрал как видимые перевозчику. Служебным
 * ключом — заказчик закрыт от перевозчика колоночными грантами.
 */
export async function forwarderPolicyByOrder(
  orderIds: readonly string[],
): Promise<Record<string, { until: string | null; cargoOwner: boolean }>> {
  const unique = [...new Set(orderIds.filter(Boolean))];
  if (unique.length === 0) return {};
  try {
    const admin = createAdminClient();
    /* Только договор напрямую: у рейса через Aivomaa полис экспедитора перевозчику не нужен. */
    const { data: orders } = await admin
      .from('orders')
      .select('id, shipper_company_id')
      .in('id', unique)
      .or('desk_contract.eq.CARRIER,contract_party.eq.CARRIER');
    const shippers = [...new Set((orders ?? []).map((o) => o.shipper_company_id))];
    if (shippers.length === 0) return {};
    const { data: policies } = await admin.rpc('forwarder_policies', { p_company_ids: shippers });
    const byCompany = new Map((policies ?? []).map((p) => [p.company_id, p]));
    const result: Record<string, { until: string | null; cargoOwner: boolean }> = {};
    for (const o of orders ?? []) {
      const p = byCompany.get(o.shipper_company_id);
      if (p) result[o.id] = { until: p.policy_until, cargoOwner: p.cargo_owner };
    }
    return result;
  } catch {
    return {};
  }
}
