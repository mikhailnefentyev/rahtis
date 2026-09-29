-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · доплата за простой: автоматический расчёт
--
-- Решение пользователя 29.09.2026: простой считается автоматически, если
-- превышение бесплатного часа не меньше 15 минут.
--
-- Правило (договор заказчика 5, договор перевозчика 9):
--   · у каждой точки погрузки и выгрузки свой бесплатный час;
--   · отсчёт — от прибытия водителя, но не раньше согласованного времени
--     точки (по часовому поясу страны точки), до отметки «пройдена»;
--   · превышение меньше 15 минут не начисляется; от 15 минут — 45 € за
--     каждый начатый час: 1 ч 10 мин — 0, 1 ч 15 мин — 45 €, 2 ч 15 мин — 90 €;
--   · только когда сторона договора заказчика — Aivomaa (contract_party
--     = RAHTIS): в прямых рейсах перевозчика на подписке простой стороны
--     договаривают сами (договор перевозчика 9.1).
--
-- Доплата фиксируется на заказе при закрытии, как сборы (freeze_order_fees):
-- waiting — строки по точкам (для счёта: точка, начало, конец, минуты,
-- часы, сумма), waiting_cents — итог. Заказчику идёт в счёт, перевозчику
-- в расчёт целиком, без сервисного сбора.
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders
  add column waiting_cents integer not null default 0,
  add column waiting jsonb not null default '[]'::jsonb;

alter table public.orders
  add constraint orders_waiting_cents_nonnegative check (waiting_cents >= 0);

comment on column public.orders.waiting_cents is
  'Доплата за простой, зафиксированная при закрытии (45 € за начатый час сверх часа на точке, от 15 минут превышения).';


/* Ставка часа простоя без ALV — одно место, как subscription_unit_cents. */
create or replace function app.waiting_hour_cents()
returns integer
language sql
immutable
as $$ select 4500 $$;


/* Часовой пояс точки по стране: согласованное время задаётся местным. */
create or replace function app.stop_timezone(p_country text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_country, 'FI'))
    when 'SE' then 'Europe/Stockholm'
    when 'NO' then 'Europe/Oslo'
    when 'DK' then 'Europe/Copenhagen'
    when 'EE' then 'Europe/Tallinn'
    else 'Europe/Helsinki'
  end
$$;


/*
 * Простой по точкам заказа: строки только с начисленными часами.
 * Точка без прибытия или без отметки «пройдена» не считается — нечем
 * показать время.
 */
create or replace function app.order_waiting(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select
      s.sequence, s.role, s.city, s.arrived_at, s.completed_at,
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
      'started_at', h.started,
      'completed_at', h.completed_at,
      'minutes', h.minutes,
      'hours', h.hours,
      'cents', h.hours * app.waiting_hour_cents()
    ) order by h.sequence), '[]'::jsonb)
  from h
  where h.hours > 0;
$$;

revoke all on function app.order_waiting(uuid) from public, anon, authenticated;


create or replace function app.freeze_order_waiting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'DONE' and old.status is distinct from 'DONE' then
    if new.contract_party = 'RAHTIS' then
      new.waiting := app.order_waiting(new.id);
      new.waiting_cents := coalesce((select sum((x->>'cents')::integer) from jsonb_array_elements(new.waiting) x), 0);
    else
      new.waiting := '[]'::jsonb;
      new.waiting_cents := 0;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app.freeze_order_waiting() from public, anon, authenticated;

create trigger orders_freeze_waiting
  before update of status on public.orders
  for each row execute function app.freeze_order_waiting();

/* Заказчик и перевозчик рейса читают доплату так же, как цену. */
grant select (waiting_cents, waiting) on public.orders to authenticated;
