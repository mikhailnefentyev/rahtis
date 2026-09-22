-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · новая схема денег: подписка перевозчика и 3 % заказчику
--
-- 22.09.2026 пользователь:
--   · перевозчик не платит процент с рейса. Вместо этого — 29,90 € + ALV
--     в месяц за каждую АКТИВНУЮ машину: машину, закрывшую в этом
--     календарном месяце хотя бы один рейс. Зарегистрировано пять, ездили
--     три — платит за три. Сбор удерживается из выплаты перевозчику;
--   · заказчик платит 3 % сверху за выполненный заказ, прошедший через
--     стол. Прямой заказ постоянной машине — 0 %. Отменённый — без платы;
--   · первый месяц бесплатно всем: до конца первого полного календарного
--     месяца после одобрения компании (одобрена 10.10 — бесплатно по
--     30.11; одобрена 1.10 — по 31.10).
--
-- Процент с перевозчика (commission_bps) остаётся в рейсах как история и
-- отныне всегда 0: app.current_commission_bps() возвращает 0, и прежняя
-- машинерия выплат считает «выплата = цена».
--
-- Плата заказчика — отдельное поле рейса shipper_fee_bps, фиксируется в
-- момент закрытия, как раньше комиссия: изменение тарифа не переписывает
-- закрытые рейсы. Через стол ли шёл рейс, решает происхождение выбранного
-- отклика (offer_origin), а не dispatch_mode: отменённый прямой заказ
-- уходит на стол, а dispatch_mode остаётся DIRECT.
--
-- Сбор за машины — строка на перевозчика и месяц (carrier_subscription_
-- fees). Он удерживается из ближайших выплат: из отчёта за 16–конец
-- месяца, а если выплаты не хватило — остаток из следующих
-- (carrier_fee_deductions). Тестовые компании не платят и не получают.
-- ═══════════════════════════════════════════════════════════════════

-- ── Тарифы ─────────────────────────────────────────────────────────

create or replace function app.current_commission_bps()
returns integer
language sql
immutable
as $$
  select 0;
$$;

comment on function app.current_commission_bps() is
  'Процент с перевозчика за рейс. С 22.09.2026 всегда 0: перевозчик платит помесячно за активные машины.';

create or replace function app.current_shipper_fee_bps()
returns integer
language sql
immutable
as $$
  select 300;
$$;

comment on function app.current_shipper_fee_bps() is
  'Плата заказчика за заказ, выполненный через стол: 300 б.п. = 3 % сверху цены.';

create or replace function app.subscription_unit_cents()
returns integer
language sql
immutable
as $$
  select 2990;
$$;

comment on function app.subscription_unit_cents() is
  'Месячный сбор перевозчика за одну активную машину, без ALV: 29,90 €.';

