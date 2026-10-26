-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · прицепы, кузова и массы (26.10.2026)
--
-- Первая часть «грунт и самосвалы». Самосвальная работа описывается
-- сцепкой: «5-осный nuppi + 4-осный кассетный прицеп», «3-осный тягач +
-- самосвальный полуприцеп». Разрешённая масса считается по стране и
-- числу осей (src/lib/fleet/mass.ts), а грузоподъёмность — как
-- разрешённая масса минус тара.
--
-- Здесь только данные:
--   · у машины — тип кузова, масса по техпаспорту, тара;
--   · прицепы — отдельные карточки компании: вид (полуприцеп, прицеп,
--     прицеп с центральной осью), оси, кузов, масса по техпаспорту, тара
--     и отметка «сдвоенные колёса» (в Финляндии от неё зависит 68/76 т).
--
-- Прицеп не проходит допуск оператора: на стол выходит машина, а не
-- прицеп, и правка прицепа не трогает допуск машины.
-- ═══════════════════════════════════════════════════════════════════

create type public.body_type as enum (
  'TIPPER',     -- самосвал (kippi)
  'CASSETTE',   -- кассета (kasetti): кузов переставляется на прицеп
  'FLATBED',    -- бортовая платформа
  'CONTAINER',  -- контейнерное шасси
  'CURTAIN',    -- тент
  'BOX',        -- фургон
  'TANK',       -- цистерна
  'OTHER'
);

create type public.trailer_kind as enum (
  'SEMI',         -- полуприцеп (puoliperävaunu)
  'FULL',         -- прицеп с дышлом (täysperävaunu)
  'CENTER_AXLE'   -- прицеп с центральной осью (keskiakseliperävaunu)
);

alter table public.vehicles
  add column body_type public.body_type,
  add column gross_max_kg integer
    constraint vehicles_gross_max_range check (gross_max_kg between 1000 and 80000),
  add column tare_kg integer
    constraint vehicles_tare_range check (tare_kg between 500 and 40000);

/* Правка у машины выдаётся по колонкам (см. 20260816160000_fleet). */
grant update (body_type, gross_max_kg, tare_kg) on public.vehicles to authenticated;

comment on column public.vehicles.gross_max_kg is
  'Наибольшая масса по техпаспорту (rekisteröintitodistus). Ограничивает расчётную разрешённую массу сверху.';
comment on column public.vehicles.tare_kg is
  'Масса пустой машины. Пока вводится руками; позже будет браться с выездного взвешивания.';

create table public.trailers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  plate text not null,
  kind public.trailer_kind not null,
  axles smallint not null constraint trailers_axles_range check (axles between 1 and 6),
  body_type public.body_type,
  gross_max_kg integer constraint trailers_gross_max_range check (gross_max_kg between 500 and 60000),
  tare_kg integer constraint trailers_tare_range check (tare_kg between 300 and 25000),
  /*
   * В Финляндии сцепка 8/9 осей получает 68/76 т вместо 64/69 т, если не
   * меньше 65 % массы прицепа приходится на сдвоенные колёса. По умолчанию
   * «да»: так устроены почти все самосвальные и кассетные прицепы.
   */
  twin_wheels boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trailers_plate_format check (plate ~ '^[A-ZÅÄÖ0-9-]{2,12}$')
);

comment on table public.trailers is
  'Прицепы и полуприцепы перевозчика. Сцепка с машиной собирается на смену; разрешённая масса считается в src/lib/fleet/mass.ts.';

create unique index trailers_company_plate_key on public.trailers (company_id, plate);

create trigger trailers_touch_updated_at
  before update on public.trailers
  for each row execute function app.touch_updated_at();

alter table public.trailers enable row level security;

create policy trailers_select_own
  on public.trailers for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy trailers_select_admin
  on public.trailers for select to authenticated
  using ((select app.is_admin()));

create policy trailers_insert_own
  on public.trailers for insert to authenticated
  with check (company_id = (select app.current_company_id()));

create policy trailers_update_own
  on public.trailers for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy trailers_delete_own
  on public.trailers for delete to authenticated
  using (company_id = (select app.current_company_id()));

grant select, insert, update, delete on public.trailers to authenticated;
