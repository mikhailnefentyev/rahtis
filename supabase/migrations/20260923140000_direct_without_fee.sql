-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · подписчик и прямой заказ: без процента и без нашего счёта
--
-- 23.09.2026 пользователь уточнил разделение:
--
--   ПОДРЯДЧИК — 3 % со ВСЕХ заказов, подписки нет. Все счета и оплаты
--     идут через нас, анонимность в обе стороны применяется.
--
--   ПОДПИСЧИК — 29,90 € за активную машину плюс 3 % только за заказы со
--     стола. Когда заказчик добавил его машину в свои и шлёт прямой
--     заказ, этот рейс идёт БЕЗ процента: счёт и оплата между ними,
--     а от нас — только отчёт о проделанной работе.
--
-- Отсюда следует то, чего в прошлой миграции не было: у подписчика
-- прямой рейс — это contract_party = 'CARRIER'. Значит, признак нельзя
-- ставить руками, он выводится из ветки перевозчика и происхождения
-- рейса, и делает это триггер на назначении: путей назначения четыре
-- (choose_offer, confirm_order, direct_assign, release_expired_order),
-- и помнить о каждом нельзя.
--
-- Анонимность идёт следом за деньгами. Если счёт выставляем мы —
-- стороны друг друга не видят, как и прежде. Если стороны рассчитываются
-- сами, скрывать их друг от друга нельзя: заказчику некому платить, а
-- перевозчику некому выставить счёт. Поэтому:
--   · заказчик видит название перевозчика у тех машин, чья компания
--     работает по подписке, — ей он и платит;
--   · перевозчик-подписчик видит настоящее имя заказчика, с которым у
--     него прямая связь; на столе всё по-прежнему кодом и городом.
-- ═══════════════════════════════════════════════════════════════════

-- ── Чей это договор ────────────────────────────────────────────────

create or replace function app.contract_party_of(p_carrier uuid, p_offer uuid)
returns public.contract_party
language sql
stable
set search_path = ''
as $$
  select case
    when p_carrier is null then 'RAHTIS'::public.contract_party
    when (select c.partnership from public.companies c where c.id = p_carrier) = 'SUBSCRIBER'
         and coalesce(
               (select f.origin from public.order_offers f where f.id = p_offer),
               'DIRECT'::public.offer_origin
             ) <> 'DESK'
      then 'CARRIER'::public.contract_party
    else 'RAHTIS'::public.contract_party
  end;
$$;

comment on function app.contract_party_of(uuid, uuid) is
  'Чей договор с клиентом: у подписчика прямой рейс — его собственный, всё остальное — наш подряд.';

create or replace function app.stamp_contract_party()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.contract_party := app.contract_party_of(new.assigned_company_id, new.chosen_offer_id);
  return new;
end;
$$;

create trigger orders_stamp_contract_party
  before insert or update of assigned_company_id, chosen_offer_id on public.orders
  for each row execute function app.stamp_contract_party();

/* Задним числом: у закрытых рейсов сторона договора остаётся как есть — это история. */
update public.orders o
set contract_party = app.contract_party_of(o.assigned_company_id, o.chosen_offer_id)
where o.status not in ('DONE', 'CANCELLED');


-- ── Деньги: пересчёт стороны при закрытии ──────────────────────────

/*
 * Ставки замораживаются при закрытии рейса. Сторона договора
 * пересчитывается там же: рейс могли переназначить другому перевозчику
 * другой ветки, и платить надо по тому, кто его вёз.
 */
create or replace function app.freeze_order_fees()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin public.offer_origin;
  v_closed date;
  v_free date;
begin
  if new.status = 'DONE' and old.status is distinct from 'DONE' then
    /* Нет отклика — значит рейс не со стола: то же правило, что в contract_party_of. */
    select coalesce(f.origin, 'DIRECT') into v_origin
    from (select 1) z
    left join public.order_offers f on f.id = new.chosen_offer_id;

    v_closed := (coalesce(new.closed_at, now()) at time zone 'Europe/Helsinki')::date;

    new.contract_party := app.contract_party_of(new.assigned_company_id, new.chosen_offer_id);

    v_free := app.free_until(new.shipper_company_id);
    new.shipper_fee_bps := case
      when v_origin = 'DIRECT' then 0
      when v_free is not null and v_closed <= v_free then 0
      else app.current_shipper_fee_bps()
    end;

    v_free := app.free_until(new.assigned_company_id);
    new.commission_bps := case
      when new.contract_party = 'CARRIER' then 0
      when v_free is not null and v_closed <= v_free then 0
      else app.current_commission_bps()
    end;
  end if;
  return new;
end;
$$;


-- ── Анонимность там, где она уместна ────────────────────────────────

