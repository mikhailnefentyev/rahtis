-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · отчёт за период знает плату заказчика
--
-- С миграции pricing_subscription заказчик платит 3 % сверху за заказ со
-- стола (orders.shipper_fee_bps). Отчёт за период в кабинете заказчика и
-- у оператора показывает эту плату и сумму к оплате с ней. Перевозчику
-- плата заказчика не показывается.
--
-- Текст функции взят из базы (pg_get_functiondef) и изменён точечно.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.period_report(date, date, uuid);

CREATE OR REPLACE FUNCTION public.period_report(p_from date, p_to date, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, closed_on date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, vehicle_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_fee_cents integer, shipper_id uuid, shipper_name text, shipper_country text, carrier_id uuid, carrier_name text, carrier_country text, route text, stops_count integer, documents_count integer, cmr_count integer, photos_count integer, claims jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Неверный период.' using errcode = '22023';
  end if;

  if p_to - p_from > 366 then
    raise exception 'Период длиннее года.' using errcode = '22023';
  end if;

  if not v_admin and v_role not in ('SHIPPER', 'CARRIER') then
    raise exception 'Отчёт недоступен.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    app.closed_day(o),
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.trailer,
    o.trailer_plate,
    v.plate,
    o.distance_km,
    o.rate_cents,

    case when v_admin or v_role = 'CARRIER' then app.order_bps(o) end,
    case when v_admin or v_role = 'CARRIER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_admin or v_role = 'CARRIER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,
    /* Плата заказчика 3 % за заказ со стола — заказчику и оператору. */
    case when v_admin or v_role = 'SHIPPER'
      then app.shipper_fee_cents(o.rate_cents, o.shipper_fee_bps) end,

    case when v_admin then sh.id end,
    case when v_admin then sh.name end,
    case when v_admin then sh.country::text end,
    case when v_admin then ca.id end,
    case when v_admin then ca.name end,
    case when v_admin then ca.country::text end,

    (
      select string_agg(coalesce(nullif(s.city, ''), s.place_name, '?'), ' - ' order by s.sequence)
      from public.order_stops s where s.order_id = o.id
    ),
    (select count(*)::integer from public.order_stops s where s.order_id = o.id),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id and d.kind = 'CMR'),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id and d.kind <> 'CMR'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ref', c.ref,
          'kind', c.kind,
          'status', c.status,
          'filed_by_role', c.filed_by_role,
          'amount_cents', c.amount_cents
        )
        order by c.created_at
      )
      from public.claims c where c.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.status = 'DONE'
    and app.closed_day(o) between p_from and p_to
    and (
      (v_admin and (p_company is null or p_company in (o.shipper_company_id, o.assigned_company_id)))
      or (not v_admin and v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (not v_admin and v_role = 'CARRIER' and o.assigned_company_id = v_company)
    )
  order by app.closed_moment(o), o.ref;
end;
$function$;

revoke all on function public.period_report(date, date, uuid) from public, anon;
grant execute on function public.period_report(date, date, uuid) to authenticated, service_role;
