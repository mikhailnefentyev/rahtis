-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · прицеп рейса у заказчика (29.10.2026)
--
-- Заказчик видит номер назначенной машины своего рейса (offers_for_shipper,
-- is_assigned). Номер прицепа рейса — так же, только у назначенного
-- рейса и только свой заказ; сама колонка orders.assigned_trailer_id для
-- чтения закрыта (20261028235000_trip_trailer_private).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.shipper_trip_trailers(p_order_ids uuid[])
returns table (order_id uuid, plate text, kind public.trailer_kind, body_type public.body_type)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, t.plate, t.kind, t.body_type
  from public.orders o
  join public.trailers t on t.id = o.assigned_trailer_id
  where o.id = any (p_order_ids)
    and o.shipper_company_id = (select app.current_company_id())
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS', 'DONE');
$$;

revoke all on function public.shipper_trip_trailers(uuid[]) from public, anon;
grant execute on function public.shipper_trip_trailers(uuid[]) to authenticated;
