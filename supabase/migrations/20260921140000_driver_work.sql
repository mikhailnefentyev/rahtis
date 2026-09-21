-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · отработка водителей и справочная оплата
--
-- Перевозчик платит отдельному сервису за учёт часов водителей — а рейсы,
-- километры и точки у нас уже есть. Не хватало смен: когда водитель
-- начал день, когда ушёл на перерыв, когда закончил. Их пишет приложение
-- водителя (source = APP), а до него — перевозчик руками (MANUAL). Обе
-- записи ложатся в одну таблицу, и отчёты не различают, откуда смена.
--
-- ЧТО ЗДЕСЬ НЕ СЧИТАЕТСЯ. Деньги водителя — справка, а не расчёт
-- зарплаты: окончательную сумму определяют работодатель, трудовой
-- договор и TES. Поэтому в базе только исходные данные и ставки, а
-- арифметика — в lib/driverPay: одна функция на экран, PDF и таблицу.
-- Это не противоречит правилу «деньги считает база одним определением»:
-- оно про деньги между сторонами сделки, а здесь справка внутри
-- перевозчика, и сверять её до цента не с чем.
--
-- СТАВКИ TES НЕ ЗАШИТЫ. TES пересматривается раз в год-два, у каждого
-- перевозчика свой договор. Правила лежат строками с датой начала
-- действия: у компании свои, а строки без компании — шаблоны, которые
-- ведёт оператор и которые перевозчик копирует к себе. Чисел шаблона
-- миграция не вносит: их берут из текста действующего TES.
-- ═══════════════════════════════════════════════════════════════════


-- ── Смены ──────────────────────────────────────────────────────────

create type public.shift_source as enum ('APP', 'MANUAL');

create table public.driver_shifts (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.drivers (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,

  started_at timestamptz not null,
  ended_at timestamptz,

  source public.shift_source not null default 'MANUAL',

  /* Показания одометра — для работы вне платформы, где рейса с пробегом нет. */
  odometer_start integer,
  odometer_end integer,

  start_lat double precision,
  start_lon double precision,
  end_lat double precision,
  end_lon double precision,

  note text,

  /* Идентификатор события из офлайн-очереди приложения: повтор не удваивает смену. */
  client_event_id uuid unique,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint driver_shifts_order
    check (ended_at is null or ended_at > started_at),

  /*
   * Сутки — предел одной смены. Больше — почти всегда забытое «Lopeta
   * päivä», и такая смена тихо испортила бы отчёт за неделю.
   */
  constraint driver_shifts_length
    check (ended_at is null or ended_at - started_at <= interval '24 hours'),

  constraint driver_shifts_odometer
    check (odometer_end is null or odometer_start is null or odometer_end >= odometer_start),

  constraint driver_shifts_odometer_range
    check (
      (odometer_start is null or odometer_start between 0 and 9999999)
      and (odometer_end is null or odometer_end between 0 and 9999999)
    ),

  constraint driver_shifts_note_length
    check (note is null or length(note) <= 500),

  /* Две смены одного водителя не пересекаются. */
  constraint driver_shifts_no_overlap
    exclude using gist (
      driver_id with =,
      tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz)) with &&
    )
);

comment on table public.driver_shifts is
  'Рабочие смены водителя. MANUAL — внёс перевозчик, APP — отметил водитель в приложении.';

create index driver_shifts_driver_idx on public.driver_shifts (driver_id, started_at desc);

create trigger driver_shifts_touch_updated_at
  before update on public.driver_shifts
  for each row execute function app.touch_updated_at();

create table public.driver_breaks (
  id uuid primary key default gen_random_uuid(),

  shift_id uuid not null references public.driver_shifts (id) on delete cascade,

  started_at timestamptz not null,
  ended_at timestamptz,

  client_event_id uuid unique,
  created_at timestamptz not null default now(),

  constraint driver_breaks_order
    check (ended_at is null or ended_at > started_at),

  constraint driver_breaks_no_overlap
    exclude using gist (
      shift_id with =,
      tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz)) with &&
    )
);

create index driver_breaks_shift_idx on public.driver_breaks (shift_id);

/*
 * Перерыв лежит внутри своей смены. Проверяется триггером, потому что
 * граница — в другой строке, а CHECK видит только свою.
 */
