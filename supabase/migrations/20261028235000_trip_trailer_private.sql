-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · прицеп рейса — не открытая колонка (28.10.2026)
--
-- Проверка 99330bb: assigned_trailer_id попал в открытые для чтения
-- колонки orders, хотя assigned_vehicle_id, assigned_company_id и
-- assigned_driver_id заказчику намеренно не видны. Колонка закрывается,
-- перевозчик получает прицепы своих рейсов функцией (как водитель —
-- driver_trip_trailers).
-- ═══════════════════════════════════════════════════════════════════

revoke select (assigned_trailer_id) on public.orders from authenticated;

create or replace function public.carrier_trip_trailers(p_order_ids uuid[])
returns table (order_id uuid, trailer_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.assigned_trailer_id
  from public.orders o
  where o.id = any (p_order_ids)
    and o.assigned_company_id = (select app.current_company_id());
$$;

revoke all on function public.carrier_trip_trailers(uuid[]) from public, anon;
grant execute on function public.carrier_trip_trailers(uuid[]) to authenticated;
