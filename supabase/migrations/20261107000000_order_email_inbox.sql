-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заказ из пересланного письма (6.11.2026)
--
-- У каждой компании-заказчика и перевозчика (не у клиента перевозчика)
-- свой адрес orders-<token>@<INBOUND_EMAIL_DOMAIN>. Пересланное письмо
-- клиента разбирает тот же сценарий n8n, что «из текста или PDF», и
-- в кабинете появляется черновик: форма заказа открывается заполненной,
-- публикует человек. Заказ сам не создаётся и не публикуется никогда.
--
--   order_inbox_addresses — адрес (токен) и дополнительные отправители.
--     Токен меняет главный пользователь: старый адрес перестаёт
--     принимать сразу. Принимаются письма только от входов компании
--     (их почта) и от адресов из allowed_senders.
--   order_email_drafts — письмо → черновик: тема, от кого, когда, ответ
--     разбора (jsonb). Тело письма и файлы не хранятся. Повтор того же
--     Message-ID не создаёт второго черновика. Хранится 30 дней
--     (ежедневная очистка /api/retention/photos).
-- ═══════════════════════════════════════════════════════════════════

create table public.order_inbox_addresses (
  company_id uuid primary key references public.companies (id) on delete cascade,
  token text not null unique,
  /* Кроме почты входов компании: например, общий ящик orders@yritys.fi. */
  allowed_senders text[] not null default '{}',
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  rotated_by uuid references auth.users (id) on delete set null,

  constraint order_inbox_token_format check (token ~ '^[a-z0-9]{12,32}$'),
  constraint order_inbox_senders_count check (cardinality(allowed_senders) <= 20)
);

comment on table public.order_inbox_addresses is
  'Адрес пересылки заказов компании (orders-<token>@домен) и дополнительные разрешённые отправители.';

alter table public.order_inbox_addresses enable row level security;
revoke all on public.order_inbox_addresses from anon, authenticated;

/* Читают люди компании; меняют только функции ниже. */
create policy order_inbox_addresses_company
  on public.order_inbox_addresses for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy mfa_required on public.order_inbox_addresses
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

grant select on public.order_inbox_addresses to authenticated;
grant all on public.order_inbox_addresses to service_role;


create table public.order_email_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  /* Message-ID письма — защита от повтора вебхука и двойной пересылки. */
  message_id text not null,
  provider_email_id text,
  from_address text not null,
  subject text not null default '',
  received_at timestamptz not null,
  /* PENDING — разбирается; PARSED — черновик готов; FAILED — не прочиталось; USED — заказ создан; DISMISSED — не нужно. */
  status text not null default 'PENDING',
  draft jsonb,
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (company_id, message_id),
  constraint order_email_drafts_status check (status in ('PENDING', 'PARSED', 'FAILED', 'USED', 'DISMISSED')),
  constraint order_email_drafts_message_id check (char_length(message_id) between 1 and 500),
  constraint order_email_drafts_from check (char_length(from_address) between 3 and 320),
  constraint order_email_drafts_subject check (char_length(subject) <= 300),
  constraint order_email_drafts_draft check (draft is null or jsonb_typeof(draft) = 'object')
);

comment on table public.order_email_drafts is
  'Черновики заказов из пересланных писем: тема, отправитель, время и разобранные поля. Тело письма и файлы не хранятся; 30 дней.';

create index order_email_drafts_company on public.order_email_drafts (company_id, received_at desc);
create index order_email_drafts_received on public.order_email_drafts (received_at);

alter table public.order_email_drafts enable row level security;
revoke all on public.order_email_drafts from anon, authenticated;

create policy order_email_drafts_company
  on public.order_email_drafts for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy mfa_required on public.order_email_drafts
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

grant select on public.order_email_drafts to authenticated;
grant all on public.order_email_drafts to service_role;


-- ── Адрес компании ─────────────────────────────────────────────────

/* 16 случайных символов [0-9a-f] из двух uuid v4 (первые 12 знаков uuid случайны целиком). */
create or replace function app.new_inbox_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
      || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4);
$$;

revoke all on function app.new_inbox_token() from public, anon, authenticated;

/* Компания, которой положен адрес: заказчик или перевозчик со входами, не клиент перевозчика. */
create or replace function app.inbox_company()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.companies c
  where c.id = (select app.current_company_id())
    and c.kind in ('SHIPPER', 'CARRIER')
    and c.client_of is null
    and c.status = 'ACTIVE';
$$;

revoke all on function app.inbox_company() from public, anon;

