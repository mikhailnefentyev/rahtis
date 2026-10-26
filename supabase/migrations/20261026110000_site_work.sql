-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · работа на объекте: самосвалы, весы, часы (26.10.2026)
--
-- Как работают финские самосвальщики: утром водитель отмечает прибытие
-- на объект, днём возит рейсы на пункт приёмки и взвешивается там
-- (брутто с грузом, на выезде тара), вечером конец дня = последняя
-- выгрузка + 30 минут. Прораб заказчика подтверждает день.
--
--   scale_sites — весы и пункты приёмки (справочник; водитель может
--                 добавить пункт, на котором стоит);
--   site_jobs   — объект клиента перевозчика: адрес, оплата (час, рейс,
--                 тонна), груз по умолчанию, запас минут к концу дня,
--                 ссылка для прораба;
--   site_days   — день водителя на объекте: прибытие, сцепка, конец,
--                 подтверждение прораба;
--   site_loads  — рейс: груз (код отхода), весы, брутто, тара, талон.
--
-- Водитель пишет только функциями (driver_site_action), как и остальные
-- действия приложения: с идентификатором события и временем нажатия,
-- поэтому очередь без связи не задваивает рейсы.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Первая попытка применить эту миграцию (26.10.2026) оборвалась на
 * функции и оставила пустые таблицы и тип. Убираем остатки, чтобы
 * миграция прошла целиком; на чистой базе это ничего не делает.
 */
drop table if exists public.site_days cascade;
drop table if exists public.site_jobs cascade;
drop table if exists public.scale_sites cascade;
drop type if exists public.site_pricing;

create type public.site_pricing as enum ('HOUR', 'LOAD', 'TONNE');

-- ── Весы и пункты приёмки ─────────────────────────────────────────

create table public.scale_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null constraint scale_sites_name_length check (length(btrim(name)) between 2 and 120),
  address text,
  city text,
  country text not null default 'FI' constraint scale_sites_country check (country ~ '^[A-Z]{2}$'),
  lat double precision,
  lon double precision,
  /* RECEIVING — пункт приёмки грунта, PIT — карьер, SCALE — просто весы. */
  kind text not null default 'RECEIVING' constraint scale_sites_kind check (kind in ('RECEIVING', 'PIT', 'SCALE')),
  accepts text,
  /* Весы подключены к mScales: позже взвешивание придёт само. */
  mscales boolean not null default false,
  created_by_company uuid references public.companies (id) on delete set null,
  /*
   * В общий список пункт попадает только после проверки оператором
   * (approved_at) или из списка весов mScales. Пункт, добавленный
   * водителем, до проверки видит лишь его компания.
   */
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  constraint scale_sites_position check ((lat is null) = (lon is null))
);

comment on table public.scale_sites is
  'Весы, пункты приёмки грунта и карьеры. Общий справочник: водитель добавляет пункт, на котором стоит.';

alter table public.scale_sites enable row level security;

/*
 * Общие — пункты, проверенные оператором, и весы mScales (approved_at).
 * Пункт, добавленный водителем, до проверки видит лишь его компания:
 * чужая компания не может засорить или подделать общий справочник.
 * Пишут в таблицу только оператор и функция водителя (ADD_SITE).
 */
create policy scale_sites_select
  on public.scale_sites for select to authenticated
  using (approved_at is not null or created_by_company = (select app.current_company_id()));

create policy scale_sites_admin
  on public.scale_sites for all to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

grant select, insert, update, delete on public.scale_sites to authenticated;

-- ── Объекты ───────────────────────────────────────────────────────

