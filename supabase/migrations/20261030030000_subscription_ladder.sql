-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · абонемент лесенкой и оплата года вперёд (30.10.2026)
--
-- Решение пользователя 30.10.2026 (после сравнения с конкурентами,
-- docs/pricing/research-competitors.md):
--   · лесенка — каждая ступень платит свою цену за машину:
--       1–9 — 29,90 €, 10–19 — 27,90 €, 20–49 — 25,90 €, 50–99 — 23,90 €, от 100 — по договорённости (пока не договорились — 23,90 €);
--     10 машин — 297 €, 20 — 574 €, 50 — 1 349 €, 100 — 2 544 € в месяц;
--   · оплата года вперёд — 10 % скидки.
--
-- Год вперёд: перевозчик выбирает число машин N, платит 12 месяцев
-- лесенки за N минус 10 %. Год начинается со следующего месяца (или
-- после бесплатного периода). В месяцы года машины сверх N оплачиваются
-- помесячно по своим ступеням лесенки, без скидки; если активных меньше
-- N — возврата нет. Счёт за год — обычной строкой сбора (kind ANNUAL)
-- в текущем месяце: выписывается вместе с месячным и так же удерживается
-- из выплаты.
--
-- Покупка года закрыта, пока не действует TERMS v21 (там это описано);
-- лесенка работает сразу — она только снижает цену от 10 машин.
-- TERMS 8.5 и CARRIER_AGREEMENT 3.2 — в черновики, активация — решение
-- пользователя.
-- ═══════════════════════════════════════════════════════════════════

/* Сумма месяца за n активных машин без ALV, в центах. Тот же расчёт — в src/lib/config.ts (subscriptionLadderCents). */
create or replace function app.subscription_ladder_cents(p_vehicles integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum((least(p_vehicles, b.hi) - b.lo + 1) * b.unit), 0)::integer
  from (values (1, 9, 2990), (10, 19, 2790), (20, 49, 2590), (50, 2147483647, 2390)) as b (lo, hi, unit)
  where p_vehicles >= b.lo;
$$;

comment on function app.subscription_ladder_cents(integer) is
  'Абонемент за n активных машин в месяц без ALV, лесенкой: 1–9 по 29,90 €, 10–19 по 27,90 €, 20–49 по 25,90 €, 50–99 по 23,90 €; от 100 — по договорённости, без неё 23,90 €.';

create or replace function app.annual_discount_bps()
returns integer
language sql
immutable
as $$
  select 1000;
$$;

/* Первая версия условий, где описана оплата года вперёд. */
create or replace function app.annual_terms_version()
returns integer
language sql
immutable
as $$
  select 21;
$$;

grant execute on function app.subscription_ladder_cents(integer), app.annual_discount_bps(), app.annual_terms_version() to authenticated, service_role;

-- ─── Строки сбора: месяц и год ───

alter table public.carrier_subscription_fees
  add column kind text not null default 'MONTH' check (kind in ('MONTH', 'ANNUAL'));
alter table public.carrier_subscription_fees drop constraint carrier_subscription_fees_unique;
alter table public.carrier_subscription_fees
  add constraint carrier_subscription_fees_unique unique (carrier_company_id, month, kind);

comment on table public.carrier_subscription_fees is
  'Сбор перевозчика: MONTH — активные машины месяца лесенкой (сверх оплаченных годом), ANNUAL — год вперёд за N машин минус 10 %; + ALV по стране.';

create table public.carrier_annual_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  vehicles integer not null check (vehicles between 1 and 99),
  starts_on date not null check (extract(day from starts_on) = 1),
  ends_on date not null,
  fee_id uuid references public.carrier_subscription_fees (id) on delete set null,
  cancelled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on > starts_on)
);

create index carrier_annual_plans_company on public.carrier_annual_plans (company_id, starts_on);

alter table public.carrier_annual_plans enable row level security;
revoke all on public.carrier_annual_plans from anon, authenticated;
grant select on public.carrier_annual_plans to authenticated;
create policy carrier_annual_plans_own on public.carrier_annual_plans
  for select to authenticated using (company_id = (select app.current_company_id()));

/* Перевозчик видит свои строки сбора (страница «Абонемент»). */
grant select on public.carrier_subscription_fees to authenticated;
alter table public.carrier_subscription_fees enable row level security;
drop policy if exists carrier_subscription_fees_own on public.carrier_subscription_fees;
create policy carrier_subscription_fees_own on public.carrier_subscription_fees
  for select to authenticated using (carrier_company_id = (select app.current_company_id()) or (select app.is_admin()));