/* Последний бесплатный день компании: конец первого полного месяца после одобрения. */
create or replace function app.free_until(p_company_id uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select case
    when c.approved_at is null then null
    else (date_trunc('month', d)
          + case when extract(day from d) = 1 then interval '1 month' else interval '2 months' end
          - interval '1 day')::date
  end
  from public.companies c
  cross join lateral (select (c.approved_at at time zone 'Europe/Helsinki')::date as d) x
  where c.id = p_company_id;
$$;

comment on function app.free_until(uuid) is
  'Последний день бесплатного периода компании: конец первого полного календарного месяца после одобрения.';

revoke all on function app.current_shipper_fee_bps() from public, anon;
revoke all on function app.subscription_unit_cents() from public, anon;
revoke all on function app.free_until(uuid) from public, anon;
grant execute on function app.current_shipper_fee_bps(), app.subscription_unit_cents(), app.free_until(uuid)
  to authenticated, service_role;


-- ── Плата заказчика в рейсе ────────────────────────────────────────

alter table public.orders
  add column shipper_fee_bps integer
    constraint orders_shipper_fee_bps check (shipper_fee_bps is null or shipper_fee_bps between 0 and 10000);

comment on column public.orders.shipper_fee_bps is
  'Плата заказчика сверху цены, б.п., зафиксированная при закрытии: 300 за рейс со стола, 0 за прямой или в бесплатный месяц.';

grant select (shipper_fee_bps) on public.orders to authenticated;

/* Закрытые до новой схемы рейсы — без платы. */
update public.orders set shipper_fee_bps = 0 where status = 'DONE';

create or replace function app.freeze_shipper_fee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origin public.offer_origin;
  v_free date;
begin
  if new.status = 'DONE' and old.status is distinct from 'DONE' then
    select f.origin into v_origin from public.order_offers f where f.id = new.chosen_offer_id;
    v_free := app.free_until(new.shipper_company_id);

    new.shipper_fee_bps := case
      when v_origin = 'DIRECT' then 0
      when v_free is not null
        and (coalesce(new.closed_at, now()) at time zone 'Europe/Helsinki')::date <= v_free then 0
      else app.current_shipper_fee_bps()
    end;
  end if;
  return new;
end;
$$;

create trigger orders_freeze_shipper_fee
  before update of status on public.orders
  for each row execute function app.freeze_shipper_fee();

/* Плата заказчика в центах: от цены рейса, сверху. */
create or replace function app.shipper_fee_cents(p_rate_cents integer, p_bps integer)
returns integer
language sql
immutable
as $$
  select round(coalesce(p_rate_cents, 0) * coalesce(p_bps, 0) / 10000.0)::integer;
$$;

grant execute on function app.shipper_fee_cents(integer, integer) to authenticated, service_role;


-- ── Месячный сбор за активные машины ───────────────────────────────

create table public.carrier_subscription_fees (
  id uuid primary key default gen_random_uuid(),
  carrier_company_id uuid not null references public.companies (id) on delete restrict,
  month date not null,
  active_vehicles integer not null,
  unit_cents integer not null,
  net_cents integer not null,
  vat_bps integer not null,
  gross_cents integer not null,
  created_at timestamptz not null default now(),
  constraint carrier_subscription_fees_unique unique (carrier_company_id, month),
  constraint carrier_subscription_fees_month check (extract(day from month) = 1),
  constraint carrier_subscription_fees_positive check (active_vehicles > 0 and net_cents >= 0)
);

comment on table public.carrier_subscription_fees is
  'Месячный сбор перевозчика: активные машины месяца × 29,90 € + ALV по стране перевозчика.';

create table public.carrier_fee_deductions (
  id uuid primary key default gen_random_uuid(),
  fee_id uuid not null references public.carrier_subscription_fees (id) on delete cascade,
  period_start date not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  constraint carrier_fee_deductions_unique unique (fee_id, period_start)
);

comment on table public.carrier_fee_deductions is
  'Сколько месячного сбора удержано из выплаты перевозчику за расчётный период (с ALV).';

alter table public.carrier_subscription_fees enable row level security;
alter table public.carrier_fee_deductions enable row level security;
revoke all on public.carrier_subscription_fees, public.carrier_fee_deductions from anon, authenticated;
grant select on public.carrier_subscription_fees, public.carrier_fee_deductions to authenticated;

create policy carrier_subscription_fees_read
  on public.carrier_subscription_fees for select to authenticated
  using ((select app.is_admin()) or carrier_company_id = (select app.current_company_id()));

create policy carrier_fee_deductions_read
  on public.carrier_fee_deductions for select to authenticated
  using (exists (select 1 from public.carrier_subscription_fees f where f.id = fee_id));

/*
 * Начислить сбор за месяц. Машина активна, если в этом месяце (по
 * Хельсинки) закрыла хотя бы один рейс. Месяц в бесплатном периоде
 * перевозчика не начисляется. Повторный вызов ничего не дублирует.
 */
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
    carrier_company_id, month, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  )
  select
    a.company_id, v_month, a.vehicles, app.subscription_unit_cents(),
    a.vehicles * app.subscription_unit_cents(),
    case when c.country = 'FI' then 2550 else 0 end,
    a.vehicles * app.subscription_unit_cents()
      + round(a.vehicles * app.subscription_unit_cents()
              * (case when c.country = 'FI' then 2550 else 0 end) / 10000.0)::integer
  from (
    select o.assigned_company_id as company_id, count(distinct o.assigned_vehicle_id)::integer as vehicles
    from public.orders o
    where o.status = 'DONE'
      and o.assigned_vehicle_id is not null
      and (app.closed_moment(o) at time zone 'Europe/Helsinki')::date between v_month and v_end
    group by o.assigned_company_id
  ) a
  join public.companies c on c.id = a.company_id
  where not c.is_test
    and (app.free_until(c.id) is null or app.free_until(c.id) < v_end)
  on conflict (carrier_company_id, month) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.issue_monthly_subscriptions(date) from public, anon, authenticated;
