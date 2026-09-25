-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · проверка «чей рейс» не пропускает NULL
--
-- Прогон тестового заказа 25.09 показал: заказчик смог поставить оценку
-- прибытия в чужом рейсе. Причина — трёхзначная логика SQL в проверке
--
--     if not (A or B or o.assigned_driver_id = app.current_driver_id())
--
-- У кабинета (заказчик, перевозчик) водителя нет, current_driver_id()
-- даёт NULL, сравнение — NULL, «false or false or NULL» — NULL, и
-- «not NULL» — снова NULL. IF на NULL не срабатывает: исключение не
-- бросается, и вызов идёт дальше, будто права есть.
--
-- Та же проверка стоит в ядре отметки точки (app.complete_stop_at, с
-- 22.09): любой вошедший без собственного водителя мог отметить точку
-- в чужом идущем рейсе, зная её идентификатор.
--
-- Исправление — coalesce(…, false): неизвестность означает «нельзя».
-- Остальное в обеих функциях без изменений.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.complete_stop_at(
  p_stop_id uuid,
  p_damage_note text,
  p_lat double precision,
  p_lon double precision,
  p_accuracy_m integer,
  p_at timestamptz
)
returns public.order_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_pending_seq smallint;
  v_previous timestamptz;
  v_lat double precision;
  v_lon double precision;
  v_at timestamptz;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not coalesce(
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
    or v_order.assigned_driver_id = (select app.current_driver_id()),
    false
  ) then
    raise exception 'Отмечать прохождение может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Отмечать точки можно только в идущем рейсе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if v_stop.completed_at is not null then
    raise exception 'Точка уже пройдена.' using errcode = '55000';
  end if;

  select min(s.sequence) into v_pending_seq
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.completed_at is null;

  if v_stop.sequence <> v_pending_seq then
    raise exception 'Точки проходятся по порядку: сначала отметьте предыдущие.'
      using errcode = '55000';
  end if;

  select max(s.completed_at) into v_previous
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.sequence < v_stop.sequence;

  v_at := greatest(p_at, coalesce(v_stop.arrived_at, p_at), coalesce(v_previous, p_at));

  if app.sane_position(p_lat, p_lon) then
    v_lat := p_lat;
    v_lon := p_lon;
  end if;

  update public.order_stops
  set completed_at = v_at,
      damage_note = nullif(btrim(coalesce(p_damage_note, '')), ''),
      completed_lat = v_lat,
      completed_lon = v_lon,
      completed_accuracy_m = case
        when v_lat is null then null
        when p_accuracy_m between 1 and 100000 then p_accuracy_m
        else null
      end
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

create or replace function public.set_stop_eta(
  p_stop_id uuid,
  p_eta timestamptz,
  p_source public.eta_source default 'CARRIER'
)
returns public.order_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_pending_seq smallint;
begin
  if p_source not in ('TRAFFIC', 'CARRIER') then
    raise exception 'Оценку по маршруту ставит только отметка точки.' using errcode = '22023';
  end if;

  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not coalesce(
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
    or v_order.assigned_driver_id = (select app.current_driver_id()),
    false
  ) then
    raise exception 'Время прибытия указывает назначенный перевозчик.' using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Рейс не идёт, время прибытия не меняется.' using errcode = '55000';
  end if;

  select min(s.sequence) into v_pending_seq
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.completed_at is null;

  if v_stop.sequence is distinct from v_pending_seq or v_stop.arrived_at is not null then
    raise exception 'Время прибытия указывается только для следующей точки до прибытия на неё.'
      using errcode = '55000';
  end if;

  if p_eta is null or p_eta < now() - interval '30 minutes' or p_eta > now() + interval '7 days' then
    raise exception 'Время прибытия вне допустимого окна.' using errcode = '22023';
  end if;

  if p_source = 'TRAFFIC' and v_stop.eta_source = 'CARRIER' then
    return v_stop;
  end if;

  update public.order_stops
  set eta_at = p_eta, eta_source = p_source, eta_updated_at = now()
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;


-- ── Та же проверка через current_company_id() ──────────────────────
--
-- У водителя в приложении профиля нет, current_company_id() даёт NULL,
-- и «компания совпадает или оператор» становится NULL, а не false.
-- Тела функций взяты из последних миграций без изменений, кроме условия.

-- public.company_readiness (из 20260816160200_readiness.sql, проверок: 1)
create or replace function public.company_readiness(p_company_id uuid)
returns table (
  documents_ok boolean,
  has_license boolean,
  has_insurance boolean,
  license_valid_until date,
  insurance_valid_until date,
  approved_vehicles integer,
  can_take_orders boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not coalesce(
    (select app.is_admin())
    or p_company_id = (select app.current_company_id()),
    false
  ) then
    raise exception 'Нет доступа к этой компании.' using errcode = '42501';
  end if;

  return query
  select
    app.company_documents_ok(p_company_id),
    exists (
      select 1 from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'CARRIER_LICENSE' and d.is_current
    ),
    exists (
      select 1 from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'INSURANCE' and d.is_current
    ),
    (
      select d.valid_until from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'CARRIER_LICENSE' and d.is_current
    ),
    (
      select d.valid_until from public.company_documents d
      where d.company_id = p_company_id and d.kind = 'INSURANCE' and d.is_current
    ),
    (
      select count(*)::integer from public.vehicles v
      where v.company_id = p_company_id and v.access = 'APPROVED'
    ),
    app.has_dispatchable_vehicle(p_company_id);
end;
$$;

-- public.close_order (из 20260819180000_commission_frozen.sql, проверок: 1)
create or replace function public.close_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_pending integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Закрыть рейс может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Закрывать можно только идущий рейс, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  select count(*) into v_pending
  from public.order_stops s
  where s.order_id = p_order_id and s.completed_at is null;

  if v_pending > 0 then
    raise exception 'Сначала отметьте все точки маршрута: осталось %.', v_pending
      using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.order_documents d
    where d.order_id = p_order_id and d.kind = 'CMR'
  ) then
    raise exception 'Приложите CMR — без накладной рейс не закрывается.'
      using errcode = '55000';
  end if;

  /*
   * Ставка комиссии записывается в сам рейс. С этого момента он
   * рассчитывается по ней навсегда, что бы ни случилось с текущей
   * ставкой платформы.
   */
  update public.orders
  set status = 'DONE',
      closed_at = now(),
      commission_bps = app.current_commission_bps()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- app.assert_amendable (из 20260819190000_live_amendments.sql, проверок: 1)
