import 'server-only';

import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type ApplyInvite = {
  token: string;
  name: string;
  businessId: string;
  email: string;
  carrierName: string;
  /** Кого пригласили: заказчика или перевозчика — от этого роль в заявке. */
  kind: 'SHIPPER' | 'CARRIER';
};

/**
 * Приглашение по ссылке из письма — для заполнения заявки.
 *
 * Читается служебным ключом: у пришедшего по ссылке нет сессии. В базе
 * лежит только хэш ссылки; использованная (заявка уже подана) не
 * открывается повторно, чужая или битая — просто пустая форма.
 */
export async function inviteByToken(token: string): Promise<ApplyInvite | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from('shipper_invites')
    .select('company_name, business_id, email, applied_company_id, carrier_company_id, invite_kind')
    .eq('token_hash', createHash('sha256').update(token).digest('hex'))
    .maybeSingle();
  if (!data || data.applied_company_id) return null;
  const { data: carrier } = await admin.from('companies').select('name').eq('id', data.carrier_company_id).maybeSingle();
  return {
    token,
    name: data.company_name,
    businessId: data.business_id,
    email: data.email,
    carrierName: carrier?.name ?? '',
    kind: data.invite_kind === 'CARRIER' ? 'CARRIER' : 'SHIPPER',
  };
}
