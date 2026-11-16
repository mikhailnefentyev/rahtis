-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · машина свободна с момента, когда последняя точка закрыта
--
-- Водитель закрыл возврат в 22:41, рейс ждёт, пока перевозчик его
-- закроет с документами, — а Paluukuorma считал «свободна 17.11 00:00»:
-- оценка прибытия 23:00 плюс час на выгрузку (16.11.2026). Закрытая
-- точка — факт, оценка после неё не нужна, и час выгрузки уже прошёл.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.backhaul_suggestions(p_radius_km integer default 75)
returns table(
  vehicle_id uuid,
  plate text,
  free_source text,
  after_ref text,
  free_city text,
  free_date date,
  free_time time without time zone,
  total_count integer,
  order_id uuid,
  ref text,
  haul_kind public.haul_kind,
  pickup_city text,
  pickup_date date,
  pickup_time time without time zone,
  finish_city text,
  rate_cents integer,
  distance_km integer,
  deadhead_km integer,
  toward_home boolean,
  desk_contract public.contract_party
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_company uuid;
  v_radius integer := greatest(10, least(coalesce(p_radius_km, 75), 300));
  v_now timestamp := (now() at time zone 'Europe/Helsinki');
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Paluukuorma on vain kuljetusliikkeelle.' using errcode = '42501';
  end if;

  v_company := (select app.current_company_id());

  return query
  with desk as (
    select d.id from public.desk_orders(null, 500) d where not d.taken_by_me
  ),
  busy as (
    select distinct on (o.assigned_vehicle_id)
      o.assigned_vehicle_id as vid,
      o.ref as oref,
      s.city,
      s.lat,
      s.lon,
      coalesce(
        s.completed_at at time zone 'Europe/Helsinki',
        coalesce(
          s.eta_at at time zone 'Europe/Helsinki',
          s.scheduled_date + coalesce(s.scheduled_time, time '16:00'),
          app.order_drive_end_local(o.id, o.distance_km)
        ) + interval '1 hour'
      ) as free_local
    from public.orders o
    join lateral (
      select x.* from public.order_stops x where x.order_id = o.id order by x.sequence desc limit 1
    ) s on true
    where o.assigned_company_id = v_company
      and o.assigned_vehicle_id is not null
      and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
      and s.lat is not null and s.lon is not null
    order by o.assigned_vehicle_id, free_local desc nulls last
  ),
  gps as (
    select distinct on (g.vehicle_id) g.vehicle_id as vid, g.lat, g.lon
    from public.gps_units g
    where g.company_id = v_company
      and g.vehicle_id is not null
      and g.lat is not null and g.lon is not null
      and g.position_at > now() - interval '30 minutes'
    order by g.vehicle_id, g.position_at desc
  ),
  freept as (
    select
      v.id as vid,
      v.plate as vplate,
      v.vehicle_class,
      v.base_lat,
      v.base_lon,
      case when b.vid is not null then 'ORDER' else 'GPS' end as src,
      b.oref,
      b.city as fcity,
      coalesce(b.lat, g.lat) as lat,
      coalesce(b.lon, g.lon) as lon,
      greatest(coalesce(b.free_local, v_now), v_now) as free_local
    from public.vehicles v
    left join busy b on b.vid = v.id
    left join gps g on g.vid = v.id
    where v.company_id = v_company
      and v.access = 'APPROVED'
      and (b.vid is not null or g.vid is not null)
  ),
  cand as (
    select
      f.vid,
      o.id as oid,
      o.ref as oref,
      o.haul_kind as okind,
      p.city as pcity,
      p.scheduled_date as pdate,
      p.scheduled_time as ptime,
      coalesce(e.city, p.city) as ecity,
      o.rate_cents as orate,
      o.distance_km as odist,
      o.desk_contract as ocontract,
      app.km_between(f.lat, f.lon, p.lat, p.lon) as dead,
      case
        when f.base_lat is not null and f.base_lon is not null and e.lat is not null and e.lon is not null then
          app.km_between(p.lat, p.lon, f.base_lat, f.base_lon) - app.km_between(e.lat, e.lon, f.base_lat, f.base_lon)
      end as home_gain
    from freept f
    cross join desk d
    join public.orders o on o.id = d.id and o.status = 'OPEN'
    join public.order_stops p on p.order_id = o.id and p.role = 'PICKUP'
    left join lateral app.route_end(o.id) e on true
    where p.lat is not null and p.lon is not null
      and app.km_between(f.lat, f.lon, p.lat, p.lon) <= v_radius
      and (p.scheduled_date is null
           or p.scheduled_date + coalesce(p.scheduled_time, time '23:59') >= f.free_local)
      and (p.scheduled_date is null or p.scheduled_date <= (f.free_local + interval '3 days')::date)
      /* Окно группы — только машинам группы. */
      and (o.group_until is null or o.group_until <= now() or f.vid = any (o.group_vehicle_ids))
      /* Годность машины — как у отклика (take_order). Тягач с требованиями к кузову отвечает сцепкой. */
      and app.vehicle_fits_haul(f.vid, o.haul_kind, o.container_feet, o.ldm,
            case when o.haul_kind = 'TIPPER' then array[o.tipper_config] else o.semi_features end)
      and (f.vehicle_class = 'TRACTOR' or app.vehicle_meets_requirements(f.vid, o) is null)
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        partition by c.vid
        order by c.dead - 0.5 * least(greatest(coalesce(c.home_gain, 0), 0), 200), c.pdate nulls last, c.oref
      ) as rn,
      count(*) over (partition by c.vid) as cnt
    from cand c
  )
  select
    f.vid,
    f.vplate,
    f.src,
    f.oref,
    f.fcity,
    f.free_local::date,
    date_trunc('minute', f.free_local)::time,
    coalesce(r.cnt, 0)::integer,
    r.oid,
    r.oref,
    r.okind,
    r.pcity,
    r.pdate,
    r.ptime,
    r.ecity,
    r.orate,
    r.odist,
    case when r.oid is not null then (round(r.dead / 5) * 5)::integer end,
    coalesce(r.home_gain >= 25, false),
    r.ocontract
  from freept f
  left join ranked r on r.vid = f.vid and r.rn <= 5
  order by f.free_local, f.vplate, r.rn;