create or replace function app.check_break_within_shift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.driver_shifts;
begin
  select * into v_shift from public.driver_shifts where id = new.shift_id;

  if new.started_at < v_shift.started_at
     or (v_shift.ended_at is not null
         and coalesce(new.ended_at, 'infinity'::timestamptz) > v_shift.ended_at) then
    raise exception 'Перерыв выходит за границы смены.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger driver_breaks_within_shift
  before insert or update on public.driver_breaks
  for each row execute function app.check_break_within_shift();

/*
 * Машина смены — из того же автопарка, что и водитель. Иначе отчёт
 * перевозчика показал бы чужой номер.
 */
create or replace function app.check_shift_vehicle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vehicle_id is not null and not exists (
    select 1
    from public.vehicles v
    join public.drivers d on d.company_id = v.company_id
    where v.id = new.vehicle_id and d.id = new.driver_id
  ) then
    raise exception 'Машина не из автопарка компании водителя.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger driver_shifts_check_vehicle
  before insert or update of vehicle_id, driver_id on public.driver_shifts
  for each row execute function app.check_shift_vehicle();


-- ── Журнал правок ──────────────────────────────────────────────────

/*
 * Часы — основание для денег, и правка задним числом должна оставлять
 * след: кто, когда и что было до. Удаление тоже.
 */
create table public.driver_shift_log (
  id bigint generated always as identity primary key,

  shift_id uuid not null,
  driver_id uuid not null references public.drivers (id) on delete cascade,

  action text not null,
  before jsonb,
  after jsonb,

  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint driver_shift_log_action
    check (action in ('INSERT', 'UPDATE', 'DELETE'))
);

create index driver_shift_log_shift_idx on public.driver_shift_log (shift_id, created_at);

create or replace function app.log_shift_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.driver_shift_log (shift_id, driver_id, action, before, after, actor_id)
  values (
    coalesce(new.id, old.id),
    coalesce(new.driver_id, old.driver_id),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) - 'updated_at' end,
    case when tg_op <> 'DELETE' then to_jsonb(new) - 'updated_at' end,
    (select auth.uid())
  );

  return coalesce(new, old);
end;
$$;

create trigger driver_shifts_log
  after insert or update or delete on public.driver_shifts
  for each row execute function app.log_shift_change();


-- ── Правила TES ────────────────────────────────────────────────────

/*
 * Набор правил почасовой оплаты по коллективному договору.
 *
 * Первая версия покрывает основное: сверхурочные сверх дневной нормы
 * двумя ступенями, вечерние и ночные доплаты за час, надбавки субботы и
 * воскресенья. Праздники, недельная норма и суточный отдых — позже.
 *
 * Суммы — в центах, надбавки — в базисных пунктах, как комиссия
 * платформы: 5000 = +50 %.
 */
create table public.tes_rule_sets (
  id uuid primary key default gen_random_uuid(),

  /* NULL — шаблон оператора, видный всем перевозчикам. */
  company_id uuid references public.companies (id) on delete cascade,

  name text not null,
  valid_from date not null,

  base_hourly_cents integer not null,

  daily_regular_minutes integer not null default 480,
  overtime1_minutes integer not null default 120,
  overtime1_bps integer not null default 0,
  overtime2_bps integer not null default 0,

  evening_start time,
  evening_end time,
  evening_cents integer not null default 0,

  night_start time,
  night_end time,
  night_cents integer not null default 0,

  saturday_bps integer not null default 0,
  sunday_bps integer not null default 0,

  note text,

  /* Из какого шаблона скопирован — чтобы видеть, что шаблон обновился. */
  based_on uuid references public.tes_rule_sets (id) on delete set null,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tes_rule_sets_name_length check (length(btrim(name)) between 2 and 120),
  constraint tes_rule_sets_base check (base_hourly_cents between 1 and 100000),
  constraint tes_rule_sets_minutes check (
    daily_regular_minutes between 60 and 1440 and overtime1_minutes between 0 and 1440
  ),
  constraint tes_rule_sets_bps check (
    overtime1_bps between 0 and 30000 and overtime2_bps between 0 and 30000
    and saturday_bps between 0 and 30000 and sunday_bps between 0 and 30000
  ),
  constraint tes_rule_sets_cents check (
    evening_cents between 0 and 100000 and night_cents between 0 and 100000
  ),
  /* Окно задаётся целиком или не задаётся. */
  constraint tes_rule_sets_evening_window
    check ((evening_start is null) = (evening_end is null)),
  constraint tes_rule_sets_night_window
    check ((night_start is null) = (night_end is null)),
  constraint tes_rule_sets_note_length check (note is null or length(note) <= 1000)
);

