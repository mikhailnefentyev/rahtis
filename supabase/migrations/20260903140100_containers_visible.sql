-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · контейнер виден перевозчику до отклика
--
-- Поля haul_kind и container_feet заведены предыдущей миграцией, но на
-- стол заказов они не попадали: заказы читаются функциями, у которых
-- список колонок задан явно, а RLS открытые заказы перевозчику не
-- отдаёт. Поле, которого нет в возвращаемой таблице, для него не
-- существует.
--
-- Функции пересоздаются целиком: create or replace не меняет набор
-- выходных колонок, для этого нужен drop. Тела оставлены как были,
-- добавлены две колонки — в объявление и в выборку.
--
-- Здесь же create_order учится принимать обе. Проверка при публикации
-- разошлась по типу единицы: у полуприцепа спрашивается регистрационный
-- номер, у контейнера — номер по ISO 6346. Одна фраза про «номер
-- прицепа» на контейнерном заказе заставляла бы искать прицеп, которого
-- в рейсе нет.
-- ═══════════════════════════════════════════════════════════════════


-- ── Стол заказов ───────────────────────────────────────────────────

drop function if exists public.desk_orders(text, integer);

create or replace function public.desk_orders(
  p_region text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  trailer text,
  trailer_plate text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  published_at timestamptz,
  pickup_city text,
  pickup_date date,
  pickup_time time,
  finish_city text,
  offers_count integer,
  taken_by_me boolean,
  route_geometry text,
  route_bounds jsonb,
  stops jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,
    o.comment,
    c.name,
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
    o.route_geometry,
    o.route_bounds,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'sequence', s.sequence,
          'role', s.role,
          'place_kind', s.place_kind,
          'place_name', s.place_name,
          'company_name', s.company_name,
          'address', s.address,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'external_ref', s.external_ref,
          'trailer_loaded', s.trailer_loaded,
          'note', s.note,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'lat', s.lat,
          'lon', s.lon,
          'leg_distance_m', s.leg_distance_m,
          'completed_at', s.completed_at
        )
        order by s.sequence
      )
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
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
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

comment on function public.desk_orders(text, integer) is
  'Открытые заказы для перевозчика с допущенной машиной. Единица и её размер — до отклика.';

revoke all on function public.desk_orders(text, integer) from public, anon;
grant execute on function public.desk_orders(text, integer) to authenticated, service_role;


-- ── Закреплённые рейсы ─────────────────────────────────────────────

drop function if exists public.my_assignments();

create or replace function public.my_assignments()
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  status public.order_status,
  deadline_at timestamptz,
  trailer text,
  trailer_plate text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  vehicle_plate text,
  route_geometry text,
  route_bounds jsonb,
  stops jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Раздел доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  return query
  select
    o.id, o.ref, o.order_type, o.haul_kind, o.container_feet, o.status, o.deadline_at,
    o.trailer, o.trailer_plate, o.distance_km, o.rate_cents, o.comment,
    c.name, v.plate,
    o.route_geometry, o.route_bounds,
    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_company_id = v_company_id
    /* DONE ушёл: выполненный рейс живёт во вкладке выполненных. */
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
  order by o.deadline_at nulls last, o.published_at desc;
end;
$$;

comment on function public.my_assignments() is
  'Рейсы, закреплённые за перевозчиком. Выполненные уходят в раздел выполненных.';

revoke all on function public.my_assignments() from public, anon;
grant execute on function public.my_assignments() to authenticated, service_role;


-- ── Публикация принимает контейнер ─────────────────────────────────

