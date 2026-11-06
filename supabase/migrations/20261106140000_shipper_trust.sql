-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сведения о платёжеспособности заказчика для перевозчика
--
-- Решение пользователя 6.11.2026: в режиме «напрямую с перевозчиком»
-- (desk_contract = CARRIER, прямой заказ contract_party = CARRIER)
-- счёт заказчику выставляет перевозчик, Aivomaa оплату не гарантирует.
-- Перевозчику показываются сигналы о заказчике — о каждом, экспедиторе
-- и грузовладельце. Никакой предоплаты, лимитов и блокировок: только
-- справка, решает перевозчик сам.
--
-- Сигналы (только агрегаты, без чужих строк):
--   · возраст компании — дата регистрации из снимка реестра, иначе «в
--     RAHTIS с» (одобрение или заявка);
--   · состояние в реестре — банкротство, реструктуризация, ликвидация,
--     ALV, ennakkoperintä, вердикт и дата проверки;
--   · платёжная история через Aivomaa — счета по рейсам RAHTIS за 12
--     месяцев: срок — конец полумесячного периода + 15 дней
--     (app.invoice_due), оплачен ли вовремя, на сколько дней позже, что
--     просрочено сейчас;
--   · отметки перевозчиков о прямых рейсах — новая таблица
--     direct_payment_reports: «вовремя / с опозданием / не оплачен».
--     Перевозчикам — счёт по статусам, без имён и номеров рейсов;
--     заказчику — тот же счёт о себе; оператору — всё;
--   · объём — выполненные рейсы за 12 месяцев и первый выполненный.
--
-- Отдача — функциями SECURITY DEFINER: перевозчик чужих строк не
-- получает. Стол перевозчика спрашивает служебным ключом по заказчикам
-- заказов, которые сервер страницы уже отобрал как видимые (как
-- forwarder_policies).
-- ═══════════════════════════════════════════════════════════════════


-- ── Отметки перевозчиков ───────────────────────────────────────────

create table public.direct_payment_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  /* Копия заказчика рейса: агрегат по заказчику без соединения с orders. Пишет триггер. */
  shipper_company_id uuid not null references public.companies (id) on delete cascade,
  status text not null,
  days_late integer,
  note text,
  reported_by uuid references auth.users (id) on delete set null,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /* Оператор снял отметку, оказавшуюся неверной (TERMS): в счёт не идёт, перевозчик не правит. */
  removed_at timestamptz,
  removed_by uuid references auth.users (id) on delete set null,
  removed_note text,

  constraint direct_payment_reports_status_known
    check (status in ('ON_TIME', 'LATE', 'UNPAID')),
  /* Дни — только у «с опозданием», и тогда обязательны. */
  constraint direct_payment_reports_days_late
    check ((status = 'LATE') = (days_late is not null) and (days_late is null or days_late between 1 and 3650)),
  constraint direct_payment_reports_text_lengths
    check (coalesce(length(note), 0) <= 300 and coalesce(length(removed_note), 0) <= 1000)
);

comment on table public.direct_payment_reports is
  'Отметка перевозчика об оплате рейса по прямому договору: вовремя, с опозданием, не оплачен. Справка для других перевозчиков в агрегате.';

create index direct_payment_reports_shipper_idx
  on public.direct_payment_reports (shipper_company_id, reported_at desc)
  where removed_at is null;

create index direct_payment_reports_carrier_idx
  on public.direct_payment_reports (carrier_company_id);

/*
 * Может ли текущий пользователь отметить оплату рейса: перевозчик,
 * которому рейс назначен; рейс выполнен, договор напрямую, заказчик —
 * не свой клиент перевозчика (client_of); с закрытия прошло не больше
 * 180 дней.
 */
create or replace function app.can_report_payment(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select true
    from public.orders o
    join public.companies sh on sh.id = o.shipper_company_id
    where o.id = p_order_id
      and o.status = 'DONE'
      and o.contract_party = 'CARRIER'
      and o.assigned_company_id = (select app.current_company_id())
      and (select app.current_party_role()) = 'CARRIER'
      and sh.client_of is null
      and app.closed_moment(o) <= now()
      and app.closed_moment(o) > now() - interval '180 days'
  ), false);
