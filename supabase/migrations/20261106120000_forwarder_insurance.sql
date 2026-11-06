-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · полис экспедитора для режима «напрямую с перевозчиком»
--
-- Решение пользователя 6.11.2026 (исследование —
-- docs/forwarders/research-insurance.md):
--
--   · экспедитор без парка регистрируется заказчиком (SHIPPER). Полис
--     ответственности экспедитора нужен ему ТОЛЬКО для договора напрямую
--     с перевозчиком: стол с desk_contract = CARRIER и прямой заказ
--     машине подписчика (contract_party = CARRIER). Работа через Aivomaa
--     (desk_contract = RAHTIS) полиса не требует;
--   · минимум: 250 000 € на страховой случай и 500 000 € в год; полис в
--     другой валюте сравнивается по курсу ЕЦБ на сегодня (app.fx_convert);
--   · грузовладелец (возит свой товар) — не экспедитор, полис ему не
--     нужен: companies.shipper_role = CARGO_OWNER. Прежние заказчики —
--     FORWARDER;
--   · польскому экспедитору для прямого режима нужна ещё лицензия на
--     посредничество (FORWARDER_LICENSE);
--   · отсрочка: у компаний, одобренных до 7.11.2026, требование действует
--     с 7.12.2026; у новых — сразу.
--
-- Документы — те же company_documents, бакет company-docs и загрузка,
-- что у лицензии и страховки перевозчика. Новое — поля полиса и решение
-- оператора: допуск машины перевозчика проверяет оператор вместе с
-- документами, а у экспедитора машин нет, проверять нечего, кроме
-- самого полиса.
--
-- Истечение ничего не пишет по расписанию: функция допуска сравнивает
-- даты сама (как app.company_documents_ok). Заказы, уже стоящие на
-- столе, не трогаются; закрываются только новые публикации.
-- ═══════════════════════════════════════════════════════════════════


-- ── Роль заказчика ─────────────────────────────────────────────────

create type public.shipper_role as enum ('FORWARDER', 'CARGO_OWNER');

/*
 * NOT NULL с умолчанием: у перевозчика колонка ничего не значит, но
 * пустое значение у заказчика означало бы третий, никем не описанный
 * случай. Прежние заказчики — экспедиторы (решение 6.11.2026).
 */
alter table public.companies
  add column shipper_role public.shipper_role not null default 'FORWARDER';

comment on column public.companies.shipper_role is
  'Кто заказчик: экспедитор (FORWARDER — для прямого договора нужен полис) или грузовладелец (CARGO_OWNER — полис не нужен). У перевозчика не используется.';

/* Правит владелец компании на /account; диспетчеру — отказ триггером ниже. */
grant update (shipper_role) on public.companies to authenticated;

/*
 * Роль — заявление компании, от него зависит допуск к прямому режиму.
 * Меняет её владелец, не диспетчер: колоночный грант не различает людей
 * внутри компании, поэтому проверка здесь.
 */
create or replace function app.shipper_role_owner_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shipper_role is distinct from old.shipper_role
     and (select auth.uid()) is not null
     and not app.is_admin()
     and exists (
       select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.member_kind = 'DISPATCHER'
     ) then
    raise exception 'Роль компании меняет её владелец.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.shipper_role_owner_only() from public, anon, authenticated;

create trigger companies_shipper_role_owner_only
  before update of shipper_role on public.companies
  for each row execute function app.shipper_role_owner_only();


-- ── Поля полиса ────────────────────────────────────────────────────

alter table public.company_documents
  add column insurer text,
  add column policy_number text,
  /* Суммы в центах валюты полиса; bigint — 500 000 € это 5·10⁷ центов, в кронах больше. */
  add column limit_event_cents bigint,
  add column limit_year_cents bigint,
  add column limit_currency public.currency_code,
  add column cmr_covered boolean,
  add column territory text,
  add column terms text,
  /* Решение оператора. У документов перевозчика не используется. */
  add column review_status text not null default 'PENDING',
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text,

  add constraint company_documents_terms_known
    check (terms is null or terms in ('NSAB2015', 'ADSP2017', 'PSYM', 'OTHER')),
  add constraint company_documents_review_status_known
    check (review_status in ('PENDING', 'APPROVED', 'REJECTED')),
  add constraint company_documents_limits_positive
    check ((limit_event_cents is null or limit_event_cents > 0) and (limit_year_cents is null or limit_year_cents > 0)),
  add constraint company_documents_text_lengths
    check (
      coalesce(length(insurer), 0) <= 200 and coalesce(length(policy_number), 0) <= 100
      and coalesce(length(territory), 0) <= 300 and coalesce(length(review_note), 0) <= 1000
    ),
  /* Полис экспедитора — как страховка перевозчика: без даты окончания не принимается. */
  add constraint company_documents_forwarder_insurance_needs_expiry
    check (kind <> 'FORWARDER_INSURANCE' or valid_until is not null),
  /* Без страховщика, номера и лимитов оператору нечего сверять. */
  add constraint company_documents_forwarder_insurance_fields
    check (
      kind <> 'FORWARDER_INSURANCE'
      or (insurer is not null and policy_number is not null
          and limit_event_cents is not null and limit_year_cents is not null
          and limit_currency is not null)
    );