/*
 * Заказчик видит, чья машина, только если платит ей напрямую. У машин
 * перевозчика-подрядчика название компании по-прежнему скрыто: счёт
 * заказчику выставляем мы, и знать перевозчика ему незачем.
 */
drop function if exists public.known_vehicles_for_shipper();

create or replace function public.known_vehicles_for_shipper()
returns table (
  vehicle_id uuid,
  plate text,
  driver_name text,
  driver_phone text,
  driver_email text,
  vehicle_class public.vehicle_class,
  make text,
  axles smallint,
  euro_class public.euro_class,
  payload_kg integer,
  ldm numeric,
  container_feet smallint[],
  rating numeric,
  trips integer,
  last_trip_at timestamptz,
  in_pool boolean,
  busy boolean,
  available boolean,
  carrier_name text,
  carrier_business_id text,
  direct_billing boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select app.current_company_id() as id),
  history as (
    select o.assigned_vehicle_id as vehicle_id,
           count(*)::integer as trips,
           max(o.closed_at) as last_trip_at
    from public.orders o, me
    where o.shipper_company_id = me.id
      and o.status = 'DONE'
      and o.assigned_vehicle_id is not null
    group by o.assigned_vehicle_id
  )
  select
    v.id,
    v.plate,
    coalesce(d.full_name, v.driver_name),
    coalesce(d.phone, v.whatsapp),
    d.email,
    v.vehicle_class,
    v.make,
    v.axles,
    v.euro_class,
    v.payload_kg,
    v.ldm,
    v.container_feet,
    app.company_rating(v.company_id),
    h.trips,
    h.last_trip_at,
    exists (
      select 1 from public.shipper_vehicle_pool p, me
      where p.shipper_company_id = me.id and p.vehicle_id = v.id
    ),
    exists (
      select 1 from public.orders o
      where o.assigned_vehicle_id = v.id
        and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    ),
    coalesce(app.vehicle_is_dispatchable(v.id), false),
    case when carrier.partnership = 'SUBSCRIBER' then carrier.name end,
    case when carrier.partnership = 'SUBSCRIBER' then carrier.business_id end,
    carrier.partnership = 'SUBSCRIBER'
  from history h
  join public.vehicles v on v.id = h.vehicle_id
  cross join me
  join public.companies carrier on carrier.id = v.company_id
  join public.carrier_shipper_links l
    on l.carrier_company_id = v.company_id
   and l.shipper_company_id = me.id
   and l.status = 'ACTIVE'
  left join public.drivers d on d.id = app.vehicle_driver_at(v.id, now())
  where (select app.current_party_role()) = 'SHIPPER'
  order by 16 desc, h.trips desc, v.plate;
$$;

revoke all on function public.known_vehicles_for_shipper() from public, anon;
grant execute on function public.known_vehicles_for_shipper() to authenticated;

/*
 * Перевозчик видит имя заказчика только там, где счёт выставляет сам:
 * подписчик с разрешённой прямой связью. Подрядчику заказчики
 * по-прежнему видны кодом — иначе он уйдёт мимо платформы.
 */
create or replace function public.carrier_partners()
returns table (
  shipper_id uuid,
  shipper_name text,
  trips integer,
  last_trip_at timestamptz,
  last_route text,
  status public.link_status,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select c.id, c.partnership
    from public.companies c
    where c.id = (select app.current_company_id())
  )
  select
    l.shipper_company_id,
    case
      when me.partnership = 'SUBSCRIBER' and l.status = 'ACTIVE' then s.name
      else 'Asiakas ' || upper(substr(md5(l.shipper_company_id::text), 1, 4))
    end,
    (select count(*)::integer from public.orders o
      where o.assigned_company_id = l.carrier_company_id
        and o.shipper_company_id = l.shipper_company_id
        and o.status = 'DONE'),
    last.closed_at,
    last.route,
    l.status,
    l.decided_at
  from public.carrier_shipper_links l
  cross join me
  join public.companies s on s.id = l.shipper_company_id
  left join lateral (
    select o.closed_at,
           concat_ws(' → ',
             (select st.city from public.order_stops st where st.order_id = o.id order by st.sequence limit 1),
             (select e.city from app.route_end(o.id) e)) as route
    from public.orders o
    where o.assigned_company_id = l.carrier_company_id
      and o.shipper_company_id = l.shipper_company_id
      and o.status = 'DONE'
    order by o.closed_at desc
    limit 1
  ) last on true
  where l.carrier_company_id = me.id
  order by (l.status = 'OFFERED') desc, last.closed_at desc nulls last;
$$;

revoke all on function public.carrier_partners() from public, anon;
grant execute on function public.carrier_partners() to authenticated;
