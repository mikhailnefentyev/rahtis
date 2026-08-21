-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · выполненный рейс уходит со стола
--
-- Закрытый рейс оставался в списке закреплённых у перевозчика — тогда
-- ему больше негде было жить, и по нему считалась выплата. Теперь у него
-- есть свой дом: вкладка выполненных, где рейс лежит с документами,
-- деньгами и оценкой.
--
-- Оставлять его в двух местах хуже, чем в одном. Стол закреплённых — это
-- список того, что требует действия: подтвердить, проехать, закрыть.
-- Выполненный рейс не требует ничего, и каждый день он делает этот
-- список длиннее ровно на ту величину, на которую компания работает.
-- Через полгода перевозчик будет искать сегодняшний рейс среди двухсот
-- вчерашних.
--
-- Смена мгновенная: закрыл рейс — он исчез со стола и появился в
-- выполненных. Никакого промежуточного состояния, когда он в обоих
-- списках сразу.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.my_assignments()
returns table (
  id uuid,
  ref text,
  order_type public.order_type,
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
    o.id, o.ref, o.order_type, o.status, o.deadline_at,
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
  'Рейсы перевозчика, требующие действия: ждущие подтверждения и идущие. Выполненные — в completed_orders.';

/* Пересоздание функции сбрасывает гранты вместе со старой версией. */
revoke all on function public.my_assignments() from public, anon;
grant execute on function public.my_assignments() to authenticated, service_role;