comment on column public.company_documents.review_status is
  'Решение оператора по документу экспедитора (FORWARDER_*): PENDING, APPROVED, REJECTED. У документов перевозчика не используется.';

/*
 * Права: на company_documents у authenticated табличный грант select и
 * insert (20260816160000_fleet), поэтому новые колонки читаются и
 * пишутся без отдельного гранта. Решение оператора компания себе не
 * выпишет: при вставке поля решения сбрасывает триггер, а UPDATE у
 * компании нет вовсе.
 */
create or replace function app.company_document_review_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.is_admin() then
    new.review_status := 'PENDING';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
  end if;
  return new;
end;
$$;

revoke all on function app.company_document_review_defaults() from public, anon, authenticated;

create trigger company_documents_review_defaults
  before insert on public.company_documents
  for each row execute function app.company_document_review_defaults();

create index company_documents_review_idx
  on public.company_documents (uploaded_at)
  where review_status = 'PENDING' and kind in ('FORWARDER_INSURANCE', 'FORWARDER_LICENSE');


-- ── Пороги и отсрочка ──────────────────────────────────────────────

create or replace function app.forwarder_min_event_cents()
returns bigint
language sql
immutable
as $$ select 25000000::bigint; $$;

create or replace function app.forwarder_min_year_cents()
returns bigint
language sql
immutable
as $$ select 50000000::bigint; $$;

comment on function app.forwarder_min_event_cents() is
  'Минимум полиса экспедитора на страховой случай: 250 000 € (решение 6.11.2026).';
comment on function app.forwarder_min_year_cents() is
  'Минимум полиса экспедитора в год: 500 000 € (решение 6.11.2026).';

/*
 * Отсрочка: одобренным до 7.11.2026 требование — с 7.12.2026. NULL —
 * отсрочки нет. Граница суток — по Хельсинки, как у остальных дат кабинета.
 */
create or replace function app.forwarder_grace_until(p_company_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.approved_at is not null
         and (c.approved_at at time zone 'Europe/Helsinki')::date < date '2026-11-07'
      then date '2026-12-07'
  end
  from public.companies c
  where c.id = p_company_id;
$$;


-- ── Действует ли полис и лицензия ──────────────────────────────────

/*
 * Решает последний РАССМОТРЕННЫЙ документ вида, а не текущая версия:
 *   · продление, загруженное за месяц до конца, ждёт проверки — прежний
 *     одобренный полис работает до своей даты, прямой режим не гаснет;
 *   · оператор отклонил последний (полис отозван, подделка) — режим
 *     закрыт, и более ранний одобренный не оживает.
 */
create or replace function app.forwarder_policy_until(p_company_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when d.review_status = 'APPROVED'
         and d.valid_until >= current_date
         and coalesce(app.fx_convert(d.limit_event_cents, d.limit_currency::text, 'EUR', current_date), 0)
             >= app.forwarder_min_event_cents()
         and coalesce(app.fx_convert(d.limit_year_cents, d.limit_currency::text, 'EUR', current_date), 0)
             >= app.forwarder_min_year_cents()
      then d.valid_until
  end
  from public.company_documents d
  where d.company_id = p_company_id
    and d.kind = 'FORWARDER_INSURANCE'
    and d.review_status <> 'PENDING'
  order by d.uploaded_at desc
  limit 1;
$$;

comment on function app.forwarder_policy_until(uuid) is
  'До какой даты действует проверенный полис экспедитора с лимитами не ниже порога. NULL — не действует.';

create or replace function app.forwarder_license_ok(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select d.review_status = 'APPROVED'
       and (d.valid_until is null or d.valid_until >= current_date)
    from public.company_documents d
    where d.company_id = p_company_id
      and d.kind = 'FORWARDER_LICENSE'
      and d.review_status <> 'PENDING'
    order by d.uploaded_at desc
    limit 1
  ), false);
$$;

/*
 * Может ли заказчик заключать договор напрямую с перевозчиком.
 *
 * Не заказчик и клиент перевозчика (свои рейсы, client_of) — правило не
 * про них. Грузовладелец — полис не нужен. В отсрочке — можно.
 */
create or replace function app.forwarder_direct_allowed(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case
      when c.kind <> 'SHIPPER' or c.client_of is not null then true
      when c.shipper_role = 'CARGO_OWNER' then true
      when current_date < coalesce(app.forwarder_grace_until(c.id), current_date) then true
      else app.forwarder_policy_until(c.id) is not null
           and (c.country is distinct from 'PL' or app.forwarder_license_ok(c.id))
    end
    from public.companies c
    where c.id = p_company_id
  ), false);
