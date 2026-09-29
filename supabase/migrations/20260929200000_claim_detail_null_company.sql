-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · claim_detail: пользователь без компании не читает чужой claim
--
-- Проверка «not (админ или v_company in (сторона, сторона))» при
-- v_company = NULL давала NULL, а не true, и if её пропускал. Так
-- водитель (у него нет компании кабинета) или вошедший заявитель мог по
-- идентификатору получить чужую претензию целиком. Нашлось прогоном
-- прав по ролям 29.09.2026. Теперь NULL — это «не сторона».
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.claim_detail(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
  v_claim public.claims;
  v_viewer public.party_role;
  v_counterparty boolean;
begin
  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null
     or not (v_admin or coalesce(v_company in (v_claim.filed_by_company_id, v_claim.against_company_id), false)) then
    return null;
  end if;

  v_viewer := case when v_admin then 'ADMIN'::public.party_role else v_role end;
  v_counterparty := not v_admin and v_claim.filed_by_company_id <> v_company;

  return jsonb_build_object(
    'viewer', v_viewer,
    'channel', case when v_counterparty then 'EMAIL' else 'CABINET' end,
    'claim', jsonb_build_object(
      'id', v_claim.id,
      'ref', v_claim.ref,
      'kind', v_claim.kind,
      'status', v_claim.status,
      'filed_by_role', v_claim.filed_by_role,
      'mine', v_claim.filed_by_company_id = v_company,
      'stop_id', v_claim.stop_id,
      'description', v_claim.description,
      'amount_cents', v_claim.amount_cents,
      'resolution', v_claim.resolution,
      'resolved_at', v_claim.resolved_at,
      'created_at', v_claim.created_at,
      'updated_at', v_claim.updated_at,
      'mirrored_at', v_claim.mirrored_at,
      'mirrored_to', case when v_admin then v_claim.mirrored_to end
    ),
    'order', (
      select jsonb_build_object(
        'id', o.id,
        'ref', o.ref,
        'shipper_ref', o.shipper_ref,
        'status', o.status,
        'order_type', o.order_type,
        'haul_kind', o.haul_kind,
        'container_feet', o.container_feet,
        'trailer', o.trailer,
        'trailer_plate', o.trailer_plate,
        'distance_km', o.distance_km,
        'rate_cents', o.rate_cents,
        'closed_at', o.closed_at,
        'vehicle_plate', v.plate,
        'shipper_name', case when v_viewer in ('ADMIN', 'CARRIER') then sh.name end,
        'carrier_name', case when v_viewer = 'ADMIN' then ca.name end,
        'route_geometry', o.route_geometry,
        'route_bounds', o.route_bounds,
        'stops', (
          select jsonb_agg(to_jsonb(s) order by s.sequence)
          from public.order_stops s where s.order_id = o.id
        )
      )
      from public.orders o
      join public.companies sh on sh.id = o.shipper_company_id
      left join public.companies ca on ca.id = o.assigned_company_id
      left join public.vehicles v on v.id = o.assigned_vehicle_id
      where o.id = v_claim.order_id
    ),
    'documents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'kind', d.kind,
          'file_name', d.file_name,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'size_bytes', d.size_bytes,
          'stop_id', d.stop_id,
          'source', d.source,
          'phase', d.phase,
          'subject', d.subject,
          'captured_at', d.captured_at,
          'created_at', d.created_at
        )
        order by coalesce(d.captured_at, d.created_at)
      )
      from public.order_documents d where d.order_id = v_claim.order_id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'file_name', a.file_name,
          'storage_path', a.storage_path,
          'mime_type', a.mime_type,
          'size_bytes', a.size_bytes,
          'author_role', a.author_role,
          'created_at', a.created_at
        )
        order by a.created_at
      )
      from public.claim_attachments a where a.claim_id = v_claim.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'kind', e.kind,
          'author_role', e.author_role,
          'body', e.body,
          'status_from', e.status_from,
          'status_to', e.status_to,
          'attachment_id', e.attachment_id,
          'created_at', e.created_at
        )
        order by e.created_at, e.id
      )
      from public.claim_events e
      where e.claim_id = v_claim.id
        and (not v_counterparty or e.kind in ('CREATED', 'STATUS'))
    ), '[]'::jsonb)
  );
end;
$$;
