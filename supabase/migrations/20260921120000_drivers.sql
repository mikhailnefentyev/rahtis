-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · водители отдельно от машин
--
-- До сих пор водитель был двумя полями машины: driver_name и whatsapp.
-- Модель «одна машина — один водитель» не держит ни пересменку, ни
-- водителя, который сегодня на одном тягаче, а завтра на другом. Хуже
-- того, телефон был идентификатором водителя для агента — и один номер,
-- записанный на две машины, делал вопрос «какой рейс у этого водителя»
-- неразрешимым.
--
-- Теперь водитель — отдельная строка компании, телефон уникален среди
-- действующих водителей всей платформы (он станет входом в приложение
-- водителя), а привязка «машина ↔ водитель» — интервал времени.
--
-- ГЛАВНОЕ РЕШЕНИЕ — поля машины остаются, но становятся зеркалом.
--
-- driver_name, whatsapp и languages у машины читают десяток функций:
-- отклики у заказчика, закреплённые рейсы, агенты, карточки оператора.
-- Переписать их все одной миграцией — значит рискнуть матчингом ради
-- переименования. Поэтому колонки остаются, но пишет в них только
-- app.sync_vehicle_driver — из текущей привязки. У перевозчика права на
-- них отозваны: второй источник правды разошёлся бы с первым на первой
-- же правке.
--
-- Смена водителя больше не снимает допуск машины. Прежде оператор
-- допускал связку «машина + водитель», и пересменка останавливала
-- машину до его решения. Каждая смена остаётся в vehicle_drivers — с
-- автором и временем, — и история от этого не теряется.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists btree_gist with schema extensions;


-- ── Водитель ───────────────────────────────────────────────────────

create type public.driver_status as enum ('ACTIVE', 'ARCHIVED');

create table public.drivers (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null,

  /* Водители бывают только у перевозчика — тот же приём, что у машин. */
  company_kind public.party_role not null default 'CARRIER',

  full_name text not null,

  /* Международный формат: номер — вход в приложение водителя. */
  phone text not null,

  languages text[] not null default '{}',

  status public.driver_status not null default 'ACTIVE',

  /*
   * Пользователь приложения водителя. Пусто, пока водитель не принял
   * приглашение. Уникально: один вход — один водитель.
   */
  auth_user_id uuid unique references auth.users (id) on delete set null,

  /*
   * Перенос из карточек машин нашёл что-то, что человек должен
   * проверить сам: один номер у разных имён или у нескольких машин.
   * Снимается любой правкой водителя перевозчиком.
   */
  needs_review boolean not null default false,

  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint drivers_company_is_carrier
    check (company_kind = 'CARRIER'),

  constraint drivers_company_fk
    foreign key (company_id, company_kind)
    references public.companies (id, kind)
    on delete cascade,

  constraint drivers_full_name_length
    check (length(btrim(full_name)) between 2 and 120),

  constraint drivers_phone_format
    check (phone ~ '^\+[1-9][0-9]{6,14}$'),

  constraint drivers_languages_known
    check (
      coalesce(array_length(languages, 1), 0) between 1 and 8
      and languages <@ array['FI', 'SV', 'EN', 'RU', 'ET', 'NO', 'DA', 'DE', 'PL', 'LT', 'LV']
    ),

  constraint drivers_archived_consistent
    check ((status = 'ARCHIVED') = (archived_at is not null))
);

comment on table public.drivers is
  'Водитель перевозчика. Телефон уникален среди действующих по всей платформе.';

/*
 * Один телефон — один действующий водитель, и не в пределах компании, а
 * везде: номер станет входом в приложение, и два водителя с одним номером
 * — это один вход на двоих. Архивный номер не занимает: водитель,
 * ушедший к другому перевозчику, заводится там заново.
 */
create unique index drivers_phone_active_key
  on public.drivers (app.phone_digits(phone))
  where status = 'ACTIVE';

create index drivers_company_idx on public.drivers (company_id, status);

create trigger drivers_touch_updated_at
  before update on public.drivers
  for each row execute function app.touch_updated_at();


-- ── Кто на какой машине ────────────────────────────────────────────

