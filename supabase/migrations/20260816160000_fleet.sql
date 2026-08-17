-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 3 · автопарк, документы компании и допуск
--
-- Ключевое решение этой миграции — как соотносятся допуск машины и срок
-- действия документов компании.
--
-- Допуск (vehicles.access) хранит решение оператора об этой машине.
-- Истечение страховки — факт о компании, а не о машине. Если снимать
-- допуск по расписанию, эти два факта смешаются: после продления страховки
-- станет не отличить машину, которую оператор допускал, от той, которую
-- он не допускал никогда.
--
-- Поэтому access не меняется по времени никогда, а право выйти на стол
-- вычисляется: access = APPROVED И документы компании действуют сегодня.
-- Дыра закрывается в момент истечения, а не когда сработает планировщик,
-- и открывается обратно сразу после загрузки продлённого документа.
-- ═══════════════════════════════════════════════════════════════════

-- ── Перечисления ───────────────────────────────────────────────────

create type public.document_kind as enum ('CARRIER_LICENSE', 'INSURANCE');

comment on type public.document_kind is
  'Документы компании-перевозчика: лицензия и страховка (ТЗ §4).';

create type public.euro_class as enum ('EURO_4', 'EURO_5', 'EURO_6');

/* Значения совпадают с ключами t.vehicleAccess в словаре интерфейса. */
create type public.vehicle_access as enum ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');


-- ── Документы компании ─────────────────────────────────────────────

create table public.company_documents (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null references public.companies (id) on delete cascade,
  kind public.document_kind not null,

  /* Путь в бакете company-docs. Первый сегмент — идентификатор компании. */
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,

  /*
   * Срок действия. У страховки он есть всегда — полис годовой, — поэтому
   * там обязателен. У лицензии перевозчика бывает бессрочная форма,
   * поэтому NULL означает «без срока».
   */
  valid_until date,

  /*
   * Текущая версия документа. Старые остаются: по ним оператор принимал
   * решение о допуске, и стирать основание нельзя.
   */
  is_current boolean not null default true,

  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),

  constraint company_documents_insurance_needs_expiry
    check (kind <> 'INSURANCE' or valid_until is not null),

  constraint company_documents_size_positive
    check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),

  constraint company_documents_mime_allowed
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'))
);

comment on table public.company_documents is
  'Лицензия и страховка перевозчика. Старые версии сохраняются как основание прошлых решений.';

/* На каждый вид документа у компании ровно одна текущая версия. */
create unique index company_documents_current_key
  on public.company_documents (company_id, kind)
  where is_current;

create index company_documents_company_idx
  on public.company_documents (company_id, kind, uploaded_at desc);

/*
 * Предыдущая версия перестаёт быть текущей до вставки новой, иначе
 * частичный уникальный индекс отклонил бы загрузку. Отсюда BEFORE, а не
 * AFTER: к моменту проверки индекса старая строка уже должна быть снята.
 */
create or replace function app.supersede_previous_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.company_documents
  set is_current = false
  where company_id = new.company_id
    and kind = new.kind
    and is_current;

  return new;
end;
$$;

create trigger company_documents_supersede
  before insert on public.company_documents
  for each row
  when (new.is_current)
  execute function app.supersede_previous_document();