create table public.site_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null constraint site_jobs_name_length check (length(btrim(name)) between 2 and 120),
  address text,
  lat double precision,
  lon double precision,
  customer_name text not null constraint site_jobs_customer_length check (length(btrim(customer_name)) between 2 and 160),
  customer_business_id text,
  customer_email text,
  pricing public.site_pricing not null default 'HOUR',
  /* Ставка в центах за час, рейс или тонну — без ALV. */
  rate_cents integer not null default 0 constraint site_jobs_rate check (rate_cents between 0 and 10000000),
  material_code text not null default '170504',
  receiving_site_id uuid references public.scale_sites (id) on delete set null,
  buffer_minutes smallint not null default 30 constraint site_jobs_buffer check (buffer_minutes between 0 and 180),
  status text not null default 'ACTIVE' constraint site_jobs_status check (status in ('ACTIVE', 'CLOSED')),
  /* Ссылка прораба: видеть дни объекта и подтверждать часы без учётной записи. */
  foreman_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index site_jobs_foreman_token_key on public.site_jobs (foreman_token);
create index site_jobs_company_idx on public.site_jobs (company_id, status);

create trigger site_jobs_touch_updated_at
  before update on public.site_jobs
  for each row execute function app.touch_updated_at();

alter table public.site_jobs enable row level security;

create policy site_jobs_own
  on public.site_jobs for all to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy site_jobs_admin
  on public.site_jobs for select to authenticated using ((select app.is_admin()));

grant select, insert, update, delete on public.site_jobs to authenticated;

-- ── Дни на объекте ────────────────────────────────────────────────

create table public.site_days (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.site_jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  trailer_id uuid references public.trailers (id) on delete set null,
  day date not null,
  arrived_at timestamptz not null,
  /* Конец, отмеченный водителем; пусто — последняя выгрузка + запас. */
  ended_at timestamptz,
  buffer_minutes smallint not null default 30,
  approved_at timestamptz,
  approved_by text,
  approval_note text,
  created_at timestamptz not null default now(),
  constraint site_days_end_after_start check (ended_at is null or ended_at > arrived_at)
);

create unique index site_days_job_driver_day_key on public.site_days (job_id, driver_id, day);
create index site_days_company_idx on public.site_days (company_id, day);

alter table public.site_days enable row level security;

create policy site_days_own
  on public.site_days for select to authenticated
  using (company_id = (select app.current_company_id()));

/* Перевозчик правит конец дня руками (водитель забыл, спор с прорабом). */
create policy site_days_update_own
  on public.site_days for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy site_days_admin
  on public.site_days for select to authenticated using ((select app.is_admin()));

grant select on public.site_days to authenticated;
grant update (ended_at, buffer_minutes) on public.site_days to authenticated;

/*
 * Правка конца дня или запаса после подтверждения снимает подтверждение:
 * прораб подтверждал другие часы. Само подтверждение (site_foreman_approve)
 * эти поля не трогает и под правило не попадает.
 */
create or replace function app.site_day_reset_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.approved_at is not null
     and (new.ended_at is distinct from old.ended_at or new.buffer_minutes is distinct from old.buffer_minutes) then
    new.approved_at := null;
    new.approved_by := null;
    new.approval_note := null;
  end if;
  return new;
end;
$$;

create trigger site_days_reset_approval
  before update on public.site_days
  for each row execute function app.site_day_reset_approval();

-- ── Рейсы ─────────────────────────────────────────────────────────

create table public.site_loads (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.site_days (id) on delete cascade,
  job_id uuid not null references public.site_jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  material_code text not null,
  scale_site_id uuid references public.scale_sites (id) on delete set null,
  gross_kg integer constraint site_loads_gross check (gross_kg between 100 and 120000),
  tare_kg integer constraint site_loads_tare check (tare_kg between 100 and 60000),
  net_kg integer generated always as (case when gross_kg is not null and tare_kg is not null then gross_kg - tare_kg end) stored,
  /* Время выгрузки: тара на выезде или нажатие «выгрузился». По нему считается конец дня. */
  unloaded_at timestamptz not null,
  ticket_no text,
  event_id uuid,
  created_at timestamptz not null default now(),
  constraint site_loads_gross_over_tare check (gross_kg is null or tare_kg is null or gross_kg > tare_kg)
);

create unique index site_loads_event_key on public.site_loads (event_id) where event_id is not null;
create index site_loads_day_idx on public.site_loads (day_id, unloaded_at);

alter table public.site_loads enable row level security;

