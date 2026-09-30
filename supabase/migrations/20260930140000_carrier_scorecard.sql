-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · карточка перевозчика
--
-- Звёзды ставит заказчик, и ставит редко. Карточка считается сама из
-- того, что уже записано, за 12 месяцев:
--
--   trips              выполненные рейсы (DONE, машина компании);
--   on_time_pct        точки, где прибытие не позже согласованного
--                      времени + 15 минут, из точек со временем и прибытием;
--   docs_pct           рейсы с загруженной CMR;
--   abandoned          отказы от взятых рейсов (abandon_order:
--                      ORDER_RELEASED, ORDER_CANCELLED от имени перевозчика);
--   claims             претензии заказчиков по его рейсам;
--   direct_accept_pct  принятые прямые заказы из решённых (принят/отказ);
--   rating, ratings_count — прежние звёзды.
--
-- Проценты — только от пяти наблюдений, иначе null: две точки из двух не
-- говорят ничего. Видят: сама компания и оператор — всё; заказчик в
-- откликах на свой заказ — рейсы и приезд вовремя (offer_scorecards).
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.carrier_scorecard(p_company_id uuid)
returns table (
  trips integer,
  on_time_pct integer,
  timed_stops integer,
  docs_pct integer,
  abandoned integer,
  claims integer,
  direct_accept_pct integer,
  direct_decided integer,
  rating numeric,
  ratings_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with done as (
    select o.id
    from public.orders o
    where o.assigned_company_id = p_company_id
      and o.status = 'DONE'
      and o.closed_at > now() - interval '12 months'
  ), timed as (
    select s.arrived_at <= app.stop_planned_at(s.scheduled_date, s.scheduled_time, s.country) + interval '15 minutes' as on_time
    from public.order_stops s
    where s.order_id in (select id from done)
      and s.arrived_at is not null
      and s.scheduled_date is not null
      and s.scheduled_time is not null
  ), docs as (
    select count(*) filter (where exists (
      select 1 from public.order_documents d where d.order_id = done.id and d.kind = 'CMR'
    ))::integer as with_cmr, count(*)::integer as total
    from done
  ), direct as (
    select count(*) filter (where r.outcome = 'ACCEPTED')::integer as accepted,
           count(*) filter (where r.outcome in ('ACCEPTED', 'DECLINED'))::integer as decided
    from public.order_direct_requests r
    where r.carrier_company_id = p_company_id
      and r.sent_at > now() - interval '12 months'
  )
  select
    (select total from docs),
    (select case when count(*) >= 5 then round(100.0 * count(*) filter (where on_time) / count(*))::integer end from timed),
    (select count(*)::integer from timed),
    (select case when total >= 5 then round(100.0 * with_cmr / total)::integer end from docs),
    (select count(*)::integer
       from public.order_amendments a
       join public.profiles p on p.id = a.actor_id
      where p.company_id = p_company_id
        and a.kind in ('ORDER_RELEASED', 'ORDER_CANCELLED')
        and a.changes -> 'by' ->> 'to' = 'CARRIER'
        and a.created_at > now() - interval '12 months'),
    (select count(*)::integer
       from public.claims c
      where c.against_company_id = p_company_id
        and c.filed_by_role = 'SHIPPER'
        and c.created_at > now() - interval '12 months'),
    (select case when decided >= 5 then round(100.0 * accepted / decided)::integer end from direct),
    (select decided from direct),
    app.company_rating(p_company_id),
    app.company_ratings_count(p_company_id)
$$;

revoke all on function app.carrier_scorecard(uuid) from public, anon, authenticated;


/* Полная карточка: сама компания-перевозчик или оператор. */
create or replace function public.carrier_scorecard(p_company_id uuid default null)
returns table (
  trips integer,
  on_time_pct integer,
  timed_stops integer,
  docs_pct integer,
  abandoned integer,
  claims integer,
  direct_accept_pct integer,
  direct_decided integer,
  rating numeric,
  ratings_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := coalesce(p_company_id, (select app.current_company_id()));
begin
  if not coalesce(
    (v_company = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Карточка компании видна ей самой и оператору.' using errcode = '42501';
  end if;

  return query select * from app.carrier_scorecard(v_company);
end;
$$;

revoke all on function public.carrier_scorecard(uuid) from public, anon;
grant execute on function public.carrier_scorecard(uuid) to authenticated;


/*
 * Заказчику к откликам на его заказы: рейсы и приезд вовремя. Без
 * названия компании — отклик анонимен (TERMS 6.7), как и звёзды.
 */
create or replace function public.offer_scorecards(p_order_ids uuid[])
returns table (offer_id uuid, trips integer, on_time_pct integer)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, sc.trips, sc.on_time_pct
  from public.order_offers f
  join public.orders o on o.id = f.order_id
  cross join lateral app.carrier_scorecard(f.carrier_company_id) sc
  where f.order_id = any (p_order_ids[1:100])
    and (o.shipper_company_id = (select app.current_company_id()) or (select app.is_admin()))
$$;

revoke all on function public.offer_scorecards(uuid[]) from public, anon;
grant execute on function public.offer_scorecards(uuid[]) to authenticated;
