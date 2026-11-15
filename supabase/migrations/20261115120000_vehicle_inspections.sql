-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · ежедневный осмотр машины водителем (lähtötarkastus), 15.11.2026
--
-- Водитель перед выездом проходит короткий список: шины, тормоза, свет,
-- жидкости, лампы на приборной панели, зеркала и стёкла, сцепка,
-- тахограф, аварийные принадлежности. Как DVIR у Fleetio и Samsara;
-- проверять машину перед выездом водитель обязан и так (в Финляндии —
-- ajoneuvolaki и työturvallisuus, в ЕС — правила о техническом
-- состоянии), здесь это фиксируется.
--
-- «Не в порядке» — обычный дефект (vehicle_defects) со ссылкой на
-- осмотр: «ехать нельзя» сразу снимает машину с рейсов (триггер
-- app.defect_downtime_sync), перевозчик получает уведомление. Пробег из
-- осмотра — ещё одно показание одометра (app.vehicle_odometer,
-- public.fleet_km_span).
--
-- Хранится 24 месяца, затем удаляется уборкой (как закрытые дефекты);
-- дефект, созданный осмотром, живёт по своим правилам.
-- ═══════════════════════════════════════════════════════════════════

/* Пункты осмотра и узел дефекта для каждого. Порядок — порядок обхода машины. */
create or replace function app.inspection_area(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'TYRES' then 'TYRES'
    when 'BRAKES' then 'BRAKES'
    when 'LIGHTS' then 'LIGHTS'
    when 'FLUIDS' then 'LEAK'
    when 'DASHBOARD' then 'ENGINE'
    when 'VISIBILITY' then 'BODY'
    when 'COUPLING' then 'COUPLING'
    when 'TACHOGRAPH' then 'TACHOGRAPH'
    when 'SAFETY' then 'OTHER'
  end;
$$;

create table public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  inspected_by uuid references auth.users (id) on delete set null default auth.uid(),
  inspected_at timestamptz not null default now(),
  odometer_km integer constraint vehicle_inspections_km check (odometer_km between 0 and 9999999),
  /* {"TYRES": "OK", "BRAKES": "DEFECT", …} — все пункты списка. */
  results jsonb not null constraint vehicle_inspections_results check (jsonb_typeof(results) = 'object'),
  defects smallint not null default 0 constraint vehicle_inspections_defects check (defects between 0 and 20),
  event_id uuid unique,
  created_at timestamptz not null default now()
);

comment on table public.vehicle_inspections is
  'Ежедневный осмотр машины водителем (lähtötarkastus): пункты, пробег, сколько неисправностей. Неисправности — vehicle_defects.inspection_id.';

create index vehicle_inspections_vehicle_idx on public.vehicle_inspections (vehicle_id, inspected_at desc);
create index vehicle_inspections_company_idx on public.vehicle_inspections (company_id, inspected_at desc);
create index vehicle_inspections_driver_idx on public.vehicle_inspections (driver_id, inspected_at desc);

/* Машина — той же компании (общий триггер ждёт и trailer_id, поэтому свой). */
create or replace function app.vehicle_inspection_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
    raise exception 'Машина другой компании.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger vehicle_inspections_check
  before insert or update of vehicle_id, company_id on public.vehicle_inspections
  for each row execute function app.vehicle_inspection_check();

alter table public.vehicle_inspections enable row level security;

/* Читает перевозчик (своя компания) и оператор; пишет только функция водителя ниже. */
create policy vehicle_inspections_own
  on public.vehicle_inspections for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy vehicle_inspections_admin
  on public.vehicle_inspections for select to authenticated using ((select app.is_admin()));

grant select on public.vehicle_inspections to authenticated;

alter table public.vehicle_defects
  add column inspection_id uuid references public.vehicle_inspections (id) on delete set null;

create index vehicle_defects_inspection_idx on public.vehicle_defects (inspection_id) where inspection_id is not null;

-- ── Пробег: осмотр — тоже показание одометра ──────────────────────

