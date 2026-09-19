-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · чтения оператора по закрытым колонкам заказа
--
-- То же, что с очередью расчётов (billing_queue): админка фильтровала
-- orders по колонкам, закрытым от authenticated колоночными грантами, и
-- получала 42501, которое страница показывала как «ничего нет».
--
--   карточка компании  — число рейсов перевозчика (assigned_company_id);
--   главная админки    — заказы, которые можно удалить (invoiced_at).
--
-- Обе выборки — функциями только для оператора.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.admin_company_orders(p_company_id uuid)
returns table (as_shipper bigint, as_carrier bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Только для оператора.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.orders o where o.shipper_company_id = p_company_id),
    (select count(*) from public.orders o where o.assigned_company_id = p_company_id);
end;
$$;

revoke all on function public.admin_company_orders(uuid) from public, anon;
grant execute on function public.admin_company_orders(uuid) to authenticated, service_role;


/*
 * Заказы, которые оператор вправе удалить: черновые, открытые и снятые,
 * по которым не выставлен счёт. Правило удаления живёт в delete_order;
 * здесь только список кандидатов для экрана.
 */
create or replace function public.admin_disposable_orders(p_limit integer default 30)
returns table (
  id uuid,
  ref text,
  status public.order_status,
  created_at timestamptz,
  distance_km integer,
  rate_cents integer,
  shipper_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Только для оператора.' using errcode = '42501';
  end if;

  return query
  select o.id, o.ref, o.status, o.created_at, o.distance_km, o.rate_cents, c.name
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  where o.status in ('DRAFT', 'OPEN', 'CANCELLED') and o.invoiced_at is null
  order by o.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 200);
end;
$$;

revoke all on function public.admin_disposable_orders(integer) from public, anon;
grant execute on function public.admin_disposable_orders(integer) to authenticated, service_role;