create table public.vehicle_drivers (
  id bigint generated always as identity primary key,

  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,

  /* Открытый интервал — водитель на машине сейчас. */
  during tstzrange not null,

  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint vehicle_drivers_during_bounded_below
    check (not lower_inf(during)),

  /*
   * Разные водители на одной машине — это смены, идущие друг за другом,
   * а не одновременно. И водитель не сидит в двух кабинах сразу.
   */
  constraint vehicle_drivers_one_driver_per_vehicle
    exclude using gist (vehicle_id with =, during with &&),

  constraint vehicle_drivers_one_vehicle_per_driver
    exclude using gist (driver_id with =, during with &&)
);

comment on table public.vehicle_drivers is
  'История привязок водителей к машинам. Пишется только app.assign_vehicle_driver.';

create index vehicle_drivers_driver_idx on public.vehicle_drivers (driver_id, lower(during) desc);


/* Водитель машины в момент p_at. */
create or replace function app.vehicle_driver_at(p_vehicle_id uuid, p_at timestamptz default now())
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select driver_id
  from public.vehicle_drivers
  where vehicle_id = p_vehicle_id
    and during @> p_at;
$$;

comment on function app.vehicle_driver_at(uuid, timestamptz) is
  'Кто был водителем машины в указанный момент. NULL — машина без водителя.';

/* Водитель, вошедший в приложение. NULL у всех остальных. */
create or replace function app.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.drivers
  where auth_user_id = (select auth.uid())
    and status = 'ACTIVE';
$$;

comment on function app.current_driver_id() is
  'Водитель текущего пользователя приложения. NULL у кабинетов и гостей.';

revoke all on function
  app.vehicle_driver_at(uuid, timestamptz),
  app.current_driver_id()
from public;

grant execute on function
  app.vehicle_driver_at(uuid, timestamptz),
  app.current_driver_id()
to authenticated, service_role;


-- ── Зеркало в карточке машины ──────────────────────────────────────

alter table public.vehicles
  alter column driver_name drop not null,
  alter column whatsapp drop not null;

comment on column public.vehicles.driver_name is
  'Зеркало текущего водителя из vehicle_drivers. Пишет только app.sync_vehicle_driver.';
comment on column public.vehicles.whatsapp is
  'Зеркало телефона текущего водителя. Пишет только app.sync_vehicle_driver.';
comment on column public.vehicles.languages is
  'Зеркало языков текущего водителя. Пишет только app.sync_vehicle_driver.';

/*
 * Переписывает зеркало машины из её текущей привязки. Машина без
 * водителя получает пустые поля, а не прошлого водителя: устаревшее
 * имя в отклике хуже пустого — по нему заказчик ждал бы не того.
 */
