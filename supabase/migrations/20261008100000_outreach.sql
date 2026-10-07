-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · приглашения от платформы: ежедневная рассылка
--
-- 7.10.2026 решение пользователя: по будним дням 5 приглашений
-- заказчикам и 5 перевозчикам из утверждённого им списка (экспедиторы и
-- линии; перевозчики из открытых данных PRH, общий адрес с их сайта).
--
-- Приглашение от платформы — не от перевозчика: carrier_company_id
-- пуст, origin = 'OPERATOR'. Связи «заказчик — перевозчик» оно не
-- создаёт: звал не перевозчик, и знакомых машин у заказчика нет.
--
-- outreach_targets — список и его состояние: кого звать, утверждён ли
-- адрес, когда ушло письмо. Видит и правит только оператор; рассылку
-- будит база (app.run_outreach) по будним дням в 07:30 UTC. Уходят
-- только строки с approved = true.
-- ═══════════════════════════════════════════════════════════════════

-- ── Приглашение от платформы ───────────────────────────────────────

alter table public.shipper_invites
  alter column carrier_company_id drop not null,
  add column origin text not null default 'CARRIER',
  add constraint shipper_invites_origin check (origin in ('CARRIER', 'OPERATOR')),
  add constraint shipper_invites_origin_inviter check ((origin = 'OPERATOR') = (carrier_company_id is null));

grant select (origin) on public.shipper_invites to authenticated;

/* Связь и уведомление — только когда звал перевозчик. */
do $$
declare
  v_fn text;
  v_def text;
  v_new text;
begin
  foreach v_fn in array array['app.on_invited_shipper_approved()', 'app.on_invited_carrier_approved()'] loop
    v_def := replace(pg_get_functiondef(v_fn::regprocedure), E'\r\n', E'\n');
    v_new := replace(v_def, 'where i.applied_company_id = new.id', 'where i.applied_company_id = new.id and i.carrier_company_id is not null');
    if v_new = v_def then
      raise exception '%: место правки не найдено', v_fn;
    end if;
    execute v_new;
  end loop;
end;
$$;


-- ── Список рассылки ────────────────────────────────────────────────

create table public.outreach_targets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  company_name text not null,
  business_id text,
  email text not null,
  website text,
  source text not null,
  /* Очередь: меньше — раньше. */
  priority integer not null default 100,
  /* Адрес утверждён пользователем; неутверждённые не уходят. */
  approved boolean not null default false,
  status text not null default 'QUEUED',
  invite_id uuid references public.shipper_invites (id) on delete set null,
  sent_at timestamptz,
  error text,
  note text,
  created_at timestamptz not null default now(),
  constraint outreach_targets_kind check (kind in ('SHIPPER', 'CARRIER')),
  constraint outreach_targets_status check (status in ('QUEUED', 'SENT', 'SKIPPED', 'FAILED', 'OPTED_OUT')),
  constraint outreach_targets_email check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
);

create unique index outreach_targets_email_key on public.outreach_targets (email);
create index outreach_targets_queue_idx on public.outreach_targets (kind, priority, created_at) where status = 'QUEUED' and approved;

alter table public.outreach_targets enable row level security;
revoke all on public.outreach_targets from anon, authenticated;

create policy outreach_targets_admin
  on public.outreach_targets for all to authenticated
  using ((select app.is_admin()))
  with check ((select app.is_admin()));
grant select, insert, update, delete on public.outreach_targets to authenticated;

comment on table public.outreach_targets is
  'Список приглашений от платформы: заказчики и перевозчики, общий адрес компании, состояние отправки.';


-- ── Будильник ──────────────────────────────────────────────────────

insert into app.runtime_config (key, value, note)
select 'outreach_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/outreach/daily'),
       'Ежедневные приглашения от платформы. Будит app.run_outreach.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_outreach()
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
  select value into v_url from app.runtime_config where key = 'outreach_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  /*
   * Срок хранения (PRIVACY 2.11): записи рассылки — 12 месяцев. Отказ
   * хранится дольше: иначе через год адрес снова попал бы в рассылку.
   */
  delete from public.outreach_targets
  where status <> 'OPTED_OUT'
    and coalesce(sent_at, created_at) < now() - interval '12 months';

  if v_url is null or v_secret is null then
    raise notice 'Приглашения не разосланы: в app.runtime_config нет outreach_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'outreach')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_outreach() from public, anon, authenticated;

/* 07:30 UTC по будним дням — утро рабочего дня в Финляндии. */
select cron.schedule('rahtis-outreach', '30 7 * * 1-5', $$ select app.run_outreach(); $$);
