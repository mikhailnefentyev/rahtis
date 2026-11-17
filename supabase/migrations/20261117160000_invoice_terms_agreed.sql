-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · периодичность счёта и срок оплаты — по согласию сторон
-- (17.11.2026)
--
-- Решение пользователя: как часто перевозчик выставляет счёт заказчику и
-- с каким сроком оплаты, согласуют сами стороны. Варианты: сразу после
-- рейса (PER_TRIP), раз в неделю (WEEKLY), раз в две недели (BIWEEKLY),
-- раз в месяц (MONTHLY); срок 7/14/21/30/45/60 дней. Пока не
-- согласовали — раз в неделю и 14 дней.
--
-- Одна сторона предлагает, другая принимает или отклоняет. Предложить
-- можно только тому, с кем уже есть заказ, — иначе это рассылка
-- незнакомым компаниям.
--
-- Задание счетов теперь ежедневное (05:10 UTC): каждое утро решает по
-- каждой паре, пора ли выставлять (src/lib/invoices/terms.ts).
-- ═══════════════════════════════════════════════════════════════════

create table public.invoice_agreements (
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  shipper_company_id uuid not null references public.companies (id) on delete cascade,
  schedule text not null default 'WEEKLY'
    constraint invoice_agreements_schedule check (schedule in ('PER_TRIP', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
  payment_term_days smallint not null default 14
    constraint invoice_agreements_term check (payment_term_days in (7, 14, 21, 30, 45, 60)),
  /* Предложение, ждущее ответа другой стороны. */
  proposed_schedule text
    constraint invoice_agreements_proposed_schedule check (proposed_schedule in ('PER_TRIP', 'WEEKLY', 'BIWEEKLY', 'MONTHLY')),
  proposed_term_days smallint
    constraint invoice_agreements_proposed_term check (proposed_term_days in (7, 14, 21, 30, 45, 60)),
  proposed_by uuid references public.companies (id) on delete set null,
  proposed_at timestamptz,
  agreed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (carrier_company_id, shipper_company_id),
  constraint invoice_agreements_proposal check (
    (proposed_by is null) = (proposed_schedule is null)
    and (proposed_schedule is null) = (proposed_term_days is null)
  )
);

comment on table public.invoice_agreements is
  'Согласованные стороной перевозчика и заказчика периодичность счёта и срок оплаты (17.11.2026). Нет строки — раз в неделю, 14 дней.';

alter table public.invoice_agreements enable row level security;

create policy invoice_agreements_parties
  on public.invoice_agreements for select to authenticated
  using (
    carrier_company_id = (select app.current_company_id())
    or shipper_company_id = (select app.current_company_id())
    or (select app.is_admin())
  );

grant select on public.invoice_agreements to authenticated;

/* Пара: кто перевозчик, кто заказчик — по виду своей компании; заказ между ними обязателен. */
create or replace function app.invoice_pair(p_counterparty uuid)
returns table (carrier_id uuid, shipper_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
  v_kind public.company_kind;
begin
  if v_me is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;
  /* Условие договора, а не рейса: согласует главный в компании, не диспетчер (security review 17.11.2026). */
  if not (select app.is_company_owner()) then
    raise exception 'Условия счёта согласует главный в компании.' using errcode = '42501';
  end if;
  select kind into v_kind from public.companies where id = v_me;

  if v_kind = 'CARRIER' then
    carrier_id := v_me;
    shipper_id := p_counterparty;
  elsif v_kind = 'SHIPPER' then
    carrier_id := p_counterparty;
    shipper_id := v_me;
  else
    raise exception 'Только перевозчик или заказчик.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.orders o
    where o.assigned_company_id = carrier_id and o.shipper_company_id = shipper_id
  ) then
    raise exception 'Между компаниями нет заказов.' using errcode = '42501';
  end if;

  return next;
end;
$$;

revoke all on function app.invoice_pair(uuid) from public, anon, authenticated;

/* Предложить условия. Новое предложение заменяет прежнее неотвеченное. */
create or replace function public.propose_invoice_terms(p_counterparty uuid, p_schedule text, p_term_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair record;
begin
  select * into v_pair from app.invoice_pair(p_counterparty);

  insert into public.invoice_agreements (
    carrier_company_id, shipper_company_id, proposed_schedule, proposed_term_days, proposed_by, proposed_at, updated_at
  )
  values (v_pair.carrier_id, v_pair.shipper_id, p_schedule, p_term_days, (select app.current_company_id()), now(), now())
  on conflict (carrier_company_id, shipper_company_id) do update
    set proposed_schedule = excluded.proposed_schedule,
        proposed_term_days = excluded.proposed_term_days,
        proposed_by = excluded.proposed_by,
        proposed_at = excluded.proposed_at,
        updated_at = now();
end;
$$;

/* Ответить на предложение другой стороны. Своё предложение принять нельзя, отозвать — можно (p_accept = false). */
create or replace function public.answer_invoice_terms(p_counterparty uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair record;
  v_row public.invoice_agreements;
  v_me uuid := (select app.current_company_id());
begin
  select * into v_pair from app.invoice_pair(p_counterparty);

  select * into v_row from public.invoice_agreements
  where carrier_company_id = v_pair.carrier_id and shipper_company_id = v_pair.shipper_id
  for update;

  if v_row.proposed_by is null then
    raise exception 'Нет предложения.' using errcode = '55000';
  end if;
  if p_accept and v_row.proposed_by = v_me then
    raise exception 'Своё предложение принимает другая сторона.' using errcode = '42501';
  end if;

  update public.invoice_agreements
  set schedule = case when p_accept then proposed_schedule else schedule end,
      payment_term_days = case when p_accept then proposed_term_days else payment_term_days end,
      agreed_at = case when p_accept then now() else agreed_at end,
      proposed_schedule = null,
      proposed_term_days = null,
      proposed_by = null,
      proposed_at = null,
      updated_at = now()
  where carrier_company_id = v_pair.carrier_id and shipper_company_id = v_pair.shipper_id;
end;
$$;

/* Контрагенты с заказами и условия с каждым — для кабинета. */
create or replace function public.invoice_counterparties()
returns table (
  counterparty_id uuid,
  counterparty_name text,
  schedule text,
  payment_term_days smallint,
  proposed_schedule text,
  proposed_term_days smallint,
  proposed_by_me boolean,
  agreed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select c.id, c.kind from public.companies c where c.id = (select app.current_company_id())
  ),
  pairs as (
    select distinct
      case when me.kind = 'CARRIER' then o.shipper_company_id else o.assigned_company_id end as other,
      case when me.kind = 'CARRIER' then me.id else o.assigned_company_id end as carrier_id,
      case when me.kind = 'CARRIER' then o.shipper_company_id else me.id end as shipper_id
    from public.orders o, me
    where (me.kind = 'CARRIER' and o.assigned_company_id = me.id)
       or (me.kind = 'SHIPPER' and o.shipper_company_id = me.id and o.assigned_company_id is not null)
  )
  select
    p.other,
    c.name,
    coalesce(a.schedule, 'WEEKLY'),
    coalesce(a.payment_term_days, 14::smallint),
    a.proposed_schedule,
    a.proposed_term_days,
    coalesce(a.proposed_by = (select id from me), false),
    a.agreed_at
  from pairs p
  join public.companies c on c.id = p.other
  left join public.invoice_agreements a
    on a.carrier_company_id = p.carrier_id and a.shipper_company_id = p.shipper_id
  order by (a.proposed_by is not null and a.proposed_by <> (select id from me)) desc, c.name;
$$;

revoke all on function public.propose_invoice_terms(uuid, text, integer) from public, anon;
revoke all on function public.answer_invoice_terms(uuid, boolean) from public, anon;
revoke all on function public.invoice_counterparties() from public, anon;
grant execute on function public.propose_invoice_terms(uuid, text, integer) to authenticated;
grant execute on function public.answer_invoice_terms(uuid, boolean) to authenticated;
grant execute on function public.invoice_counterparties() to authenticated;

-- ── Ежедневное задание счетов за перевозки ─────────────────────────

insert into app.runtime_config (key, value, note)
values (
  'freight_invoices_url',
  'https://www.rahtis.eu/api/invoices/freight',
  'Куда стучится ежедневное задание счетов перевозчиков за прямые перевозки (17.11.2026).'
)
on conflict (key) do update set value = excluded.value, note = excluded.note, updated_at = now();

create or replace function app.run_freight_invoices()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select value into v_url from app.runtime_config where key = 'freight_invoices_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';
  if v_url is null or v_secret is null then
    raise notice 'Счета за перевозки не выставлены: нет freight_invoices_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job) values (v_request, 'freight_invoices');
  return v_request;
end;
$$;

revoke all on function app.run_freight_invoices() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('rahtis-freight-invoices');
exception
  when others then
    null;
end;
$$;

/* 05:10 UTC каждый день — утро в Финляндии, после счетов по объектам по понедельникам. */
select cron.schedule('rahtis-freight-invoices', '10 5 * * *', $$ select app.run_freight_invoices(); $$);