-- ── Автопарк ───────────────────────────────────────────────────────

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null,

  /*
   * Машины бывают только у перевозчика. Значение фиксировано ограничением,
   * а связь с компанией составная — заказчик с автопарком сломал бы гейт
   * стола заказов, поэтому это факт базы, а не договорённость.
   */
  company_kind public.party_role not null default 'CARRIER',

  plate text not null,
  driver_name text not null,

  /* Языки водителя — мультивыбор из фиксированного набора (ТЗ §4). */
  languages text[] not null default '{}',

  whatsapp text not null,
  axles smallint not null,
  make text not null,
  euro_class public.euro_class not null,
  base_city text not null,

  access public.vehicle_access not null default 'DRAFT',
  rejection_reason text,

  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vehicles_company_is_carrier
    check (company_kind = 'CARRIER'),

  constraint vehicles_company_fk
    foreign key (company_id, company_kind) references public.companies (id, kind),

  constraint vehicles_plate_format
    check (plate = upper(plate) and plate ~ '^[A-Z0-9-]{4,12}$'),

  constraint vehicles_driver_name_length
    check (length(btrim(driver_name)) between 2 and 120),

  /* Международный формат: водителю пишет бот WhatsApp, местная запись не годится. */
  constraint vehicles_whatsapp_format
    check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),

  constraint vehicles_axles_range
    check (axles between 2 and 5),

  constraint vehicles_languages_known
    check (
      array_length(languages, 1) between 1 and 8
      and languages <@ array['FI', 'SV', 'EN', 'RU', 'ET', 'NO', 'DA', 'DE', 'PL', 'LT', 'LV']
    ),

  constraint vehicles_base_city_length
    check (length(btrim(base_city)) between 2 and 80),

  constraint vehicles_rejection_reason_present
    check (access <> 'REJECTED' or nullif(btrim(coalesce(rejection_reason, '')), '') is not null)
);

comment on table public.vehicles is
  'Карточка авто. Рейтинг здесь не хранится: он копится на компанию (ТЗ §2).';

comment on column public.vehicles.access is
  'Решение оператора об этой машине. По времени не меняется — см. app.vehicle_is_dispatchable.';

create index vehicles_company_idx on public.vehicles (company_id, access);

create index vehicles_pending_idx
  on public.vehicles (submitted_at)
  where access = 'PENDING';

/*
 * Один госномер не может быть допущен у двух компаний одновременно — это
 * либо ошибка ввода, либо попытка выдать чужую машину за свою. Черновики
 * и отклонённые карточки номер не занимают: перевозчик вправе завести
 * карточку на машину, которую только собирается оформить.
 */
create unique index vehicles_approved_plate_key
  on public.vehicles (plate)
  where access = 'APPROVED';

create trigger vehicles_touch_updated_at
  before update on public.vehicles
  for each row execute function app.touch_updated_at();

/*
 * Правка существенных полей у допущенной машины возвращает её на проверку.
 *
 * Оператор допускал конкретную связку «машина + водитель + оси + эко-класс».
 * Молчаливая подмена водителя обесценила бы это решение, а запрет правки
 * вовсе сделал бы карточку неживой: водители меняются.
 */
create or replace function app.reset_vehicle_access_on_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.access = 'APPROVED' and (
       new.plate is distinct from old.plate
    or new.driver_name is distinct from old.driver_name
    or new.axles is distinct from old.axles
    or new.euro_class is distinct from old.euro_class
  ) then
    new.access := 'PENDING';
    new.submitted_at := now();
    new.approved_at := null;
  end if;

  return new;
end;
$$;

create trigger vehicles_recheck_on_material_change
  before update on public.vehicles
  for each row execute function app.reset_vehicle_access_on_material_change();


-- ── Журнал допуска ─────────────────────────────────────────────────

create table public.vehicle_events (
  id bigint generated always as identity primary key,

  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,

  from_access public.vehicle_access,
  to_access public.vehicle_access not null,
  note text,

  created_at timestamptz not null default now()
);

comment on table public.vehicle_events is
  'Журнал смен допуска. Пишется триггером, вручную не заполняется.';

create index vehicle_events_vehicle_idx
  on public.vehicle_events (vehicle_id, created_at desc);

create or replace function app.log_vehicle_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := coalesce(
    nullif(current_setting('app.actor_id', true), '')::uuid,
    (select auth.uid())
  );

  if tg_op = 'INSERT' then
    insert into public.vehicle_events (vehicle_id, actor_id, from_access, to_access)
    values (new.id, v_actor, null, new.access);
  elsif new.access is distinct from old.access then
    insert into public.vehicle_events (vehicle_id, actor_id, from_access, to_access, note)
    values (new.id, v_actor, old.access, new.access, new.rejection_reason);
  end if;

  return new;
