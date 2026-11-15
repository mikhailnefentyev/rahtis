-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · пробег машин за период — для расходов на обслуживание
-- (евро на километр), 15.11.2026
--
-- GPS нет, поэтому пробег — по показаниям одометра из тех же
-- источников, что и app.vehicle_odometer: заправки, смены водителя,
-- сервисная книжка, дефекты. Пробег за период = последнее показание в
-- периоде минус последнее показание до его начала; показаний до начала
-- нет — минус первое показание в периоде (тогда пробег занижен, и
-- сайт так и подписывает: «по показаниям»).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.fleet_km_span(p_from date)
returns table (vehicle_id uuid, km_start integer, km_end integer, readings integer)
language sql
stable
security definer
set search_path = ''
as $$
  with own as (
    select v.id from public.vehicles v where v.company_id = (select app.current_company_id())
  ),
  readings as (
    select f.vehicle_id, (f.filled_at at time zone 'Europe/Helsinki')::date as on_day, f.odometer_km as km
    from public.fuel_entries f join own on own.id = f.vehicle_id
    where f.odometer_km is not null
    union all
    select s.vehicle_id, (s.started_at at time zone 'Europe/Helsinki')::date, s.odometer_start
    from public.driver_shifts s join own on own.id = s.vehicle_id
    where s.odometer_start is not null
    union all
    select s.vehicle_id, (coalesce(s.ended_at, s.started_at) at time zone 'Europe/Helsinki')::date, s.odometer_end
    from public.driver_shifts s join own on own.id = s.vehicle_id
    where s.odometer_end is not null
    union all
    select r.vehicle_id, r.done_on, r.odometer_km
    from public.maintenance_records r join own on own.id = r.vehicle_id
    where r.odometer_km is not null
    union all
    select d.vehicle_id, (d.reported_at at time zone 'Europe/Helsinki')::date, d.odometer_km
    from public.vehicle_defects d join own on own.id = d.vehicle_id
    where d.odometer_km is not null
  )
  select
    r.vehicle_id,
    coalesce(max(r.km) filter (where r.on_day < p_from), min(r.km) filter (where r.on_day >= p_from)) as km_start,
    max(r.km) filter (where r.on_day >= p_from) as km_end,
    (count(*) filter (where r.on_day >= p_from))::integer as readings
  from readings r
  group by r.vehicle_id
  having count(*) filter (where r.on_day >= p_from) > 0;
$$;

comment on function public.fleet_km_span(date) is
  'Пробег машин своей компании с даты по показаниям одометра (заправки, смены, книжка, дефекты): начало и конец периода.';

revoke all on function public.fleet_km_span(date) from public, anon;
grant execute on function public.fleet_km_span(date) to authenticated;
