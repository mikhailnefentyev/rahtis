-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заказчику видно, куда платить за прямой рейс
--
-- 23.09.2026 пользователь: если заказчик рассчитывается с перевозчиком
-- сам, ему нужен номер счёта — и BIC вместе с ним.
--
-- Это доводит до конца прежнюю правку. Имя и Y-tunnus перевозчика уже
-- отдавались у машин, чья компания работает по подписке, но заплатить
-- по ним нельзя: счёт выставляет перевозчик, а реквизитов у заказчика
-- нет. Банковские данные отдаются там же и на том же условии — только
-- когда счёт выставляет сам перевозчик. У машин подрядчика их нет и
-- быть не должно: счёт заказчику выставляем мы, и платит он нам.
-- ═══════════════════════════════════════════════════════════════════

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
  carrier_iban text,
  carrier_bic text,
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
    case when carrier.partnership = 'SUBSCRIBER' then carrier.iban end,
    case when carrier.partnership = 'SUBSCRIBER' then carrier.bic end,
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
