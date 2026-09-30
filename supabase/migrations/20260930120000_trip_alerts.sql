-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · оповещения в пути: опоздание и простой
--
-- Раньше заказчик узнавал о задержке звонком, а о простое — из счёта.
-- Раз в пять минут база смотрит на идущие рейсы и один раз на точку
-- сообщает заказчику и перевозчику (кабинет) и заказчику по API:
--
--   LATE     следующая точка, машина ещё не приехала, а ожидаемое
--            прибытие (оценка или «сейчас», что позже) больше чем на
--            30 минут позже согласованного времени. Точка без времени
--            не оценивается: «к обеду» опозданием не измерить.
--   WAITING  водитель на точке, бесплатный час (отсчёт как у доплаты:
--            от прибытия, но не раньше согласованного времени) истёк,
--            точка не пройдена. Где простой оплачивается (contract_party
--            = RAHTIS), в тексте — когда начнётся доплата.
--
-- Повтор не шлётся: order_stop_alerts хранит, что уже сказано.
-- ═══════════════════════════════════════════════════════════════════

create table public.order_stop_alerts (
  stop_id uuid not null references public.order_stops (id) on delete cascade,
  kind text not null,
  minutes integer not null,
  created_at timestamptz not null default now(),
  primary key (stop_id, kind),
  constraint order_stop_alerts_kind check (kind in ('LATE', 'WAITING'))
);

alter table public.order_stop_alerts enable row level security;
revoke all on public.order_stop_alerts from anon, authenticated;
grant select on public.order_stop_alerts to authenticated;

create policy order_stop_alerts_admin
  on public.order_stop_alerts for select to authenticated
  using ((select app.is_admin()));


/* Согласованный момент точки: местное время страны точки. */
create or replace function app.stop_planned_at(p_date date, p_time time, p_country text)
returns timestamptz
language sql
stable
as $$
  select case when p_date is not null
    then (p_date + coalesce(p_time, time '00:00')) at time zone app.stop_timezone(p_country)
  end
$$;


create or replace function app.run_trip_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_late integer := 0;
  v_waiting integer := 0;
  v_stop jsonb;
begin
  /* ── Опоздание на следующую точку ── */
  for r in
    with nxt as (
      select distinct on (s.order_id) s.*
      from public.order_stops s
      join public.orders o on o.id = s.order_id
      where o.status = 'IN_PROGRESS' and s.completed_at is null
      order by s.order_id, s.sequence
    ), t as (
      select n.*,
             app.stop_planned_at(n.scheduled_date, n.scheduled_time, n.country) as planned,
             greatest(coalesce(n.eta_at, now()), now()) as expected
      from nxt n
      where n.arrived_at is null
        and n.scheduled_date is not null
        and n.scheduled_time is not null
    )
    select t.id, t.sequence, t.role, t.city, t.planned, t.eta_at,
           ceil(extract(epoch from t.expected - t.planned) / 60)::integer as minutes,
           o.ref, o.shipper_ref, o.shipper_company_id, o.assigned_company_id
    from t
    join public.orders o on o.id = t.order_id
    where t.expected > t.planned + interval '30 minutes'
      and not exists (select 1 from public.order_stop_alerts a where a.stop_id = t.id and a.kind = 'LATE')
  loop
    insert into public.order_stop_alerts (stop_id, kind, minutes) values (r.id, 'LATE', r.minutes);

    perform app.notify_event(r.shipper_company_id, 'ORDER', 'trip.late',
      jsonb_build_object('ref', r.ref, 'city', r.city, 'minutes', r.minutes), '/shipper/orders');
    if r.assigned_company_id is not null then
      perform app.notify_event(r.assigned_company_id, 'ORDER', 'trip.late',
        jsonb_build_object('ref', r.ref, 'city', r.city, 'minutes', r.minutes), '/carrier/desk');
    end if;

    v_stop := jsonb_build_object('sequence', r.sequence, 'role', r.role, 'city', r.city,
      'scheduled_at', r.planned, 'eta_at', r.eta_at, 'late_minutes', r.minutes);
    perform app.enqueue_webhook(r.shipper_company_id, 'order.late', jsonb_build_object(
      'ref', r.ref, 'shipper_ref', r.shipper_ref, 'stop', v_stop));

    v_late := v_late + 1;
  end loop;

  /* ── Бесплатный час на точке истёк ── */
  for r in
    with t as (
      select s.*, o.ref, o.shipper_ref, o.shipper_company_id, o.assigned_company_id, o.contract_party,
             greatest(s.arrived_at, app.stop_planned_at(s.scheduled_date, s.scheduled_time, s.country)) as started
      from public.order_stops s
      join public.orders o on o.id = s.order_id
      where o.status = 'IN_PROGRESS'
        and s.arrived_at is not null
        and s.completed_at is null
    )
    select t.*, floor(extract(epoch from now() - t.started) / 60)::integer as minutes
    from t
    where now() >= t.started + interval '60 minutes'
      and not exists (select 1 from public.order_stop_alerts a where a.stop_id = t.id and a.kind = 'WAITING')
  loop
    insert into public.order_stop_alerts (stop_id, kind, minutes) values (r.id, 'WAITING', r.minutes);

    perform app.notify_event(r.shipper_company_id, 'ORDER', 'trip.waiting',
      jsonb_build_object('ref', r.ref, 'city', r.city, 'charged', case when r.contract_party = 'RAHTIS' then 'yes' else 'no' end,
                         'euros', app.waiting_hour_cents() / 100), '/shipper/orders');
    if r.assigned_company_id is not null then
      perform app.notify_event(r.assigned_company_id, 'ORDER', 'trip.waiting',
        jsonb_build_object('ref', r.ref, 'city', r.city, 'charged', case when r.contract_party = 'RAHTIS' then 'yes' else 'no' end,
                           'euros', app.waiting_hour_cents() / 100), '/carrier/desk');
    end if;

    v_stop := jsonb_build_object('sequence', r.sequence, 'role', r.role, 'city', r.city,
      'arrived_at', r.arrived_at, 'waiting_started_at', r.started,
      'free_until', r.started + interval '60 minutes',
      'surcharge_from', case when r.contract_party = 'RAHTIS' then r.started + interval '75 minutes' end);
    perform app.enqueue_webhook(r.shipper_company_id, 'order.waiting', jsonb_build_object(
      'ref', r.ref, 'shipper_ref', r.shipper_ref, 'stop', v_stop));

    v_waiting := v_waiting + 1;
  end loop;

  return jsonb_build_object('late', v_late, 'waiting', v_waiting);
end;
$$;

revoke all on function app.run_trip_alerts() from public, anon, authenticated;

select cron.schedule('rahtis-trip-alerts', '*/5 * * * *', $$ select app.run_trip_alerts(); $$);


/* Новые события вебхуков. */
alter table public.api_webhooks drop constraint api_webhooks_events_known;
alter table public.api_webhooks add constraint api_webhooks_events_known check (
  events <@ array[
    'order.taken', 'order.reopened', 'order.started', 'order.stop_arrived', 'order.stop_completed',
    'order.eta_changed', 'order.late', 'order.waiting', 'order.amended', 'order.closed', 'order.cancelled',
    'offer.received', 'document.added', 'claim.updated'
  ]
  and cardinality(events) >= 1
);