$$;

comment on function app.forwarder_direct_allowed(uuid) is
  'Допуск заказчика к договору напрямую с перевозчиком: грузовладелец, отсрочка или проверенный полис экспедитора (+ лицензия в Польше).';

revoke all on function
  app.forwarder_grace_until(uuid),
  app.forwarder_policy_until(uuid),
  app.forwarder_license_ok(uuid),
  app.forwarder_direct_allowed(uuid)
from public, anon;

grant execute on function
  app.forwarder_grace_until(uuid),
  app.forwarder_policy_until(uuid),
  app.forwarder_license_ok(uuid),
  app.forwarder_direct_allowed(uuid)
to authenticated, service_role;


-- ── Состояние для кабинета ─────────────────────────────────────────

/*
 * Одна строка для формы заказа, баннера и /account: по ней интерфейс
 * объясняет, почему прямой режим закрыт, а не даёт публикации упасть.
 * Своя компания — любому её пользователю; чужая — только оператору.
 */
create or replace function public.forwarder_status(p_company_id uuid default null)
returns table (
  shipper_role public.shipper_role,
  applies boolean,
  allowed boolean,
  grace_until date,
  in_grace boolean,
  policy_until date,
  needs_license boolean,
  license_ok boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := coalesce(p_company_id, (select app.current_company_id()));
begin
  if v_company is null then
    return;
  end if;

  if v_company is distinct from (select app.current_company_id()) and not app.is_admin() then
    raise exception 'Нет доступа к этой компании.' using errcode = '42501';
  end if;

  return query
  select
    c.shipper_role,
    c.kind = 'SHIPPER' and c.client_of is null and c.shipper_role = 'FORWARDER',
    app.forwarder_direct_allowed(c.id),
    app.forwarder_grace_until(c.id),
    current_date < coalesce(app.forwarder_grace_until(c.id), current_date),
    app.forwarder_policy_until(c.id),
    c.country = 'PL',
    app.forwarder_license_ok(c.id)
  from public.companies c
  where c.id = v_company;
end;
$$;

revoke all on function public.forwarder_status(uuid) from public, anon;
grant execute on function public.forwarder_status(uuid) to authenticated, service_role;

/*
 * Для стола перевозчика: «полис экспедитора проверен до …». Только
 * служебным ключом: сервер страницы сам решает, какие заказы перевозчику
 * видны, и спрашивает по их заказчикам.
 */
create or replace function public.forwarder_policies(p_company_ids uuid[])
returns table (company_id uuid, cargo_owner boolean, policy_until date)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.shipper_role = 'CARGO_OWNER', app.forwarder_policy_until(c.id)
  from public.companies c
  where c.id = any (p_company_ids) and c.kind = 'SHIPPER' and c.client_of is null;
$$;

revoke all on function public.forwarder_policies(uuid[]) from public, anon, authenticated;
grant execute on function public.forwarder_policies(uuid[]) to service_role;


-- ── Решение оператора ──────────────────────────────────────────────

/*
 * Одобрить или отклонить документ экспедитора. Отклонить можно и
 * одобренный прежде (полис отозван, страховщик не подтвердил) — так
 * оператор приостанавливает прямой режим. Отказ — только с причиной:
 * её читает экспедитор.
 */
create or replace function public.review_company_document(
  p_document_id uuid,
  p_decision text,
  p_note text default null
)
returns public.company_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.company_documents;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not app.is_admin() then
    raise exception 'Решение по документу принимает оператор.' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Неизвестное решение: %.', p_decision using errcode = '22023';
  end if;

  if p_decision = 'REJECTED' and v_note is null then
    raise exception 'Причина отказа обязательна.' using errcode = '22023';
  end if;

  update public.company_documents
  set review_status = p_decision,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = left(v_note, 1000)
  where id = p_document_id
    and kind in ('FORWARDER_INSURANCE', 'FORWARDER_LICENSE')
  returning * into v_doc;

  if v_doc.id is null then
    raise exception 'Документ не найден.' using errcode = 'P0002';
  end if;

  return v_doc;
end;
$$;

revoke all on function public.review_company_document(uuid, text, text) from public, anon;
grant execute on function public.review_company_document(uuid, text, text) to authenticated;


-- ── Запрет в базе ──────────────────────────────────────────────────

/*
 * Договор напрямую без допуска не возникает.
 *
 * Проверяются только новые шаги заказчика:
 *   · публикация на стол (вставка в OPEN или переход DRAFT/CANCELLED →
 *     OPEN, или смена договора стола на CARRIER) с desk_contract =
 *     CARRIER или с группой, где есть машина подписчика: первая из них
 *     возьмёт рейс по своему договору (app.contract_party_of);
 *   · прямое назначение машине подписчика (новый отклик DIRECT, сторона
 *     договора CARRIER). Взятие из группы не проверяется — группа
 *     проверена при публикации, и отказ достался бы перевозчику.
 * Возвраты на стол (отказ, истёкший срок), подтверждения и рейсы, уже
 * идущие или стоящие на столе, не проверяются: полис истёк — новые
 * закрыты, начатое доезжает.
 *
 * Имя с «zz»: BEFORE-триггеры идут по алфавиту, и проверка должна видеть
 * сторону договора, которую проставил orders_stamp_contract_party, и
 * статус после orders_own_never_open.
 */
create or replace function app.forwarder_direct_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publishing boolean;
  v_carrier_contract boolean;
  v_assigning boolean := false;
begin
  if app.is_carrier_client(new.shipper_company_id) then
    return new;
  end if;

  v_publishing := new.status = 'OPEN'
    and (
      tg_op = 'INSERT'
      or old.status in ('DRAFT', 'CANCELLED')
      or (old.status = 'OPEN' and new.desk_contract = 'CARRIER' and old.desk_contract is distinct from 'CARRIER')
    );

  v_carrier_contract := false;
  if v_publishing then
    v_carrier_contract := new.desk_contract = 'CARRIER'
      or (
        new.group_vehicle_ids is not null
        and exists (
          select 1
          from public.vehicles v
          join public.companies c on c.id = v.company_id
          where v.id = any (new.group_vehicle_ids) and c.partnership = 'SUBSCRIBER'
        )
      );
  end if;

  if tg_op = 'UPDATE'
     and new.contract_party = 'CARRIER'
     and new.assigned_company_id is not null
     and new.chosen_offer_id is distinct from old.chosen_offer_id
     /*
      * Прямое назначение отличаем от взятия из группы по автору отклика:
      * из группы отклик создаёт сам перевозчик (публикацию группы уже
      * проверили), прямое назначение — заказчик или оператор. Признак
      * «есть группа» не годится: заказчик может назначить машину и у
      * заказа с группой.
      */
     and exists (
       select 1 from public.order_offers f
       where f.id = new.chosen_offer_id and f.origin = 'DIRECT'
         and not exists (
           select 1 from public.profiles p
           where p.id = f.created_by and p.company_id = f.carrier_company_id
         )
     ) then
    v_assigning := true;
  end if;

  if ((v_publishing and v_carrier_contract) or v_assigning)
     and not app.forwarder_direct_allowed(new.shipper_company_id) then
    raise exception 'Договор напрямую с перевозчиком недоступен: нужен действующий полис ответственности экспедитора, проверенный RAHTIS.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function app.forwarder_direct_guard() from public, anon, authenticated;

create trigger orders_zz_forwarder_guard
  before insert or update of status, desk_contract, assigned_company_id, chosen_offer_id, contract_party, group_vehicle_ids
  on public.orders
  for each row execute function app.forwarder_direct_guard();


-- ── Журнал напоминаний ─────────────────────────────────────────────

/*
 * Напоминания за 30 и за 7 дней до конца полиса. Ключ — компания, дата
 * окончания и порог: продлили полис — новая дата, и всё начнётся заново.
 */
create table public.forwarder_reminders (
  company_id uuid not null references public.companies (id) on delete cascade,
  valid_until date not null,
  stage smallint not null check (stage in (30, 7)),
  sent_at timestamptz not null default now(),
  primary key (company_id, valid_until, stage)
);

alter table public.forwarder_reminders enable row level security;
revoke all on public.forwarder_reminders from anon, authenticated;
/* Пишет и читает только сервер служебным ключом. */
