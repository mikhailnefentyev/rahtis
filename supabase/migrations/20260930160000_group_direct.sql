-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сначала своим, потом на стол
--
-- Прямой заказ уходил одной машине и ждал без срока. Теперь заказчик
-- может предложить заказ группе знакомых машин (2–10) на 15, 30, 60 или
-- 120 минут:
--
--   · заказ публикуется (OPEN), но стол, счётчик регионов и рассылка
--     показывают его только перевозчикам машин группы;
--   · первый, кто нажал «Беру», получает его сразу — как прямое
--     назначение, уже подтверждённое (app.group_take): отклика и выбора
--     заказчика здесь нет, он выбрал заранее, составив группу;
--   · окно закрылось, никто не взял — заказ выходит всем: уведомления и
--     письма остальным перевозчикам (app.run_group_release → Next), а
--     заказчику — что группа не взяла.
--
-- Отклики со стола во время окна не принимаются (take_order, 55005).
-- Тексты функций взяты из базы (pg_get_functiondef) и изменены точечно.
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders
  add column group_vehicle_ids uuid[],
  add column group_until timestamptz,
  add column group_released_at timestamptz,
  add constraint orders_group_together check ((group_vehicle_ids is null) = (group_until is null));

grant select (group_vehicle_ids, group_until, group_released_at) on public.orders to authenticated;

create index orders_group_release_idx on public.orders (group_until)
  where group_until is not null and group_released_at is null;


