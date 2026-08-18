-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 4+ · автоматический расчёт пробега и геометрия маршрута
--
-- Километраж перестаёт быть только ручным вводом: адреса точек дают
-- координаты, координаты дают маршрут по дорогам для грузовика, маршрут
-- даёт километры и линию для карты.
--
-- Главное решение — кто источник правды по пробегу.
--
-- distance_km остаётся тем, чем был: числом, по которому считаются €/км,
-- ставка и комиссия. Расчёт его НЕ перезаписывает, а предлагает: результат
-- ложится в distance_auto_km, а distance_source говорит, откуда взялось
-- действующее значение. Заказчик, поправивший километраж руками, должен
-- остаться поправившим — иначе следующий пересчёт молча отменит его
-- решение, а вместе с ним изменит цену уже опубликованного заказа.
--
-- Замер по Финляндии (TomTom, профиль 44 т / 4,4 м): грузовой маршрут
-- расходится с легковым до 12,6 % — Turku → Rauma 102,6 км против 91,1.
-- Поэтому профиль именно грузовой, а не «маршрут вообще».
-- ═══════════════════════════════════════════════════════════════════

/*
 * Откуда взят действующий пробег. MANUAL по умолчанию: все заказы,
 * созданные до этой миграции, набраны руками, и записать им AUTO
 * означало бы соврать о происхождении числа.
 */
create type public.distance_source as enum ('MANUAL', 'AUTO');

alter table public.orders
  add column distance_source public.distance_source not null default 'MANUAL',

  /*
   * Что предложил роутер. Хранится всегда, даже когда заказчик правил
   * километраж руками: расхождение между предложенным и принятым — это
   * сигнал, по которому видно, где расчёт систематически врёт.
   */
  add column distance_auto_km integer,

  /*
   * Линия маршрута закодированной полилинией (алгоритм Google, точность 5),
   * а не массивом координат: Hanko → Kotka это 4092 точки, то есть около
   * 160 КБ в JSON против примерно 20 КБ здесь. Строка едет в браузер на
   * каждый показ карточки заказа.
   */
  add column route_geometry text,

  /*
   * Углы описанного прямоугольника: [minLon, minLat, maxLon, maxLat].
   * Карта по ним выставляет вид, не разбирая полилинию.
   */
  add column route_bounds jsonb,

  add column route_computed_at timestamptz,

  /*
   * Отпечаток набора точек, по которому считался маршрут.
   *
   * Пересчёт нужен только тогда, когда изменились координаты или порядок
   * точек. Сравнивать сами точки на каждом сохранении дороже и путанее,
   * чем сравнить одну строку; несовпадение означает «кэш устарел».
   */
  add column route_fingerprint text,

  add constraint orders_distance_auto_positive
    check (distance_auto_km is null or distance_auto_km between 1 and 20000);

comment on column public.orders.distance_source is
  'Откуда действующий distance_km: ввод заказчика или расчёт роутера.';
comment on column public.orders.route_geometry is
  'Линия маршрута закодированной полилинией, точность 5.';
comment on column public.orders.route_fingerprint is
  'Отпечаток координат и порядка точек. Не совпал — кэш маршрута устарел.';


-- ── Координаты точек ───────────────────────────────────────────────

/*
 * Координаты запоминаются в момент выбора адреса из подсказки, а не
 * геокодированием свободной строки при публикации.
 *
 * Это не про удобство. Замер показал: несуществующий адрес
 * («Teollisuuskatu 12, 20100 Turku» — настоящая улица имеет индекс 20520)
 * геокодер не отвергает, а подбирает похожую улицу в другом городе, за
 * двести километров, и сообщает об этом только пониженной оценкой
 * совпадения. Выбор из подсказки убирает саму возможность такой ошибки:
 * координаты приходят от той же строки, которую человек увидел и выбрал.
 */
alter table public.order_stops
  add column lat double precision,
  add column lon double precision,

  /*
   * Оценка совпадения от геокодера. Настоящие адреса дают 7,9–10,3,
   * несуществующие — 4,7–6,1. Хранится как основание доверия к точке.
   */
  add column geocode_score numeric,

  /* Плечо ДО этой точки от предыдущей. У первой точки NULL. */
  add column leg_distance_m integer,
  add column leg_duration_s integer,

  add constraint order_stops_coords_together
    check ((lat is null) = (lon is null)),

  add constraint order_stops_lat_range
    check (lat is null or lat between -90 and 90),

  add constraint order_stops_lon_range
    check (lon is null or lon between -180 and 180),

  add constraint order_stops_leg_positive
    check (leg_distance_m is null or leg_distance_m >= 0);

