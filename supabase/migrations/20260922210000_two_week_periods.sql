-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · расчётный период — две недели; счёт уходит сам
--
-- 21.09.2026 решено: деньги живут двухнедельными периодами, а не
-- половинами месяца. Период — две полные недели с понедельника по
-- воскресенье. Отсчёт идёт от понедельника 5.1.2026, поэтому граница
-- периода всегда совпадает с границей недели. Недельный отчёт ложится в
-- период целиком, и две недели в сумме дают ровно его.
--
-- Сроки считаются от конца периода, как и раньше: заказчик платит в
-- течение 15 дней, перевозчику платят в течение 30 дней. Пример:
-- период 14.–27.9.2026, заказчик платит до 12.10, перевозчик получает
-- 27.10.
--
-- СЧЁТ, А НЕ СВОДКА. Документ периода для заказчика и раньше уходил
-- автоматически — с реквизитами обеих сторон, налогом и сроком, но без
-- номера. Номер вписывали в админку руками, и до этого рейсы висели
-- «невыставленными», хотя документ давно был у заказчика. Теперь у
-- документа есть номер из сплошной серии (год-порядковый), и в момент
-- выпуска рейсы периода сами переходят в INVOICED с этим номером.
--
-- Номер закрепляется за парой «заказчик + период» до выпуска PDF: при
-- повторном запуске (сбой почты, ручной перевыпуск) тот же счёт получает
-- тот же номер. Номер, выданный один раз, не освобождается, поэтому в
-- серии нет ни пропусков, ни дублей.
--
-- Переход: текущий полумесячный период 16.–30.9 в новом правиле
-- распадается на 14.–27.9 и 28.9–11.10. Настоящих заказов на платформе
-- ещё не было (комиссия 0 % до первого), поэтому переносить нечего.
-- ═══════════════════════════════════════════════════════════════════


-- ── Границы периода ────────────────────────────────────────────────

create or replace function app.payout_period_start(p_moment timestamptz)
returns date
language sql
stable
as $$
  select date '2026-01-05' + (floor((d - date '2026-01-05') / 14.0)::integer * 14)
  from (select (p_moment at time zone 'Europe/Helsinki')::date as d) s;
$$;

create or replace function app.payout_period_end(p_start date)
returns date
language sql
immutable
as $$
  select p_start + 13;
$$;

/* Перевозчику — через 30 дней после конца периода, как в условиях (8.4). */
create or replace function app.payout_due(p_moment timestamptz)
returns date
language sql
stable
as $$
  select app.payout_period_end(app.payout_period_start(p_moment)) + 30;
$$;

comment on function app.payout_period_start(timestamptz) is
  'Начало двухнедельного расчётного периода по Хельсинки: понедельник, отсчёт от 5.1.2026.';
comment on function app.payout_period_end(date) is
  'Конец расчётного периода: воскресенье второй недели.';
comment on function app.payout_due(timestamptz) is
  'День выплаты перевозчику: конец периода плюс 30 дней.';


-- ── Номера счетов ──────────────────────────────────────────────────

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  company_id uuid not null references public.companies (id) on delete restrict,
  period_start date not null,
  issued_on date not null default (now() at time zone 'Europe/Helsinki')::date,
  created_at timestamptz not null default now(),
  constraint invoices_one_per_period unique (company_id, period_start)
);

comment on table public.invoices is
  'Счета заказчикам за расчётный период. Номер из сплошной серии, один на заказчика и период.';

create table app.invoice_counters (
  year integer primary key,
  last integer not null
);

alter table public.invoices enable row level security;
revoke all on public.invoices from anon, authenticated;
grant select on public.invoices to authenticated;

create policy invoices_read
  on public.invoices for select to authenticated
  using ((select app.is_admin()) or company_id = (select app.current_company_id()));

/*
 * Номер счёта заказчика за период: уже выданный или следующий в серии.
 * Счётчик по году и под блокировкой строки — два параллельных выпуска не
 * получат один номер.
 */
create or replace function public.period_invoice(p_company_id uuid, p_period_start date)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice public.invoices;
  v_year integer := extract(year from (now() at time zone 'Europe/Helsinki'))::integer;
  v_next integer;
begin
  select * into v_invoice
  from public.invoices
  where company_id = p_company_id and period_start = p_period_start;

  if v_invoice.id is not null then
    return v_invoice;
  end if;

  insert into app.invoice_counters (year, last) values (v_year, 1)
  on conflict (year) do update set last = app.invoice_counters.last + 1
  returning last into v_next;

  insert into public.invoices (number, company_id, period_start)
  values (v_year::text || '-' || lpad(v_next::text, 4, '0'), p_company_id, p_period_start)
  returning * into v_invoice;

  return v_invoice;
end;
$$;

comment on function public.period_invoice(uuid, date) is
  'Номер счёта заказчика за период: выданный ранее или следующий в серии. Только выпуску документов.';

revoke all on function public.period_invoice(uuid, date) from public, anon, authenticated;
grant execute on function public.period_invoice(uuid, date) to service_role;


-- ── Расписание: каждый понедельник, выпуск — только после конца периода ─

do $$
begin
  perform cron.unschedule('rahtis-period-settlement');
exception
  when others then
    null;
end;
$$;

/*
 * Раз в неделю, а не раз в две: cron не умеет «каждый второй
 * понедельник». Маршрут сам проверяет, что вчера закончился период, и в
 * промежуточный понедельник ничего не выпускает.
 */
select cron.schedule(
  'rahtis-period-settlement',
  '20 4 * * 1',
  $$ select app.run_period_settlement(); $$
);


-- ── Расчёты оператора знают период и его сроки ─────────────────────

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
    app.payout_period_end(p.st) + 30,
    o.billing,
    o.invoice_ref,
    o.invoiced_at,
    o.paid_at,
    o.settled_at,
    o.rate_cents,
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
    and (o.billing <> 'SETTLED' or o.settled_at > now() - interval '90 days')
  order by o.closed_at;
end;
$$;

comment on function public.billing_overview() is
  'Расчёты оператора по рейсам: период и его сроки, суммы, этап, реквизиты сторон. Только оператору.';

revoke all on function public.billing_overview() from public, anon;
grant execute on function public.billing_overview() to authenticated;
