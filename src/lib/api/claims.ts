import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, type ApiContext } from './handler';

/**
 * Претензии для API: те, что компания подала, и те, что поданы против
 * неё, — как app.party_to_claim в кабинете. Читается служебным ключом,
 * поэтому граница — явный фильтр по компании ключа.
 *
 * Имён сторон нет: кабинет берёт их из claim_detail, где решена
 * анонимность, а своей стороне достаточно направления (filed/received) и
 * роли подавшего.
 */

const CLAIM_COLUMNS =
  'id,ref,kind,status,filed_by_role,filed_by_company_id,description,amount_cents,resolution,resolved_at,created_at,updated_at,order:orders(ref),stop:order_stops(sequence)';

const CLAIM_STATUSES = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'] as const;

type ClaimRow = {
  id: string;
  ref: string;
  kind: string;
  status: string;
  filed_by_role: string;
  filed_by_company_id: string;
  description: string | null;
  amount_cents: number | null;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  order: { ref: string } | null;
  stop: { sequence: number } | null;
};

function claimOut(ctx: ApiContext, c: ClaimRow) {
  return {
    ref: c.ref,
    order_ref: c.order?.ref ?? null,
    stop_sequence: c.stop?.sequence ?? null,
    kind: c.kind,
    status: c.status,
    direction: c.filed_by_company_id === ctx.companyId ? 'filed' : 'received',
    filed_by_role: c.filed_by_role,
    description: c.description,
    amount: c.amount_cents === null ? null : { amount: (c.amount_cents / 100).toFixed(2), currency: 'EUR' },
    resolution: c.resolution,
    resolved_at: c.resolved_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

const party = (ctx: ApiContext) => `filed_by_company_id.eq.${ctx.companyId},against_company_id.eq.${ctx.companyId}`;

export async function listClaims(ctx: ApiContext, url: URL) {
  const admin = createAdminClient();
  let query = admin.from('claims').select(CLAIM_COLUMNS).or(party(ctx)).order('created_at', { ascending: false }).limit(200);

  const status = url.searchParams.get('status');
  if (status) {
    const wanted = status.split(',').map((s) => s.trim().toUpperCase());
    if (!wanted.every((s) => (CLAIM_STATUSES as readonly string[]).includes(s))) {
      throw new ApiError('bad_request', `status must be a comma-separated list of: ${CLAIM_STATUSES.join(', ')}.`);
    }
    query = query.in('status', wanted as (typeof CLAIM_STATUSES)[number][]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return { data: ((data ?? []) as unknown as ClaimRow[]).map((c) => claimOut(ctx, c)) };
}

const LINK_TTL_S = 300;

export async function getClaim(ctx: ApiContext, ref: string) {
  if (!/^CL-[A-Z]{2}-\d{4}-\d{3,6}-\d{1,3}$/.test(ref)) throw new ApiError('not_found', 'Claim not found.');
  const admin = createAdminClient();

  const { data, error } = await admin.from('claims').select(CLAIM_COLUMNS).eq('ref', ref).or(party(ctx)).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('not_found', 'Claim not found.');
  const claim = data as unknown as ClaimRow;

  const [events, attachments] = await Promise.all([
    admin
      .from('claim_events')
      .select('kind,author_role,body,status_from,status_to,attachment_id,created_at')
      .eq('claim_id', claim.id)
      .order('created_at'),
    admin
      .from('claim_attachments')
      .select('id,storage_path,file_name,mime_type,size_bytes,author_role,created_at')
      .eq('claim_id', claim.id)
      .order('created_at'),
  ]);
  if (events.error) throw events.error;
  if (attachments.error) throw attachments.error;

  const files = attachments.data ?? [];
  const signed = files.length
    ? await admin.storage.from('claim-docs').createSignedUrls(
        files.map((f) => f.storage_path),
        LINK_TTL_S,
      )
    : { data: [], error: null };
  if (signed.error) throw signed.error;
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const expires = new Date(Date.now() + LINK_TTL_S * 1000).toISOString();

  return {
    ...claimOut(ctx, claim),
    events: (events.data ?? []).map((e) => ({
      at: e.created_at,
      kind: e.kind,
      author_role: e.author_role,
      body: e.body,
      status_from: e.status_from,
      status_to: e.status_to,
      attachment_id: e.attachment_id,
    })),
    attachments: files.map((f) => ({
      id: f.id,
      file_name: f.file_name,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      author_role: f.author_role,
      created_at: f.created_at,
      url: urls.get(f.storage_path) ?? null,
      url_expires_at: expires,
    })),
  };
}