create or replace function app.assert_amendable(p_stop public.order_stops)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_stop.order_id;

  if not coalesce(
    v_order.shipper_company_id = (select app.current_company_id())
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Править маршрут может только заказчик этого рейса.'
      using errcode = '42501';
  end if;

  /*
   * До старта маршрут этими функциями не правится. Опубликованный заказ
   * лежит на столе, по нему поданы отклики, и тихая подмена адреса
   * означала бы, что перевозчик согласился на один рейс, а везёт другой.
   * Такая правка — это снятие с публикации, и она будет отдельной.
   */
  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Живая корректировка возможна только в идущем рейсе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if p_stop.completed_at is not null then
    raise exception 'Точка уже пройдена — её маршрут не меняет.'
      using errcode = '55000';
  end if;

  return v_order;
end;
$$;

-- public.store_route (из 20260819190000_live_amendments.sql, проверок: 1)
create or replace function public.store_route(p_order_id uuid, p_route jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_leg jsonb;
  v_index integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_order.shipper_company_id = (select app.current_company_id())
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Маршрут пересчитывает заказчик этого рейса.' using errcode = '42501';
  end if;

  update public.orders
  set route_geometry = nullif(p_route->>'geometry', ''),
      route_bounds = p_route->'bounds',
      route_fingerprint = nullif(p_route->>'fingerprint', ''),
      route_computed_at = now(),
      distance_auto_km = nullif(p_route->>'km', '')::integer
  where id = p_order_id
  returning * into v_order;

  /*
   * Плечи раскладываются по точкам в порядке маршрута: плечо N — путь ДО
   * точки N от предыдущей, поэтому у первой его нет. Роутер отдаёт их
   * ровно столько, сколько промежутков между точками.
   */
  if jsonb_typeof(p_route->'legs') = 'array' then
    for v_leg in select * from jsonb_array_elements(p_route->'legs') loop
      v_index := v_index + 1;

      update public.order_stops s
      set leg_distance_m = nullif(v_leg->>'distanceM', '')::integer,
          leg_duration_s = nullif(v_leg->>'durationS', '')::integer
      where s.id = (
        select t.id from public.order_stops t
        where t.order_id = p_order_id
        order by t.sequence
        offset v_index limit 1
      );
    end loop;
  end if;

  return v_order;
end;
$$;

-- public.acknowledge_amendments (из 20260819190000_live_amendments.sql, проверок: 1)
create or replace function public.acknowledge_amendments(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_count integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Отметить изменения может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  with seen as (
    update public.order_amendments
    set acknowledged_at = now(), acknowledged_by = (select auth.uid())
    where order_id = p_order_id and acknowledged_at is null
    returning 1
  )
  select count(*)::integer into v_count from seen;

  return v_count;
end;
$$;

-- public.rate_order (из 20260821140000_ratings.sql, проверок: 1)
create or replace function public.rate_order(
  p_order_id uuid,
  p_score smallint,
  p_comment text default null
)
returns public.order_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_rating public.order_ratings;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_order.shipper_company_id = (select app.current_company_id())
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Оценить рейс может только его заказчик.' using errcode = '42501';
  end if;

  if v_order.status <> 'DONE' then
    raise exception 'Оценка ставится после закрытия рейса, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if v_order.assigned_company_id is null then
    raise exception 'У рейса нет перевозчика — оценивать некого.' using errcode = '55000';
  end if;

  if p_score is null or p_score not between 1 and 5 then
    raise exception 'Оценка ставится по шкале от 1 до 5.' using errcode = '22023';
  end if;

  insert into public.order_ratings (
    order_id, carrier_company_id, shipper_company_id, score, comment, rated_by
  )
  values (
    p_order_id,
    v_order.assigned_company_id,
    v_order.shipper_company_id,
    p_score,
    nullif(btrim(coalesce(p_comment, '')), ''),
    (select auth.uid())
  )
  on conflict (order_id) do update
    set score = excluded.score,
        comment = excluded.comment,
        rated_by = excluded.rated_by
  returning * into v_rating;

  return v_rating;
end;
$$;

-- public.carrier_rating (из 20260821140000_ratings.sql, проверок: 1)
create or replace function public.carrier_rating(p_company_id uuid default null)
returns table (score numeric, ratings_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  v_company := coalesce(p_company_id, (select app.current_company_id()));

  if not coalesce(
    (v_company = (select app.current_company_id())
      and (select app.current_party_role()) = 'CARRIER')
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Оценки компании видны ей самой и оператору.' using errcode = '42501';
  end if;

  return query
  select app.company_rating(v_company), app.company_ratings_count(v_company);
end;
$$;
