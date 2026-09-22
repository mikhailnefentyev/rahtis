-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · заправки, стоянки, душ и сервис на карте водителя
--
-- 22.09.2026 пользователь дал таблицы по Финляндии, Швеции, Норвегии и
-- Дании (исследование от 22.09.2026): заправки для фур, стоянки, душ и
-- сауна, сервис и мойки. Решено: только в приложении водителя, отдельной
-- вкладкой «Kartta», тексты на финском и английском.
--
-- Данные — справочник, а не часть рейсов: источник правды — файл
-- data/driver-places/places.json в репозитории (координаты получены из
-- адресов через TomTom и проверены; переводы fi/en). В базу его загружает
-- scripts/import-driver-places.mjs служебным ключом; повторная загрузка
-- обновляет точки по id и удаляет исчезнувшие.
--
-- Читать могут только водитель приложения и оператор: кабинетам
-- перевозчика и заказчика справочник не нужен и не показывается.
-- ═══════════════════════════════════════════════════════════════════

create table public.driver_places (
  id text primary key,
  country text not null check (country in ('FI', 'SE', 'NO', 'DK')),
  kinds text[] not null check (kinds <@ array['FUEL', 'PARKING', 'SHOWER', 'SERVICE'] and cardinality(kinds) > 0),
  name_fi text not null,
  name_en text not null,
  network text,
  address text,
  lat double precision not null check (lat between 50 and 72),
  lon double precision not null check (lon between 3 and 33),
  /* Координаты по центру населённого пункта, а не по адресу. */
  approx boolean not null default false,
  hours_fi text,
  hours_en text,
  phone text,
  free boolean not null default false,
  secured boolean not null default false,
  sauna boolean not null default false,
  /* В описании есть предупреждение: кражи, штрафы, закрыто, старая цена. */
  warning boolean not null default false,
  /* [{k: price|security|facilities|capacity|notes|state, fi, en}] */
  details jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.driver_places is
  'Справочник для водителя: заправки, стоянки, душ, сервис в FI/SE/NO/DK. Загружается из data/driver-places/places.json.';

create index driver_places_country_idx on public.driver_places (country);

alter table public.driver_places enable row level security;
revoke all on public.driver_places from anon, authenticated;
grant select on public.driver_places to authenticated;

create policy driver_places_read
  on public.driver_places for select to authenticated
  using ((select app.current_driver_id()) is not null or (select app.is_admin()));