end;
$$;

create trigger vehicles_log_access_insert
  after insert on public.vehicles
  for each row execute function app.log_vehicle_access_change();

create trigger vehicles_log_access_update
  after update of access on public.vehicles
  for each row execute function app.log_vehicle_access_change();


-- ── Готовность: документы и право выйти на стол ────────────────────

/*
 * Действуют ли документы компании прямо сейчас.
 *
 * NULL в valid_until означает бессрочный документ. Отсутствие любого из
 * двух — не действуют.
 */
create or replace function app.company_documents_ok(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where kind = 'CARRIER_LICENSE') = 1
    and count(*) filter (where kind = 'INSURANCE') = 1
  from public.company_documents
  where company_id = p_company_id
    and is_current
    and (valid_until is null or valid_until >= current_date);
$$;

comment on function app.company_documents_ok(uuid) is
  'Есть ли у компании действующие лицензия и страховка на сегодня.';

/*
 * Может ли машина выйти на стол заказов.
 *
 * Ровно то место, где решение оператора встречается со сроком действия
 * документов. На Этапе 4 это условие станет фильтром стола.
 */
create or replace function app.vehicle_is_dispatchable(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select v.access = 'APPROVED' and app.company_documents_ok(v.company_id)
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
     and exists (
       select 1 from public.vehicles
       where company_id = p_company_id and access = 'APPROVED'
     );
$$;

comment on function app.has_dispatchable_vehicle(uuid) is
  'Гейт стола заказов: есть ли хотя бы одна машина, которая может выйти на рейс (ТЗ §3.5).';

revoke all on function
  app.company_documents_ok(uuid),
  app.vehicle_is_dispatchable(uuid),
  app.has_dispatchable_vehicle(uuid)
from public;

grant execute on function
  app.company_documents_ok(uuid),
  app.vehicle_is_dispatchable(uuid),
  app.has_dispatchable_vehicle(uuid)
to authenticated, service_role;


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.company_documents enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_events enable row level security;

revoke all on public.company_documents from anon, authenticated;
revoke all on public.vehicles from anon, authenticated;
revoke all on public.vehicle_events from anon, authenticated;

grant select, insert on public.company_documents to authenticated;
grant select, insert on public.vehicles to authenticated;
grant select on public.vehicle_events to authenticated;

/*
 * Перевозчик правит описание машины, но не допуск. Как и со статусом
 * компании, запрет держится колоночным грантом, а не политикой: RLS
 * построчный и не отличает смену водителя от выписывания себе допуска.
 */
grant update (
  plate, driver_name, languages, whatsapp, axles, make, euro_class, base_city
) on public.vehicles to authenticated;

/* Черновик можно и удалить — он ещё ничего не значит. */
grant delete on public.vehicles to authenticated;

-- документы компании
create policy company_documents_select_own
  on public.company_documents for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy company_documents_select_admin
  on public.company_documents for select to authenticated
  using ((select app.is_admin()));

create policy company_documents_insert_own
  on public.company_documents for insert to authenticated
  with check (
    company_id = (select app.current_company_id())
    and uploaded_by = (select auth.uid())
  );

/*
 * Политик UPDATE и DELETE нет. Замена документа — загрузка новой версии;
 * стирание основания прошлого решения о допуске недопустимо. Удаление по
 * требованию GDPR выполняется оператором вне обычного пути.
 */

-- машины
create policy vehicles_select_own
  on public.vehicles for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy vehicles_select_admin
  on public.vehicles for select to authenticated
  using ((select app.is_admin()));

create policy vehicles_insert_own
  on public.vehicles for insert to authenticated
  with check (company_id = (select app.current_company_id()));

create policy vehicles_update_own
  on public.vehicles for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy vehicles_delete_draft
  on public.vehicles for delete to authenticated
  using (
    company_id = (select app.current_company_id())
    and access = 'DRAFT'
  );

-- журнал
create policy vehicle_events_select_own
  on public.vehicle_events for select to authenticated
  using (
    exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id
        and v.company_id = (select app.current_company_id())
    )
  );