/* Видит ли компания заказ с группой: окно закрыто или у неё машина в группе. */
create or replace function app.group_sees(p_group uuid[], p_until timestamptz, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_until is null
      or p_until <= now()
      or exists (select 1 from public.vehicles v where v.id = any (p_group) and v.company_id = p_company_id)
$$;

revoke all on function app.group_sees(uuid[], timestamptz, uuid) from public, anon, authenticated;


/* Группа при публикации: те же проверки, что у прямого назначения, для каждой машины. */
create or replace function app.assert_group(p_order public.orders, p_group uuid[], p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_id uuid;
begin
  if cardinality(p_group) < 2 or cardinality(p_group) > 10 then
    raise exception 'В группе от двух до десяти машин.' using errcode = '22023';
  end if;
  if p_minutes is null or p_minutes not in (15, 30, 60, 120) then
    raise exception 'Окно группы: 15, 30, 60 или 120 минут.' using errcode = '22023';
  end if;

  foreach v_id in array p_group loop
    select * into v_vehicle from public.vehicles where id = v_id;
    if v_vehicle.id is null or not app.shipper_knows_vehicle(p_order.shipper_company_id, v_id) then
      raise exception 'Машина не среди ваших знакомых.' using errcode = '42501';
    end if;
    if not app.vehicle_is_dispatchable(v_id) then
      raise exception 'Машина % сейчас не выходит на рейсы.', v_vehicle.plate using errcode = '55004';
    end if;
    perform app.assert_vehicle_fits_order(p_order, v_vehicle);
  end loop;
end;
$$;

revoke all on function app.assert_group(public.orders, uuid[], integer) from public, anon, authenticated;


/*
 * Перевозчик берёт заказ, предложенный его машине в группе. Первый
 * получает: строка заказа блокируется, второй увидит, что заказ ушёл.
 * Сразу подтверждено: переходы OPEN → AWAIT_DRIVER → IN_PROGRESS те же,
 * что у прямого назначения, — уведомления, вебхуки и учёт прямых
 * заказов работают без изменений.
 */
create or replace function public.group_take_order(p_order_id uuid, p_vehicle_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_vehicle public.vehicles;
  v_offer_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Берёт перевозчик.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id for share;
  if v_vehicle.id is null or v_vehicle.company_id is distinct from (select app.current_company_id())
     or not (p_vehicle_id = any (coalesce(v_order.group_vehicle_ids, '{}'))) then
    raise exception 'Эта машина не в группе заказа.' using errcode = '42501';
  end if;

  if v_order.status <> 'OPEN' or v_order.group_until is null or v_order.group_until <= now()
     or exists (select 1 from public.order_offers where order_id = p_order_id) then
    raise exception 'Заказ уже взят или окно группы закрыто.' using errcode = '55000';
  end if;

  if not app.vehicle_is_dispatchable(p_vehicle_id) then
    raise exception 'Машина сейчас не выходит на рейсы.' using errcode = '55004';
  end if;
  perform app.assert_vehicle_fits_order(v_order, v_vehicle);

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, created_by, origin)
  values (p_order_id, v_vehicle.company_id, p_vehicle_id, (select auth.uid()), 'DIRECT')
  returning id into v_offer_id;

  insert into public.order_direct_requests (order_id, vehicle_id, carrier_company_id, sent_by)
  values (p_order_id, p_vehicle_id, v_vehicle.company_id, (select auth.uid()));

  update public.orders
  set status = 'AWAIT_DRIVER',
      dispatch_mode = 'DIRECT',
      chosen_offer_id = v_offer_id,
      assigned_company_id = v_vehicle.company_id,
      assigned_vehicle_id = p_vehicle_id,
      deadline_at = null
  where id = p_order_id;

  update public.orders
  set status = 'IN_PROGRESS'
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

comment on function public.group_take_order(uuid, uuid) is
  'Перевозчик берёт заказ, предложенный группе машин заказчика: первый получает, сразу подтверждено.';

revoke all on function public.group_take_order(uuid, uuid) from public, anon;
grant execute on function public.group_take_order(uuid, uuid) to authenticated;


-- ── Публикация: группа своих машин ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_order(p_order jsonb, p_stops jsonb, p_publish boolean DEFAULT true)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_direct uuid;
  v_group uuid[];
  v_minutes integer;
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

    /*
     * Прямое назначение знакомой машине вместо стола. Проверки полноты
     * выше общие: заказ, ушедший напрямую, при отмене попадает на стол,
     * и там он обязан быть таким же полным, как любой другой.
     */
    v_direct := nullif(p_order->>'direct_vehicle_id', '')::uuid;

    /*
     * Группа своих машин: заказ на столе, но первые минуты его видят и
     * берут только перевозчики этих машин (app.group_take). Потом — всем.
     */
    v_group := case
      when jsonb_typeof(p_order->'group_vehicle_ids') = 'array'
        then array(select distinct x::uuid from jsonb_array_elements_text(p_order->'group_vehicle_ids') x)
    end;
    v_minutes := nullif(p_order->>'group_minutes', '')::integer;

    if v_direct is not null then
      v_order := app.direct_assign(v_order.id, v_direct);
    elsif coalesce(cardinality(v_group), 0) > 0 then
      perform app.assert_group(v_order, v_group, v_minutes);

      update public.orders
      set status = 'OPEN', published_at = now(),
          group_vehicle_ids = v_group,
          group_until = now() + make_interval(mins => v_minutes)
      where id = v_order.id
      returning * into v_order;
    else
      update public.orders
      set status = 'OPEN', published_at = now()
      where id = v_order.id
      returning * into v_order;
    end if;
  end if;

  return v_order;
end;
$function$;


-- ── Стол: видимость группы ─────────────────────────────────────────

drop function public.desk_orders(text, integer);

CREATE OR REPLACE FUNCTION public.desk_orders(p_region text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, ref text, order_type order_type, haul_kind haul_kind, container_feet smallint, ldm numeric, trailer text, trailer_plate text, distance_km integer, rate_cents integer, comment text, shipper_name text, published_at timestamp with time zone, pickup_city text, pickup_date date, pickup_time time without time zone, finish_city text, offers_count integer, taken_by_me boolean, route_geometry text, route_bounds jsonb, stops jsonb, group_until timestamp with time zone, group_vehicle_ids uuid[])
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
    ),
    case when o.group_until > now() then o.group_until end,
    /* Только свои машины из группы — чужие номера перевозчику ни к чему. */
    case when o.group_until > now() then array(
      select v.id from public.vehicles v
      where v.id = any (o.group_vehicle_ids) and v.company_id = v_company_id
    ) end
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
    and app.group_sees(o.group_vehicle_ids, o.group_until, v_company_id)
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;

comment on function public.desk_orders(text, integer) is
  'Открытые заказы для перевозчика с допущенной машиной подходящего класса. Пока окно группы открыто — только перевозчикам машин группы.';
revoke all on function public.desk_orders(text, integer) from public, anon;
grant execute on function public.desk_orders(text, integer) to authenticated, service_role;

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
    and app.group_sees(o.group_vehicle_ids, o.group_until, (select app.current_company_id()))
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

  if v_order.group_until > now() then
    raise exception 'Заказ сейчас предложен машинам заказчика — его берут кнопкой прямого заказа.'
      using errcode = '55005';
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
        /*
         * Пока окно открыто — только перевозчики машин группы; после —
         * все остальные: группа о заказе уже знает.
         */
        and case
          when o.group_until is null then true
          when o.group_until > now() then exists (
            select 1 from public.vehicles v where v.id = any (o.group_vehicle_ids) and v.company_id = c.id)
          else not exists (
            select 1 from public.vehicles v where v.id = any (o.group_vehicle_ids) and v.company_id = c.id)
        end
    );