end;
$$;

comment on function public.backhaul_suggestions(integer) is
  'Paluukuorma: где и когда освобождается каждая машина перевозчика и до пяти заказов стола рядом с этой точкой (только из desk_orders).';

revoke all on function public.backhaul_suggestions(integer) from public, anon;
grant execute on function public.backhaul_suggestions(integer) to authenticated;

create or replace function app.vehicle_free_points(p_company_id uuid)
returns table(
  vehicle_id uuid,
  source text,
  after_ref text,
  city text,
  lat double precision,
  lon double precision,
  free_local timestamp without time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  with busy as (
    select distinct on (o.assigned_vehicle_id)
      o.assigned_vehicle_id as vid,
      o.ref as oref,
      s.city,
      s.lat,
      s.lon,
      coalesce(
        s.completed_at at time zone 'Europe/Helsinki',
        coalesce(
          s.eta_at at time zone 'Europe/Helsinki',
          s.scheduled_date + coalesce(s.scheduled_time, time '16:00'),
          app.order_drive_end_local(o.id, o.distance_km)
        ) + interval '1 hour'
      ) as free_at
    from public.orders o
    join lateral (
      select x.* from public.order_stops x where x.order_id = o.id order by x.sequence desc limit 1
    ) s on true
    where o.assigned_company_id = p_company_id
      and o.assigned_vehicle_id is not null
      and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
      and s.lat is not null and s.lon is not null
    order by o.assigned_vehicle_id, free_at desc nulls last
  ),
  gps as (
    select distinct on (g.vehicle_id) g.vehicle_id as vid, g.lat, g.lon
    from public.gps_units g
    where g.company_id = p_company_id
      and g.vehicle_id is not null
      and g.lat is not null and g.lon is not null
      and g.position_at > now() - interval '12 hours'
    order by g.vehicle_id, g.position_at desc
  ),
  prev as (
    select distinct on (o.assigned_vehicle_id)
      o.assigned_vehicle_id as vid, o.ref as oref, s.city, s.lat, s.lon
    from public.orders o
    join lateral (
      select x.* from public.order_stops x where x.order_id = o.id order by x.sequence desc limit 1
    ) s on true
    where o.assigned_company_id = p_company_id
      and o.assigned_vehicle_id is not null
      and o.status = 'DONE'
      and o.updated_at > now() - interval '30 days'
      and s.lat is not null and s.lon is not null
    order by o.assigned_vehicle_id, o.updated_at desc
  )
  select
    v.id,
    case
      when b.vid is not null then 'ORDER'
      when g.vid is not null then 'GPS'
      when l.vid is not null then 'LAST'
      else 'BASE'
    end,
    coalesce(b.oref, case when g.vid is null then l.oref end),
    coalesce(b.city, case when g.vid is null then coalesce(l.city, v.base_city) end),
    coalesce(b.lat, g.lat, l.lat, v.base_lat),
    coalesce(b.lon, g.lon, l.lon, v.base_lon),
    date_trunc('minute', greatest(
      coalesce(b.free_at, now() at time zone 'Europe/Helsinki'),
      now() at time zone 'Europe/Helsinki'))
  from public.vehicles v
  left join busy b on b.vid = v.id
  left join gps g on g.vid = v.id
  left join prev l on l.vid = v.id
  where v.company_id = p_company_id
    and v.access = 'APPROVED'
    and (b.vid is not null or g.vid is not null or l.vid is not null
         or (v.base_lat is not null and v.base_lon is not null));
$$;

revoke all on function app.vehicle_free_points(uuid) from public, anon, authenticated;


