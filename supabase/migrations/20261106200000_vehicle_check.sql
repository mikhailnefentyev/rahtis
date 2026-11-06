-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · «та ли машина приехала» (6.11.2026)
--
-- Кража груза через «фантомного» перевозчика: на погрузку приезжает
-- другая машина или другой водитель (docs/market/research-us-china-uae.md,
-- п. 3; Китай с 2026 требует сверять реальные машину и водителя).
--
-- На первой погрузке рейса (у сцепки и контейнера это забор единицы)
-- сервер сверяет заказ с тем, что есть:
--   · номер, который подтвердил водитель (заполнен номером его машины);
--   · последняя позиция машины из GPS перевозчика — не дальше ~2 км от
--     точки (нет GPS — «нет данных», а не расхождение);
--   · водитель: отметил назначенный или другой водитель компании
--     (справочно; записанная смена водителя — не флаг).
-- Решение считает сервер (src/lib/orders/vehicleCheck.ts, тесты), пишет
-- служебная функция. Это флаг для человека, а не блокировка (ст. 22
-- GDPR): при расхождении — уведомление обеим сторонам, отметка на
-- карточке и пункт «Требует действия», где сторона подтверждает
-- «всё в порядке» с причиной (кто и когда — в строке).
-- ═══════════════════════════════════════════════════════════════════

/* Номер для сравнения: только буквы и цифры, верхний регистр. */
create or replace function app.plate_key(p_plate text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_plate, ''), '[^0-9A-Za-zÅÄÖÜåäöü]', '', 'g'));
$$;

revoke all on function app.plate_key(text) from public, anon;
grant execute on function app.plate_key(text) to authenticated, service_role;


create table public.vehicle_checks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  stop_id uuid not null unique references public.order_stops (id) on delete cascade,
  /* Кто отметил точку: водитель в приложении или кабинет перевозчика. */
  source text not null check (source in ('DRIVER', 'CARRIER')),
  expected_plate text check (char_length(expected_plate) <= 32),
  reported_plate text check (char_length(reported_plate) <= 32),
  expected_trailer_plate text check (char_length(expected_trailer_plate) <= 32),
  reported_trailer_plate text check (char_length(reported_trailer_plate) <= 32),
  /* Только расстояние и время позиции — координаты не храним. */
  gps_distance_m integer check (gps_distance_m >= 0),
  gps_seen_at timestamptz,
  driver_matches boolean,
  verdict text not null check (verdict in ('OK', 'MISMATCH', 'NO_DATA')),
  reasons jsonb not null default '[]'::jsonb,
  shipper_confirmed_at timestamptz,
  shipper_confirmed_by uuid references auth.users (id) on delete set null,
  shipper_reason text check (char_length(shipper_reason) <= 500),
  carrier_confirmed_at timestamptz,
  carrier_confirmed_by uuid references auth.users (id) on delete set null,
  carrier_reason text check (char_length(carrier_reason) <= 500),
  created_at timestamptz not null default now()
);

create index vehicle_checks_order on public.vehicle_checks (order_id);

comment on table public.vehicle_checks is
  'Сверка машины и водителя на первой погрузке: флаг для сторон рейса, не блокировка.';

alter table public.vehicle_checks enable row level security;

revoke all on public.vehicle_checks from anon, authenticated;
grant select on public.vehicle_checks to authenticated;

/* Читают заказчик и перевозчик рейса, оператор. Пишут только функции ниже. */
create policy vehicle_checks_party on public.vehicle_checks
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = vehicle_checks.order_id
        and (o.shipper_company_id = (select app.current_company_id())
             or o.assigned_company_id = (select app.current_company_id()))
    )
    or (select app.is_admin())
  );

/* Новые таблицы mfa_required сами не получают (20261106190000_two_step). */
create policy mfa_required on public.vehicle_checks
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));


-- ── Что известно о погрузке ────────────────────────────────────────