$$;

revoke all on function app.can_report_payment(uuid) from public, anon;
grant execute on function app.can_report_payment(uuid) to authenticated, service_role;

/*
 * Поля, которых перевозчик не задаёт: чья отметка, о ком, кто и когда.
 * Окно и право проверяет и политика, и триггер — политика не видит
 * подмены колонок, триггер не видит чужих строк.
 */
create or replace function app.direct_payment_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipper uuid;
begin
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if new.status <> 'LATE' then
    new.days_late := null;
  end if;

  if tg_op = 'INSERT' then
    select o.shipper_company_id into v_shipper from public.orders o where o.id = new.order_id;
    new.shipper_company_id := v_shipper;
    new.reported_at := now();
    new.updated_at := now();
    new.removed_at := null;
    new.removed_by := null;
    new.removed_note := null;
    if (select auth.uid()) is not null then
      if not app.can_report_payment(new.order_id) then
        raise exception 'Оплату отмечает перевозчик рейса по прямому договору в течение 180 дней после закрытия.'
          using errcode = '42501';
      end if;
      new.carrier_company_id := (select app.current_company_id());
      new.reported_by := (select auth.uid());
    end if;
    return new;
  end if;

  /* UPDATE: рейс, стороны и время отметки не меняются. */
  new.order_id := old.order_id;
  new.carrier_company_id := old.carrier_company_id;
  new.shipper_company_id := old.shipper_company_id;
  new.reported_at := old.reported_at;

  if (select auth.uid()) is not null and not app.is_admin() then
    if old.removed_at is not null or not app.can_report_payment(old.order_id) then
      raise exception 'Отметку уже нельзя изменить.' using errcode = '42501';
    end if;
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
    new.removed_note := old.removed_note;
    new.reported_by := (select auth.uid());
  end if;

  if (new.status, new.days_late, new.note) is distinct from (old.status, old.days_late, old.note) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function app.direct_payment_reports_guard() from public, anon, authenticated;

create trigger direct_payment_reports_guard
  before insert or update on public.direct_payment_reports
  for each row execute function app.direct_payment_reports_guard();

alter table public.direct_payment_reports enable row level security;
revoke all on public.direct_payment_reports from anon, authenticated;

/* Заказчик строк не видит вовсе — только счёт о себе (company_trust): кто отметил, ему не известно. */
create policy direct_payment_reports_own_read
  on public.direct_payment_reports for select to authenticated
  using (carrier_company_id = (select app.current_company_id()));

create policy direct_payment_reports_own_insert
  on public.direct_payment_reports for insert to authenticated
  with check ((select app.can_report_payment(order_id)));

create policy direct_payment_reports_own_update
  on public.direct_payment_reports for update to authenticated
  using (
    carrier_company_id = (select app.current_company_id())
    and removed_at is null
    and (select app.can_report_payment(order_id))
  )
  with check (carrier_company_id = (select app.current_company_id()));

create policy direct_payment_reports_admin_read
  on public.direct_payment_reports for select to authenticated
  using ((select app.is_admin()));

grant select on public.direct_payment_reports to authenticated;
grant insert (order_id, status, days_late, note) on public.direct_payment_reports to authenticated;
grant update (status, days_late, note) on public.direct_payment_reports to authenticated;
grant all on public.direct_payment_reports to service_role;

/*
 * Рейсы, по которым перевозчик может отметить оплату или уже отметил:
 * для списка выполненных. Окно — 180 дней; старая отметка видна, но не
 * правится.
 */