create or replace function app.sync_vehicle_driver(p_vehicle_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.vehicles v
  set driver_name = d.full_name,
      whatsapp = d.phone,
      languages = coalesce(d.languages, '{}')
  from (select 1) one
  left join public.drivers d
    on d.id = app.vehicle_driver_at(p_vehicle_id)
  where v.id = p_vehicle_id;
$$;

revoke all on function app.sync_vehicle_driver(uuid) from public, anon, authenticated;

/* Правка имени, телефона или языков водителя доходит до его машины. */
create or replace function app.on_driver_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle_id uuid;
begin
  for v_vehicle_id in
    select vehicle_id from public.vehicle_drivers
    where driver_id = new.id and upper_inf(during)
  loop
    perform app.sync_vehicle_driver(v_vehicle_id);
  end loop;

  return new;
end;
$$;

create trigger drivers_sync_vehicle
  after update of full_name, phone, languages on public.drivers
  for each row execute function app.on_driver_changed();

/*
 * Смена водителя больше не материальна для допуска — см. шапку. Всё
 * остальное условие прежнее.
 */
create or replace function app.reset_vehicle_access_on_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.access = 'APPROVED' and (
       new.plate is distinct from old.plate
    or new.axles is distinct from old.axles
    or new.euro_class is distinct from old.euro_class
    or new.vehicle_class is distinct from old.vehicle_class
    or new.payload_kg is distinct from old.payload_kg
    or new.ldm is distinct from old.ldm
  ) then
    new.access := 'PENDING';
    new.submitted_at := now();
    new.approved_at := null;
  end if;

  return new;
end;
$$;


-- ── Назначить водителя на машину ───────────────────────────────────

/*
 * Ставит водителя на машину с этой минуты; p_driver_id = NULL снимает
 * водителя с машины.
 *
 * Прежняя привязка машины закрывается. Если водитель сидел на другой
 * машине — закрывается и она: пересадка — одно действие, а не два, и
 * ограничение «водитель в одной кабине» не должно отказывать человеку,
 * который просто пересаживает водителя.
 */
create or replace function public.assign_vehicle_driver(p_vehicle_id uuid, p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := (select app.current_company_id());
  v_vehicle public.vehicles;
  v_driver public.drivers;
  v_previous_vehicle uuid;
  v_now timestamptz := now();
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Назначать водителей может только перевозчик.' using errcode = '42501';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;

  if v_vehicle.id is null or v_vehicle.company_id is distinct from v_company_id then
    raise exception 'Машина не найдена в вашем автопарке.' using errcode = '42501';
  end if;

  if p_driver_id is not null then
    select * into v_driver from public.drivers where id = p_driver_id for update;

    if v_driver.id is null or v_driver.company_id is distinct from v_company_id then
      raise exception 'Водитель не найден в вашей компании.' using errcode = '42501';
    end if;

    if v_driver.status <> 'ACTIVE' then
      raise exception 'Водитель в архиве.' using errcode = '55000';
    end if;

    /* Уже на этой машине — делать нечего. */
    if app.vehicle_driver_at(p_vehicle_id, v_now) = p_driver_id then
      return;
    end if;
  end if;

  /* Машина освобождается от прежнего водителя. */
  update public.vehicle_drivers
  set during = tstzrange(lower(during), v_now)
  where vehicle_id = p_vehicle_id and upper_inf(during);

  if p_driver_id is not null then
    /* Водитель уходит с прежней машины, если был на ней. */
    update public.vehicle_drivers
    set during = tstzrange(lower(during), v_now)
    where driver_id = p_driver_id and upper_inf(during)
    returning vehicle_id into v_previous_vehicle;

    insert into public.vehicle_drivers (vehicle_id, driver_id, during, assigned_by)
    values (p_vehicle_id, p_driver_id, tstzrange(v_now, null), (select auth.uid()));
  end if;

  perform app.sync_vehicle_driver(p_vehicle_id);

  if v_previous_vehicle is not null and v_previous_vehicle <> p_vehicle_id then
    perform app.sync_vehicle_driver(v_previous_vehicle);
  end if;
end;
$$;

comment on function public.assign_vehicle_driver(uuid, uuid) is
  'Ставит водителя на машину с этой минуты (NULL — снять). Пересадка с другой машины — тем же вызовом.';

revoke all on function public.assign_vehicle_driver(uuid, uuid) from public, anon;
grant execute on function public.assign_vehicle_driver(uuid, uuid) to authenticated;


/*
 * Архив: водитель уходит с машины и перестаёт занимать номер. Его
 * рейсы и смены остаются — это история, по которой считаются отчёты.
 */
create or replace function public.archive_driver(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle_id uuid;
  v_now timestamptz := now();
begin
  select * into v_driver from public.drivers where id = p_driver_id for update;

  if v_driver.id is null or v_driver.company_id is distinct from (select app.current_company_id()) then
    raise exception 'Водитель не найден в вашей компании.' using errcode = '42501';
  end if;

  if v_driver.status = 'ARCHIVED' then
    return;
  end if;

  update public.vehicle_drivers
  set during = tstzrange(lower(during), v_now)
  where driver_id = p_driver_id and upper_inf(during)
  returning vehicle_id into v_vehicle_id;

  update public.drivers
  set status = 'ARCHIVED',
      archived_at = v_now,
      auth_user_id = null
  where id = p_driver_id;

  if v_vehicle_id is not null then
    perform app.sync_vehicle_driver(v_vehicle_id);
  end if;
end;
$$;

/*
 * Вернуть из архива. Номер мог за это время занять другой водитель —
 * тогда уникальный индекс откажет, и это правильный отказ.
 */
create or replace function public.restore_driver(p_driver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.drivers
  set status = 'ACTIVE',
      archived_at = null
  where id = p_driver_id
    and company_id = (select app.current_company_id())
    and status = 'ARCHIVED';
end;
$$;

revoke all on function public.archive_driver(uuid), public.restore_driver(uuid) from public, anon;
grant execute on function public.archive_driver(uuid), public.restore_driver(uuid) to authenticated;


-- ── Машина без водителя на рейс не выходит ─────────────────────────

/*
 * Откликнуться машиной без водителя значит пообещать рейс, который
 * некому везти, — а у заказчика при выборе не было бы даже имени.
 */
create or replace function app.vehicle_is_dispatchable(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select v.access = 'APPROVED'
     and app.company_documents_ok(v.company_id)
     and app.company_is_open(v.company_id)
     and app.vehicle_driver_at(v.id) is not null
  from public.vehicles v
  where v.id = p_vehicle_id;
$$;

create or replace function app.has_dispatchable_vehicle(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.company_documents_ok(p_company_id)
     and app.company_is_open(p_company_id)
     and exists (
       select 1 from public.vehicles v
       where v.company_id = p_company_id
         and v.access = 'APPROVED'
         and app.vehicle_driver_at(v.id) is not null
     );
$$;


-- ── Кто вёз рейс ───────────────────────────────────────────────────

/*
 * Водитель рейса — снимок, а не вывод из привязки. Привязки меняются, а
 * рейс должен остаться за тем, кто его вёз: по нему считаются часы и
 * километры водителя. Та же причина, по которой при закрытии
 * замораживается комиссия.
 *
 * Снимок берётся при назначении машины и обновляется при подтверждении:
 * между выбором и стартом перевозчик мог пересадить водителя, и везёт
 * тот, кто сидит в кабине в момент старта.
 */
alter table public.orders
  add column assigned_driver_id uuid references public.drivers (id) on delete set null;

comment on column public.orders.assigned_driver_id is
  'Водитель рейса: снимок привязки машины при назначении и при старте.';

create index orders_assigned_driver_idx on public.orders (assigned_driver_id)
  where assigned_driver_id is not null;

create or replace function app.snapshot_order_driver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_vehicle_id is null then
    new.assigned_driver_id := null;
  elsif tg_op = 'INSERT' then
    new.assigned_driver_id := app.vehicle_driver_at(new.assigned_vehicle_id);
  elsif new.assigned_vehicle_id is distinct from old.assigned_vehicle_id
     or (new.status = 'IN_PROGRESS' and old.status is distinct from 'IN_PROGRESS') then
    new.assigned_driver_id := app.vehicle_driver_at(new.assigned_vehicle_id);
  end if;

  return new;
end;
$$;

create trigger orders_snapshot_driver
  before insert or update of assigned_vehicle_id, status on public.orders
  for each row execute function app.snapshot_order_driver();


-- ── Права ──────────────────────────────────────────────────────────

alter table public.drivers enable row level security;
alter table public.vehicle_drivers enable row level security;

revoke all on public.drivers from anon, authenticated;
revoke all on public.vehicle_drivers from anon, authenticated;

grant select on public.drivers to authenticated;
grant insert (company_id, full_name, phone, languages) on public.drivers to authenticated;
/* needs_review снимает сама правка: см. триггер ниже. */
grant update (full_name, phone, languages) on public.drivers to authenticated;
grant select on public.vehicle_drivers to authenticated;

create policy drivers_select_own
  on public.drivers for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy drivers_select_admin
  on public.drivers for select to authenticated
  using ((select app.is_admin()));

/* Водитель в приложении видит себя. */
create policy drivers_select_self
  on public.drivers for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy drivers_insert_own
  on public.drivers for insert to authenticated
  with check (
    company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  );

create policy drivers_update_own
  on public.drivers for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy vehicle_drivers_select_own
  on public.vehicle_drivers for select to authenticated
  using (
    exists (
      select 1 from public.drivers d
      where d.id = driver_id
        and d.company_id = (select app.current_company_id())
    )
  );

create policy vehicle_drivers_select_admin
  on public.vehicle_drivers for select to authenticated
  using ((select app.is_admin()));

/* Любая правка перевозчиком — это и есть проверка. */
create or replace function app.clear_driver_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.needs_review := false;
  end if;
  return new;
end;
$$;

create trigger drivers_clear_review
  before update of full_name, phone, languages on public.drivers
  for each row execute function app.clear_driver_review();

/*
 * Поля водителя в карточке машины перевозчик больше не пишет. Вставка
 * была табличным грантом — заодно она перестаёт пускать access и даты
 * решения оператора: вставить себе сразу допущенную машину прежде
 * мешала только форма.
 */
revoke update (driver_name, whatsapp, languages) on public.vehicles from authenticated;
revoke insert on public.vehicles from authenticated;

grant insert (
  company_id, plate, axles, make, euro_class, base_city, adr, container_feet,
  vehicle_class, payload_kg, ldm, tail_lift, side_loading, reefer,
  reefer_inspection_until, base_lat, base_lon, base_country
) on public.vehicles to authenticated;


-- ── Перенос из карточек машин ──────────────────────────────────────

/*
 * Водители собираются по цифрам телефона внутри компании. Один номер у
 * нескольких машин — один водитель на всех: так это и было записано. Но
 * по базе не понять, один это человек или ошибка ввода, поэтому такой
 * водитель помечается «проверьте».
 *
 * Номер, встречающийся у двух компаний, действующим может быть только у
 * одной: остальные заводятся архивными с той же пометкой и без машины.
 */
with langs as (
  select
    v.company_id,
    app.phone_digits(v.whatsapp) as digits,
    array_agg(distinct l order by l) as languages
  from public.vehicles v, unnest(v.languages) l
  group by v.company_id, app.phone_digits(v.whatsapp)
),
grouped as (
  select
    v.company_id,
    app.phone_digits(v.whatsapp) as digits,
    (array_agg(v.driver_name order by v.updated_at desc))[1] as full_name,
    (array_agg(v.whatsapp order by v.updated_at desc))[1] as phone,
    count(*) > 1 or count(distinct lower(btrim(v.driver_name))) > 1 as ambiguous,
    min(v.created_at) as first_seen
  from public.vehicles v
  where app.phone_digits(v.whatsapp) is not null
  group by v.company_id, app.phone_digits(v.whatsapp)
),
ranked as (
  select g.*, coalesce(l.languages, '{}') as languages,
         row_number() over (partition by g.digits order by g.first_seen) as claim
  from grouped g
  left join langs l on l.company_id = g.company_id and l.digits = g.digits
)
insert into public.drivers (company_id, full_name, phone, languages, status, archived_at, needs_review)
select
  company_id,
  full_name,
  phone,
  case when coalesce(array_length(languages, 1), 0) = 0 then array['FI'] else languages[1:8] end,
  case when claim = 1 then 'ACTIVE' else 'ARCHIVED' end::public.driver_status,
  case when claim = 1 then null else now() end,
  ambiguous or claim > 1
from ranked;

/*
 * Привязка: водитель садится на последнюю по правке машину с его
 * номером. Остальные машины с тем же номером остаются без водителя —
 * одновременно в двух кабинах он быть не может, а пометка на водителе
 * скажет перевозчику, куда смотреть.
 */
insert into public.vehicle_drivers (vehicle_id, driver_id, during)
select distinct on (d.id)
  v.id,
  d.id,
  tstzrange(v.created_at, null)
from public.drivers d
join public.vehicles v
  on v.company_id = d.company_id
 and app.phone_digits(v.whatsapp) = app.phone_digits(d.phone)
where d.status = 'ACTIVE'
order by d.id, v.updated_at desc;

select app.sync_vehicle_driver(v.id) from public.vehicles v;

/*
 * Рейсы, уже закреплённые за машиной, получают её нынешнего водителя.
 * Отметка времени правки при этом не сдвигается: по ней сортируются
 * списки, и перенос не должен поднять старые рейсы наверх.
 */
alter table public.orders disable trigger orders_touch_updated_at;

update public.orders o
set assigned_driver_id = app.vehicle_driver_at(o.assigned_vehicle_id)
where o.assigned_vehicle_id is not null;

alter table public.orders enable trigger orders_touch_updated_at;
