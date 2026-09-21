-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приложение водителя без связи: очередь, время нажатия, повторы
--
-- В порту и на терминале связь пропадает. Приложение копит действия в
-- очереди на телефоне и отправляет их, когда сеть вернётся, — иногда
-- через полчаса и пачкой. Для базы из этого следуют две вещи.
--
-- ВРЕМЯ — НАЖАТИЯ, А НЕ ПРИХОДА. Отметка «Saapui», пришедшая вечером,
-- должна лечь временем прибытия, а не временем, когда нашлась сеть:
-- иначе простой на погрузке превращается в выдумку. Время с телефона
-- проверяется на правдоподобие (app.client_time): не из будущего и не
-- старше суток — иначе берётся время приёма.
--
-- ПОВТОР НЕ УДВАИВАЕТ. Мобильная сеть повторяет запросы, а очередь
-- повторяет неотправленное. У каждого действия свой идентификатор с
-- телефона, и журнал driver_app_events помнит принятые: второй экземпляр
-- тихо ничего не делает.
-- ═══════════════════════════════════════════════════════════════════


-- ── Журнал принятых действий ───────────────────────────────────────

create table public.driver_app_events (
  id uuid primary key,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  kind text not null,
  pressed_at timestamptz,
  received_at timestamptz not null default now()
);

comment on table public.driver_app_events is
  'Принятые действия приложения водителя по идентификатору с телефона. Повтор того же id ничего не делает.';

create index driver_app_events_driver_idx on public.driver_app_events (driver_id, received_at desc);

alter table public.driver_app_events enable row level security;
revoke all on public.driver_app_events from anon, authenticated;

/*
 * Было ли действие уже принято. Если нет — записывает его и отвечает
 * false: вызывающий выполняет действие. Запись и проверка — одним
 * insert … on conflict, так что два одновременных повтора не пройдут оба.
 */