create or replace function public.payment_report_targets()
returns table (
  order_id uuid,
  editable boolean,
  status text,
  days_late integer,
  note text,
  removed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    app.closed_moment(o) > now() - interval '180 days' and r.removed_at is null,
    r.status,
    r.days_late,
    r.note,
    r.removed_at is not null
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.direct_payment_reports r on r.order_id = o.id
  where o.assigned_company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
    and o.status = 'DONE'
    and o.contract_party = 'CARRIER'
    and sh.client_of is null
    and (app.closed_moment(o) > now() - interval '180 days' or r.id is not null);
$$;

revoke all on function public.payment_report_targets() from public, anon;
grant execute on function public.payment_report_targets() to authenticated, service_role;

/* Оператор снимает отметку, оказавшуюся неверной (или возвращает). Причина обязательна при снятии. */
create or replace function public.moderate_payment_report(p_report_id uuid, p_remove boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not app.is_admin() then
    raise exception 'Отметку снимает оператор.' using errcode = '42501';
  end if;
  if p_remove and v_note is null then
    raise exception 'Укажите причину.' using errcode = '22023';
  end if;

  update public.direct_payment_reports
  set removed_at = case when p_remove then now() end,
      removed_by = case when p_remove then (select auth.uid()) end,
      removed_note = case when p_remove then v_note end
  where id = p_report_id;
end;
$$;

revoke all on function public.moderate_payment_report(uuid, boolean, text) from public, anon;
grant execute on function public.moderate_payment_report(uuid, boolean, text) to authenticated, service_role;


-- ── Сводка о заказчике ─────────────────────────────────────────────

/* Дата из строки снимка реестра: «2010-05-12» или ISO-время; мусор — NULL. */
create or replace function app.jsonb_date(p_value jsonb)
returns date
language sql
immutable
as $$
  select case
    when jsonb_typeof(p_value) = 'string' and (p_value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
      then left(p_value #>> '{}', 10)::date
  end;
$$;

create or replace function app.jsonb_bool(p_value jsonb)
returns boolean
language sql
immutable
as $$
  select case when jsonb_typeof(p_value) = 'boolean' then (p_value #>> '{}')::boolean end;
$$;

/*
 * Одна строка сигналов по заказчику. Только агрегаты: ни номеров
 * рейсов, ни имён перевозчиков. Окно — 12 месяцев по моменту закрытия
 * рейса (отметки — по времени отметки).
 */
create or replace function app.shipper_trust_of(p_company_id uuid)
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select co.*, coalesce(co.registry_check, '{}'::jsonb) as rc
    from public.companies co
    where co.id = p_company_id
  ),
  inv as (
    select
      o.billing,
      (o.paid_at at time zone 'Europe/Helsinki')::date as paid_on,
      app.invoice_due(app.payout_period_start(app.closed_moment(o))) as due
    from public.orders o
    where o.shipper_company_id = p_company_id
      and o.status = 'DONE'
      and o.contract_party = 'RAHTIS'
      and app.closed_moment(o) > now() - interval '12 months'
      and (o.invoiced_at is not null or o.billing <> 'PENDING')
  ),
  pay as (
    select
      count(*)::integer as invoiced,
      /* Оплачен без даты оплаты (старые отметки) — нарушения не видно, считается вовремя. */
      count(*) filter (where paid_on <= due or (paid_on is null and billing in ('PAID', 'SETTLED')))::integer as on_time,
      count(*) filter (where paid_on > due)::integer as late,
      round(avg(paid_on - due) filter (where paid_on > due))::integer as avg_late,
      count(*) filter (
        where paid_on is null and billing = 'INVOICED'
          and (now() at time zone 'Europe/Helsinki')::date > due
      )::integer as overdue
    from inv
  ),
  rep as (
    select
      count(*) filter (where r.status = 'ON_TIME')::integer as on_time,
      count(*) filter (where r.status = 'LATE')::integer as late,
      count(*) filter (where r.status = 'UNPAID')::integer as unpaid
    from public.direct_payment_reports r
    where r.shipper_company_id = p_company_id
      and r.removed_at is null
      and r.reported_at > now() - interval '12 months'
  ),
  vol as (
    select
      count(*) filter (where app.closed_moment(o) > now() - interval '12 months')::integer as done_12m,
      (min(app.closed_moment(o)) at time zone 'Europe/Helsinki')::date as first_done
    from public.orders o
    where o.shipper_company_id = p_company_id and o.status = 'DONE'
  )
  select
    c.id,
    c.country::text,
    app.jsonb_date(c.rc -> 'registeredOn'),
    (coalesce(c.approved_at, c.created_at) at time zone 'Europe/Helsinki')::date,
    c.rc ->> 'verdict',
    case when jsonb_typeof(c.rc -> 'situations') = 'array'
      then array(select jsonb_array_elements_text(c.rc -> 'situations'))
      else '{}'::text[]
    end,
    app.jsonb_bool(c.rc -> 'vat'),
    app.jsonb_bool(c.rc -> 'prepayment'),
    app.jsonb_date(c.rc -> 'checkedAt'),
    pay.invoiced,
    pay.on_time,
    pay.late,
    pay.avg_late,
    pay.overdue,
    rep.on_time,
    rep.late,
    rep.unpaid,
    vol.done_12m,
    vol.first_done
  from c, pay, rep, vol;
$$;

revoke all on function app.shipper_trust_of(uuid) from public, anon, authenticated;
grant execute on function app.shipper_trust_of(uuid) to service_role;

/*
 * Для стола перевозчика: сводки по заказчикам. Только служебным ключом —
 * сервер страницы сам отбирает видимые перевозчику заказы (desk_orders,
 * my_assignments) и спрашивает по их заказчикам; свои клиенты
 * перевозчика (client_of) сюда не попадают.
 */
create or replace function public.shipper_trust(p_company_ids uuid[])
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.*
  from public.companies c
  cross join lateral app.shipper_trust_of(c.id) t
  where c.id = any (p_company_ids) and c.kind = 'SHIPPER' and c.client_of is null;
$$;

revoke all on function public.shipper_trust(uuid[]) from public, anon, authenticated;
grant execute on function public.shipper_trust(uuid[]) to service_role;

/*
 * Та же сводка о своей компании — заказчику («что видят о вас
 * перевозчики»), о любой — оператору.
 */
create or replace function public.company_trust(p_company_id uuid default null)
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date
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
  select t.*
  from public.companies c
  cross join lateral app.shipper_trust_of(c.id) t
  where c.id = v_company and c.kind = 'SHIPPER';
end;
$$;

revoke all on function public.company_trust(uuid) from public, anon;
grant execute on function public.company_trust(uuid) to authenticated, service_role;


-- ── Свежесть снимка реестра ────────────────────────────────────────

/*
 * Кого перепроверить в реестре: заказчики, у которых за 90 дней был
 * заказ на столе «напрямую» или прямой заказ, а снимку больше недели.
 * Сначала самые старые снимки. Запрос шлёт сервер (ежедневный запуск
 * напоминаний), по одному и понемногу — у PRH ограничение частоты.
 */
create or replace function public.trust_registry_due(p_limit integer default 15)
returns table (
  id uuid,
  name text,
  business_id text,
  country text,
  vat_number text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.business_id, c.country::text, c.vat_number
  from public.companies c
  where c.kind = 'SHIPPER'
    and c.client_of is null
    and c.status = 'ACTIVE'
    and not c.is_test
    and c.business_id is not null
    and coalesce(app.jsonb_date(c.registry_check -> 'checkedAt'), date '2000-01-01')
        < (now() at time zone 'Europe/Helsinki')::date - 7
    and exists (
      select 1 from public.orders o
      where o.shipper_company_id = c.id
        and (
          (o.desk_contract = 'CARRIER' and o.published_at > now() - interval '90 days')
          or (o.contract_party = 'CARRIER' and o.created_at > now() - interval '90 days')
        )
    )
  order by app.jsonb_date(c.registry_check -> 'checkedAt') nulls first
  limit greatest(1, least(coalesce(p_limit, 15), 50));
$$;

revoke all on function public.trust_registry_due(integer) from public, anon, authenticated;
grant execute on function public.trust_registry_due(integer) to service_role;
