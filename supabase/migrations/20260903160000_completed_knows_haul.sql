-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · выполненные рейсы тоже знают, что везли
--
-- Раздел выполненных читается функцией completed_orders, и в её
-- возвращаемой таблице колонок haul_kind и container_feet не было. Список
-- точек там строится тем же компонентом, что и в рабочих кабинетах, а
-- значит закрытый контейнерный рейс подписывал бы забор и возврат
-- перевозчиком прицепа — того самого, которого в рейсе не было.
--
-- Заодно это единственное место, где рейс живёт после закрытия: спор о
-- том, что именно везли, разбирается по нему.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.completed_orders(date, date);

create function public.completed_orders(
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  ref text,
  shipper_ref text,
  closed_at timestamptz,
  week date,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  trailer text,
  trailer_plate text,
  distance_km integer,
  rate_cents integer,
  commission_bps integer,
  commission_cents integer,
  payout_cents integer,
  shipper_name text,
  carrier_name text,
  vehicle_plate text,
  route_geometry text,
  route_bounds jsonb,
  rating_score smallint,
  rating_comment text,
  can_rate boolean,
  stops jsonb,
  documents jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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

    case when v_role <> 'SHIPPER' then shipper.name end,
    case when v_role = 'ADMIN' then carrier.name end,
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
$$;

comment on function public.completed_orders(date, date) is
  'Выполненные рейсы для кабинета: точки, документы, суммы и оценка. Комиссия только не заказчику.';

revoke all on function public.completed_orders(date, date) from public, anon;
grant execute on function public.completed_orders(date, date) to authenticated, service_role;
