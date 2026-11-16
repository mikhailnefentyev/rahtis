-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Румыния (16.11.2026)
--
-- Клиент из Румынии попросил регистрацию. Код страны — src/lib/country
-- (CUI с контрольной цифрой, VIES, +40, индекс из 6 цифр); здесь то, что
-- живёт в базе:
--
--   1. Часовой пояс точек в Румынии — Europe/Bucharest (UTC+2, как
--      Хельсинки, но правило должно быть явным, а не совпадением).
--   2. Лей (RON) — рабочая валюта компании, как злотый у польской:
--      домен currency_code, валюта страны, курс ЕЦБ подтягивается сам.
--   3. Румынский — язык, на котором говорит водитель.
--   4. Справочник мест водителя: Румыния начинается от 43,6° с. ш.
--   5. Номер компании: CUI бывает короче четырёх знаков (старые
--      фирмы) — форма записи в базе принимает от двух.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Часовой пояс точки ─────────────────────────────────────────

create or replace function app.stop_timezone(p_country text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_country, 'FI'))
    when 'SE' then 'Europe/Stockholm'
    when 'NO' then 'Europe/Oslo'
    when 'DK' then 'Europe/Copenhagen'
    when 'EE' then 'Europe/Tallinn'
    when 'LV' then 'Europe/Riga'
    when 'LT' then 'Europe/Vilnius'
    when 'PL' then 'Europe/Warsaw'
    when 'DE' then 'Europe/Berlin'
    when 'RO' then 'Europe/Bucharest'
    else 'Europe/Helsinki'
  end
$$;

-- ── 2. Лей ────────────────────────────────────────────────────────

do $$
declare
  v_name text;
begin
  for v_name in
    select c.conname from pg_constraint c
    join pg_type t on t.oid = c.contypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'currency_code' and c.contype = 'c'
  loop
    execute format('alter domain public.currency_code drop constraint %I', v_name);
  end loop;
end;
$$;

alter domain public.currency_code
  add constraint currency_code_check check (value in ('EUR', 'SEK', 'NOK', 'DKK', 'PLN', 'RON'));

create or replace function app.country_currency(p_country text)
returns public.currency_code
language sql
immutable
set search_path = ''
as $$
  select (case upper(coalesce(p_country, ''))
    when 'SE' then 'SEK'
    when 'NO' then 'NOK'
    when 'DK' then 'DKK'
    when 'PL' then 'PLN'
    when 'RO' then 'RON'
    else 'EUR'
  end)::public.currency_code;
$$;

-- ── 3. Языки водителя ─────────────────────────────────────────────

alter table public.vehicles
  drop constraint vehicles_languages_known,
  add constraint vehicles_languages_known check (
    array_length(languages, 1) between 1 and 8
    and languages <@ array['FI', 'SV', 'EN', 'RU', 'ET', 'NO', 'DA', 'DE', 'PL', 'LT', 'LV', 'RO']
  );

alter table public.drivers
  drop constraint drivers_languages_known,
  add constraint drivers_languages_known check (
    coalesce(array_length(languages, 1), 0) between 1 and 8
    and languages <@ array['FI', 'SV', 'EN', 'RU', 'ET', 'NO', 'DA', 'DE', 'PL', 'LT', 'LV', 'RO']
  );

-- ── 4. Места водителя ─────────────────────────────────────────────

alter table public.driver_places
  drop constraint driver_places_country_check,
  add constraint driver_places_country_check
    check (country in ('FI', 'SE', 'NO', 'DK', 'EE', 'LV', 'LT', 'PL', 'DE', 'RO')),
  drop constraint driver_places_lat_check,
  add constraint driver_places_lat_check check (lat between 43 and 72);

-- ── 5. Номер компании ─────────────────────────────────────────────

/* Пусто, Y-tunnus для FI, буквы-цифры-дефис от двух знаков для прочих (CUI старых фирм — 2–3 цифры). */
create or replace function app.business_id_ok(p_country text, p_business_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_business_id = ''
      or (p_country = 'FI' and p_business_id ~ '^\d{7}-\d$')
      or (p_country <> 'FI' and p_business_id ~ '^[A-Z0-9][A-Z0-9-]{1,19}$')
$$;
