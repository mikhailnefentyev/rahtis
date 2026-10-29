-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · доходность машин (30.10.2026)
--
-- Просьба перевозчика (через пользователя): видеть все расходы и доходы
-- в одном месте и доходность каждой машины и парка. В карточке машины —
-- за сколько куплена, сразу или в кредит / рассрочку / лизинг, платёж в
-- месяц, страховка, каско, налог; плюс топливо, доходы от работы и
-- зарплаты.
--
-- Решения пользователя 30.10.2026:
--   · купленная сразу машина — цена делится на срок службы (по
--     умолчанию 60 месяцев), плюс окупаемость;
--   · журнал разовых расходов (ремонт и ТО, шины, дорожные сборы,
--     стоянки, мойка, штрафы, прочее);
--   · зарплата — ориентировочная по сменам водителя на этой машине плюс
--     процент на налоги и взносы работодателя (по умолчанию 25 %).
--
-- Все суммы без ALV, в центах. Видит и меняет только своя компания;
-- входит в подписку, как топливо (app.own_orders_allowed).
-- ═══════════════════════════════════════════════════════════════════

create table public.vehicle_finance (
  vehicle_id uuid primary key references public.vehicles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  purchase_price_cents bigint check (purchase_price_cents between 0 and 1000000000),
  purchased_on date,
  financing text not null default 'CASH' check (financing in ('CASH', 'LOAN', 'INSTALLMENT', 'LEASING')),
  /* Платёж по кредиту, рассрочке или лизингу в месяц. */
  monthly_payment_cents integer check (monthly_payment_cents between 0 and 10000000),
  /* Последний месяц платежей; пусто — платёж идёт. */
  payments_until date,
  /* Срок службы для купленной сразу машины: цена ÷ месяцы. */
  useful_life_months integer not null default 60 check (useful_life_months between 6 and 360),
  /* Остаточная стоимость в конце срока — вычитается из цены. */
  residual_cents bigint check (residual_cents between 0 and 1000000000),
  insurance_cents_year integer check (insurance_cents_year between 0 and 10000000),
  kasko_cents_year integer check (kasko_cents_year between 0 and 10000000),
  tax_cents_year integer check (tax_cents_year between 0 and 10000000),
  /* Прочее постоянное в месяц: связь, тахограф, GPS, место стоянки. */
  other_fixed_cents_month integer check (other_fixed_cents_month between 0 and 10000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create index vehicle_finance_company on public.vehicle_finance (company_id);

create table public.vehicle_costs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  spent_on date not null,
  category text not null check (category in ('REPAIR', 'TYRES', 'TOLLS', 'PARKING', 'WASH', 'FINE', 'OTHER')),
  amount_cents integer not null check (amount_cents between 1 and 10000000),
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index vehicle_costs_vehicle on public.vehicle_costs (vehicle_id, spent_on);
create index vehicle_costs_company on public.vehicle_costs (company_id, spent_on);

/* Настройки расчёта компании: надбавка к зарплате на налоги и взносы работодателя. */
create table public.company_economics (
  company_id uuid primary key references public.companies (id) on delete cascade,
  employer_cost_bps integer not null default 2500 check (employer_cost_bps between 0 and 10000),
  updated_at timestamptz not null default now()
);

/* Машина и компания строки — одной компании: ловит все пути записи. */
create or replace function app.vehicle_money_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.vehicle_money_check() from public, anon, authenticated;

create trigger vehicle_finance_check before insert or update of vehicle_id, company_id on public.vehicle_finance
  for each row execute function app.vehicle_money_check();
create trigger vehicle_costs_check before insert or update of vehicle_id, company_id on public.vehicle_costs
  for each row execute function app.vehicle_money_check();

alter table public.vehicle_finance enable row level security;
alter table public.vehicle_costs enable row level security;
alter table public.company_economics enable row level security;

create policy vehicle_finance_read on public.vehicle_finance for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy vehicle_finance_write on public.vehicle_finance for insert to authenticated
  with check (company_id = (select app.current_company_id()) and coalesce(app.own_orders_allowed(company_id), false));
create policy vehicle_finance_update on public.vehicle_finance for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()) and coalesce(app.own_orders_allowed(company_id), false));

create policy vehicle_costs_read on public.vehicle_costs for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy vehicle_costs_write on public.vehicle_costs for insert to authenticated
  with check (company_id = (select app.current_company_id()) and coalesce(app.own_orders_allowed(company_id), false));
create policy vehicle_costs_delete on public.vehicle_costs for delete to authenticated
  using (company_id = (select app.current_company_id()));

create policy company_economics_read on public.company_economics for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy company_economics_write on public.company_economics for insert to authenticated
  with check (company_id = (select app.current_company_id()));
create policy company_economics_update on public.company_economics for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

grant select, insert, update on public.vehicle_finance to authenticated;
grant select, insert, delete on public.vehicle_costs to authenticated;
grant select, insert, update on public.company_economics to authenticated;
