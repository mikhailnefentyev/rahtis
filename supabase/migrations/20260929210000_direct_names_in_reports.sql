-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · прямой рейс: стороны видят друг друга в отчётах
--
-- Отчёт за период и выполненные рейсы показывали имена сторон только
-- оператору. Для рейса через Aivomaa это верно — стороны анонимны
-- (20260922300000_carrier_sees_no_shipper). Для прямого рейса перевозчика
-- на подписке (contract_party = CARRIER) договор перевозки — между
-- сторонами, счёт перевозчик выставляет заказчику сам, а отчёт — то, что
-- Aivomaa по такому рейсу выдаёт. Без имени заказчик не знает, от кого
-- счёт, перевозчик — кому его выставить. PRIVACY 10.2: при прямых рейсах
-- стороны видят друг друга по имени.
--
-- Теперь при contract_party = CARRIER каждой стороне видны имя и страна
-- другой (страна — для ALV в счёте). Идентификаторы компаний — только
-- оператору. Найдено прогоном платформы 29.09.2026.
--
-- Тексты функций взяты из базы (pg_get_functiondef) и изменены точечно.
-- ═══════════════════════════════════════════════════════════════════

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
    case when v_admin or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then sh.name end,
    case when v_admin or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then sh.country::text end,
    case when v_admin then ca.id end,
    case when v_admin or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then ca.name end,
    case when v_admin or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then ca.country::text end,

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

CREATE OR REPLACE FUNCTION public.completed_orders(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, week date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_name text, carrier_name text, vehicle_plate text, route_geometry text, route_bounds jsonb, rating_score smallint, rating_comment text, can_rate boolean, stops jsonb, documents jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role public.party_role;
  v_company uuid;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    app.report_week(app.closed_moment(o)),
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,

    case when v_role <> 'SHIPPER' then app.order_bps(o) end,
    case when v_role <> 'SHIPPER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_role <> 'SHIPPER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,

    case when v_role = 'ADMIN' or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then shipper.name end,
    case when v_role = 'ADMIN' or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then carrier.name end,
    v.plate,

    o.route_geometry,
    o.route_bounds,

    r.score,
    r.comment,
    (v_role = 'SHIPPER' and o.assigned_company_id is not null),

    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    ),
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'kind', d.kind,
          'file_name', d.file_name,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'size_bytes', d.size_bytes,
          'stop_id', d.stop_id,
          'created_at', d.created_at
        )
        order by d.created_at
      )
      from public.order_documents d
      where d.order_id = o.id
    )
  from public.orders o
  join public.companies shipper on shipper.id = o.shipper_company_id
  left join public.companies carrier on carrier.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  left join public.order_ratings r on r.order_id = o.id
  where o.status = 'DONE'
    and (
      (v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (v_role = 'CARRIER' and o.assigned_company_id = v_company)
      or v_role = 'ADMIN'
    )
    and (p_from is null or app.report_week(app.closed_moment(o)) >= p_from)
    and (p_to is null or app.report_week(app.closed_moment(o)) <= p_to)
  order by app.closed_moment(o) desc;
end;
$function$;