create policy site_loads_own
  on public.site_loads for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy site_loads_admin
  on public.site_loads for select to authenticated using ((select app.is_admin()));

grant select on public.site_loads to authenticated;

-- ── Приложение водителя ───────────────────────────────────────────

/*
 * Всё, что нужно экрану «Объект»: открытые объекты компании, сегодняшние
 * дни водителя с рейсами, его машина и прицепы компании (для предела
 * массы), весы и пункты приёмки.
 */
create or replace function public.driver_site_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_today date := (now() at time zone 'Europe/Helsinki')::date;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);

  return jsonb_build_object(
    'today', v_today,
    'country', (select country from public.companies where id = v_driver.company_id),
    'vehicle', (
      select jsonb_build_object('id', v.id, 'plate', v.plate, 'vehicle_class', v.vehicle_class, 'axles', v.axles,
                                'gross_max_kg', v.gross_max_kg, 'tare_kg', v.tare_kg, 'body_type', v.body_type)
      from public.vehicles v where v.id = v_vehicle
    ),
    'trailers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'plate', t.plate, 'kind', t.kind, 'axles', t.axles,
                                          'twin_wheels', t.twin_wheels, 'gross_max_kg', t.gross_max_kg, 'tare_kg', t.tare_kg)
                       order by t.plate)
      from public.trailers t where t.company_id = v_driver.company_id
    ), '[]'::jsonb),
    'jobs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'name', j.name, 'address', j.address, 'customer_name', j.customer_name,
        'material_code', j.material_code, 'receiving_site_id', j.receiving_site_id,
        'day', (
          select jsonb_build_object(
            'id', d.id, 'arrived_at', d.arrived_at, 'ended_at', d.ended_at, 'buffer_minutes', d.buffer_minutes,
            'trailer_id', d.trailer_id, 'approved_at', d.approved_at,
            'loads', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', l.id, 'material_code', l.material_code, 'scale_site_id', l.scale_site_id,
                'gross_kg', l.gross_kg, 'tare_kg', l.tare_kg, 'net_kg', l.net_kg,
                'unloaded_at', l.unloaded_at, 'ticket_no', l.ticket_no) order by l.unloaded_at)
              from public.site_loads l where l.day_id = d.id
            ), '[]'::jsonb))
          from public.site_days d
          where d.job_id = j.id and d.driver_id = v_driver.id and d.day = v_today
        )) order by j.name)
      from public.site_jobs j
      where j.company_id = v_driver.company_id and j.status = 'ACTIVE'
    ), '[]'::jsonb),
    'scale_sites', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'city', s.city, 'lat', s.lat, 'lon', s.lon, 'kind', s.kind)
                       order by s.name)
      from public.scale_sites s
      where s.approved_at is not null or s.created_by_company = v_driver.company_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_site_state() from public, anon;
grant execute on function public.driver_site_state() to authenticated;

/*
 * Действия водителя на объекте:
 *   ARRIVE — прибыл (p_data.trailer_id — прицеп на сегодня, если есть);
 *   LOAD   — рейс с весами или без: material_code, scale_site_id,
 *            gross_kg, tare_kg, ticket_no; время нажатия = выгрузка;
 *   END    — закончил день (иначе конец = последняя выгрузка + запас);
 *   ADD_SITE — новый пункт приёмки: name, lat, lon, kind.
 */