create or replace function public.create_order(
  p_order jsonb,
  p_stops jsonb,
  p_publish boolean default true
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_company public.companies;
  v_stop jsonb;
  v_role text;
  v_seq smallint := 0;
  v_has_pickup boolean := false;
  v_has_work boolean := false;
  v_has_return boolean := false;
  v_geometry text;
  v_haul public.haul_kind;
  v_feet smallint;
begin
  select * into v_company
  from public.companies
  where id = (select app.current_company_id());

  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;

  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.'
      using errcode = '55000';
  end if;

  v_geometry := nullif(btrim(coalesce(p_order->>'route_geometry', '')), '');

  v_haul := coalesce(nullif(p_order->>'haul_kind', ''), 'TRAILER')::public.haul_kind;
  v_feet := nullif(p_order->>'container_feet', '')::smallint;

  /*
   * Размер спрашивается здесь, а не при публикации.
   *
   * Ограничение таблицы всё равно не пропустит контейнер без длины, но
   * скажет об этом кодом 23514 и текстом про имя ограничения. Проверка
   * до вставки даёт человеку фразу, по которой понятно, что заполнить.
   */
  if v_haul = 'CONTAINER' and v_feet is null then
    raise exception 'Укажите длину контейнера в футах.' using errcode = '22023';
  end if;

  /*
   * У полуприцепа длины нет по определению, и присланную форма могла
   * оставить от переключения типа. Обнуляем здесь, а не надеемся на
   * форму: ограничение таблицы иначе отвергнет заказ, который человек
   * заполнил правильно.
   */
  if v_haul = 'TRAILER' then
    v_feet := null;
  end if;

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, haul_kind, container_feet,
    trailer, trailer_plate,
    distance_km, rate_cents, comment, created_by, status,
    distance_source, distance_auto_km,
    route_geometry, route_bounds, route_fingerprint, route_computed_at
  )
  values (
    v_company.id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    (p_order->>'order_type')::public.order_type,
    v_haul,
    v_feet,
    nullif(btrim(coalesce(p_order->>'trailer', '')), ''),
    nullif(upper(btrim(coalesce(p_order->>'trailer_plate', ''))), ''),
    nullif(p_order->>'distance_km', '')::integer,
    nullif(p_order->>'rate_cents', '')::integer,
    nullif(btrim(coalesce(p_order->>'comment', '')), ''),
    (select auth.uid()),
    'DRAFT',
    coalesce(nullif(p_order->>'distance_source', ''), 'MANUAL')::public.distance_source,
    nullif(p_order->>'distance_auto_km', '')::integer,
    v_geometry,
    case when p_order ? 'route_bounds' then p_order->'route_bounds' end,
    nullif(btrim(coalesce(p_order->>'route_fingerprint', '')), ''),
    case when v_geometry is not null then now() end
  )
  returning * into v_order;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    insert into public.order_stops (
      order_id, sequence, role, place_kind, place_name, company_name,
      address, city, contact_name, contact_phone,
      scheduled_date, scheduled_time, external_ref, trailer_loaded, note,
      cargo_weight_kg, consignee, seal_required,
      lat, lon, geocode_score, leg_distance_m, leg_duration_s
    )
    values (
      v_order.id,
      v_seq,
      (v_stop->>'role')::public.stop_role,
      nullif(v_stop->>'place_kind', '')::public.place_kind,
      nullif(btrim(coalesce(v_stop->>'place_name', '')), ''),
      nullif(btrim(coalesce(v_stop->>'company_name', '')), ''),
      btrim(coalesce(v_stop->>'address', '')),
      btrim(coalesce(v_stop->>'city', '')),
      nullif(btrim(coalesce(v_stop->>'contact_name', '')), ''),
      nullif(regexp_replace(coalesce(v_stop->>'contact_phone', ''), '[\s-]', '', 'g'), ''),
      nullif(v_stop->>'scheduled_date', '')::date,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(btrim(coalesce(v_stop->>'external_ref', '')), ''),
      case when v_stop ? 'trailer_loaded' then (v_stop->>'trailer_loaded')::boolean end,
      nullif(btrim(coalesce(v_stop->>'note', '')), ''),
      nullif(v_stop->>'cargo_weight_kg', '')::integer,
      nullif(btrim(coalesce(v_stop->>'consignee', '')), ''),
      case when v_stop ? 'seal_required' then (v_stop->>'seal_required')::boolean end,
      nullif(v_stop->>'lat', '')::double precision,
      nullif(v_stop->>'lon', '')::double precision,
      nullif(v_stop->>'geocode_score', '')::numeric,
      nullif(v_stop->>'leg_distance_m', '')::integer,
      nullif(v_stop->>'leg_duration_s', '')::integer
    );

    v_role := v_stop->>'role';

    if v_role = 'PICKUP' then v_has_pickup := true; end if;
    if v_role = 'TRAILER_RETURN' then v_has_return := true; end if;
    if v_role in ('DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'CONTINUATION') then
      v_has_work := true;
    end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not v_has_pickup then
      raise exception 'Маршрут неполон: нужна точка забора прицепа.' using errcode = '22023';
    end if;

    if not v_has_work then
      raise exception 'Добавьте хотя бы одно действие: выгрузку или загрузку.'
        using errcode = '22023';
    end if;

    if v_order.order_type = 'TRAILER_SWAP' and not v_has_return then
      raise exception 'Перецеп заканчивается отцепкой прицепа — укажите, где его оставить.'
        using errcode = '22023';
    end if;

    /*
     * Единицу ищут по номеру. Без него водитель приедет на площадку и не
     * поймёт, что цеплять: сотня прицепов выглядит одинаково, а описание
     * «Тент 13.6, 3 оси» подходит к половине из них. У контейнеров то же
     * самое и хуже: на терминале их тысячи, и различает их только номер
     * по ISO 6346.
     *
     * Фраза разная, потому что искать человек будет разные вещи. Одно
     * сообщение про «номер прицепа» на контейнерном заказе отправило бы
     * его искать прицеп, которого в рейсе нет.
     */
    if v_order.trailer_plate is null then
      if v_order.haul_kind = 'CONTAINER' then
        raise exception 'Укажите номер контейнера — по нему водитель находит его на терминале.'
          using errcode = '22023';
      else
        raise exception 'Укажите регистрационный номер прицепа — по нему водитель его находит.'
          using errcode = '22023';
      end if;
    end if;


    if v_order.distance_km is null or v_order.rate_cents is null then
      raise exception 'Укажите пробег и ставку.' using errcode = '22023';
    end if;

    update public.orders
    set status = 'OPEN', published_at = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

comment on function public.create_order(jsonb, jsonb, boolean) is
  'Создаёт заказ вместе с маршрутом одной транзакцией и, по умолчанию, публикует.';
