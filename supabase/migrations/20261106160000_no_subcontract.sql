-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · без подряда: Aivomaa больше не сторона договора перевозки
--
-- Решение пользователя 6.11.2026: «Убрать Aivomaa как сторону договора —
-- убрать режим подряда. Для перевозчиков RAHTIS — управление парком, для
-- экспедиторов — поиск перевозчиков и продажа грузов. Новых сборов нет:
-- входим в рынок, пересмотрим через год».
--
--   · каждый новый заказ — стол, прямой, группа, свой рейс, API — договор
--     напрямую заказчика с перевозчиком (desk_contract и contract_party =
--     CARRIER), 0 % с обеих сторон, минимума 15 € нет;
--   · история не трогается: закрытые рейсы, счета, отчёты и претензии
--     RAHTIS-рейсов остаются как были. Рейсы, уже идущие по договору
--     Aivomaa, и заказы, опубликованные на стол с выбором «Aivomaa
--     отвечает» до этой миграции, доезжают на прежних условиях (с теми
--     же процентами при закрытии — app.freeze_order_fees не меняется:
--     плата только у contract_party = RAHTIS, а новых таких нет);
--   · у перевозчика остаётся одна ветка — подписка: первая активная
--     машина бесплатно, каждая следующая 14,90 € в месяц. Подрядчики
--     переводятся на подписку; им сбор начисляется с 1.1.2027
--     (companies.subscription_fees_from) — поверх правила «первый месяц
--     бесплатно»;
--   · полис экспедитора — отметка для перевозчика, а не допуск: запрет в
--     базе (orders_zz_forwarder_guard) снят, отсрочки больше нет.
--
-- Счета Aivomaa за полмесяца, выплаты, ожидание и претензии к Aivomaa
-- выбирают только contract_party = RAHTIS — новых строк у них не будет,
-- код и таблицы остаются ради истории.
-- ═══════════════════════════════════════════════════════════════════


-- ── Перевозчик: только подписка ────────────────────────────────────

alter table public.companies
  add column subscription_fees_from date;

comment on column public.companies.subscription_fees_from is
  'С какого месяца начисляется подписка. Задано у перевозчиков, переведённых с подряда 6.11.2026 (1.1.2027); NULL — по общему правилу (первый месяц бесплатно).';

grant select (subscription_fees_from) on public.companies to authenticated;

/* Подрядчики (и старые NULL — тоже подряд) — на подписку, сбор с 2027 года. */
update public.companies
set partnership = 'SUBSCRIBER',
    subscription_fees_from = date '2027-01-01'
where kind = 'CARRIER'
  and partnership is distinct from 'SUBSCRIBER';

/* Заявок на смену ветки больше не бывает. */
update public.companies
set pending_partnership = null,
    pending_partnership_from = null
where pending_partnership is not null;

/*
 * Новый перевозчик — сразу подписчик, что бы ни прислала форма или
 * старая вкладка. Тип partnership_mode остаётся: на нём история заявок
 * и журнал.
 */
create or replace function app.carrier_is_subscriber()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'CARRIER' then
    new.partnership := 'SUBSCRIBER';
  else
    new.partnership := null;
  end if;
  new.pending_partnership := null;
  new.pending_partnership_from := null;
  return new;
end;
$$;

revoke all on function app.carrier_is_subscriber() from public, anon, authenticated;

create trigger companies_carrier_is_subscriber
  before insert or update of kind, partnership, pending_partnership on public.companies
  for each row execute function app.carrier_is_subscriber();

alter table public.companies
  add constraint companies_carrier_subscriber
    check ((kind <> 'CARRIER' or partnership = 'SUBSCRIBER') and pending_partnership is null);

comment on column public.companies.partnership is
  'Ветка перевозчика. С 6.11.2026 всегда SUBSCRIBER: подряда нет (20261106160000_no_subcontract).';

/* Сам перевозчик ветку больше не выбирает. */
create or replace function public.set_own_partnership(p_mode public.partnership_mode)
returns date
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_mode is distinct from 'SUBSCRIBER' then
    raise exception 'Подряда больше нет: платформа работает только по подписке.' using errcode = '22023';
  end if;
  return null;
end;
$$;

comment on function public.set_own_partnership(public.partnership_mode) is
  'Оставлена для старых вкладок: с 6.11.2026 ветка одна — подписка.';