create or replace function app.driver_event_seen(p_event_id uuid, p_kind text, p_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if p_event_id is null then
    return false;
  end if;

  insert into public.driver_app_events (id, driver_id, kind, pressed_at)
  values (p_event_id, v_driver, p_kind, p_at)
  on conflict (id) do nothing;

  return not found;
end;
$$;

/* Время нажатия с телефона, если ему можно верить, иначе — сейчас. */
create or replace function app.client_time(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_at between now() - interval '24 hours' and now() + interval '5 minutes' then least(p_at, now())
    else now()
  end;
$$;

revoke all on function app.driver_event_seen(uuid, text, timestamptz), app.client_time(timestamptz)
  from public, anon, authenticated;


-- ── Смена ──────────────────────────────────────────────────────────

drop function public.driver_shift_action(text, double precision, double precision);

/*
 * Прежняя логика (20260922120000_driver_app) со временем нажатия и
 * идентификатором. Время не раньше начала смены: часы телефона могут
 * отставать, и конец раньше начала нарушил бы ограничение смены.
 */
create function public.driver_shift_action(
  p_action text,
  p_lat double precision default null,
  p_lon double precision default null,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
  v_shift public.driver_shifts;
  v_vehicle uuid;
  v_sane boolean := app.sane_position(p_lat, p_lon);
  v_at timestamptz := coalesce(app.client_time(p_at), clock_timestamp());
  v_break_start timestamptz;
begin
  if v_driver is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'SHIFT_' || p_action, p_at) then
    return;
  end if;

  select * into v_shift from public.driver_shifts
  where driver_id = v_driver and ended_at is null
  for update;

  if p_action = 'START' then
    if v_shift.id is not null then
      raise exception 'Смена уже идёт.' using errcode = '55000';
    end if;

    select vehicle_id into v_vehicle from public.vehicle_drivers
    where driver_id = v_driver and upper_inf(during);

    insert into public.driver_shifts (driver_id, vehicle_id, started_at, source, start_lat, start_lon, created_by)
    values (
      v_driver, v_vehicle, v_at, 'APP',
      case when v_sane then p_lat end, case when v_sane then p_lon end,
      (select auth.uid())
    );
    return;
  end if;

  if v_shift.id is null then
    raise exception 'Смена не начата.' using errcode = '55000';
  end if;

  v_at := greatest(v_at, v_shift.started_at + interval '1 second');

  select started_at into v_break_start
  from public.driver_breaks where shift_id = v_shift.id and ended_at is null;

  if p_action = 'BREAK' then
    if v_break_start is null then
      insert into public.driver_breaks (shift_id, started_at) values (v_shift.id, v_at);
    end if;
  elsif p_action = 'RESUME' then
    update public.driver_breaks
    set ended_at = greatest(v_at, v_break_start + interval '1 second')
    where shift_id = v_shift.id and ended_at is null;
  elsif p_action = 'END' then
    if v_break_start is not null then
      v_at := greatest(v_at, v_break_start + interval '1 second');
      update public.driver_breaks set ended_at = v_at
      where shift_id = v_shift.id and ended_at is null;
    end if;

    update public.driver_shifts
    set ended_at = v_at,
        end_lat = case when v_sane then p_lat end,
        end_lon = case when v_sane then p_lon end
    where id = v_shift.id;
  else
    raise exception 'Неизвестное действие %.', p_action using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.driver_shift_action(text, double precision, double precision, timestamptz, uuid)
  from public, anon;
grant execute on function public.driver_shift_action(text, double precision, double precision, timestamptz, uuid)
  to authenticated;


-- ── Прибытие ───────────────────────────────────────────────────────

drop function public.driver_arrive_stop(uuid, double precision, double precision);

create function public.driver_arrive_stop(
  p_stop_id uuid,
  p_lat double precision default null,
  p_lon double precision default null,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_sane boolean := app.sane_position(p_lat, p_lon);
begin
  select * into v_stop from public.order_stops where id = p_stop_id for update;
  select * into v_order from public.orders where id = v_stop.order_id;

  if v_order.id is null or v_order.assigned_driver_id is distinct from (select app.current_driver_id()) then
    raise exception 'Точка не из вашего рейса.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'ARRIVE', p_at) then
    return;
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Рейс не идёт, текущий статус: %.', v_order.status using errcode = '55000';
  end if;

  if v_stop.completed_at is not null then
    raise exception 'Точка уже пройдена.' using errcode = '55000';
  end if;

  /* Повторное нажатие не переписывает первое время прибытия. */
  update public.order_stops
  set arrived_at = coalesce(arrived_at, app.client_time(p_at)),
      arrived_lat = case when arrived_at is null and v_sane then p_lat else arrived_lat end,
      arrived_lon = case when arrived_at is null and v_sane then p_lon else arrived_lon end
  where id = p_stop_id;
end;
$$;

revoke all on function public.driver_arrive_stop(uuid, double precision, double precision, timestamptz, uuid)
  from public, anon;
grant execute on function public.driver_arrive_stop(uuid, double precision, double precision, timestamptz, uuid)
  to authenticated;


-- ── Отметка точки ──────────────────────────────────────────────────

/*
 * Ядро отметки — одно на кабинет и приложение, чтобы правила «кто,
 * когда и по порядку» не разошлись. Отличается только время: кабинет
 * отмечает сейчас, приложение — моментом нажатия. Отметка не раньше
 * прибытия на эту точку и не раньше предыдущей точки: часы телефона
 * могут отставать, а лента рейса обязана идти вперёд.
 */
create or replace function app.complete_stop_at(
  p_stop_id uuid,
  p_damage_note text,
  p_lat double precision,
  p_lon double precision,
  p_accuracy_m integer,
  p_at timestamptz
)
returns public.order_stops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_pending_seq smallint;
  v_previous timestamptz;
  v_lat double precision;
  v_lon double precision;
  v_at timestamptz;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not (
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
    or v_order.assigned_driver_id = (select app.current_driver_id())
  ) then
    raise exception 'Отмечать прохождение может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status <> 'IN_PROGRESS' then
    raise exception 'Отмечать точки можно только в идущем рейсе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if v_stop.completed_at is not null then
    raise exception 'Точка уже пройдена.' using errcode = '55000';
  end if;

  select min(s.sequence) into v_pending_seq
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.completed_at is null;

  if v_stop.sequence <> v_pending_seq then
    raise exception 'Точки проходятся по порядку: сначала отметьте предыдущие.'
      using errcode = '55000';
  end if;

  select max(s.completed_at) into v_previous
  from public.order_stops s
  where s.order_id = v_stop.order_id and s.sequence < v_stop.sequence;

  v_at := greatest(p_at, coalesce(v_stop.arrived_at, p_at), coalesce(v_previous, p_at));

  if app.sane_position(p_lat, p_lon) then
    v_lat := p_lat;
    v_lon := p_lon;
  end if;

  update public.order_stops
  set completed_at = v_at,
      damage_note = nullif(btrim(coalesce(p_damage_note, '')), ''),
      completed_lat = v_lat,
      completed_lon = v_lon,
      completed_accuracy_m = case
        when v_lat is null then null
        when p_accuracy_m between 1 and 100000 then p_accuracy_m
        else null
      end
  where id = p_stop_id
  returning * into v_stop;

  return v_stop;
end;
$$;

revoke all on function app.complete_stop_at(uuid, text, double precision, double precision, integer, timestamptz)
  from public, anon, authenticated;

/* Кабинет и прежние вызовы — сейчас. */
create or replace function public.complete_stop(
  p_stop_id uuid,
  p_damage_note text default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_accuracy_m integer default null
)
returns public.order_stops
language sql
security definer
set search_path = ''
as $$
  select app.complete_stop_at(p_stop_id, p_damage_note, p_lat, p_lon, p_accuracy_m, now());
$$;

/* Приложение — моментом нажатия и с идентификатором от повторов. */
create or replace function public.driver_complete_stop(
  p_stop_id uuid,
  p_damage_note text default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_accuracy_m integer default null,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select app.current_driver_id()) is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'COMPLETE', p_at) then
    return;
  end if;

  perform app.complete_stop_at(p_stop_id, p_damage_note, p_lat, p_lon, p_accuracy_m, app.client_time(p_at));
end;
$$;

revoke all on function public.driver_complete_stop(uuid, text, double precision, double precision, integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.driver_complete_stop(uuid, text, double precision, double precision, integer, timestamptz, uuid)
  to authenticated;
