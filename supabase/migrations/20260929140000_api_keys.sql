-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · API для заказчиков, этап 1: ключи, журнал, чтение
--
-- Решения пользователя 29.09.2026: API сначала для заказчиков; ключ
-- выпускает сама активная компания в кабинете, бесплатно; первая версия
-- читает заказы, пишет (этап 2) и шлёт вебхуки (этап 3).
--
-- Ключ хранится только хэшем. Сам ключ создаёт сервер приложения и
-- показывает человеку один раз; в базу он не приходит ни при выпуске, ни
-- при проверке — сюда передаётся SHA-256, и совпадение ищется по нему.
--
-- Ключ действует от имени компании и того, кто его выпустил. Там, где
-- кабинет зовёт функцию с проверками (offers_for_shipper, а на этапе 2 —
-- create_order), обёртка ставит в транзакции личность выпустившего
-- (request.jwt.claims) и зовёт ту же функцию: правила анонимности,
-- контуры «тест/настоящие» и остальное не дублируются.
--
-- Ключ перестаёт работать сам, если компания не активна или заморожена,
-- или если выпустивший больше не заказчик этой компании.
--
-- Журнал запросов хранится 90 дней (политика, черновик).
-- ═══════════════════════════════════════════════════════════════════

create type public.api_scope as enum ('READ', 'WRITE');

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  /* Начало ключа — чтобы человек узнал свой ключ в списке. Не секрет. */
  prefix text not null unique,
  /* SHA-256 всего ключа, hex. */
  key_hash text not null unique,
  scope public.api_scope not null default 'READ',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,

  constraint api_keys_name_length check (length(btrim(name)) between 1 and 60),
  constraint api_keys_hash_shape check (key_hash ~ '^[0-9a-f]{64}$'),
  constraint api_keys_prefix_shape check (prefix ~ '^rhs_(live|test)_[0-9a-f]{8}$')
);

create index api_keys_company_idx on public.api_keys (company_id, created_at desc);

comment on table public.api_keys is
  'Ключи API компании. Хранится только SHA-256; сам ключ показывается один раз при выпуске.';

