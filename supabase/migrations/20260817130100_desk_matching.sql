-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 5 · стол с учётом откликов и просроченной брони
--
-- Стол теперь показывает и заказы, у которых срок решения истёк: без
-- этого просроченный заказ висел бы занятым до срабатывания планировщика,
-- и правильность зависела бы от того, работает ли он.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.desk_orders(text, integer);

create or replace function public.desk_orders(
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
  /* Сколько мест занято из трёх и занято ли одно из них этой компанией. */
  offers_count integer,
  taken_by_me boolean,
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
    /*
     * У заказа с истёкшей бронью отклики ещё лежат в таблице, но силы уже
     * не имеют: их сотрёт первое же действие или уборка планировщика.
     * Показывать их числом было бы обманом — место свободно.
     */
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
          'note', s.note
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
      /* Просроченная бронь равносильна свободному заказу. */
      or app.order_deadline_passed(o.status, o.deadline_at)
      /* Заказ, на который эта компания уже откликнулась, из стола не пропадает. */
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
  'Стол заказов. Просроченная бронь считается снятой, контакты получателей не отдаются.';

revoke all on function public.desk_orders(text, integer) from public, anon;
grant execute on function public.desk_orders(text, integer) to authenticated, service_role;


/*
 * Рейсы, закреплённые за перевозчиком: ждущие подтверждения и идущие.
 * Здесь контакты уже отдаются — заказ закреплён, они нужны для работы.
 */
create or replace function public.my_assignments()
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

revoke all on function public.my_assignments() from public, anon;
grant execute on function public.my_assignments() to authenticated, service_role;
