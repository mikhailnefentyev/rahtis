-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · стол: какая своя машина подходит заказу (6.11.2026)
--
-- «Беру одним нажатием»: у каждого заказа стола — лучшая своя машина
-- (или сцепка), когда она освобождается и сколько ехать порожняком до
-- забора. Годность — теми же проверками, что у отклика (take_order,
-- take_order_combo): вид, метры, контейнер, кузов, загрузка, вес. Сам
-- отклик — прежними функциями, новой брони здесь нет.
--
--   1. app.vehicle_misfit / app.combo_misfit — причина «не подходит»
--      кодом (CLASS, SIZE, BODY, WEIGHT) или null.
--   2. app.vehicle_free_points — где и когда машина освобождается:
--      последняя точка идущего рейса (ORDER), свежая точка GPS (GPS),
--      последняя точка прошлого рейса (LAST), база машины (BASE).
--   3. public.fleet_free_points — то же наружу, без координат.
--   4. public.desk_matches — заказ стола × своя машина или сцепка: код
--      причины и прямое расстояние до забора, округлённое до 5 км (точку
--      забора стол до отклика не раскрывает, как и обратный груз).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Годность кодом ─────────────────────────────────────────────

/* Порядок проверок — как в take_order: вид и размер, кузов, вес. */
create or replace function app.vehicle_misfit(p_vehicle_id uuid, p_order public.orders)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_capacity integer;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.id is null then
    return 'CLASS';
  end if;

  if not app.vehicle_fits_haul(p_vehicle_id, p_order.haul_kind, p_order.container_feet, p_order.ldm,
       case when p_order.haul_kind = 'TIPPER' then array[p_order.tipper_config] else p_order.semi_features end) then
    if p_order.haul_kind = 'SEMI' then
      if v_vehicle.vehicle_class <> 'TRACTOR' then return 'CLASS'; end if;
      return 'SIZE';
    end if;
    if app.vehicle_branch(v_vehicle.vehicle_class) <> app.haul_branch(p_order.haul_kind) then
      return 'CLASS';
    end if;
    return 'SIZE';
  end if;

  if app.vehicle_meets_requirements(p_vehicle_id, p_order) is not null then
    return 'BODY';
  end if;

  v_capacity := app.vehicle_capacity_kg(p_vehicle_id);
  if app.order_max_weight_kg(p_order.id) > v_capacity then
    return 'WEIGHT';
  end if;

  return null;
end;
$$;

revoke all on function app.vehicle_misfit(uuid, public.orders) from public, anon, authenticated;

/* Сцепка — как в take_order_combo: подбор по живым машине и прицепу, груз — по расчёту сцепки. */
create or replace function app.combo_misfit(p_combo public.vehicle_combos, p_order public.orders)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_reason text;
begin
  v_reason := app.combo_fit_reason(p_combo, p_order);
  if v_reason is not null then
    if v_reason like 'Нужен другой кузов%' or v_reason like 'Нет нужного способа%' then
      return 'BODY';
    end if;
    if v_reason like 'Нужно от%' or v_reason like 'Нужен тягач с шасси%' or v_reason like 'У полуприцепа нет%' then
      return 'SIZE';
    end if;
    return 'CLASS';
  end if;

  if app.order_max_weight_kg(p_order.id)
     > coalesce(p_combo.payload_kg, app.vehicle_capacity_kg(p_combo.vehicle_id)) then
    return 'WEIGHT';
  end if;

  return null;
end;
$$;

revoke all on function app.combo_misfit(public.vehicle_combos, public.orders) from public, anon, authenticated;


-- ── 2. Где и когда машина освобождается ───────────────────────────

/*
 * Время — местное (Хельсинки), как плановое время точек. Идущий рейс —
 * как в backhaul_suggestions: прибытие по оценке, без неё — плановое
 * время последней точки, плюс час на выгрузку. Без рейса машина свободна
 * сейчас; точка — GPS за последние 12 часов, иначе последняя точка
 * прошлого рейса (за 30 дней), иначе база. Нет ничего — строки нет.
 */
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
        s.eta_at at time zone 'Europe/Helsinki',
        s.scheduled_date + coalesce(s.scheduled_time, time '16:00')
      ) + interval '1 hour' as free_at
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