alter table public.api_keys enable row level security;
revoke all on public.api_keys from anon, authenticated;
grant select (id, company_id, name, prefix, scope, created_by, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;

create policy api_keys_select_own
  on public.api_keys for select to authenticated
  using (company_id = (select app.current_company_id()) or (select app.is_admin()));


create table public.api_requests (
  id bigint generated always as identity primary key,
  key_id uuid not null references public.api_keys (id) on delete cascade,
  method text not null,
  path text not null,
  status smallint not null,
  duration_ms integer not null,
  created_at timestamptz not null default now(),

  constraint api_requests_method check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  constraint api_requests_path_length check (length(path) <= 200)
);

create index api_requests_key_idx on public.api_requests (key_id, created_at desc);
create index api_requests_created_idx on public.api_requests (created_at);

comment on table public.api_requests is
  'Журнал запросов API: ключ, метод, путь без параметров, код ответа, время. Хранится 90 дней.';

alter table public.api_requests enable row level security;
revoke all on public.api_requests from anon, authenticated;
grant select on public.api_requests to authenticated;

create policy api_requests_select_own
  on public.api_requests for select to authenticated
  using (
    (select app.is_admin())
    or exists (
      select 1 from public.api_keys k
      where k.id = api_requests.key_id and k.company_id = (select app.current_company_id())
    )
  );


-- ── Выпуск и отзыв — из кабинета ───────────────────────────────────

create or replace function public.api_key_create(
  p_name text,
  p_scope public.api_scope,
  p_prefix text,
  p_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'SHIPPER' then
    raise exception 'Ключ API выпускает заказчик.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = (select app.current_company_id());

  if v_company.id is null or v_company.status <> 'ACTIVE' or v_company.frozen_at is not null then
    raise exception 'Ключ выпускает активная компания.' using errcode = '55000';
  end if;

  if (select count(*) from public.api_keys where company_id = v_company.id and revoked_at is null) >= 10 then
    raise exception 'У компании уже десять действующих ключей. Отзовите ненужный.' using errcode = '55001';
  end if;

  /* Контур ключа виден по префиксу: тестовой компании — rhs_test_. */
  if p_prefix !~ ('^rhs_' || case when v_company.is_test then 'test' else 'live' end || '_[0-9a-f]{8}$') then
    raise exception 'Префикс ключа не соответствует компании.' using errcode = '22023';
  end if;

  insert into public.api_keys (company_id, name, prefix, key_hash, scope, created_by)
  values (v_company.id, btrim(p_name), p_prefix, lower(p_hash), p_scope, (select auth.uid()))
  returning id into v_id;

  perform app.audit('api_key.create', v_id::text, jsonb_build_object('company', v_company.id, 'scope', p_scope));
  return v_id;
end;
$$;

revoke all on function public.api_key_create(text, public.api_scope, text, text) from public, anon;
grant execute on function public.api_key_create(text, public.api_scope, text, text) to authenticated;


create or replace function public.api_key_revoke(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.api_keys
  set revoked_at = now(), revoked_by = (select auth.uid())
  where id = p_id
    and revoked_at is null
    and (company_id = (select app.current_company_id()) or (select app.is_admin()));

  if not found then
    raise exception 'Ключ не найден или уже отозван.' using errcode = 'P0002';
  end if;

  perform app.audit('api_key.revoke', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.api_key_revoke(uuid) from public, anon;
grant execute on function public.api_key_revoke(uuid) to authenticated;


-- ── Проверка ключа и журнал — только серверу приложения ────────────

create or replace function public.api_authenticate(p_hash text)
returns table (
  key_id uuid,
  company_id uuid,
  user_id uuid,
  scope public.api_scope,
  is_test boolean,
  limited boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys;
begin
  select * into v_key from public.api_keys k where k.key_hash = lower(p_hash) and k.revoked_at is null;
  if v_key.id is null then
    return;
  end if;

  /* Компания активна, выпустивший всё ещё заказчик этой компании. */
  if not exists (
    select 1
    from public.companies c
    join public.profiles p on p.company_id = c.id
    where c.id = v_key.company_id
      and c.status = 'ACTIVE'
      and c.frozen_at is null
      and p.id = v_key.created_by
      and p.role = 'SHIPPER'
  ) then
    return;
  end if;

  /* Не чаще раза в минуту: отметка «использован» — не журнал. */
  update public.api_keys set last_used_at = now()
  where id = v_key.id and (last_used_at is null or last_used_at < now() - interval '1 minute');

  return query
  select
    v_key.id,
    v_key.company_id,
    v_key.created_by,
    v_key.scope,
    (select c.is_test from public.companies c where c.id = v_key.company_id),
    (select count(*) from public.api_requests r
     where r.key_id = v_key.id and r.created_at > now() - interval '1 minute') >= 60;
end;
$$;

revoke all on function public.api_authenticate(text) from public, anon, authenticated;
grant execute on function public.api_authenticate(text) to service_role;


create or replace function public.api_log(
  p_key_id uuid,
  p_method text,
  p_path text,
  p_status integer,
  p_duration_ms integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.api_requests (key_id, method, path, status, duration_ms)
  values (p_key_id, upper(p_method), left(p_path, 200), p_status, greatest(0, p_duration_ms));
$$;

revoke all on function public.api_log(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.api_log(uuid, text, text, integer, integer) to service_role;


/*
 * Машина и водитель по заказам — тем же offers_for_shipper, что кабинет,
 * от имени выпустившего ключ. Анонимность перевозчика соблюдается там.
 */
create or replace function public.api_order_vehicles(p_key_id uuid, p_order_ids uuid[])
returns table (
  order_id uuid,
  plate text,
  make text,
  euro_class text,
  axles integer,
  driver_name text,
  languages text[],
  rating numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select k.created_by into v_user from public.api_keys k where k.id = p_key_id and k.revoked_at is null;
  if v_user is null then
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

  return query
  select o.order_id, o.plate::text, o.make::text, o.euro_class::text, o.axles::integer,
         o.driver_name::text, o.languages::text[], o.rating::numeric
  from public.offers_for_shipper(p_order_ids) o
  where o.is_assigned or o.is_chosen;
end;
$$;

revoke all on function public.api_order_vehicles(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.api_order_vehicles(uuid, uuid[]) to service_role;


-- ── Журнал: 90 дней ─────────────────────────────────────────────────

create or replace function app.purge_api_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.api_requests where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app.purge_api_requests() from public, anon, authenticated;

select cron.schedule(
  'rahtis-api-requests-retention',
  '50 3 * * *',
  $$ select app.purge_api_requests(); $$
);
