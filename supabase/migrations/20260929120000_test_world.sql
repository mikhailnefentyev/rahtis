-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · тестовые и настоящие компании не видят друг друга
--
-- Отметка is_test (20260922240000) убирала тестовые рейсы только из
-- расчётов. Видимость она не трогала: 28.09 тестовый заказ RS-2026-0144
-- из сквозной проверки висел на столе у настоящего перевозчика Jafort, и
-- тот мог его взять. Письма о новых заказах так же ушли бы настоящим
-- перевозчикам, а тестовый заказчик видел на карте настоящий транспорт.
--
-- Теперь у каждой компании свой контур: тестовая видит только тестовых,
-- настоящая — только настоящих. Сквозные проверки на боевой платформе
-- остаются возможны и никого не задевают. Оператор видит всё.
--
-- Место проверки — там, где заказ встречает перевозчика: стол заказов и
-- его регионы, отклик и взятие, прямое назначение машины, адресаты
-- рассылки о новом заказе, карта транспорта у заказчика.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.same_world(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_test from public.companies where id = p_a), false)
       = coalesce((select is_test from public.companies where id = p_b), false);
$$;

revoke all on function app.same_world(uuid, uuid) from public, anon;
grant execute on function app.same_world(uuid, uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.desk_orders(p_region text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, ref text, order_type order_type, haul_kind haul_kind, container_feet smallint, ldm numeric, trailer text, trailer_plate text, distance_km integer, rate_cents integer, comment text, shipper_name text, published_at timestamp with time zone, pickup_city text, pickup_date date, pickup_time time without time zone, finish_city text, offers_count integer, taken_by_me boolean, route_geometry text, route_bounds jsonb, stops jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Стол заказов доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  if not app.has_dispatchable_vehicle(v_company_id) then
    return;
  end if;

  return query
  select
    o.id,
    o.ref,
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.ldm,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,
    o.comment,
    null::text,
    o.published_at,
    pickup.city,
    pickup.scheduled_date,
    pickup.scheduled_time,
    (
      select s.city
      from public.order_stops s
      where s.order_id = o.id
      order by s.sequence desc
      limit 1
    ),
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then 0
      else (select count(*)::integer from public.order_offers f where f.order_id = o.id)
    end,
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then false
      else exists (
        select 1 from public.order_offers f
        where f.order_id = o.id and f.carrier_company_id = v_company_id
      )
    end,
    null::text,
    null::jsonb,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'sequence', s.sequence,
          'role', s.role,
          'place_kind', s.place_kind,
          'place_name', s.city,
          'company_name', null,
          'address', null,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'external_ref', null,
          'trailer_loaded', s.trailer_loaded,
          'note', null,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'lat', round(s.lat::numeric, 1),
          'lon', round(s.lon::numeric, 1),
          'leg_distance_m', s.leg_distance_m,
          'completed_at', s.completed_at
        )
        order by s.sequence
      )
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  where (
      o.status = 'OPEN'
      or app.order_deadline_passed(o.status, o.deadline_at)
      or (
        o.status = 'REQUESTED'
        and exists (
          select 1 from public.order_offers f
          where f.order_id = o.id and f.carrier_company_id = v_company_id
        )
      )
    )
    /* Ветка, в которой перевозчику нечем работать, на витрину не идёт. */
    and app.has_vehicle_for_haul(v_company_id, o.haul_kind)
    and app.same_world(o.shipper_company_id, v_company_id)
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

CREATE OR REPLACE FUNCTION public.desk_regions()
 RETURNS TABLE(city text, open_orders integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Стол заказов доступен только перевозчику.' using errcode = '42501';
  end if;

  if not app.has_dispatchable_vehicle((select app.current_company_id())) then
    return;
  end if;

  return query
  select s.city, count(*)::integer
  from public.orders o
  join public.order_stops s on s.order_id = o.id and s.role = 'PICKUP'
  where o.status = 'OPEN'
    and app.same_world(o.shipper_company_id, (select app.current_company_id()))
  group by s.city
  order by count(*) desc, s.city;
end;
$function$;

CREATE OR REPLACE FUNCTION public.take_order(p_order_id uuid, p_vehicle_id uuid)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders;
  v_vehicle public.vehicles;
  v_company_id uuid;
  v_offers integer;
  v_needed integer;
  v_capacity integer;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Откликаться может только перевозчик.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;

  if v_vehicle.id is null or v_vehicle.company_id is distinct from v_company_id then
    raise exception 'Машина не найдена в вашем автопарке.' using errcode = '42501';
  end if;

  if not app.vehicle_is_dispatchable(p_vehicle_id) then
    raise exception 'Машина не допущена к заказам или документы компании просрочены.'
      using errcode = '55000';
  end if;

  /* Истёкшая бронь снимается здесь же — заказ мог освободиться минуту назад. */
  v_order := app.release_expired_order(p_order_id);

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not app.same_world(v_order.shipper_company_id, v_company_id) then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_order.status <> 'OPEN' and v_order.status <> 'REQUESTED' then
    raise exception 'Заказ уже не на столе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  /*
   * Машина против единицы. Коды разные, потому что перевозчику нужно
   * понять, какая машина подойдёт, а не просто «не получилось»:
   * 55002 — нет шасси нужной длины, 55003 — не та ветка или мало
   * погрузочных метров. Проверка стоит раньше веса: не влезающий груз не
   * спасёт никакая грузоподъёмность.
   */
  if not app.vehicle_fits_haul(p_vehicle_id, v_order.haul_kind, v_order.container_feet, v_order.ldm) then
    if app.vehicle_branch(v_vehicle.vehicle_class) <> app.haul_branch(v_order.haul_kind) then
      if app.haul_carries_unit(v_order.haul_kind) then
        raise exception 'Этот заказ возят тягачом: груз едет за машиной, а не в ней.'
          using errcode = '55003';
      else
        raise exception 'Этот заказ возят грузовиком или микроавтобусом: груз едет в машине.'
          using errcode = '55003';
      end if;
    elsif v_order.haul_kind = 'CONTAINER' then
      raise exception 'Машина не берёт %-футовый контейнер.', v_order.container_feet
        using errcode = '55002';
    else
      raise exception 'Нужен кузов от % погрузочных метров.', v_order.ldm
        using errcode = '55003';
    end if;
  end if;

  /*
   * Вес против вместимости.
   *
   * Отдельный код, а не общий 55000: перевозчику нужно отличить «не
   * хватает грузоподъёмности» от «мест нет» и «заказ уже занят».
   */
  v_needed := app.order_max_weight_kg(p_order_id);
  v_capacity := app.vehicle_capacity_kg(p_vehicle_id);

  if v_needed > v_capacity then
    raise exception 'Груз % кг превышает грузоподъёмность машины % кг.', v_needed, v_capacity
      using errcode = '55001';
  end if;

  select count(*) into v_offers from public.order_offers where order_id = p_order_id;

  if v_offers >= 3 then
    raise exception 'Мест нет: на заказ уже откликнулись три машины.' using errcode = '55000';
  end if;

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, created_by)
  values (p_order_id, v_company_id, p_vehicle_id, (select auth.uid()));

  /*
   * Отсчёт запускает первый отклик и дальше не сдвигается: пятнадцать
   * минут даётся заказчику на решение, а не каждому новому отклику.
   */
  update public.orders
  set status = 'REQUESTED',
      deadline_at = coalesce(deadline_at, now() + interval '15 minutes')
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$function$;