-- ─── Месячный сбор: лесенка, машины сверх года ───

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
    x.company_id, v_month, 'MONTH', x.extra,
    round(x.net::numeric / x.extra)::integer,
    x.net,
    x.vat_bps,
    x.net + round(x.net * x.vat_bps / 10000.0)::integer
  from (
    select
      a.company_id,
      a.vehicles - least(a.vehicles, coalesce(p.vehicles, 0)) as extra,
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
  ) x
  where x.extra > 0 and x.net > 0
  on conflict (carrier_company_id, month, kind) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.issue_monthly_subscriptions(date) from public, anon, authenticated;
grant execute on function public.issue_monthly_subscriptions(date) to service_role;

-- ─── Год вперёд ───

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
  if p_vehicles is null or p_vehicles not between 1 and 99 then
    raise exception 'Число машин 1–99; от 100 — по договорённости.' using errcode = '22023';
  end if;

  /* Бесплатный период не съедается годом: год начинается после него. */
  v_free := app.free_until(v_company.id);
  if v_free is not null and v_free >= v_start then
    v_start := (date_trunc('month', v_free) + interval '1 month')::date;
  end if;

  if exists (
    select 1 from public.carrier_annual_plans
    where company_id = v_company.id and cancelled_at is null and ends_on >= v_start
  ) then
    raise exception 'Год уже оплачен.' using errcode = '23505';
  end if;

  v_net := round(app.subscription_ladder_cents(p_vehicles) * 12 * (10000 - app.annual_discount_bps()) / 10000.0)::integer;
  v_vat := case when v_company.country = 'FI' then 2550 else 0 end;

  insert into public.carrier_subscription_fees (
    carrier_company_id, month, kind, active_vehicles, unit_cents, net_cents, vat_bps, gross_cents
  ) values (
    v_company.id, date_trunc('month', v_now)::date, 'ANNUAL', p_vehicles,
    round(v_net::numeric / p_vehicles / 12)::integer, v_net, v_vat,
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

-- ─── Удержание из выплаты: какой это сбор ───

drop function public.apply_carrier_fees(uuid, date, integer);

create or replace function public.apply_carrier_fees(
  p_company_id uuid,
  p_period_start date,
  p_available_cents integer
)
returns table (month date, kind text, active_vehicles integer, unit_cents integer, vat_bps integer, amount_cents integer)
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
    order by f.month, f.kind
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
    kind := v_fee.kind;
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

-- ─── Условия: TERMS 8.5 и договор перевозчика 3.2 (черновики) ───

create or replace function pg_temp.draft_of(p_kind public.legal_kind)
returns uuid
language plpgsql
as $$
declare
  v_active uuid := public.active_legal_document(p_kind);
  v_draft uuid;
begin
  select d.id into v_draft
  from public.legal_documents d
  where d.kind = p_kind and d.status = 'DRAFT'
    and d.version > (select version from public.legal_documents where id = v_active)
  order by d.version desc
  limit 1;

  if v_draft is null then
    insert into public.legal_documents (kind, version, status, effective_from)
    values (p_kind, (select max(version) + 1 from public.legal_documents where kind = p_kind), 'DRAFT', current_date)
    returning id into v_draft;

    insert into public.legal_clauses (document_id, locale, path, title, body)
    select v_draft, c.locale, c.path, c.title, c.body
    from public.legal_clauses c where c.document_id = v_active;
  end if;

  return v_draft;
end;
$$;

create or replace function pg_temp.swap(p_doc uuid, p_path integer[], p_locale text, p_from text, p_to text)
returns void
language plpgsql
as $$
begin
  update public.legal_clauses
  set body = replace(body, p_from, p_to)
  where document_id = p_doc and path = p_path and locale = p_locale and position(p_from in body) > 0;
  if not found then
    raise exception 'Пункт % (%): фрагмент не найден: %', array_to_string(p_path, '.'), p_locale, left(p_from, 60);
  end if;
end;
$$;

do $$
declare
  v_terms uuid := pg_temp.draft_of('TERMS');
  v_carrier uuid := pg_temp.draft_of('CARRIER_AGREEMENT');
begin
  if (select version from public.legal_documents where id = v_terms) <> app.annual_terms_version() then
    raise exception 'Черновик TERMS должен быть версии %', app.annual_terms_version();
  end if;

  perform pg_temp.swap(v_terms, array[8, 5], 'fi',
    'maksu on 29,90 euroa kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta.',
    'maksu lasketaan kalenterikuukausittain ajoneuvoista, joilla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi keikka; muista palveluun rekisteröidyistä ajoneuvoista ei makseta. Hinta on porrastettu niin, että kunkin portaan ajoneuvoista maksetaan portaan hinta: 1.–9. ajoneuvo 29,90 euroa, 10.–19. ajoneuvo 27,90 euroa, 20.–49. ajoneuvo 25,90 euroa ja 50. ajoneuvosta alkaen 23,90 euroa ajoneuvolta kuukaudessa. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan 50. ajoneuvosta alkaen olevaa hintaa. Kuljetusliike voi maksaa vuoden etukäteen valitsemastaan ajoneuvomäärästä, jolloin se maksaa kahdentoista kuukauden porrastetun hinnan kyseisestä määrästä 10 prosentilla alennettuna. Vuosi alkaa maksua seuraavan kalenterikuukauden alusta tai maksuttoman jakson jälkeen. Vuoden aikana valittua määrää useammista ajoneuvoista maksetaan kuukausittain porrastetun hinnan mukaan ilman alennusta; jos ajoneuvoja on vähemmän, vuosimaksua ei palauteta.');
  perform pg_temp.swap(v_terms, array[8, 5], 'en',
    'the fee is 29.90 euros per calendar month for each vehicle that has at least one job marked complete during that month; no fee is charged for the other vehicles registered in the service.',
    'the fee is calculated per calendar month for the vehicles that have at least one job marked complete during that month; no fee is charged for the other vehicles registered in the service. The price is tiered so that the vehicles of each tier are charged that tier''s price: vehicles 1 to 9 at 29.90 euros, vehicles 10 to 19 at 27.90 euros, vehicles 20 to 49 at 25.90 euros and from the 50th vehicle 23.90 euros per vehicle per month. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the price from the 50th vehicle applies. The carrier may pay a year in advance for a number of vehicles it chooses, in which case it pays the tiered price of twelve months for that number less 10 per cent. The year begins at the start of the calendar month following the payment or after the free period. During the year, vehicles above the chosen number are charged monthly at the tiered price without discount; if there are fewer vehicles, the annual fee is not refunded.');

  perform pg_temp.swap(v_carrier, array[3, 2], 'fi',
    'maksaa RAHTIS-palvelusta 29,90 euroa ilman arvonlisäveroa kalenterikuukaudessa jokaisesta ajoneuvosta, jolla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi RAHTIS-palvelussa käsitelty toimeksianto.',
    'maksaa RAHTIS-palvelusta kalenterikuukausittain ajoneuvoista, joilla on kyseisen kuukauden aikana merkitty valmiiksi vähintään yksi RAHTIS-palvelussa käsitelty toimeksianto, porrastetun hinnan ilman arvonlisäveroa: 1.–9. ajoneuvo 29,90 euroa, 10.–19. ajoneuvo 27,90 euroa, 20.–49. ajoneuvo 25,90 euroa ja 50. ajoneuvosta alkaen 23,90 euroa ajoneuvolta. 100. ajoneuvosta alkaen hinnasta voidaan sopia erikseen; ellei toisin sovita, sovelletaan 50. ajoneuvosta alkaen olevaa hintaa. Vuoden etukäteen maksettaessa hinnasta myönnetään 10 prosentin alennus käyttöehtojen kohdan 8.5 mukaisesti.');
  perform pg_temp.swap(v_carrier, array[3, 2], 'en',
    'pays for the RAHTIS service 29.90 euros excluding value added tax per calendar month for each vehicle that has at least one assignment handled in the RAHTIS service marked as completed during that month.',
    'pays for the RAHTIS service per calendar month, for the vehicles that have at least one assignment handled in the RAHTIS service marked as completed during that month, a tiered price excluding value added tax: vehicles 1 to 9 at 29.90 euros, vehicles 10 to 19 at 27.90 euros, vehicles 20 to 49 at 25.90 euros and from the 50th vehicle 23.90 euros per vehicle. From the 100th vehicle the price may be agreed separately; unless otherwise agreed, the price from the 50th vehicle applies. When a year is paid in advance, a 10 per cent discount is given as set out in section 8.5 of the terms of use.');
end;
$$;