comment on table public.tes_rule_sets is
  'Правила почасовой оплаты по TES. company_id NULL — шаблон оператора. Суммы в центах, надбавки в б.п.';

create index tes_rule_sets_company_idx on public.tes_rule_sets (company_id, valid_from desc);

create trigger tes_rule_sets_touch_updated_at
  before update on public.tes_rule_sets
  for each row execute function app.touch_updated_at();

/* Копия шаблона оператора в компанию перевозчика. */
create or replace function public.copy_tes_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := (select app.current_company_id());
  v_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Копировать шаблон может только перевозчик.' using errcode = '42501';
  end if;

  insert into public.tes_rule_sets (
    company_id, name, valid_from, base_hourly_cents,
    daily_regular_minutes, overtime1_minutes, overtime1_bps, overtime2_bps,
    evening_start, evening_end, evening_cents,
    night_start, night_end, night_cents,
    saturday_bps, sunday_bps, note, based_on, created_by
  )
  select
    v_company_id, name, valid_from, base_hourly_cents,
    daily_regular_minutes, overtime1_minutes, overtime1_bps, overtime2_bps,
    evening_start, evening_end, evening_cents,
    night_start, night_end, night_cents,
    saturday_bps, sunday_bps, note, id, (select auth.uid())
  from public.tes_rule_sets
  where id = p_template_id and company_id is null
  returning id into v_id;

  if v_id is null then
    raise exception 'Шаблон не найден.' using errcode = 'P0002';
  end if;

  return v_id;
end;
$$;

revoke all on function public.copy_tes_template(uuid) from public, anon;
grant execute on function public.copy_tes_template(uuid) to authenticated;


-- ── Модель оплаты водителя ─────────────────────────────────────────

create type public.pay_model as enum ('PER_KM', 'TRIP_PERCENT', 'FLAT_HOURLY', 'TES');

/*
 * Модель и ставка с датой начала действия. Новая ставка — новая строка,
 * а не правка старой: отчёт за прошлый месяц считается по ставке того
 * месяца.
 */
create table public.driver_pay_profiles (
  id uuid primary key default gen_random_uuid(),

  driver_id uuid not null references public.drivers (id) on delete cascade,
  valid_from date not null,

  model public.pay_model not null,

  per_km_cents integer,
  trip_bps integer,
  hourly_cents integer,
  tes_rule_set_id uuid references public.tes_rule_sets (id) on delete restrict,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint driver_pay_profiles_one_per_day unique (driver_id, valid_from),

  constraint driver_pay_profiles_fields check (
    case model
      when 'PER_KM' then per_km_cents between 1 and 100000
      when 'TRIP_PERCENT' then trip_bps between 1 and 10000
      when 'FLAT_HOURLY' then hourly_cents between 1 and 100000
      when 'TES' then tes_rule_set_id is not null
    end
  )
);

comment on table public.driver_pay_profiles is
  'Модель оплаты водителя с даты. PER_KM — центы за км, TRIP_PERCENT — б.п. от выплаты перевозчику за рейс.';

create index driver_pay_profiles_driver_idx on public.driver_pay_profiles (driver_id, valid_from desc);

/* Набор TES профиля — свой или шаблон, но не чужой компании. */
create or replace function app.check_pay_profile_tes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tes_rule_set_id is not null and not exists (
    select 1
    from public.tes_rule_sets r
    join public.drivers d on d.id = new.driver_id
    where r.id = new.tes_rule_set_id
      and (r.company_id is null or r.company_id = d.company_id)
  ) then
    raise exception 'Набор правил TES не найден.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger driver_pay_profiles_check_tes
  before insert or update on public.driver_pay_profiles
  for each row execute function app.check_pay_profile_tes();


-- ── Рейсы водителя за период ───────────────────────────────────────

/*
 * Закрытые рейсы водителей компании с тем, что нужно отчёту: пробег,
 * отмеченные точки и выплата перевозчику — база модели «процент от
 * рейса». Выплата по той же формуле и замороженной ставке комиссии,
 * что в отчёте перевозчика, иначе справка разошлась бы с его же
 * отчётом за тот же рейс.
 */