CREATE OR REPLACE FUNCTION app.dispatch_audience(p_order_id uuid)
 RETURNS SETOF companies
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.*
  from public.companies c
  where c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    /* Тот же гейт, что у стола: допущенная машина и документы компании. */
    and app.has_dispatchable_vehicle(c.id)
    and exists (
      select 1
      from public.orders o
      join public.order_stops p on p.order_id = o.id and p.role = 'PICKUP'
      where o.id = p_order_id
        and o.status = 'OPEN'
        and (p.country is null or p.country = c.country)
        and app.has_vehicle_for_haul(c.id, o.haul_kind)
        and app.same_world(o.shipper_company_id, c.id)
    );
$function$;

CREATE OR REPLACE FUNCTION app.assert_vehicle_fits_order(p_order orders, p_vehicle vehicles)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_needed integer;
  v_capacity integer;
begin
  if not app.same_world(p_order.shipper_company_id, p_vehicle.company_id) then
    raise exception 'Машина и заказ из разных контуров: тестовые компании работают только с тестовыми.'
      using errcode = '42501';
  end if;

  if not app.vehicle_fits_haul(p_vehicle.id, p_order.haul_kind, p_order.container_feet, p_order.ldm) then
    if app.vehicle_branch(p_vehicle.vehicle_class) <> app.haul_branch(p_order.haul_kind) then
      if app.haul_carries_unit(p_order.haul_kind) then
        raise exception 'Этот заказ возят тягачом: груз едет за машиной, а не в ней.'
          using errcode = '55003';
      else
        raise exception 'Этот заказ возят грузовиком или микроавтобусом: груз едет в машине.'
          using errcode = '55003';
      end if;
    elsif p_order.haul_kind = 'CONTAINER' then
      raise exception 'Машина не берёт %-футовый контейнер.', p_order.container_feet
        using errcode = '55002';
    else
      raise exception 'Нужен кузов от % погрузочных метров.', p_order.ldm
        using errcode = '55003';
    end if;
  end if;

  v_needed := app.order_max_weight_kg(p_order.id);
  v_capacity := app.vehicle_capacity_kg(p_vehicle.id);

  if v_needed > v_capacity then
    raise exception 'Груз % кг превышает грузоподъёмность машины % кг.', v_needed, v_capacity
      using errcode = '55001';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.carrier_presence()
 RETURNS TABLE(city text, country text, lat double precision, lon double precision, tractors integer, trucks integer, vans integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select app.current_party_role()) not in ('SHIPPER', 'ADMIN') then
    raise exception 'Карта транспорта доступна заказчику и оператору.' using errcode = '42501';
  end if;

  return query
  select
    min(btrim(v.base_city))::text,
    max(v.base_country)::text,
    avg(v.base_lat)::double precision,
    avg(v.base_lon)::double precision,
    count(*) filter (where v.vehicle_class = 'TRACTOR')::integer,
    count(*) filter (where v.vehicle_class = 'TRUCK')::integer,
    count(*) filter (where v.vehicle_class = 'VAN')::integer
  from public.vehicles v
  join public.companies c on c.id = v.company_id
  where v.access = 'APPROVED'
    and v.base_lat is not null
    and c.kind = 'CARRIER'
    and c.status = 'ACTIVE'
    and c.frozen_at is null
    /* Документы просрочены — машина заказы не берёт, и на карте её нет. */
    and app.company_documents_ok(c.id)
    /* Заказчик видит транспорт своего контура; оператор — весь. */
    and ((select app.current_party_role()) = 'ADMIN' or app.same_world(c.id, (select app.current_company_id())))
  group by v.base_country, lower(btrim(v.base_city))
  order by 5 desc, 6 desc, 7 desc, 1;
end;
$function$;