$function$;


-- ── Окно закрылось: заказ выходит всем ─────────────────────────────

insert into app.runtime_config (key, value, note)
select 'group_release_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/dispatch/group-release'),
       'Письма перевозчикам о заказе, который группа не взяла. Будит app.run_group_release.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

/*
 * Раз в минуту. Уведомления в кабинеты пишутся здесь же, письма — в Next
 * (dispatchPublishedOrder), туда уходят номера выпущенных заказов.
 * Аудитория после окна — все, кроме группы (dispatch_audience).
 */
create or replace function app.run_group_release()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_url text;
  v_secret text;
  v_request bigint;
begin
  with due as (
    update public.orders o
    set group_released_at = now()
    where o.group_until <= now()
      and o.group_released_at is null
    returning o.id, o.ref, o.status, o.shipper_company_id
  ), open_due as (
    select * from due where status = 'OPEN'
  ), carriers as (
    insert into public.notifications (company_id, kind, code, params, link)
    select a.id, 'ORDER', 'order.published',
           jsonb_build_object('ref', d.ref, 'from', coalesce(pickup.city, ''), 'to', coalesce(finish.city, ret.city, '')),
           '/carrier/desk'
    from open_due d
    cross join lateral app.dispatch_audience(d.id) a
    left join public.order_stops pickup on pickup.order_id = d.id and pickup.role = 'PICKUP'
    left join public.order_stops ret on ret.order_id = d.id and ret.role = 'TRAILER_RETURN'
    left join lateral app.route_end(d.id) finish on true
    returning 1
  ), shippers as (
    insert into public.notifications (company_id, kind, code, params, link)
    select d.shipper_company_id, 'ORDER', 'group.released', jsonb_build_object('ref', d.ref), '/shipper/orders'
    from open_due d
    returning 1
  )
  /* Изменяющие CTE выполняются всегда, даже если на них не ссылаются. */
  select array_agg(id) into v_ids from open_due;

  if v_ids is null then
    return 0;
  end if;

  select value into v_url from app.runtime_config where key = 'group_release_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';
  if v_url is not null and v_secret is not null then
    select net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
      body := jsonb_build_object('order_ids', to_jsonb(v_ids)),
      timeout_milliseconds := 30000
    ) into v_request;

    insert into app.scheduler_calls (request_id, job)
    values (v_request, 'group-release')
    on conflict (request_id) do nothing;
  end if;

  return cardinality(v_ids);
end;
$$;

revoke all on function app.run_group_release() from public, anon, authenticated;

select cron.schedule('rahtis-group-release', '* * * * *', $$ select app.run_group_release(); $$);