create or replace function public.driver_site_action(
  p_action text,
  p_job_id uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_job public.site_jobs;
  v_day public.site_days;
  v_at timestamptz := coalesce(app.client_time(p_at), clock_timestamp());
  v_date date;
  v_vehicle uuid;
  v_trailer uuid;
  v_lat double precision := nullif(p_data ->> 'lat', '')::double precision;
  v_lon double precision := nullif(p_data ->> 'lon', '')::double precision;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'SITE_' || p_action, p_at) then
    return;
  end if;

  if p_action = 'ADD_SITE' then
    insert into public.scale_sites (name, city, country, lat, lon, kind, created_by_company)
    values (
      btrim(p_data ->> 'name'),
      nullif(btrim(coalesce(p_data ->> 'city', '')), ''),
      coalesce((select country from public.companies where id = v_driver.company_id), 'FI'),
      case when app.sane_position(v_lat, v_lon) then v_lat end,
      case when app.sane_position(v_lat, v_lon) then v_lon end,
      coalesce(nullif(p_data ->> 'kind', ''), 'RECEIVING'),
      v_driver.company_id
    );
    return;
  end if;

  select * into v_job from public.site_jobs
  where id = p_job_id and company_id = v_driver.company_id and status = 'ACTIVE';
  if v_job.id is null then
    raise exception 'Объект не найден.' using errcode = 'P0002';
  end if;

  v_date := (v_at at time zone 'Europe/Helsinki')::date;

  select * into v_day from public.site_days
  where job_id = v_job.id and driver_id = v_driver.id and day = v_date
  for update;

  if p_action = 'ARRIVE' then
    if v_day.id is not null then
      return;
    end if;
    select vehicle_id into v_vehicle from public.vehicle_drivers
    where driver_id = v_driver.id and upper_inf(during);
    select id into v_trailer from public.trailers
    where id = nullif(p_data ->> 'trailer_id', '')::uuid and company_id = v_driver.company_id;

    insert into public.site_days (job_id, company_id, driver_id, vehicle_id, trailer_id, day, arrived_at, buffer_minutes)
    values (v_job.id, v_job.company_id, v_driver.id, v_vehicle, v_trailer, v_date, v_at, v_job.buffer_minutes)
    on conflict (job_id, driver_id, day) do nothing;
    return;
  end if;

  if v_day.id is null then
    raise exception 'Сначала отметьте прибытие на объект.' using errcode = '55000';
  end if;

  if p_action = 'LOAD' then
    insert into public.site_loads (day_id, job_id, company_id, material_code, scale_site_id, gross_kg, tare_kg, unloaded_at, ticket_no, event_id)
    values (
      v_day.id, v_job.id, v_job.company_id,
      coalesce(nullif(p_data ->> 'material_code', ''), v_job.material_code),
      (select id from public.scale_sites
       where id = nullif(p_data ->> 'scale_site_id', '')::uuid
         and (approved_at is not null or created_by_company = v_job.company_id)),
      nullif(p_data ->> 'gross_kg', '')::integer,
      nullif(p_data ->> 'tare_kg', '')::integer,
      greatest(v_at, v_day.arrived_at),
      nullif(btrim(coalesce(p_data ->> 'ticket_no', '')), ''),
      p_event_id
    )
    on conflict do nothing;
    /*
     * Новый рейс после «закончил» — день продолжается. И в любом случае
     * подтверждение прораба снимается: он подтверждал другой день.
     */
    update public.site_days
    set ended_at = case when ended_at is not null and ended_at < v_at then null else ended_at end,
        approved_at = null, approved_by = null, approval_note = null
    where id = v_day.id;
    return;
  end if;

  if p_action = 'END' then
    update public.site_days
    set ended_at = greatest(v_at, arrived_at + interval '1 minute'),
        approved_at = null, approved_by = null, approval_note = null
    where id = v_day.id;
    return;
  end if;

  raise exception 'Неизвестное действие %.', p_action using errcode = '22023';
end;
$$;

