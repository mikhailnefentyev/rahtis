-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · реквизиты перевозчика по своему заказу (17.11.2026)
--
-- С 6.11.2026 договор перевозки — напрямую между заказчиком и
-- перевозчиком. Заказчик обязан знать свою сторону договора: кто она, её
-- Y-tunnus и счёт, на который он платит. До сих пор реквизиты приходили
-- только из known_vehicles_for_shipper — то есть по машинам с завершённым
-- рейсом или от пригласившего перевозчика. Первый рейс нового
-- перевозчика показывал на месте перевозчика «Aivomaa Oy» — а Aivomaa в
-- перевозках не участвует.
--
-- Отдаёт реквизиты только по своим заказам с прямым договором и уже
-- назначенным перевозчиком.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.shipper_order_carriers(p_order_ids uuid[])
returns table (
  order_id uuid,
  carrier_id uuid,
  carrier_name text,
  carrier_business_id text,
  carrier_iban text,
  carrier_bic text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, c.id, c.name, c.business_id, c.iban, c.bic
  from public.orders o
  join public.companies c on c.id = o.assigned_company_id
  where o.id = any (p_order_ids)
    and o.shipper_company_id = (select app.current_company_id())
    and o.contract_party = 'CARRIER'
    and (select app.current_party_role()) = 'SHIPPER';
$$;

comment on function public.shipper_order_carriers(uuid[]) is
  'Сторона договора перевозки по своим заказам заказчика: перевозчик, Y-tunnus, счёт (прямой договор, 17.11.2026).';

revoke all on function public.shipper_order_carriers(uuid[]) from public, anon;
grant execute on function public.shipper_order_carriers(uuid[]) to authenticated, service_role;