-- ── 3. Наружу: без координат ──────────────────────────────────────

create or replace function public.fleet_free_points()
returns table(
  vehicle_id uuid,
  source text,
  after_ref text,
  city text,
  free_local timestamp without time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.vehicle_id, f.source, f.after_ref, f.city, f.free_local
  from app.vehicle_free_points((select app.current_company_id())) f
  where (select app.current_party_role()) = 'CARRIER';
$$;

comment on function public.fleet_free_points() is
  'Где и когда освобождается каждая допущенная машина перевозчика: ORDER, GPS, LAST или BASE. Без координат.';

revoke all on function public.fleet_free_points() from public, anon;
grant execute on function public.fleet_free_points() to authenticated;


-- ── 4. Заказ стола × своя машина ──────────────────────────────────

/*
 * Кандидаты — только из desk_orders (тот же регион, без своих откликов):
 * чего перевозчику не видно, сюда не попадёт. Машины — те, что выходят на
 * рейсы (допущена, документы, водитель). Пока открыто окно группы —
 * только машины группы и без сцепок (group_take_order берёт машину).
 * Расстояние — по прямой до первого забора, кратно 5 км.
 */
create or replace function public.desk_matches(p_region text default null)
returns table(
  order_id uuid,
  vehicle_id uuid,
  combo_id uuid,
  misfit text,
  line_km integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select app.current_company_id()) as cid
    where (select app.current_party_role()) = 'CARRIER'
  ),
  desk as (
    select d.id from public.desk_orders(p_region, 100) d, me where not d.taken_by_me
  ),
  ord as (
    select o as ord_row, o.id, o.group_until, o.group_vehicle_ids, p.lat, p.lon
    from desk
    join public.orders o on o.id = desk.id
    left join lateral (
      select x.lat, x.lon from public.order_stops x
      where x.order_id = o.id and x.role = 'PICKUP'
      order by x.sequence limit 1
    ) p on true
  ),
  veh as (
    select v.id
    from public.vehicles v, me
    where v.company_id = me.cid and app.vehicle_is_dispatchable(v.id)
  ),
  fp as (
    select f.* from me, app.vehicle_free_points(me.cid) f
  ),
  pairs as (
    select o.id as oid, v.id as vid, null::uuid as comboid, app.vehicle_misfit(v.id, o.ord_row) as why
    from ord o
    cross join veh v
    where o.group_until is null or o.group_until <= now() or v.id = any (o.group_vehicle_ids)
    union all
    select o.id, c.vehicle_id, c.id, app.combo_misfit(c, o.ord_row)
    from ord o
    cross join me
    join public.vehicle_combos c on c.company_id = me.cid
    join veh v on v.id = c.vehicle_id
    where o.group_until is null or o.group_until <= now()
  )
  select
    p.oid,
    p.vid,
    p.comboid,
    p.why,
    case
      when o.lat is not null and o.lon is not null and f.lat is not null and f.lon is not null then
        /*
         * До района точки, а не до точки: адрес до взятия скрыт, и стол
         * показывает координаты с шагом 0,1°. Расстояние до точной точки
         * позволило бы вычислить адрес, двигая базу машины.
         */
        (round(app.km_between(f.lat, f.lon, round(o.lat::numeric, 1)::double precision, round(o.lon::numeric, 1)::double precision) / 5) * 5)::integer
    end
  from pairs p
  join ord o on o.id = p.oid
  left join fp f on f.vehicle_id = p.vid;
$$;

comment on function public.desk_matches(text) is
  'Стол: каждая своя машина и сцепка против каждого заказа desk_orders — код причины (null = подходит) и прямые км до забора, кратно 5.';

revoke all on function public.desk_matches(text) from public, anon;
grant execute on function public.desk_matches(text) to authenticated;