create policy vehicle_events_select_admin
  on public.vehicle_events for select to authenticated
  using ((select app.is_admin()));


-- ── Отправка на допуск и решение оператора ─────────────────────────

/*
 * Перевозчик отправляет карточку на проверку.
 *
 * Требование действующих документов здесь не формальность: по ТЗ §3.4
 * оператор проверяет документы и машину вместе, и отправлять машину на
 * допуск без лицензии значит гарантированно занять очередь отказом.
 */
create or replace function public.submit_vehicle(p_vehicle_id uuid)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;

  if v_vehicle.id is null then
    raise exception 'Машина не найдена.' using errcode = 'P0002';
  end if;

  if v_vehicle.company_id is distinct from (select app.current_company_id()) then
    raise exception 'Отправить на допуск можно только свою машину.' using errcode = '42501';
  end if;

  if v_vehicle.access = 'PENDING' then
    return v_vehicle;
  end if;

  if v_vehicle.access = 'APPROVED' then
    raise exception 'Машина уже допущена.' using errcode = '55000';
  end if;

  if not app.company_documents_ok(v_vehicle.company_id) then
    raise exception 'Сначала загрузите действующие лицензию и страховку компании.'
      using errcode = '55000';
  end if;

  update public.vehicles
  set access = 'PENDING',
      submitted_at = now(),
      rejection_reason = null
  where id = p_vehicle_id
  returning * into v_vehicle;

  return v_vehicle;
end;
$$;

/*
 * Решение оператора о допуске.
 *
 * Допустить машину при просроченных документах нельзя: допуск означает,
 * что машина может выйти на рейс, а с недействительной страховкой это
 * ответственность оператора платформы.
 */
create or replace function public.decide_vehicle(
  p_vehicle_id uuid,
  p_decision public.vehicle_access,
  p_note text default null
)
returns public.vehicles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
begin
  if not (select app.is_admin()) then
    raise exception 'Допуск выдаёт только администратор.' using errcode = '42501';
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Недопустимое решение: %. Ожидается APPROVED или REJECTED.', p_decision
      using errcode = '22023';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;

  if v_vehicle.id is null then
    raise exception 'Машина не найдена.' using errcode = 'P0002';
  end if;

  if v_vehicle.access <> 'PENDING' then
    raise exception 'Карточка не находится на проверке, текущий статус: %.', v_vehicle.access
      using errcode = '55000';
  end if;

  if p_decision = 'APPROVED' and not app.company_documents_ok(v_vehicle.company_id) then
    raise exception 'Документы компании отсутствуют или просрочены — допуск невозможен.'
      using errcode = '55000';
  end if;

  if p_decision = 'REJECTED' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Отказ требует причины.' using errcode = '22023';
  end if;

  update public.vehicles
  set access = p_decision,
      approved_at = case when p_decision = 'APPROVED' then now() else approved_at end,
      rejected_at = case when p_decision = 'REJECTED' then now() else rejected_at end,
      rejection_reason = case when p_decision = 'REJECTED' then btrim(p_note) else null end
  where id = p_vehicle_id
  returning * into v_vehicle;

  return v_vehicle;
end;
$$;

revoke all on function public.submit_vehicle(uuid) from public, anon;
revoke all on function public.decide_vehicle(uuid, public.vehicle_access, text) from public, anon;

grant execute on function public.submit_vehicle(uuid) to authenticated, service_role;
grant execute on function public.decide_vehicle(uuid, public.vehicle_access, text)
  to authenticated, service_role;