/* Адрес компании; нет — заводится при первом показе. */
create or replace function public.order_inbox_address()
returns table (token text, allowed_senders text[], rotated_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := app.inbox_company();
begin
  if v_company is null then
    return;
  end if;

  insert into public.order_inbox_addresses (company_id, token)
  values (v_company, app.new_inbox_token())
  on conflict (company_id) do nothing;

  return query
    select a.token, a.allowed_senders, a.rotated_at
    from public.order_inbox_addresses a
    where a.company_id = v_company;
end;
$$;

revoke all on function public.order_inbox_address() from public, anon;
grant execute on function public.order_inbox_address() to authenticated;

/* Главный пользователь компании (не диспетчер). */
create or replace function app.inbox_owner_company()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select app.inbox_company()
  where exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.member_kind = 'OWNER'
  );
$$;

revoke all on function app.inbox_owner_company() from public, anon;

/* Новый адрес: старый перестаёт принимать письма сразу. */
create or replace function public.rotate_order_inbox_address()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := app.inbox_owner_company();
  v_token text := app.new_inbox_token();
begin
  if v_company is null then
    raise exception 'Адрес меняет главный пользователь компании.' using errcode = '42501';
  end if;

  insert into public.order_inbox_addresses (company_id, token, rotated_at, rotated_by)
  values (v_company, v_token, now(), (select auth.uid()))
  on conflict (company_id) do update
    set token = excluded.token, rotated_at = excluded.rotated_at, rotated_by = excluded.rotated_by;

  return v_token;
end;
$$;

revoke all on function public.rotate_order_inbox_address() from public, anon;
grant execute on function public.rotate_order_inbox_address() to authenticated;

/* Дополнительные отправители: адреса почты, без повторов, не больше 20. */
create or replace function public.set_order_inbox_senders(p_senders text[])
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := app.inbox_owner_company();
  v_list text[];
begin
  if v_company is null then
    raise exception 'Отправителей меняет главный пользователь компании.' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct s order by s), '{}') into v_list
  from (select lower(btrim(x)) as s from unnest(coalesce(p_senders, '{}')) x) q
  where s <> '';

  if cardinality(v_list) > 20 then
    raise exception 'Не больше 20 адресов.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_list) s where s !~ '^[^@[:space:]<>,;]+@[^@[:space:]<>,;]+\.[a-z]{2,}$' or char_length(s) > 254) then
    raise exception 'Неверный адрес почты.' using errcode = '22023';
  end if;

  insert into public.order_inbox_addresses (company_id, token, allowed_senders)
  values (v_company, app.new_inbox_token(), v_list)
  on conflict (company_id) do update set allowed_senders = excluded.allowed_senders;

  return v_list;
end;
$$;

revoke all on function public.set_order_inbox_senders(text[]) from public, anon;
grant execute on function public.set_order_inbox_senders(text[]) to authenticated;


-- ── Приём письма (только служебный ключ) ───────────────────────────

/*
 * По токену — компания и кто вправе присылать: почта входов компании
 * (заказчик, перевозчик и их диспетчеры; не водители) и
 * дополнительные адреса. Нет адреса или компания не активна — пусто.
 */
create or replace function public.inbound_order_target(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'company_id', c.id,
    'kind', c.kind,
    'country', c.country,
    'language', c.language,
    'own_access', c.kind <> 'CARRIER' or coalesce(app.own_orders_allowed(c.id), false),
    'allowed', a.allowed_senders,
    'members', coalesce((
      select jsonb_agg(lower(u.email))
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.company_id = c.id
        and p.role in ('SHIPPER', 'CARRIER')
        and u.email is not null
    ), '[]'::jsonb)
  )
  from public.order_inbox_addresses a
  join public.companies c on c.id = a.company_id
  where a.token = lower(btrim(p_token))
    and c.status = 'ACTIVE'
    and c.client_of is null
    and c.kind in ('SHIPPER', 'CARRIER');
$$;

revoke all on function public.inbound_order_target(text) from public, anon, authenticated;
grant execute on function public.inbound_order_target(text) to service_role;


-- ── Черновик: использован или не нужен ─────────────────────────────

/*
 * USED — с заказом, который создал этот же человек из черновика (заказ
 * своей компании: заказчика или свой рейс перевозчика). DISMISSED — без.
 */
create or replace function public.close_order_email_draft(p_id uuid, p_order_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  if p_order_id is not null and not exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (o.shipper_company_id = v_company or o.assigned_company_id = v_company)
  ) then
    raise exception 'Заказ не найден.' using errcode = '22023';
  end if;

  update public.order_email_drafts
  set status = case when p_order_id is null then 'DISMISSED' else 'USED' end,
      order_id = p_order_id,
      updated_at = now()
  where id = p_id
    and company_id = v_company
    and status in ('PENDING', 'PARSED', 'FAILED');
end;
$$;

revoke all on function public.close_order_email_draft(uuid, uuid) from public, anon;
grant execute on function public.close_order_email_draft(uuid, uuid) to authenticated;
