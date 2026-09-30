-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · подсказка цены и «нет откликов»
--
-- Заказчик ставит цену сам и не знает, какая нормальна. Две вещи:
--
--   price_guide     при создании заказа — сколько стоили выполненные
--                   рейсы той же единицы на похожем расстоянии (±30 %,
--                   12 месяцев), пересчитанные на это расстояние: медиана
--                   и середина разброса. Меньше пяти рейсов — подсказки нет:
--                   ориентир, взятый с потолка, хуже, чем никакого.
--                   Тестовые заказы — только тестовым компаниям.
--   NO_OFFERS       заказ полчаса на столе без откликов — заказчику одно
--                   уведомление (поднять цену или отправить знакомой
--                   машине), оператору — список в пульте.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.price_guide(p_haul_kind public.haul_kind, p_distance_km integer)
returns table (samples integer, median_cents integer, low_cents integer, high_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select coalesce((select c.is_test from public.companies c where c.id = (select app.current_company_id())), false) as is_test
  ), s as (
    select o.rate_cents::numeric * p_distance_km / o.distance_km as cents
    from public.orders o
    join public.companies c on c.id = o.shipper_company_id
    where o.status = 'DONE'
      and o.haul_kind = p_haul_kind
      and o.closed_at > now() - interval '12 months'
      and o.distance_km > 0 and o.rate_cents > 0
      and o.distance_km between p_distance_km * 0.7 and p_distance_km * 1.3
      and (not c.is_test or (select is_test from me))
  )
  select count(*)::integer,
         round(percentile_cont(0.5) within group (order by cents))::integer,
         round(percentile_cont(0.25) within group (order by cents))::integer,
         round(percentile_cont(0.75) within group (order by cents))::integer
  from s
  where p_distance_km between 1 and 5000
    and (select app.current_party_role()) in ('SHIPPER', 'ADMIN')
  having count(*) >= 5
$$;

revoke all on function public.price_guide(public.haul_kind, integer) from public, anon;
grant execute on function public.price_guide(public.haul_kind, integer) to authenticated;


create table public.order_alerts (
  order_id uuid not null references public.orders (id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (order_id, kind),
  constraint order_alerts_kind check (kind in ('NO_OFFERS'))
);

alter table public.order_alerts enable row level security;
revoke all on public.order_alerts from anon, authenticated;


create or replace function app.run_no_offer_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select o.id, o.ref, o.shipper_company_id
    from public.orders o
    where o.status = 'OPEN'
      and o.published_at < now() - interval '30 minutes'
      and not exists (select 1 from public.order_offers f where f.order_id = o.id)
      and not exists (select 1 from public.order_alerts a where a.order_id = o.id and a.kind = 'NO_OFFERS')
  loop
    insert into public.order_alerts (order_id, kind) values (r.id, 'NO_OFFERS');
    perform app.notify_event(r.shipper_company_id, 'ORDER', 'order.no_offers',
      jsonb_build_object('ref', r.ref, 'minutes', 30), '/shipper/orders');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function app.run_no_offer_alerts() from public, anon, authenticated;

select cron.schedule('rahtis-no-offer-alerts', '*/5 * * * *', $$ select app.run_no_offer_alerts(); $$);


/* Пульт оператора: заказы на столе дольше получаса без откликов. */
create or replace function public.admin_orders_without_offers()
returns table (
  id uuid,
  ref text,
  shipper_name text,
  is_test boolean,
  haul_kind public.haul_kind,
  pickup_city text,
  finish_city text,
  distance_km integer,
  rate_cents integer,
  published_at timestamptz,
  minutes_open integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Только оператор.' using errcode = '42501';
  end if;

  return query
  select o.id, o.ref, c.name, c.is_test, o.haul_kind,
         (select s.city from public.order_stops s where s.order_id = o.id order by s.sequence limit 1),
         (select s.city from public.order_stops s where s.order_id = o.id order by s.sequence desc limit 1),
         o.distance_km, o.rate_cents, o.published_at,
         floor(extract(epoch from now() - o.published_at) / 60)::integer
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  where o.status = 'OPEN'
    and o.published_at < now() - interval '30 minutes'
    and not exists (select 1 from public.order_offers f where f.order_id = o.id)
  order by o.published_at
  limit 50;
end;
$$;

revoke all on function public.admin_orders_without_offers() from public, anon;
grant execute on function public.admin_orders_without_offers() to authenticated;
