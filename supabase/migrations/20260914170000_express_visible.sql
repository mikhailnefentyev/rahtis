-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экспресс на столе, в рассылке и в публикации
--
-- Колонки заведены предыдущей миграцией, но заказы читаются функциями с
-- явным списком колонок: поля, которого нет в возвращаемой таблице, для
-- перевозчика не существует. Тот же урок, что с trailer_plate и
-- haul_kind, — здесь он применён заранее, а не после жалобы.
--
-- ЧЕМ ЗАКАНЧИВАЕТСЯ ПУБЛИКАЦИЯ ЭКСПРЕССА. Проверки при выходе на стол
-- разошлись по тому же вопросу, что и вся ветка: есть ли у рейса
-- единица. Где её нет — не спрашивается её номер, не требуется точка
-- возврата, но зато обязательны адрес доставки, вес и погрузочные метры.
-- Без веса отклик нечем проверить: app.order_max_weight_kg вернёт ноль, и
-- полторы тонны уедут в фургон, который берёт восемьсот.
--
-- ФОРМА РЕЙСА У ЭКСПРЕССА ОДНА. order_type ставится здесь, а не
-- принимается от формы: забрать в одном месте и привезти в другое — это
-- ONE_WAY по определению, и оставлять форме возможность прислать
-- «перецеп» значило бы завести состояние, которое ничего не означает.
--
-- СТОЛ ФИЛЬТРУЕТСЯ ПО КЛАССУ МАШИНЫ. До сих пор гейт у стола был один —
-- допуск, и по стране рассылка сужалась, а витрина нет: «финн, которому
-- нужен датский рейс, найдёт его руками». Здесь иначе. Разница между
-- страной и классом в том, что чужую страну перевозчик взять может, а
-- фургонный заказ владелец тягача не возьмёт никогда: take_order
-- откажет. Показывать целую ветку тому, кто в ней физически не работает,
-- значит забить витрину заказами, по которым кнопка всегда отвечает
-- отказом.
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
  ldm numeric,
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
    o.ldm,
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
    /* Ветка, в которой перевозчику нечем работать, на витрину не идёт. */
    and app.has_vehicle_for_haul(v_company_id, o.haul_kind)
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

comment on function public.desk_orders(text, integer) is
  'Открытые заказы для перевозчика с допущенной машиной подходящего класса. Единица и её размер — до отклика.';

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
  ldm numeric,
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
    o.id, o.ref, o.order_type, o.haul_kind, o.container_feet, o.ldm, o.status, o.deadline_at,
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


-- ── Кому рассылать ─────────────────────────────────────────────────

/*
 * К стране забора добавляется класс машины. Причина та же, по которой
 * заводилась страна: письмо, которое стабильно не про тебя, отучает
 * читать все остальные. Владельцу тягачей фургонные заказы не про него
 * никогда, а не «обычно».
 */
create or replace function app.dispatch_audience(p_order_id uuid)
returns setof public.companies
language sql
stable
security definer
set search_path = ''
as $$
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
    );
$$;

comment on function app.dispatch_audience(uuid) is
  'Перевозчики, которым рассылается заказ: допуск, класс машины под единицу и совпадение страны забора.';

revoke all on function app.dispatch_audience(uuid) from public, anon, authenticated;


-- ── Карточка для письма ────────────────────────────────────────────

create or replace function public.order_dispatch_card(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ref', o.ref,
    'haul_kind', o.haul_kind,
    'container_feet', o.container_feet,
    'ldm', o.ldm,
    'cargo_weight_kg', pickup.cargo_weight_kg,
    'trailer', o.trailer,
    'distance_km', o.distance_km,
    'rate_cents', o.rate_cents,
    'pickup_city', pickup.city,
    'pickup_place', coalesce(pickup.place_name, pickup.city),
    'pickup_date', pickup.scheduled_date,
    'pickup_time', pickup.scheduled_time,
    'delivery_city', coalesce(delivery.city, pickup.city)
  )
  from public.orders o
  left join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  left join public.order_stops delivery
    on delivery.order_id = o.id and delivery.role = 'DELIVERY'
  where o.id = p_order_id;
$$;

