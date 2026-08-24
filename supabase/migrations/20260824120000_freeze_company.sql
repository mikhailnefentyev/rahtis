-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заморозка компании и журнал действий оператора
--
-- Заморозка вместо удаления. Компания перестаёт входить и брать работу,
-- но её заказы, рейсы, накладные, оценки и суммы остаются нетронутыми:
-- это доказательная база и бухгалтерия, а по kirjanpitolaki хранить её
-- нужно шесть лет.
--
-- Не значение в company_status, а отдельная колонка. Статус означает
-- решение модерации — одобрена, отклонена. Заморозка ортогональна:
-- заморозить можно и ACTIVE, и REJECTED, и разморозить обратно без
-- потери того, чем компания была до этого. Новое значение в перечислении
-- заставило бы переписать каждый разбор статуса и уничтожило бы смысл
-- activated_at.
--
-- Одна жёсткая граница: заморозить компанию с незакрытыми заказами
-- нельзя. Замороженный не может войти, а значит не может отметить точку
-- и закрыть рейс — груз остался бы посреди маршрута без единого
-- человека, способного довести его до конца.
-- ═══════════════════════════════════════════════════════════════════

-- ── Журнал действий оператора ──────────────────────────────────────

/*
 * Отдельно от company_events, и намеренно без внешних ключей.
 *
 * company_events привязан к компании каскадом и умирает вместе с ней —
 * для журнала это дисквалификация: он должен пережить то, о чём в нём
 * написано. Здесь id объекта лежит текстом, а почта оператора копией:
 * учётную запись сотрудника Aivomaa тоже когда-нибудь удалят.
 */
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),

  actor_id uuid,
  actor_email text,

  action text not null,
  subject text not null,
  detail jsonb not null default '{}'::jsonb,

  constraint audit_log_action_length check (length(btrim(action)) between 1 and 80),
  constraint audit_log_detail_object check (jsonb_typeof(detail) = 'object')
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_subject_idx on public.audit_log (subject, at desc);

comment on table public.audit_log is
  'Действия оператора над компаниями и деньгами. Без внешних ключей: переживает удаление объекта.';

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

create policy audit_log_select_admin
  on public.audit_log for select to authenticated
  using ((select app.is_admin()));


create or replace function app.audit(
  p_action text,
  p_subject text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, actor_email, action, subject, detail)
  values (
    (select auth.uid()),
    (select email from auth.users where id = (select auth.uid())),
    p_action,
    p_subject,
    p_detail
  );
$$;

/* Как и app.notify: definer без проверки внутри наружу не отдаётся. */
revoke all on function app.audit(text, text, jsonb) from public, anon, authenticated;


-- ── Заморозка ──────────────────────────────────────────────────────

alter table public.companies
  add column frozen_at timestamptz,
  add column frozen_by uuid references auth.users (id) on delete set null,
  add column freeze_reason text;

comment on column public.companies.frozen_at is
  'Заморожена оператором. Не входит и не берёт работу, данные сохраняются.';

/* Правит только оператор через функции — в колоночный грант не попадает. */

create index companies_active_idx on public.companies (kind, status)
  where frozen_at is null;


/* Открыта ли компания для работы. Одно место, чтобы гейты не разошлись. */
create or replace function app.company_is_open(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies
    where id = p_company_id and frozen_at is null
  );
$$;

revoke all on function app.company_is_open(uuid) from public, anon;
grant execute on function app.company_is_open(uuid) to authenticated, service_role;


-- ── Гейты: замороженный не берёт работу ────────────────────────────

/*
 * Проверка добавляется в оба гейта перевозчика, а не в
 * company_documents_ok. Та функция отвечает на вопрос про документы, и
 * подмешивать в неё заморозку значит соврать в её названии — через год
 * никто не поймёт, почему компания с действующей лицензией «не ок».
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
       select 1 from public.vehicles
       where company_id = p_company_id and access = 'APPROVED'
     );
$$;


-- ── Заморозить и разморозить ───────────────────────────────────────

create or replace function public.freeze_company(p_company_id uuid, p_reason text default null)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_open integer;
begin
  if not (select app.is_admin()) then
    raise exception 'Замораживать компании может только оператор.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id;

  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  if v_company.frozen_at is not null then
    return v_company;
  end if;

  /*
   * Незакрытые заказы считаются с обеих сторон: компания могла быть и
   * заказчиком, и перевозчиком. Считаются все нетерминальные, а не
   * только идущие: заморозив заказчика с висящим на столе заказом, мы
   * оставили бы перевозчикам приманку, взять которую уже нельзя.
   */
  select count(*) into v_open
  from public.orders
  where status in ('DRAFT', 'OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
    and (shipper_company_id = p_company_id or assigned_company_id = p_company_id);

  if v_open > 0 then
    raise exception
      'У компании % незакрытых заказов. Закройте или отмените их, потом замораживайте.', v_open
      using errcode = '55003';
  end if;

  update public.companies
  set frozen_at = now(),
      frozen_by = (select auth.uid()),
      freeze_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_company_id
  returning * into v_company;

  perform app.audit(
    'company.freeze',
    p_company_id::text,
    jsonb_build_object('name', v_company.name, 'reason', v_company.freeze_reason)
  );

  return v_company;
end;
$$;

revoke all on function public.freeze_company(uuid, text) from public, anon;
grant execute on function public.freeze_company(uuid, text) to authenticated, service_role;


create or replace function public.unfreeze_company(p_company_id uuid)
returns public.companies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  if not (select app.is_admin()) then
    raise exception 'Размораживать компании может только оператор.' using errcode = '42501';
  end if;

  update public.companies
  set frozen_at = null, frozen_by = null, freeze_reason = null
  where id = p_company_id
  returning * into v_company;

  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = 'P0002';
  end if;

  perform app.audit('company.unfreeze', p_company_id::text,
    jsonb_build_object('name', v_company.name));

  return v_company;
end;
$$;

revoke all on function public.unfreeze_company(uuid) from public, anon;
grant execute on function public.unfreeze_company(uuid) to authenticated, service_role;


-- ── Публикация заказа ──────────────────────────────────────────────

/*
 * Заморозка заказчика проверяется там же, где статус компании. Отдельной
 * миграции функции create_order не нужно: ниже в этом же файле она не
 * переписывается целиком, поэтому проверка ставится триггером на вставку
 * заказа — так она не разъедется с будущими правками create_order.
 */
create or replace function app.reject_frozen_shipper()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.company_is_open(new.shipper_company_id) then
    raise exception 'Компания заморожена, публиковать заказы нельзя.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger orders_reject_frozen_shipper
  before insert on public.orders
  for each row execute function app.reject_frozen_shipper();
