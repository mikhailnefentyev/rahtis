-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перевозчик видит, у кого из водителей включены уведомления
--
-- Прямой заказ попадает в приложение водителя сразу, но телефон о нём
-- сообщает только при включённом push. На 1.10.2026 push включил один
-- водитель из всех: остальные узнают о прямом заказе, лишь открыв
-- приложение. Перевозчик должен это видеть и напомнить водителю.
--
-- Наружу — только число устройств и время последней доставки: адреса
-- подписок и ключи остаются в базе (driver_push_subscriptions читает
-- только сайт служебным ключом).
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.carrier_drivers_push()
returns table (driver_id uuid, devices integer, last_sent_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, count(s.id)::integer, max(s.last_sent_at)
  from public.drivers d
  left join public.driver_push_subscriptions s on s.driver_id = d.id
  where d.company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  group by d.id
$$;

comment on function public.carrier_drivers_push() is
  'Водители компании-перевозчика: на скольких устройствах включены push-уведомления.';

revoke all on function public.carrier_drivers_push() from public, anon;
grant execute on function public.carrier_drivers_push() to authenticated;