create or replace function app.vehicle_odometer(p_vehicle uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(km) from (
    select max(odometer_km) as km from public.fuel_entries where vehicle_id = p_vehicle
    union all
    select max(greatest(odometer_start, odometer_end)) from public.driver_shifts where vehicle_id = p_vehicle
    union all
    select max(odometer_km) from public.maintenance_records where vehicle_id = p_vehicle
    union all
    select max(odometer_km) from public.vehicle_defects where vehicle_id = p_vehicle
    union all
    select max(odometer_km) from public.vehicle_inspections where vehicle_id = p_vehicle
  ) k;
$$;

create or replace function public.fleet_km_span(p_from date)
returns table (vehicle_id uuid, km_start integer, km_end integer, readings integer)
language sql
stable
security definer
set search_path = ''
as $$
  with own as (
    select v.id from public.vehicles v where v.company_id = (select app.current_company_id())
  ),
  readings as (
    select f.vehicle_id, (f.filled_at at time zone 'Europe/Helsinki')::date as on_day, f.odometer_km as km
    from public.fuel_entries f join own on own.id = f.vehicle_id
    where f.odometer_km is not null
    union all
    select s.vehicle_id, (s.started_at at time zone 'Europe/Helsinki')::date, s.odometer_start
    from public.driver_shifts s join own on own.id = s.vehicle_id
    where s.odometer_start is not null
    union all
    select s.vehicle_id, (coalesce(s.ended_at, s.started_at) at time zone 'Europe/Helsinki')::date, s.odometer_end
    from public.driver_shifts s join own on own.id = s.vehicle_id
    where s.odometer_end is not null
    union all
    select r.vehicle_id, r.done_on, r.odometer_km
    from public.maintenance_records r join own on own.id = r.vehicle_id
    where r.odometer_km is not null
    union all
    select d.vehicle_id, (d.reported_at at time zone 'Europe/Helsinki')::date, d.odometer_km
    from public.vehicle_defects d join own on own.id = d.vehicle_id
    where d.odometer_km is not null
    union all
    select i.vehicle_id, (i.inspected_at at time zone 'Europe/Helsinki')::date, i.odometer_km
    from public.vehicle_inspections i join own on own.id = i.vehicle_id
    where i.odometer_km is not null
  )
  select
    r.vehicle_id,
    coalesce(max(r.km) filter (where r.on_day < p_from), min(r.km) filter (where r.on_day >= p_from)) as km_start,
    max(r.km) filter (where r.on_day >= p_from) as km_end,
    (count(*) filter (where r.on_day >= p_from))::integer as readings
  from readings r
  group by r.vehicle_id
  having count(*) filter (where r.on_day >= p_from) > 0;
$$;

-- ── Приложение водителя ───────────────────────────────────────────

/*
 * Экран осмотра: машина водителя, последний пробег и осмотры этой
 * машины за сегодня (кем и во сколько) — второй водитель смены видит,
 * что машину уже осмотрели.
 */
create or replace function public.driver_inspection_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);

  return jsonb_build_object(
    'vehicle', (select jsonb_build_object('id', v.id, 'plate', v.plate) from public.vehicles v where v.id = v_vehicle),
    'last_odometer', case when v_vehicle is not null then app.vehicle_odometer(v_vehicle) end,
    'today', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'inspected_at', i.inspected_at, 'defects', i.defects, 'mine', i.driver_id = v_driver.id)
        order by i.inspected_at desc)
      from public.vehicle_inspections i
      where i.vehicle_id = v_vehicle
        and (i.inspected_at at time zone 'Europe/Helsinki')::date = (now() at time zone 'Europe/Helsinki')::date
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_inspection_state() from public, anon;
grant execute on function public.driver_inspection_state() to authenticated;

/*
 * Осмотр от водителя. p_data:
 *   odometer_km — по желанию;
 *   items — [{key, ok, severity, description}] по всем пунктам списка;
 *           у «не в порядке» — можно ли ехать и пара слов.
 * Машина — та, за которой водитель закреплён. Каждое «не в порядке» —
 * дефект (узел — app.inspection_area). Возвращает {inspection_id,
 * defect_ids} или null, если это повтор из очереди телефона.
 */