comment on column public.order_stops.geocode_score is
  'Оценка совпадения адреса. Низкая означает, что геокодер подобрал похожее, а не нашёл точное.';


-- ── Запись координат и кэша маршрута при публикации ────────────────

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
  v_seq smallint := 0;
  v_has_pickup boolean := false;
  v_has_delivery boolean := false;
  v_geometry text;
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

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, trailer,
    distance_km, rate_cents, comment, created_by, status,
    distance_source, distance_auto_km,
    route_geometry, route_bounds, route_fingerprint, route_computed_at
  )
  values (
    v_company.id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    (p_order->>'order_type')::public.order_type,
    nullif(btrim(coalesce(p_order->>'trailer', '')), ''),
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
      scheduled_date, scheduled_time, external_ref, returns_loaded, note,
      booking_ref, cargo_weight_kg, consignee, seal_required,
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
      case when v_stop ? 'returns_loaded' then (v_stop->>'returns_loaded')::boolean end,
      nullif(btrim(coalesce(v_stop->>'note', '')), ''),
      nullif(btrim(coalesce(v_stop->>'booking_ref', '')), ''),
      nullif(v_stop->>'cargo_weight_kg', '')::integer,
      nullif(btrim(coalesce(v_stop->>'consignee', '')), ''),
      case when v_stop ? 'seal_required' then (v_stop->>'seal_required')::boolean end,
      nullif(v_stop->>'lat', '')::double precision,
      nullif(v_stop->>'lon', '')::double precision,
      nullif(v_stop->>'geocode_score', '')::numeric,
      nullif(v_stop->>'leg_distance_m', '')::integer,
      nullif(v_stop->>'leg_duration_s', '')::integer
    );

    if (v_stop->>'role') = 'PICKUP' then v_has_pickup := true; end if;
    if (v_stop->>'role') = 'DELIVERY' then v_has_delivery := true; end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not (v_has_pickup and v_has_delivery) then
      raise exception 'Маршрут неполон: нужны забор и выгрузка.' using errcode = '22023';
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


-- ── Стол и рейсы: геометрия и пробег ───────────────────────────────

/*
 * Стол отдаёт геометрию маршрута: карта нужна перевозчику до того, как он
 * возьмёт заказ, — именно по ней видно, куда на самом деле ехать. Контактов
 * и получателя в ней нет, линия на карте их не раскрывает.
 */
/* Набор колонок меняется, а create or replace этого не умеет. */
drop function if exists public.desk_orders(text, integer);

create function public.desk_orders(
  p_region text default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  trailer text,
  distance_km integer,
  rate_cents integer,
  comment text,
  shipper_name text,
  published_at timestamptz,
  pickup_city text,
  pickup_date date,
  pickup_time time,
  delivery_city text,
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
    o.trailer,
    o.distance_km,
    o.rate_cents,
    o.comment,
    c.name,
    o.published_at,
    pickup.city,
    pickup.scheduled_date,
    pickup.scheduled_time,
    delivery.city,
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
          'returns_loaded', s.returns_loaded,
          'note', s.note,
          'booking_ref', s.booking_ref,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          /* Координаты нужны, чтобы поставить точку на карту. */
          'lat', s.lat,
          'lon', s.lon,
          'leg_distance_m', s.leg_distance_m
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
  left join public.order_stops delivery
    on delivery.order_id = o.id and delivery.role = 'DELIVERY'
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
  'Стол заказов. Просроченная бронь считается снятой, контакты и получатель не отдаются.';


drop function if exists public.my_assignments();

create function public.my_assignments()
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
  status public.order_status,
  deadline_at timestamptz,
  trailer text,
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
    o.id, o.ref, o.order_type, o.status, o.deadline_at,
    o.trailer, o.distance_km, o.rate_cents, o.comment,
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
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
  order by o.deadline_at nulls last, o.published_at desc;
end;
$$;

revoke all on function public.desk_orders(text, integer) from public, anon;
grant execute on function public.desk_orders(text, integer) to authenticated, service_role;

revoke all on function public.my_assignments() from public, anon;
grant execute on function public.my_assignments() to authenticated, service_role;

comment on function public.my_assignments() is
  'Рейсы, закреплённые за перевозчиком: ждущие подтверждения и идущие.';
