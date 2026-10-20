-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · клиенты и приглашения из других стран
--
-- Продолжение пакетов стран (20261021120000). Клиент перевозчика и
-- приглашённая компания до сих пор были финскими по определению: страна
-- вставлялась строкой 'FI', номер проверялся маской Y-tunnus. Польский
-- перевозчик не мог завести своего польского клиента, финский — немецкого.
--
-- Теперь у клиента и у приглашения есть страна. Не указана — страна
-- перевозчика: свои клиенты у перевозчика чаще всего из его же страны.
-- Номер компании для Финляндии по-прежнему проверяется маской Y-tunnus;
-- для остальных стран контрольные цифры проверяет приложение
-- (src/lib/country), база держит только форму записи.
-- ═══════════════════════════════════════════════════════════════════

/* Номер компании в виде хранения: пусто, Y-tunnus для FI, буквы-цифры-дефис для прочих. */
create or replace function app.business_id_ok(p_country text, p_business_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_business_id = ''
      or (p_country = 'FI' and p_business_id ~ '^\d{7}-\d$')
      or (p_country <> 'FI' and p_business_id ~ '^[A-Z0-9][A-Z0-9-]{3,19}$')
$$;

grant execute on function app.business_id_ok(text, text) to authenticated;


-- ── Приглашения ────────────────────────────────────────────────────

alter table public.shipper_invites
  add column country char(2) not null default 'FI',
  add constraint shipper_invites_country_format check (country ~ '^[A-Z]{2}$');

grant select (country) on public.shipper_invites to authenticated;

drop function public.carrier_invite_company(text, text, text, text, text);

/* Приглашение заказчика или перевозчика: только активный перевозчик, не больше 20 в сутки. */
create or replace function public.carrier_invite_company(
  p_kind text, p_name text, p_business_id text, p_email text, p_token_hash text, p_country text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_country text;
  v_id uuid;
begin
  if p_kind not in ('SHIPPER', 'CARRIER') then
    raise exception 'Вид приглашения: SHIPPER или CARRIER.' using errcode = '22023';
  end if;
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Приглашает перевозчик.' using errcode = '42501';
  end if;
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null or v_company.status <> 'ACTIVE' or v_company.frozen_at is not null then
    raise exception 'Приглашает активная компания.' using errcode = '55000';
  end if;

  v_country := upper(btrim(coalesce(nullif(p_country, ''), v_company.country)));
  if v_country !~ '^[A-Z]{2}$' or btrim(coalesce(p_business_id, '')) = ''
     or not app.business_id_ok(v_country, upper(btrim(p_business_id))) then
    raise exception 'Номер компании указан неверно.' using errcode = '22023';
  end if;

  if (select count(*) from public.shipper_invites
      where carrier_company_id = v_company.id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Не больше 20 приглашений в сутки.' using errcode = '55001';
  end if;

  insert into public.shipper_invites (carrier_company_id, token_hash, company_name, business_id, email, created_by, invite_kind, country)
  values (v_company.id, lower(p_token_hash), btrim(p_name), upper(btrim(p_business_id)), lower(btrim(p_email)), (select auth.uid()), p_kind, v_country)
  returning id into v_id;

  perform app.audit('company_invite.create', v_id::text, jsonb_build_object('carrier', v_company.id, 'kind', p_kind, 'country', v_country));
  return v_id;
end;
$$;

revoke all on function public.carrier_invite_company(text, text, text, text, text, text) from public, anon;
grant execute on function public.carrier_invite_company(text, text, text, text, text, text) to authenticated;


-- ── Справочник клиентов ────────────────────────────────────────────

drop function public.carrier_clients();

/* Клиенты перевозчика для формы своего рейса — со страной. */
create function public.carrier_clients()
returns table (id uuid, name text, country text, business_id text, contact_email text, orders integer, last_order_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.country::text, c.business_id, c.contact_email,
         (select count(*)::integer from public.orders o where o.shipper_company_id = c.id),
         (select max(o.created_at) from public.orders o where o.shipper_company_id = c.id)
  from public.companies c
  where c.client_of = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  order by 7 desc nulls last, c.name;
$$;

revoke all on function public.carrier_clients() from public, anon;
grant execute on function public.carrier_clients() to authenticated;


/*
 * Свой рейс перевозчика — тело из 20261012100000; новое — страна клиента
 * (p_client->>'country', по умолчанию страна перевозчика) и проверка
 * номера по ней. Знакомый клиент ищется по стране и номеру.
 */
create or replace function public.carrier_create_own_order(
  p_client jsonb, p_order jsonb, p_stops jsonb, p_vehicle_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carrier public.companies;
  v_client uuid;
  v_name text := app.clean_client_name(p_client->>'name');
  v_bid text := upper(btrim(coalesce(p_client->>'business_id', '')));
  v_email text := lower(btrim(coalesce(p_client->>'email', '')));
  v_country text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Свой рейс заводит перевозчик.' using errcode = '42501';
  end if;

  select * into v_carrier from public.companies where id = (select app.current_company_id());

  if v_carrier.id is null or v_carrier.status <> 'ACTIVE' or v_carrier.frozen_at is not null then
    raise exception 'Свои рейсы — у активной компании.' using errcode = '55000';
  end if;

  perform app.assert_legal_current(v_carrier.id);

  if not app.own_orders_allowed(v_carrier.id) then
    raise exception 'Свои рейсы — по подписке.' using errcode = '55010';
  end if;

  if p_vehicle_id is null then
    raise exception 'Выберите машину.' using errcode = '22023';
  end if;

  if not app.client_email_ok(v_email) then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  v_country := upper(btrim(coalesce(nullif(p_client->>'country', ''), v_carrier.country)));
  if v_country !~ '^[A-Z]{2}$' or not app.business_id_ok(v_country, v_bid) then
    raise exception 'Номер клиента указан неверно.' using errcode = '22023';
  end if;

  if nullif(p_client->>'id', '') is not null then
    select id into v_client from public.companies
    where id = (p_client->>'id')::uuid and client_of = v_carrier.id;
    if v_client is null then
      raise exception 'Клиент не найден.' using errcode = 'P0002';
    end if;
  else
    if length(v_name) < 2 or length(v_name) > 200 then
      raise exception 'Укажите имя клиента.' using errcode = '22023';
    end if;

    select id into v_client from public.companies
    where client_of = v_carrier.id
      and ((v_bid <> '' and country = v_country and business_id = v_bid)
        or (v_bid = '' and lower(app.clean_client_name(name)) = lower(v_name)))
    order by created_at
    limit 1;

    if v_client is null then
      /* Клиент тестового перевозчика — тестовый: контуры не смешиваются. */
      insert into public.companies (kind, status, name, country, business_id, contact_email, language, client_of, is_test)
      values ('SHIPPER', 'APPROVED', v_name, v_country, v_bid, v_email, v_carrier.language, v_carrier.id, v_carrier.is_test)
      returning id into v_client;
    end if;
  end if;

  /* Новая почта клиента заменяет старую: ссылку отправляют на неё. */
  if v_email <> '' then
    update public.companies set contact_email = v_email where id = v_client and contact_email <> v_email;
  end if;

  return app.create_order_for(
    v_client,
    p_order - 'direct_vehicle_id' - 'group_vehicle_ids' - 'group_minutes' - 'desk_contract',
    p_stops, true, p_vehicle_id);
end;
$$;


drop function public.carrier_update_client(uuid, text, text, text);

/*
 * Имя, страна, номер и почта клиента. Правит перевозчик, чей это клиент.
 * Страна не передана — остаётся прежней.
 */
create or replace function public.carrier_update_client(
  p_client_id uuid, p_name text, p_business_id text, p_email text, p_country text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
  v_name text := app.clean_client_name(p_name);
  v_bid text := upper(btrim(coalesce(p_business_id, '')));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_country text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' or v_me is null then
    raise exception 'Клиентов правит перевозчик.' using errcode = '42501';
  end if;

  select country into v_country from public.companies where id = p_client_id and client_of = v_me;
  if v_country is null then
    raise exception 'Клиент не найден.' using errcode = 'P0002';
  end if;
  v_country := upper(btrim(coalesce(nullif(p_country, ''), v_country)));

  if length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'Укажите имя клиента.' using errcode = '22023';
  end if;

  if not app.client_email_ok(v_email) then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  if v_country !~ '^[A-Z]{2}$' or not app.business_id_ok(v_country, v_bid) then
    raise exception 'Номер клиента указан неверно.' using errcode = '22023';
  end if;

  /* Второй клиент с тем же именем или номером — это дубль, а не правка. */
  if exists (
    select 1 from public.companies c
    where c.client_of = v_me and c.id <> p_client_id
      and ((v_bid <> '' and c.country = v_country and c.business_id = v_bid)
        or lower(app.clean_client_name(c.name)) = lower(v_name))
  ) then
    raise exception 'Такой клиент уже есть.' using errcode = '23505';
  end if;

  update public.companies
  set name = v_name, country = v_country, business_id = v_bid, contact_email = v_email
  where id = p_client_id and client_of = v_me;
end;
$$;

revoke all on function public.carrier_update_client(uuid, text, text, text, text) from public, anon;
grant execute on function public.carrier_update_client(uuid, text, text, text, text) to authenticated;
