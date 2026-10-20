-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · страна точки в строках простоя
--
-- Время событий точки показывается по поясу её страны (src/lib/orders/
-- stopTime, 21.10.2026). Строки простоя в отчёте («ожидание 08:00–10:40»)
-- выводятся из снимка app.order_waiting, а страны в нём не было — и
-- простой в Гданьске считался бы по Хельсинки. Тело функции то же, что в
-- 20260929230000, плюс поле country.
--
-- Снимки уже закрытых рейсов не пересчитываются: у них страны нет, и
-- отчёт показывает их, как раньше, по Хельсинки.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.order_waiting(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select
      s.sequence, s.role, s.city, s.country, s.arrived_at, s.completed_at,
      greatest(
        s.arrived_at,
        case when s.scheduled_date is not null
          then (s.scheduled_date + coalesce(s.scheduled_time, time '00:00')) at time zone app.stop_timezone(s.country)
        end
      ) as started
    from public.order_stops s
    where s.order_id = p_order_id
      and s.arrived_at is not null
      and s.completed_at is not null
  ), m as (
    select t.*,
           greatest(0, floor(extract(epoch from (t.completed_at - t.started)) / 60))::integer as minutes
    from t
    where t.completed_at > t.started
  ), h as (
    select m.*,
           case when m.minutes - 60 >= 15 then ceil((m.minutes - 60) / 60.0)::integer else 0 end as hours
    from m
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'sequence', h.sequence,
      'role', h.role,
      'city', h.city,
      'country', h.country,
      'started_at', h.started,
      'completed_at', h.completed_at,
      'minutes', h.minutes,
      'hours', h.hours,
      'cents', h.hours * app.waiting_hour_cents()
    ) order by h.sequence), '[]'::jsonb)
  from h
  where h.hours > 0;
$$;