/*
 * Данные для сверки по пройденной точке. Права — как у отметки точки:
 * назначенный перевозчик, его водитель рейса, оператор. NULL — сверять
 * нечего: не первая погрузка, точка не пройдена или сверка уже есть.
 * Координаты GPS уходят только серверу, в таблицу пишется расстояние.
 */
create or replace function public.vehicle_check_evidence(p_stop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_driver uuid := (select app.current_driver_id());
  v_first uuid;
  v_plate text;
  v_trailer text;
  v_gps_lat double precision;
  v_gps_lon double precision;
  v_gps_at timestamptz;
begin
  select * into v_stop from public.order_stops where id = p_stop_id;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;

  select * into v_order from public.orders where id = v_stop.order_id;

  if not coalesce(
    v_order.assigned_company_id = (select app.current_company_id())
    or (select app.is_admin())
    or v_order.assigned_driver_id = v_driver,
    false
  ) then
    raise exception 'Сверку машины пишет назначенный перевозчик.' using errcode = '42501';
  end if;

  select s.id into v_first
  from public.order_stops s
  where s.order_id = v_order.id and s.role = 'PICKUP'
  order by s.sequence
  limit 1;

  if v_first is distinct from v_stop.id
     or v_stop.completed_at is null
     or exists (select 1 from public.vehicle_checks c where c.stop_id = v_stop.id) then
    return null;
  end if;

  select v.plate into v_plate from public.vehicles v where v.id = v_order.assigned_vehicle_id;
  /* Единица заказчика (номер в заказе) или прицеп перевозчика из сцепки. */
  v_trailer := coalesce(
    v_order.trailer_plate,
    (select t.plate from public.trailers t where t.id = v_order.assigned_trailer_id)
  );

  /* Блок GPS машины: привязанный к машине или с тем же номером. */
  select g.lat, g.lon, g.position_at into v_gps_lat, v_gps_lon, v_gps_at
  from public.gps_units g
  where g.company_id = v_order.assigned_company_id
    and g.lat is not null and g.lon is not null and g.position_at is not null
    and (
      g.vehicle_id = v_order.assigned_vehicle_id
      or (v_plate is not null and app.plate_key(g.plate) = app.plate_key(v_plate))
    )
  order by (g.vehicle_id is not distinct from v_order.assigned_vehicle_id) desc, g.position_at desc
  limit 1;

  return jsonb_build_object(
    'order_id', v_order.id,
    'stop_id', v_stop.id,
    'ref', v_order.ref,
    'shipper_company_id', v_order.shipper_company_id,
    'carrier_company_id', v_order.assigned_company_id,
    'source', case when v_driver is not null then 'DRIVER' else 'CARRIER' end,
    'completed_at', v_stop.completed_at,
    'stop_lat', v_stop.lat,
    'stop_lon', v_stop.lon,
    'expected_plate', v_plate,
    'expected_trailer', v_trailer,
    'gps_lat', v_gps_lat,
    'gps_lon', v_gps_lon,
    'gps_at', v_gps_at,
    'assigned_driver_id', v_order.assigned_driver_id,
    /* Кто за рулём: водитель приложения, иначе закреплённый за машиной на тот момент. */
    'actual_driver_id', coalesce(v_driver, app.vehicle_driver_at(v_order.assigned_vehicle_id, v_stop.completed_at)),
    'driver_change_recorded', exists (
      select 1 from public.order_amendments a
      where a.order_id = v_order.id and a.kind::text = 'ASSIGNMENT_CHANGED' and a.changes ? 'driver'
    )
  );
end;
$$;

revoke all on function public.vehicle_check_evidence(uuid) from public, anon;
grant execute on function public.vehicle_check_evidence(uuid) to authenticated;


-- ── Запись сверки: только сервер ───────────────────────────────────

/*
 * Пишет сервер (служебный ключ) после отметки точки: решение считает
 * код сервера, а не телефон и не кабинет — иначе перевозчик мог бы
 * сам себе записать «OK». Повтор (очередь водителя) ничего не меняет.
 * Расхождение — уведомление заказчику и перевозчику. Ответ — id новой
 * строки или NULL, если сверка уже была.
 */
create or replace function public.record_vehicle_check(p_check jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stop public.order_stops;
  v_order public.orders;
  v_id uuid;
  v_verdict text := p_check ->> 'verdict';
begin
  select * into v_stop from public.order_stops where id = (p_check ->> 'stop_id')::uuid;
  if v_stop.id is null then
    raise exception 'Точка не найдена.' using errcode = 'P0002';
  end if;
  select * into v_order from public.orders where id = v_stop.order_id;

  insert into public.vehicle_checks (
    order_id, stop_id, source,
    expected_plate, reported_plate, expected_trailer_plate, reported_trailer_plate,
    gps_distance_m, gps_seen_at, driver_matches, verdict, reasons
  )
  values (
    v_order.id, v_stop.id, coalesce(p_check ->> 'source', 'CARRIER'),
    left(p_check ->> 'expected_plate', 32), left(p_check ->> 'reported_plate', 32),
    left(p_check ->> 'expected_trailer', 32), left(p_check ->> 'reported_trailer', 32),
    (p_check ->> 'gps_distance_m')::integer, (p_check ->> 'gps_seen_at')::timestamptz,
    (p_check ->> 'driver_matches')::boolean, v_verdict,
    coalesce(p_check -> 'reasons', '[]'::jsonb)
  )
  on conflict (stop_id) do nothing
  returning id into v_id;

  if v_id is not null and v_verdict = 'MISMATCH' then
    perform app.notify_event(
      v_order.shipper_company_id, 'ORDER', 'order.vehicle_mismatch',
      jsonb_build_object('ref', v_order.ref), '/shipper/orders'
    );
    if v_order.assigned_company_id is not null then
      perform app.notify_event(
        v_order.assigned_company_id, 'ORDER', 'order.vehicle_mismatch',
        jsonb_build_object('ref', v_order.ref), '/carrier/desk'
      );
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.record_vehicle_check(jsonb) from public, anon, authenticated;
grant execute on function public.record_vehicle_check(jsonb) to service_role;


-- ── «Всё в порядке»: решение человека ──────────────────────────────

/* Сторона рейса подтверждает расхождение с причиной; кто и когда — в строке. */
create or replace function public.confirm_vehicle_check(p_check_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check public.vehicle_checks;
  v_order public.orders;
  v_me uuid := (select app.current_company_id());
  v_reason text := btrim(left(coalesce(p_reason, ''), 500));
begin
  select * into v_check from public.vehicle_checks where id = p_check_id;
  if v_check.id is null then
    raise exception 'Сверка не найдена.' using errcode = 'P0002';
  end if;
  if v_check.verdict <> 'MISMATCH' then
    raise exception 'Подтверждать нечего.' using errcode = '55000';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'Укажите причину.' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = v_check.order_id;

  if coalesce(v_order.shipper_company_id = v_me, false) then
    update public.vehicle_checks
    set shipper_confirmed_at = now(), shipper_confirmed_by = (select auth.uid()), shipper_reason = v_reason
    where id = p_check_id and shipper_confirmed_at is null;
  elsif coalesce(v_order.assigned_company_id = v_me and (select app.current_party_role()) = 'CARRIER', false) then
    update public.vehicle_checks
    set carrier_confirmed_at = now(), carrier_confirmed_by = (select auth.uid()), carrier_reason = v_reason
    where id = p_check_id and carrier_confirmed_at is null;
  else
    raise exception 'Подтверждает сторона рейса.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.confirm_vehicle_check(uuid, text) from public, anon;
grant execute on function public.confirm_vehicle_check(uuid, text) to authenticated;
