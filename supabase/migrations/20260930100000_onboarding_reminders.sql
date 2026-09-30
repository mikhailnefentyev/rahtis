-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · путь от одобрения до первой работы: шаги и напоминания
--
-- Замер 29.09.2026: из 13 одобренных перевозчиков работают 4. Из девяти
-- остановившихся трое не открыли приглашение, шестеро вошли и не
-- активировались (реквизиты, согласие). Кабинет теперь показывает путь
-- шагами (OnboardingSteps), а здесь — то, что будит застрявших и что видит
-- оператор:
--
--   onboarding_status()     — компания, её шаг и с какого момента она на
--                             нём стоит; оператору — все, серверу — для писем;
--   onboarding_reminders    — какие напоминания уже ушли (2, 5, 10 день
--                             на шаге), чтобы не слать дважды;
--   app.run_onboarding_reminders — будильник 07:15 UTC → маршрут
--                             /api/reminders/onboarding.
--
-- Шаги:
--   INVITE      одобрена, приглашение не открыто (почта не подтверждена);
--   ACTIVATE    вошла, реквизиты и согласие не сданы (status APPROVED);
--   SETUP       перевозчик активен, но стол закрыт: нет документов,
--               одобренной машины или водителя;
--   FIRST_ORDER заказчик активен, заказов ещё нет.
-- Тестовые и замороженные компании не трогаются.
-- ═══════════════════════════════════════════════════════════════════

create table public.onboarding_reminders (
  company_id uuid not null references public.companies (id) on delete cascade,
  stage text not null,
  day integer not null,
  sent_at timestamptz not null default now(),
  primary key (company_id, stage, day),
  constraint onboarding_reminders_stage check (stage in ('INVITE', 'ACTIVATE', 'SETUP', 'FIRST_ORDER'))
);

alter table public.onboarding_reminders enable row level security;
revoke all on public.onboarding_reminders from anon, authenticated;

create policy onboarding_reminders_admin
  on public.onboarding_reminders for select to authenticated
  using ((select app.is_admin()));
grant select on public.onboarding_reminders to authenticated;


create or replace function public.onboarding_status()
returns table (
  company_id uuid,
  name text,
  kind text,
  language text,
  contact_email text,
  user_id uuid,
  stage text,
  stage_since timestamptz,
  days_on_stage integer,
  last_sign_in_at timestamptz,
  has_documents boolean,
  vehicles integer,
  approved_vehicles integer,
  drivers integer,
  reminders_sent integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  /* Оператору и серверу (service_role); компании своё видят в кабинете. */
  if not (coalesce((select app.is_admin()), false) or (select auth.role()) = 'service_role') then
    raise exception 'Только оператору.' using errcode = '42501';
  end if;

  return query
  with c as (
    select
      co.*,
      (select p.id from public.profiles p where p.company_id = co.id order by p.created_at limit 1) as owner
    from public.companies co
    where not co.is_test
      and co.frozen_at is null
      and co.status in ('APPROVED', 'ACTIVE')
  ), s as (
    select
      c.*,
      u.email_confirmed_at,
      u.last_sign_in_at,
      app.company_documents_ok(c.id) as docs,
      (select count(*)::integer from public.vehicles v where v.company_id = c.id) as vehicle_count,
      (select count(*)::integer from public.vehicles v where v.company_id = c.id and v.access = 'APPROVED') as approved_count,
      (select count(*)::integer from public.drivers d where d.company_id = c.id and d.status = 'ACTIVE') as driver_count,
      exists (select 1 from public.orders o where o.shipper_company_id = c.id) as has_orders,
      app.has_dispatchable_vehicle(c.id) as dispatchable
    from c
    left join auth.users u on u.id = c.owner
  )
  select
    s.id,
    s.name::text,
    s.kind::text,
    s.language::text,
    s.contact_email::text,
    s.owner,
    case
      when s.status = 'APPROVED' and s.email_confirmed_at is null then 'INVITE'
      when s.status = 'APPROVED' then 'ACTIVATE'
      when s.kind = 'CARRIER' and not s.dispatchable then 'SETUP'
      when s.kind = 'SHIPPER' and not s.has_orders then 'FIRST_ORDER'
    end,
    case when s.status = 'APPROVED' then s.approved_at else coalesce(s.activated_at, s.approved_at) end,
    floor(extract(epoch from now() - case when s.status = 'APPROVED' then s.approved_at else coalesce(s.activated_at, s.approved_at) end) / 86400)::integer,
    s.last_sign_in_at,
    s.docs,
    s.vehicle_count,
    s.approved_count,
    s.driver_count,
    (select count(*)::integer from public.onboarding_reminders r where r.company_id = s.id)
  from s
  where (s.status = 'APPROVED')
     or (s.kind = 'CARRIER' and not s.dispatchable)
     or (s.kind = 'SHIPPER' and not s.has_orders)
  order by 8 nulls last;
end;
$$;

revoke all on function public.onboarding_status() from public, anon;
grant execute on function public.onboarding_status() to authenticated, service_role;


/* Будильник: маршрут — от адреса отчётов, как у напоминаний о сертификатах. */
insert into app.runtime_config (key, value, note)
select 'onboarding_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/reminders/onboarding'),
       'Напоминания застрявшим на пути к первой работе. Будит app.run_onboarding_reminders.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_onboarding_reminders()
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
  select value into v_url from app.runtime_config where key = 'onboarding_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Напоминания не разосланы: в app.runtime_config нет onboarding_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'onboarding-reminders')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_onboarding_reminders() from public, anon, authenticated;

/* 07:15 UTC — утро по Хельсинки, после напоминаний о сертификатах. */
select cron.schedule('rahtis-onboarding-reminders', '15 7 * * *', $$ select app.run_onboarding_reminders(); $$);