grant execute on function public.issue_monthly_subscriptions(date) to service_role;

/*
 * Удержать открытые сборы перевозчика из выплаты за период.
 *
 * p_available_cents — выплата периода с ALV. Сначала снимаются прежние
 * удержания этого же периода (перевыпуск документа не удваивает), затем
 * открытые сборы гасятся по порядку месяцев, пока хватает выплаты.
 * Возвращает, что удержано: по строке на месяц.
 */
create or replace function public.apply_carrier_fees(
  p_company_id uuid,
  p_period_start date,
  p_available_cents integer
)
returns table (month date, active_vehicles integer, unit_cents integer, vat_bps integer, amount_cents integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_left integer := greatest(coalesce(p_available_cents, 0), 0);
  v_fee record;
  v_open integer;
  v_take integer;
begin
  delete from public.carrier_fee_deductions d
  using public.carrier_subscription_fees f
  where d.fee_id = f.id and f.carrier_company_id = p_company_id and d.period_start = p_period_start;

  for v_fee in
    select f.* from public.carrier_subscription_fees f
    where f.carrier_company_id = p_company_id
      and f.month <= p_period_start
    order by f.month
  loop
    exit when v_left <= 0;
    v_open := v_fee.gross_cents - coalesce((
      select sum(d.amount_cents) from public.carrier_fee_deductions d where d.fee_id = v_fee.id
    ), 0);
    continue when v_open <= 0;

    v_take := least(v_open, v_left);
    insert into public.carrier_fee_deductions (fee_id, period_start, amount_cents)
    values (v_fee.id, p_period_start, v_take);
    v_left := v_left - v_take;

    month := v_fee.month;
    active_vehicles := v_fee.active_vehicles;
    unit_cents := v_fee.unit_cents;
    vat_bps := v_fee.vat_bps;
    amount_cents := v_take;
    return next;
  end loop;
end;
$$;

revoke all on function public.apply_carrier_fees(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.apply_carrier_fees(uuid, date, integer) to service_role;


-- ── Расчёты оператора: плата заказчика и удержания ─────────────────

drop function if exists public.billing_overview();

create or replace function public.billing_overview()
returns table (
  id uuid,
  ref text,
  shipper_ref text,
  closed_at timestamptz,
  period_start date,
  period_end date,
  invoice_due date,
  payout_due date,
  billing public.billing_status,
  invoice_ref text,
  invoiced_at timestamptz,
  paid_at timestamptz,
  settled_at timestamptz,
  rate_cents integer,
  shipper_fee_cents integer,
  commission_cents integer,
  payout_cents integer,
  route_from text,
  route_to text,
  shipper_id uuid,
  shipper_name text,
  shipper_business_id text,
  shipper_country text,
  shipper_billing_email text,
  carrier_id uuid,
  carrier_name text,
  carrier_business_id text,
  carrier_country text,
  carrier_iban text,
  carrier_bic text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Расчёты видны только оператору.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    p.st,
    app.payout_period_end(p.st),
    app.invoice_due(p.st),
    app.payout_due(app.closed_moment(o)),
    o.billing,
    o.invoice_ref,
    o.invoiced_at,
    o.paid_at,
    o.settled_at,
    o.rate_cents,
    app.shipper_fee_cents(o.rate_cents, o.shipper_fee_bps),
    app.commission_cents(o.rate_cents, app.order_bps(o)),
    app.payout_cents(o.rate_cents, app.order_bps(o)),
    (select s.city from public.order_stops s where s.order_id = o.id order by s.sequence limit 1),
    (select e.city from app.route_end(o.id) e),
    sh.id,
    sh.name,
    sh.business_id,
    sh.country::text,
    coalesce(sh.billing_email, sh.contact_email),
    ca.id,
    ca.name,
    ca.business_id,
    ca.country::text,
    ca.iban,
    ca.bic
  from public.orders o
  cross join lateral (select app.payout_period_start(app.closed_moment(o)) as st) p
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where o.status = 'DONE'
    and not sh.is_test
    and not coalesce(ca.is_test, false)
    and (o.billing <> 'SETTLED' or o.settled_at > now() - interval '90 days')
  order by o.closed_at;
end;
$$;

revoke all on function public.billing_overview() from public, anon;
grant execute on function public.billing_overview() to authenticated;