revoke all on function public.driver_site_action(text, uuid, jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_site_action(text, uuid, jsonb, timestamptz, uuid) to authenticated;

-- ── Прораб по ссылке ──────────────────────────────────────────────

/*
 * Страница прораба: объект, дни и рейсы по ссылке с токеном, без входа.
 * Отдаётся только то, что прораб и так видит на объекте: машины, водители
 * по имени, время, рейсы и тонны. Ставки и суммы — нет.
 */
create or replace function public.site_foreman_view(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'job', jsonb_build_object('name', j.name, 'address', j.address, 'customer_name', j.customer_name,
                              'carrier', c.name, 'pricing', j.pricing, 'material_code', j.material_code),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'day', d.day, 'arrived_at', d.arrived_at, 'ended_at', d.ended_at,
        'buffer_minutes', d.buffer_minutes, 'approved_at', d.approved_at, 'approved_by', d.approved_by,
        'driver', dr.full_name,
        'plate', (select plate from public.vehicles where id = d.vehicle_id),
        'trailer_plate', (select plate from public.trailers where id = d.trailer_id),
        'loads', coalesce((
          select jsonb_agg(jsonb_build_object('material_code', l.material_code, 'net_kg', l.net_kg,
                                              'unloaded_at', l.unloaded_at, 'ticket_no', l.ticket_no,
                                              'scale_site', (select name from public.scale_sites where id = l.scale_site_id))
                           order by l.unloaded_at)
          from public.site_loads l where l.day_id = d.id
        ), '[]'::jsonb)) order by d.day desc, dr.full_name)
      from public.site_days d
      join public.drivers dr on dr.id = d.driver_id
      where d.job_id = j.id and d.day >= current_date - 62
    ), '[]'::jsonb)
  )
  from public.site_jobs j
  join public.companies c on c.id = j.company_id
  where j.foreman_token = p_token;
$$;

revoke all on function public.site_foreman_view(uuid) from public;
grant execute on function public.site_foreman_view(uuid) to anon, authenticated;

create or replace function public.site_foreman_approve(p_token uuid, p_day_id uuid, p_name text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Имя обязательно.' using errcode = '22023';
  end if;

  update public.site_days d
  set approved_at = now(),
      approved_by = left(btrim(p_name), 120),
      approval_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  from public.site_jobs j
  where d.id = p_day_id and d.job_id = j.id and j.foreman_token = p_token
    and j.status = 'ACTIVE' and d.approved_at is null;

  if not found then
    raise exception 'День не найден.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.site_foreman_approve(uuid, uuid, text, text) from public;
grant execute on function public.site_foreman_approve(uuid, uuid, text, text) to anon, authenticated;

-- ── Подтверждение дня перевозчиком ──────────────────────────────────

/*
 * Вместо прораба день может подтвердить сам перевозчик — по данным
 * водителя о выгрузках. В отметке видно, кто подтвердил: «<имя>
 * (kuljetusliike)», чтобы заказчик отличал это от подтверждения прораба.
 */
create or replace function public.carrier_site_approve_day(p_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_name text;
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'RAHTIS') into v_name
  from public.profiles where id = (select auth.uid());

  update public.site_days
  set approved_at = now(),
      approved_by = left(v_name, 100) || ' (kuljetusliike)',
      approval_note = null
  where id = p_day_id and company_id = v_company and approved_at is null;

  if not found then
    raise exception 'День не найден или уже подтверждён.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.carrier_site_approve_day(uuid) from public, anon;
grant execute on function public.carrier_site_approve_day(uuid) to authenticated;

-- ── Стартовый справочник (открытые источники, 26.10.2026) ───────────

insert into public.scale_sites (name, address, city, country, lat, lon, kind, accepts, approved_at) values
  ('HSY Ämmässuo ekoteollisuuskeskus', null, 'Espoo', 'FI', null, null, 'RECEIVING', 'Maa-ainekset ympäristöluvan mukaan; ei pilaantumatonta savea tai silttiä', now()),
  ('NCC Loviisa Vanhakylä', null, 'Loviisa', 'FI', null, null, 'PIT', 'Puhtaat maat, kirjallinen ilmoitus etukäteen', now()),
  ('NCC Mäntsälä Ohkola', null, 'Mäntsälä', 'FI', null, null, 'PIT', 'Puhtaat maat, kirjallinen ilmoitus etukäteen', now()),
  ('NCC Pornainen', null, 'Pornainen', 'FI', null, null, 'PIT', 'Puhtaat maat, kirjallinen ilmoitus etukäteen', now()),
  ('NCC Porvoo Tolkkinen', null, 'Porvoo', 'FI', null, null, 'PIT', 'Puhtaat maat, kirjallinen ilmoitus etukäteen', now()),
  ('Kiertokapula Karanoja', null, 'Hämeenlinna', 'FI', null, null, 'RECEIVING', 'Puhtaat maat', now());