comment on function public.order_dispatch_card(uuid) is
  'Что написать в письме о новом заказе. Исполнителя здесь нет: его ещё не выбрали.';

revoke all on function public.order_dispatch_card(uuid) from public, anon, authenticated;
grant execute on function public.order_dispatch_card(uuid) to service_role;


-- ── Публикация ─────────────────────────────────────────────────────

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
  v_has_delivery boolean := false;
  v_has_return boolean := false;
  v_geometry text;
  v_haul public.haul_kind;
  v_type public.order_type;
  v_unit boolean;
  v_feet smallint;
  v_ldm numeric;
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
  v_unit := app.haul_carries_unit(v_haul);
  v_feet := nullif(p_order->>'container_feet', '')::smallint;
  v_ldm := nullif(p_order->>'ldm', '')::numeric;

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

  if not v_unit and v_ldm is null then
    raise exception 'Укажите погрузочные метры груза.' using errcode = '22023';
  end if;

  /*
   * Лишнее обнуляется здесь, а не в форме.
   *
   * Переключение типа единицы оставляет в форме поля предыдущего:
   * футы от контейнера, метры от фургона, номер прицепа. Ограничения
   * таблицы отвергли бы такой заказ целиком, и человек увидел бы отказ
   * на форме, которую заполнил правильно.
   */
  if v_haul <> 'CONTAINER' then v_feet := null; end if;
  if v_unit then v_ldm := null; end if;

  /*
   * Форма рейса у экспресса одна: забрать здесь, привезти туда.
   * Принимать её от клиента значит допускать «перецеп фургоном».
   */
  v_type := case when v_unit then (p_order->>'order_type')::public.order_type else 'ONE_WAY' end;

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, haul_kind, container_feet, ldm,
    trailer, trailer_plate,
    distance_km, rate_cents, comment, created_by, status,
    distance_source, distance_auto_km,
    route_geometry, route_bounds, route_fingerprint, route_computed_at
  )
  values (
    v_company.id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    v_type,
    v_haul,
    v_feet,
    v_ldm,
    case when v_unit then nullif(btrim(coalesce(p_order->>'trailer', '')), '') end,
    case when v_unit then nullif(upper(btrim(coalesce(p_order->>'trailer_plate', ''))), '') end,
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
      address, city, country, contact_name, contact_phone,
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
      nullif(upper(btrim(coalesce(v_stop->>'country', ''))), ''),
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
    if v_role = 'DELIVERY' then v_has_delivery := true; end if;
    if v_role in ('DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'CONTINUATION') then
      v_has_work := true;
    end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not v_has_pickup then
      if v_unit then
        raise exception 'Маршрут неполон: нужна точка забора прицепа.' using errcode = '22023';
      else
        raise exception 'Укажите адрес, где забрать груз.' using errcode = '22023';
      end if;
    end if;

    if v_unit then
      if not v_has_work then
        raise exception 'Добавьте хотя бы одно действие: выгрузку или загрузку.'
          using errcode = '22023';
      end if;

      if v_order.order_type = 'TRAILER_SWAP' and not v_has_return then
        raise exception 'Перецеп заканчивается отцепкой прицепа — укажите, где его оставить.'
          using errcode = '22023';
      end if;

      /*
       * Единицу ищут по номеру. Без него водитель приедет на площадку и
       * не поймёт, что цеплять: сотня прицепов выглядит одинаково, а
       * описание «Тент 13.6, 3 оси» подходит к половине из них. У
       * контейнеров то же самое и хуже: на терминале их тысячи, и
       * различает их только номер по ISO 6346.
       *
       * У экспресса искать нечего: груз выдают по адресу, и номера у
       * него нет. Спрашивать его там означало бы требовать выдумать.
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

    else
      if not v_has_delivery then
        raise exception 'Укажите адрес доставки.' using errcode = '22023';
      end if;

      /*
       * Вес — не украшение карточки, а то, чем проверяется отклик.
       * Без него app.order_max_weight_kg вернёт ноль, и полторы тонны
       * уедут в фургон, который берёт восемьсот килограммов.
       */
      if app.order_max_weight_kg(v_order.id) = 0 then
        raise exception 'Укажите вес груза — по нему подбирается машина.' using errcode = '22023';
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