create or replace function public.set_company_partnership(
  p_company_id uuid,
  p_mode public.partnership_mode
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Ветку перевозчика меняет только оператор.' using errcode = '42501';
  end if;

  if p_mode is distinct from 'SUBSCRIBER' then
    raise exception 'Подряда больше нет: платформа работает только по подписке.' using errcode = '22023';
  end if;
end;
$$;

/* Ночное включение заявок больше не нужно. */
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'rahtis-apply-partnership';


-- ── Заказ: всегда напрямую ─────────────────────────────────────────

alter table public.orders alter column desk_contract set default 'CARRIER';
alter table public.orders alter column contract_party set default 'CARRIER';

comment on column public.orders.desk_contract is
  'Договор стола. С 6.11.2026 всегда CARRIER — напрямую заказчика с перевозчиком; RAHTIS (Aivomaa — сторона договора) только у заказов, опубликованных раньше.';

/*
 * Новая публикация — только напрямую. Вставка, публикация черновика и
 * повторная публикация снятого заказа получают CARRIER; возврат на стол
 * (отказ, истёкший срок) договор не меняет — заказ, опубликованный с
 * «Aivomaa отвечает», доезжает на своих условиях. Назад в RAHTIS — нельзя.
 *
 * Имя с «aa»: BEFORE-триггеры идут по алфавиту, и договор стола должен
 * быть выставлен раньше стороны договора (orders_stamp_contract_party)
 * и проверки валюты (orders_zz_currency_guard).
 */
create or replace function app.order_direct_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.desk_contract := 'CARRIER';
  elsif new.desk_contract = 'RAHTIS'
        and (old.desk_contract is distinct from 'RAHTIS'
             or (new.status = 'OPEN' and old.status in ('DRAFT', 'CANCELLED'))) then
    new.desk_contract := 'CARRIER';
  end if;
  return new;
end;
$$;

revoke all on function app.order_direct_contract() from public, anon, authenticated;

create trigger orders_aa_direct_contract
  before insert or update of status, desk_contract on public.orders
  for each row execute function app.order_direct_contract();

/*
 * Сторона договора: RAHTIS — только отклик со стола на заказ, который
 * опубликовали с «Aivomaa отвечает» до 6.11.2026. Всё остальное, кем бы
 * ни был перевозчик, — договор напрямую.
 */
create or replace function app.contract_party_of(p_carrier uuid, p_offer uuid)
returns public.contract_party
language sql
stable
set search_path = ''
as $$
  select case
    when p_carrier is not null and exists (
      select 1
      from public.order_offers f
      join public.orders o on o.id = f.order_id
      join public.companies s on s.id = o.shipper_company_id
      where f.id = p_offer
        and f.origin = 'DESK'
        and o.desk_contract = 'RAHTIS'
        and s.client_of is null
    ) then 'RAHTIS'::public.contract_party
    else 'CARRIER'::public.contract_party
  end;
$$;

comment on function app.contract_party_of(uuid, uuid) is
  'Чей договор с заказчиком: с 6.11.2026 всегда напрямую (CARRIER); RAHTIS — только стол-заказ, опубликованный с «Aivomaa отвечает» раньше.';

/* Без назначения сторона договора — та, что выбрана для стола. */
create or replace function app.stamp_contract_party()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.chosen_offer_id is null
     and old.chosen_offer_id is not null
     and new.assigned_company_id is not null
     and new.assigned_company_id is not distinct from old.assigned_company_id then
    return new;
  end if;

  if new.assigned_company_id is null then
    new.contract_party := new.desk_contract;
    return new;
  end if;

  new.contract_party := app.contract_party_of(new.assigned_company_id, new.chosen_offer_id);
  return new;
end;
$$;

/*
 * Стол открыт всем допущенным перевозчикам: подписка у всех, и её
 * состояние никого не отсекает. Допуск (машина, документы, заморозка,
 * статус компании) проверяют, как и раньше, has_dispatchable_vehicle и
 * вызывающие функции.
 */
create or replace function app.desk_contract_allows(p_contract public.contract_party, p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select true
$$;

revoke all on function app.desk_contract_allows(public.contract_party, uuid) from public, anon, authenticated;

/* Свои рейсы — у всех перевозчиков: подписка есть у каждого. */
create or replace function app.own_orders_allowed(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company_id and c.kind = 'CARRIER'
  );
$$;


-- ── Полис экспедитора: отметка, а не допуск ────────────────────────

drop trigger if exists orders_zz_forwarder_guard on public.orders;
drop function if exists app.forwarder_direct_guard();

/* Отсрочки больше нет: нечего откладывать. */
create or replace function app.forwarder_grace_until(p_company_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select null::date;
$$;

comment on function app.forwarder_direct_allowed(uuid) is
  'Справка: у экспедитора проверенный полис (+ лицензия в Польше), либо полис не нужен. С 6.11.2026 ни к чему не допускает — перевозчик видит отметку.';


-- ── Подписка: начало начислений ────────────────────────────────────

create or replace function public.issue_monthly_subscriptions(p_month date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month' - interval '1 day')::date;
  v_count integer;
begin
  insert into public.carrier_subscription_fees (
    carrier_company_id, month, kind, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  )
  select
    x.company_id, v_month, 'MONTH', x.billed,
    round(x.net::numeric / x.billed)::integer,
    x.net,
    x.vat_bps,
    x.net + round(x.net * x.vat_bps / 10000.0)::integer
  from (
    select
      a.company_id,
      /* Первая машина бесплатна и считается внутри года, если он есть. */
      a.vehicles - greatest(least(a.vehicles, coalesce(p.vehicles, 0)), 1) as billed,
      app.subscription_ladder_cents(a.vehicles) - app.subscription_ladder_cents(least(a.vehicles, coalesce(p.vehicles, 0))) as net,
      case when c.country = 'FI' then 2550 else 0 end as vat_bps
    from (
      select o.assigned_company_id as company_id, count(distinct o.assigned_vehicle_id)::integer as vehicles
      from public.orders o
      where o.status = 'DONE'
        and o.assigned_vehicle_id is not null
        and (app.closed_moment(o) at time zone 'Europe/Helsinki')::date between v_month and v_end
      group by o.assigned_company_id
    ) a
    join public.companies c on c.id = a.company_id
    left join public.carrier_annual_plans p
      on p.company_id = a.company_id and p.cancelled_at is null and p.starts_on <= v_month and p.ends_on >= v_end
    where not c.is_test
      and c.partnership = 'SUBSCRIBER'
      and (app.free_until(c.id) is null or app.free_until(c.id) < v_end)
      /* Переведённым с подряда — с 1.1.2027. */
      and (c.subscription_fees_from is null or c.subscription_fees_from <= v_month)
  ) x
  where x.billed > 0 and x.net > 0
  on conflict (carrier_company_id, month, kind) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.issue_monthly_subscriptions(date) from public, anon, authenticated;
grant execute on function public.issue_monthly_subscriptions(date) to service_role;

/* Год вперёд не начинается раньше начала начислений. */
create or replace function public.carrier_annual_plan_create(p_vehicles integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_now date := (now() at time zone 'Europe/Helsinki')::date;
  v_start date := (date_trunc('month', v_now) + interval '1 month')::date;
  v_free date;
  v_net integer;
  v_vat integer;
  v_fee uuid;
  v_plan uuid;
begin
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null then
    raise exception 'Компания не найдена.' using errcode = '42501';
  end if;
  if v_company.partnership is distinct from 'SUBSCRIBER' then
    raise exception 'Год вперёд — только на подписке.' using errcode = '42501';
  end if;
  if (select version from public.legal_documents where id = public.active_legal_document('TERMS')) < app.annual_terms_version() then
    raise exception 'Оплата года вперёд откроется с новыми условиями.' using errcode = '55000';
  end if;
  if p_vehicles is null or p_vehicles not between 2 and 99 then
    raise exception 'Число машин 2–99 (первая бесплатна); от 100 — по договорённости.' using errcode = '22023';
  end if;

  /* Бесплатный период не съедается годом: год начинается после него. */
  v_free := app.free_until(v_company.id);
  if v_free is not null and v_free >= v_start then
    v_start := (date_trunc('month', v_free) + interval '1 month')::date;
  end if;
  if v_company.subscription_fees_from is not null and v_company.subscription_fees_from > v_start then
    v_start := date_trunc('month', v_company.subscription_fees_from)::date;
  end if;

  if exists (
    select 1 from public.carrier_annual_plans
    where company_id = v_company.id and cancelled_at is null and ends_on >= v_start
  ) then
    raise exception 'Год уже оплачен.' using errcode = '23505';
  end if;

  v_net := round(app.subscription_ladder_cents(p_vehicles) * 12 * (10000 - app.annual_discount_bps()) / 10000.0)::integer;
  v_vat := case when v_company.country = 'FI' then 2550 else 0 end;

  /* В строке сбора — платные машины (без первой), цена за машину в месяц со скидкой. */
  insert into public.carrier_subscription_fees (
    carrier_company_id, month, kind, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  ) values (
    v_company.id, date_trunc('month', v_now)::date, 'ANNUAL', p_vehicles - 1,
    round(v_net::numeric / (p_vehicles - 1) / 12)::integer, v_net, v_vat,
    v_net + round(v_net * v_vat / 10000.0)::integer
  )
  returning id into v_fee;

  insert into public.carrier_annual_plans (company_id, vehicles, starts_on, ends_on, fee_id, created_by)
  values (v_company.id, p_vehicles, v_start, (v_start + interval '12 months' - interval '1 day')::date, v_fee, auth.uid())
  returning id into v_plan;

  return v_plan;
end;
$$;

revoke all on function public.carrier_annual_plan_create(integer) from public, anon;
grant execute on function public.carrier_annual_plan_create(integer) to authenticated;