create or replace function public.driver_trips(p_from date, p_to date)
returns table (
  order_id uuid,
  ref text,
  driver_id uuid,
  plate text,
  started_at timestamptz,
  closed_at timestamptz,
  distance_km integer,
  stops_done integer,
  payout_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.ref,
    o.assigned_driver_id,
    v.plate,
    (select min(s.completed_at) from public.order_stops s where s.order_id = o.id),
    o.closed_at,
    o.distance_km,
    (select count(*)::integer from public.order_stops s
      where s.order_id = o.id and s.completed_at is not null),
    app.payout_cents(o.rate_cents, coalesce(o.commission_bps, 0))
  from public.orders o
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_company_id = (select app.current_company_id())
    and o.status = 'DONE'
    and o.assigned_driver_id is not null
    and (o.closed_at at time zone 'Europe/Helsinki')::date between p_from and p_to
  order by o.closed_at;
$$;

revoke all on function public.driver_trips(date, date) from public, anon;
grant execute on function public.driver_trips(date, date) to authenticated;


-- ── Права ──────────────────────────────────────────────────────────

alter table public.driver_shifts enable row level security;
alter table public.driver_breaks enable row level security;
alter table public.driver_shift_log enable row level security;
alter table public.tes_rule_sets enable row level security;
alter table public.driver_pay_profiles enable row level security;

revoke all on public.driver_shifts from anon, authenticated;
revoke all on public.driver_breaks from anon, authenticated;
revoke all on public.driver_shift_log from anon, authenticated;
revoke all on public.tes_rule_sets from anon, authenticated;
revoke all on public.driver_pay_profiles from anon, authenticated;

/* Принадлежит ли водитель компании текущего пользователя. */
create or replace function app.owns_driver(p_driver_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.drivers
    where id = p_driver_id
      and company_id = (select app.current_company_id())
  );
$$;

revoke all on function app.owns_driver(uuid) from public, anon;
grant execute on function app.owns_driver(uuid) to authenticated;

-- смены: перевозчик — всё по своим водителям, водитель — читать свои
grant select, insert, update, delete on public.driver_shifts to authenticated;

create policy driver_shifts_carrier
  on public.driver_shifts for all to authenticated
  using ((select app.owns_driver(driver_id)))
  with check ((select app.owns_driver(driver_id)) and source = 'MANUAL');

create policy driver_shifts_select_self
  on public.driver_shifts for select to authenticated
  using (driver_id = (select app.current_driver_id()));

grant select, insert, update, delete on public.driver_breaks to authenticated;

create policy driver_breaks_carrier
  on public.driver_breaks for all to authenticated
  using (
    exists (
      select 1 from public.driver_shifts s
      where s.id = shift_id and (select app.owns_driver(s.driver_id))
    )
  )
  with check (
    exists (
      select 1 from public.driver_shifts s
      where s.id = shift_id and (select app.owns_driver(s.driver_id))
    )
  );

grant select on public.driver_shift_log to authenticated;

create policy driver_shift_log_carrier
  on public.driver_shift_log for select to authenticated
  using ((select app.owns_driver(driver_id)));

-- правила TES: свои и шаблоны; шаблоны пишет оператор
grant select, insert, update, delete on public.tes_rule_sets to authenticated;

create policy tes_rule_sets_select
  on public.tes_rule_sets for select to authenticated
  using (
    company_id is null
    or company_id = (select app.current_company_id())
    or (select app.is_admin())
  );

create policy tes_rule_sets_write_own
  on public.tes_rule_sets for all to authenticated
  using (company_id = (select app.current_company_id()))
  with check (
    company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  );

create policy tes_rule_sets_write_template
  on public.tes_rule_sets for all to authenticated
  using (company_id is null and (select app.is_admin()))
  with check (company_id is null and (select app.is_admin()));

-- модели оплаты: только перевозчик, водителю не показываются
grant select, insert, delete on public.driver_pay_profiles to authenticated;

create policy driver_pay_profiles_carrier
  on public.driver_pay_profiles for all to authenticated
  using ((select app.owns_driver(driver_id)))
  with check ((select app.owns_driver(driver_id)));
