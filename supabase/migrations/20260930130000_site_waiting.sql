-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · простой по площадкам
--
-- Из отметок прибытия и «пройдена» считается, сколько обычно стоят на
-- площадке: порт, терминал, склад клиента. Перевозчик видит это на
-- столе до отклика — «Hanko: обычно 1 ч 40 мин» — и может заложить в
-- решение; заказчик видит свои площадки и где его машины ждут.
--
-- Правила:
--   · простой считается как у доплаты: от прибытия, но не раньше
--     согласованного времени, до отметки «пройдена»;
--   · площадка — выполненные точки в прямоугольнике ~300 м вокруг
--     координат точки (у одного порта разные адреса въезда), за 12 месяцев;
--   · меньше трёх рейсов — цифры нет: одна неудачная смена не рейтинг;
--   · сутки и больше — не простой, а забытая отметка: не считается.
-- Никто не видит, чьи это были рейсы: только медиана, доля простоев
-- дольше часа и число рейсов.
-- ═══════════════════════════════════════════════════════════════════

create index if not exists order_stops_site_idx
  on public.order_stops (lat, lon)
  where completed_at is not null and arrived_at is not null;


/* Простой одной выполненной точки в минутах, null если не посчитать. */
create or replace function app.stop_waited_minutes(
  p_arrived timestamptz, p_completed timestamptz, p_date date, p_time time, p_country text
)
returns integer
language sql
stable
as $$
  select case
    when p_arrived is null or p_completed is null then null
    when p_completed - p_arrived >= interval '24 hours' then null
    else greatest(0, floor(extract(epoch from
      p_completed - greatest(p_arrived, coalesce(app.stop_planned_at(p_date, p_time, p_country), p_arrived))) / 60))::integer
  end
$$;


/* Статистика площадки вокруг координат. */
create or replace function app.site_waiting(p_lat double precision, p_lon double precision)
returns table (samples integer, median_minutes integer, over_hour_pct integer)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select app.stop_waited_minutes(s.arrived_at, s.completed_at, s.scheduled_date, s.scheduled_time, s.country) as minutes
    from public.order_stops s
    join public.orders o on o.id = s.order_id
    where o.status = 'DONE'
      and s.completed_at is not null and s.arrived_at is not null
      and s.completed_at > now() - interval '12 months'
      and s.lat between p_lat - 0.003 and p_lat + 0.003
      and s.lon between p_lon - 0.006 and p_lon + 0.006
  )
  select count(*)::integer,
         round(percentile_cont(0.5) within group (order by minutes))::integer,
         round(100.0 * count(*) filter (where minutes > 60) / nullif(count(*), 0))::integer
  from w
  where minutes is not null
  having count(*) >= 3
$$;

revoke all on function app.site_waiting(double precision, double precision) from public, anon, authenticated;


/*
 * Для перечисленных точек — простой на их площадках. Точку можно
 * спросить, если видишь её заказ: заказчик свою, перевозчик — открытую
 * на столе или свою в работе, оператор — любую.
 */
create or replace function public.stop_waiting_typical(p_stop_ids uuid[])
returns table (stop_id uuid, samples integer, median_minutes integer, over_hour_pct integer)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, w.samples, w.median_minutes, w.over_hour_pct
  from public.order_stops s
  join public.orders o on o.id = s.order_id
  cross join lateral app.site_waiting(s.lat, s.lon) w
  where s.id = any (p_stop_ids[1:200])
    and s.lat is not null and s.lon is not null
    and (
      (select app.is_admin())
      or o.shipper_company_id = (select app.current_company_id())
      or o.assigned_company_id = (select app.current_company_id())
      or ((select app.current_party_role()) = 'CARRIER' and o.status in ('OPEN', 'REQUESTED'))
    )
$$;

revoke all on function public.stop_waiting_typical(uuid[]) from public, anon;
grant execute on function public.stop_waiting_typical(uuid[]) to authenticated;


/*
 * Площадки заказчика за 12 месяцев: его выполненные точки, собранные по
 * месту (город + адрес). Цифры — по всем рейсам на площадке, не только
 * его: так видно, стоит ли площадка вообще или только у него.
 */
create or replace function public.shipper_sites_waiting()
returns table (
  city text,
  address text,
  place_name text,
  my_stops integer,
  samples integer,
  median_minutes integer,
  over_hour_pct integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select s.city, s.address,
           max(s.place_name) as place_name,
           count(*)::integer as my_stops,
           avg(s.lat) as lat, avg(s.lon) as lon
    from public.order_stops s
    join public.orders o on o.id = s.order_id
    where o.shipper_company_id = (select app.current_company_id())
      and o.status = 'DONE'
      and s.completed_at > now() - interval '12 months'
      and s.lat is not null and s.lon is not null
    group by s.city, s.address
  )
  select m.city, m.address, m.place_name, m.my_stops, w.samples, w.median_minutes, w.over_hour_pct
  from mine m
  cross join lateral app.site_waiting(m.lat, m.lon) w
  where (select app.current_party_role()) = 'SHIPPER'
  order by w.median_minutes desc, m.my_stops desc
  limit 50
$$;

revoke all on function public.shipper_sites_waiting() from public, anon;
grant execute on function public.shipper_sites_waiting() to authenticated;
