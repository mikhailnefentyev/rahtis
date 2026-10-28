-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · GPS: подключение Wialon по ключу (29.10.2026)
--
-- Перевозчик вставляет ключ Wialon (токен или ссылку Locator), и его
-- машины видны на карте кабинета. Как iCal в OwnerHub: ключ даёт сам
-- клиент, платформа ничего не платит.
--
-- Ключ — в Supabase Vault, читается только служебной ролью (сервер
-- RAHTIS при обновлении). Храним ТОЛЬКО последнюю точку машины, она
-- перезаписывается; истории перемещений нет. Трек рейса — следующий шаг.
--
-- PRIVACY 2.18 и 8.4 — в черновик v21, активация — решение пользователя.
-- ═══════════════════════════════════════════════════════════════════

create table public.gps_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  provider text not null default 'WIALON' check (provider in ('WIALON')),
  label text check (char_length(label) <= 80),
  /* Сервер API: hst-api.wialon.com или сервер реселлера. Только имя хоста. */
  api_host text not null check (api_host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  /* Секрет в vault.secrets; наружу не читается. */
  secret_id uuid not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ERROR')),
  account_name text check (char_length(account_name) <= 200),
  last_sync_at timestamptz,
  last_error text check (char_length(last_error) <= 300),
  unit_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index gps_connections_company on public.gps_connections (company_id);

create table public.gps_units (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.gps_connections (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  external_id text not null check (char_length(external_id) <= 64),
  name text not null check (char_length(name) <= 200),
  /* Номер из профиля Wialon (registration_plate), если заполнен. */
  plate text check (char_length(plate) <= 32),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  speed_kmh integer,
  course integer,
  position_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (connection_id, external_id)
);

create index gps_units_company on public.gps_units (company_id);
create unique index gps_units_vehicle on public.gps_units (vehicle_id) where vehicle_id is not null;

alter table public.gps_connections enable row level security;
alter table public.gps_units enable row level security;

revoke all on public.gps_connections from anon, authenticated;
revoke all on public.gps_units from anon, authenticated;

/* Перевозчик читает свои подключения — без secret_id. */
grant select (id, company_id, provider, label, api_host, status, account_name, last_sync_at, last_error, unit_count, created_at)
  on public.gps_connections to authenticated;
grant select on public.gps_units to authenticated;

create policy gps_connections_own on public.gps_connections
  for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy gps_units_own on public.gps_units
  for select to authenticated
  using (company_id = (select app.current_company_id()));

-- ─── Ключ: запись и чтение только сервером (служебная роль) ───

create or replace function public.gps_connection_create(
  p_company_id uuid, p_user_id uuid, p_api_host text, p_token text, p_label text, p_account_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_secret uuid;
begin
  if p_token is null or char_length(p_token) not between 20 and 200 then
    raise exception 'bad token' using errcode = '22023';
  end if;
  v_secret := vault.create_secret(p_token, 'gps:' || v_id::text, 'RAHTIS GPS ' || p_company_id::text);
  insert into public.gps_connections (id, company_id, api_host, secret_id, label, account_name, created_by)
  values (v_id, p_company_id, lower(p_api_host), v_secret, nullif(trim(p_label), ''), p_account_name, p_user_id);
  return v_id;
end;
$$;

create or replace function public.gps_connection_token(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.gps_connections c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.id = p_id;
$$;

create or replace function public.gps_connection_delete(p_id uuid, p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret uuid;
begin
  delete from public.gps_connections
  where id = p_id and company_id = p_company_id
  returning secret_id into v_secret;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
end;
$$;

revoke all on function public.gps_connection_create(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.gps_connection_token(uuid) from public, anon, authenticated;
revoke all on function public.gps_connection_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gps_connection_create(uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.gps_connection_token(uuid) to service_role;
grant execute on function public.gps_connection_delete(uuid, uuid) to service_role;

-- ─── Привязка машины Wialon к машине автопарка ───

create or replace function public.carrier_gps_map_unit(p_unit_id uuid, p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if v_company is null then
    raise exception 'no company' using errcode = '42501';
  end if;
  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = v_company
  ) then
    raise exception 'foreign vehicle' using errcode = '42501';
  end if;
  /* Одна машина — одна точка: старую привязку снимаем. */
  if p_vehicle_id is not null then
    update public.gps_units set vehicle_id = null
    where vehicle_id = p_vehicle_id and company_id = v_company and id <> p_unit_id;
  end if;
  update public.gps_units set vehicle_id = p_vehicle_id
  where id = p_unit_id and company_id = v_company;
  if not found then
    raise exception 'no unit' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.carrier_gps_map_unit(uuid, uuid) from public, anon;
grant execute on function public.carrier_gps_map_unit(uuid, uuid) to authenticated;

-- ─── PRIVACY 2.18 и 8.4 (черновик) ───

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
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  delete from public.legal_clauses where document_id = v_doc and path = array[2, 18];

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, 18], null,
     'GPS-seuranta: kuljetusliike voi liittää palveluun oman ajoneuvoseurantajärjestelmänsä (Wialon) antamalla sen käyttöavaimen. Avain säilytetään salattuna, ja palvelu hakee sillä kuljetusliikkeen ajoneuvojen nimen, rekisterinumeron ja viimeisimmän sijainnin (aika, koordinaatit, nopeus ja suunta), kun kuljetusliike avaa GPS-näkymän. Kustakin ajoneuvosta tallennetaan vain viimeisin sijainti, joka korvataan seuraavalla haulla; reittihistoriaa ei tallenneta. Sijainnit näkevät kuljetusliike ja palvelun ylläpito; tilaajat eivät näe niitä. Kuljetusliike vastaa omien kuljettajiensa tiedottamisesta ja on heidän tietojensa osalta rekisterinpitäjä; palvelu käsittelee tietoja sen lukuun. Kuljetusliike voi poistaa liitännän milloin tahansa, jolloin avain ja sijainnit poistetaan.'),
    (v_doc, 'en', array[2, 18], null,
     'GPS tracking: a carrier may connect its own vehicle tracking system (Wialon) to the service by providing its access key. The key is stored encrypted, and the service uses it to retrieve the name, registration number and latest position (time, coordinates, speed and heading) of the carrier''s vehicles when the carrier opens the GPS view. Only the latest position of each vehicle is stored and it is replaced on the next retrieval; no route history is stored. Positions are visible to the carrier and the service administrators; shippers do not see them. The carrier is responsible for informing its own drivers and is the controller of their data; the service processes the data on its behalf. The carrier may remove the connection at any time, in which case the key and the positions are deleted.');

  perform pg_temp.swap(v_doc, array[8, 4], 'fi',
    'Määräajan umpeuduttua tiedot poistetaan automaattisesti;',
    'Kohdan 2.18 ajoneuvojen sijainnit säilytetään vain viimeisimpänä sijaintina, ja ne poistetaan liitännän poistamisen yhteydessä. Määräajan umpeuduttua tiedot poistetaan automaattisesti;');
  perform pg_temp.swap(v_doc, array[8, 4], 'en',
    'When the period ends, the data is deleted automatically;',
    'The vehicle positions of clause 2.18 are kept only as the latest position and are deleted when the connection is removed. When the period ends, the data is deleted automatically;');
end;
$$;