create or replace function public.driver_inspection_add(
  p_data jsonb,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_at timestamptz;
  v_km integer;
  v_item jsonb;
  v_key text;
  v_results jsonb := '{}'::jsonb;
  v_faults jsonb := '[]'::jsonb;
  v_id uuid;
  v_defect uuid;
  v_defects uuid[] := '{}';
  v_keys constant text[] := array['TYRES', 'BRAKES', 'LIGHTS', 'FLUIDS', 'DASHBOARD', 'VISIBILITY', 'COUPLING', 'TACHOGRAPH', 'SAFETY'];
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'INSPECTION', p_at) then
    return null;
  end if;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);
  if v_vehicle is null then
    raise exception 'Водитель не закреплён за машиной.' using errcode = '55000';
  end if;

  if jsonb_typeof(p_data -> 'items') is distinct from 'array' then
    raise exception 'Нет пунктов осмотра.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_data -> 'items') loop
    v_key := v_item ->> 'key';
    if not (v_key = any (v_keys)) or v_results ? v_key then
      raise exception 'Неизвестный или повторный пункт осмотра.' using errcode = '22023';
    end if;
    if coalesce((v_item ->> 'ok')::boolean, false) then
      v_results := v_results || jsonb_build_object(v_key, 'OK');
    else
      if char_length(btrim(coalesce(v_item ->> 'description', ''))) < 3 then
        raise exception 'Опишите неисправность.' using errcode = '22023';
      end if;
      v_results := v_results || jsonb_build_object(v_key, 'DEFECT');
      v_faults := v_faults || jsonb_build_array(v_item);
    end if;
  end loop;

  /* Все пункты: осмотр «наполовину» — не осмотр. */
  if (select count(*) from jsonb_object_keys(v_results)) <> cardinality(v_keys) then
    raise exception 'Осмотр не по всем пунктам.' using errcode = '22023';
  end if;

  v_at := coalesce(app.client_time(p_at), clock_timestamp());
  v_km := nullif(p_data ->> 'odometer_km', '')::numeric::integer;
  if v_km is not null and (v_km < 0 or v_km > 9999999) then
    v_km := null;
  end if;

  insert into public.vehicle_inspections (company_id, vehicle_id, driver_id, inspected_at, odometer_km, results, defects, event_id)
  values (v_driver.company_id, v_vehicle, v_driver.id, v_at, v_km, v_results, jsonb_array_length(v_faults), p_event_id)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(v_faults) loop
    insert into public.vehicle_defects (
      company_id, vehicle_id, driver_id, reported_by, reported_at,
      area, severity, description, odometer_km, inspection_id)
    values (
      v_driver.company_id, v_vehicle, v_driver.id, auth.uid(), v_at,
      app.inspection_area(v_item ->> 'key'),
      case when v_item ->> 'severity' = 'UNSAFE' then 'UNSAFE' else 'CAN_DRIVE' end,
      left(btrim(v_item ->> 'description'), 1000),
      v_km,
      v_id)
    returning id into v_defect;
    v_defects := v_defects || v_defect;
  end loop;

  return jsonb_build_object('inspection_id', v_id, 'defect_ids', to_jsonb(v_defects));
end;
$$;

revoke all on function public.driver_inspection_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_inspection_add(jsonb, timestamptz, uuid) to authenticated;

-- ── Уборка: осмотры старше 24 месяцев ─────────────────────────────

create or replace function public.retention_purge_inspections(p_limit integer default 2000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.vehicle_inspections
  where id in (
    select id from public.vehicle_inspections
    where inspected_at < now() - interval '24 months'
    order by inspected_at
    limit p_limit
  );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.retention_purge_inspections(integer) from public, anon, authenticated;
grant execute on function public.retention_purge_inspections(integer) to service_role;
