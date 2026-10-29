-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · GPS: другие провайдеры и всё, что они отдают (29.10.2026)
--
-- Решение пользователя: «проверь всех поставщиков в 9 странах, у кого
-- есть API-токены в кабинетах, сделай как Wialon; по возможности
-- локации, топливо, стоянки — максимально по инфе».
--
-- Провайдеры с ключом, который клиент создаёт сам в своём кабинете
-- (docs/telematics/research-api-tokens.md): Mapon, Navirec, Ruptela
-- TrustTrack, Navixy (и её реселлеры под своей маркой), Samsara.
-- Webfleet (ключ по заявке), Geotab (логин и пароль), ABAX (OAuth-
-- приложение) и rFMS производителей — не сейчас.
--
-- У машины кроме точки — пробег, моточасы, зажигание, топливо (уровень,
-- общий расход, объём бака), состояние «едет / стоит» и с какого
-- времени, водитель и адрес. Всё — только последнее значение, оно
-- перезаписывается; истории нет. Заправки, которые видит система
-- слежения, уходят в «Топливо» (telematics_fuel_add, PRIVACY 2.17).
-- ═══════════════════════════════════════════════════════════════════

alter table public.gps_connections drop constraint gps_connections_provider_check;
alter table public.gps_connections add constraint gps_connections_provider_check
  check (provider in ('WIALON', 'MAPON', 'NAVIREC', 'RUPTELA', 'NAVIXY', 'SAMSARA'));

/* Учётная запись у провайдера (Navirec — id аккаунта) и метка «что уже забрали» (заправки, изменения). */
alter table public.gps_connections
  add column account_ref text check (char_length(account_ref) <= 200),
  add column sync_cursor text check (char_length(sync_cursor) <= 200);

grant select (provider) on public.gps_connections to authenticated;

alter table public.gps_units
  add column odometer_km integer check (odometer_km between 0 and 10000000),
  add column engine_hours numeric(10, 1) check (engine_hours >= 0),
  add column ignition boolean,
  add column fuel_level_pct numeric(5, 1) check (fuel_level_pct between 0 and 100),
  add column fuel_level_l numeric(8, 1) check (fuel_level_l >= 0),
  add column fuel_used_l numeric(14, 1) check (fuel_used_l >= 0),
  add column tank_l numeric(8, 1) check (tank_l > 0),
  add column state text check (state in ('MOVING', 'STOPPED', 'PARKED', 'OFFLINE')),
  add column state_since timestamptz,
  add column driver text check (char_length(driver) <= 120),
  add column address text check (char_length(address) <= 200);

-- ─── Ключ: запись — с провайдером ───

drop function public.gps_connection_create(uuid, uuid, text, text, text, text);

create or replace function public.gps_connection_create(
  p_company_id uuid,
  p_user_id uuid,
  p_provider text,
  p_api_host text,
  p_token text,
  p_label text,
  p_account_name text,
  p_account_ref text default null
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
  if p_token is null or char_length(p_token) not between 16 and 400 then
    raise exception 'bad token' using errcode = '22023';
  end if;
  v_secret := vault.create_secret(p_token, 'gps:' || v_id::text, 'RAHTIS GPS ' || p_company_id::text);
  insert into public.gps_connections (id, company_id, provider, api_host, secret_id, label, account_name, account_ref, created_by)
  values (v_id, p_company_id, p_provider, lower(p_api_host), v_secret, nullif(trim(p_label), ''), p_account_name,
          nullif(p_account_ref, ''), p_user_id);
  return v_id;
end;
$$;

revoke all on function public.gps_connection_create(uuid, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.gps_connection_create(uuid, uuid, text, text, text, text, text, text) to service_role;

-- ─── PRIVACY 2.18: провайдеры и данные машины (черновик) ───

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

do $$
declare
  v_doc uuid := pg_temp.draft_of('PRIVACY');
begin
  delete from public.legal_clauses where document_id = v_doc and path = array[2, 18];

  insert into public.legal_clauses (document_id, locale, path, title, body)
  values
    (v_doc, 'fi', array[2, 18], null,
     'GPS-seuranta: kuljetusliike voi liittää palveluun oman ajoneuvoseurantajärjestelmänsä (Wialon, Mapon, Navirec, Ruptela TrustTrack, Navixy tai Samsara) antamalla sen käyttöavaimen. Avain säilytetään salattuna, ja palvelu hakee sillä kuljetusliikkeen ajoneuvoista nimen, rekisterinumeron ja viimeisimmän tilan: sijainnin (aika, koordinaatit, nopeus, suunta ja osoite), liikkuuko vai seisooko ajoneuvo ja mistä lähtien, sytytyksen, mittarilukeman, käyttötunnit, polttoaineen määrän ja kulutuksen sekä järjestelmään kirjautuneen kuljettajan nimen tai tunnisteen, jos järjestelmä ne antaa. Tiedot haetaan, kun kuljetusliike avaa GPS-näkymän. Kustakin ajoneuvosta tallennetaan vain viimeisin tila, joka korvataan seuraavalla haulla; reittihistoriaa ei tallenneta. Järjestelmän havaitsemat tankkaukset tallennetaan kohdan 2.17 mukaisesti. Tiedot näkevät kuljetusliike ja palvelun ylläpito; tilaajat eivät näe niitä. Kuljetusliike vastaa omien kuljettajiensa tiedottamisesta ja on heidän tietojensa osalta rekisterinpitäjä; palvelu käsittelee tietoja sen lukuun. Kuljetusliike voi poistaa liitännän milloin tahansa, jolloin avain ja ajoneuvojen tilat poistetaan.'),
    (v_doc, 'en', array[2, 18], null,
     'GPS tracking: a carrier may connect its own vehicle tracking system (Wialon, Mapon, Navirec, Ruptela TrustTrack, Navixy or Samsara) to the service by providing its access key. The key is stored encrypted, and the service uses it to retrieve, for the carrier''s vehicles, the name, registration number and latest status: position (time, coordinates, speed, heading and address), whether the vehicle is moving or standing and since when, ignition, odometer reading, engine hours, fuel level and consumption, and the name or identifier of the driver logged in to the system, where the system provides them. The data is retrieved when the carrier opens the GPS view. Only the latest status of each vehicle is stored and it is replaced on the next retrieval; no route history is stored. Refuelling detected by the system is stored as described in clause 2.17. The data is visible to the carrier and the service administrators; shippers do not see it. The carrier is responsible for informing its own drivers and is the controller of their data; the service processes the data on its behalf. The carrier may remove the connection at any time, in which case the key and the vehicle statuses are deleted.');
end;
$$;
