-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · конструктор сцепок, этап A: карточки и сцепки (28.10.2026)
--
-- Пользователь 28.10.2026: «регистрируем отдельно тягачи, микроавтобусы,
-- грузовики, самосвалы (нуппи), полуприцепы и прицепы (самосвал, тент,
-- изотерм, реф, трал) с загрузкой сверху, сбоку, сзади; перевозчик сам
-- вносит грузоподъёмность, габариты, оси и как на конструкторе собирает
-- сцепку для заказа». План: docs/fleet-constructor/PLAN.md.
--
--   · машины и прицепы: способ загрузки (TOP, SIDE, REAR) и внутренние
--     размеры; у прицепа — своя грузоподъёмность;
--   · нуппи — грузовик-самосвал: кузов TIPPER (кассета теперь не кузов,
--     а сцепка «нуппи + прицеп»);
--   · vehicle_combos — сохранённые сцепки: машина + прицеп (или без).
--     Что сцепка везёт (предел по закону, груз, метры, объём, кузова,
--     загрузка) считает сервер (src/lib/fleet/mass.ts) и пишет в строку;
--     заказы по сцепкам — этап B.
-- ═══════════════════════════════════════════════════════════════════

-- ── Загрузка и размеры ────────────────────────────────────────────

alter table public.vehicles
  add column loading text[] not null default '{}'
    constraint vehicles_loading check (loading <@ array['TOP', 'SIDE', 'REAR']),
  add column inner_length_m numeric(4, 2) constraint vehicles_inner_length check (inner_length_m between 0.5 and 20),
  add column inner_width_m numeric(4, 2) constraint vehicles_inner_width check (inner_width_m between 0.5 and 3),
  add column inner_height_m numeric(4, 2) constraint vehicles_inner_height check (inner_height_m between 0.3 and 4.5);

/* Права по колонкам: и вставка, и правка (память rahtis-column-grants). */
grant insert (loading, inner_length_m, inner_width_m, inner_height_m) on public.vehicles to authenticated;
grant update (loading, inner_length_m, inner_width_m, inner_height_m) on public.vehicles to authenticated;

alter table public.trailers
  add column payload_kg integer constraint trailers_payload_range check (payload_kg between 100 and 60000),
  add column loading text[] not null default '{}'
    constraint trailers_loading check (loading <@ array['TOP', 'SIDE', 'REAR']),
  add column inner_length_m numeric(4, 2) constraint trailers_inner_length check (inner_length_m between 0.5 and 20),
  add column inner_width_m numeric(4, 2) constraint trailers_inner_width check (inner_width_m between 0.5 and 3),
  add column inner_height_m numeric(4, 2) constraint trailers_inner_height check (inner_height_m between 0.3 and 4.5);

-- ── Нуппи: кузов самосвальный ─────────────────────────────────────

update public.vehicles set body_type = 'TIPPER' where vehicle_class = 'TIPPER' and body_type = 'CASSETTE';

alter table public.vehicles drop constraint vehicles_tipper_shape;
alter table public.vehicles
  add constraint vehicles_tipper_shape
    check (vehicle_class <> 'TIPPER' or (body_type = 'TIPPER' and axles between 3 and 5));

-- ── Сцепки ────────────────────────────────────────────────────────

create table public.vehicle_combos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  trailer_id uuid references public.trailers (id) on delete cascade,
  /*
   * Что это за сцепка: TRACTOR_SOLO (тягач под перецепку), SEMI (тягач +
   * полуприцеп), PUOLIKAS (тягач + самосвальный полуприцеп), NUPPI,
   * KASETTI (нуппи + прицеп), TRUCK, TRUCK_TRAILER, VAN.
   */
  kind text not null constraint vehicle_combos_kind
    check (kind in ('TRACTOR_SOLO', 'SEMI', 'PUOLIKAS', 'NUPPI', 'KASETTI', 'TRUCK', 'TRUCK_TRAILER', 'VAN')),
  name text not null constraint vehicle_combos_name check (char_length(btrim(name)) between 2 and 80),
  /* Расчёт сервера по mass.ts на момент сохранения — для показа и подбора (этап B). */
  country text not null default 'FI' constraint vehicle_combos_country check (country ~ '^[A-Z]{2}$'),
  axles smallint not null,
  legal_kg integer not null,
  payload_kg integer,
  ldm numeric(4, 1),
  volume_m3 numeric(5, 1),
  bodies text[] not null default '{}',
  loading text[] not null default '{}',
  semi_features text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index vehicle_combos_unit_key on public.vehicle_combos (vehicle_id, trailer_id) nulls not distinct;
create index vehicle_combos_company_idx on public.vehicle_combos (company_id);

create trigger vehicle_combos_touch_updated_at
  before update on public.vehicle_combos
  for each row execute function app.touch_updated_at();

/*
 * Сцепка собирается по правилам: машина и прицеп — той же компании;
 * полуприцеп — только к тягачу; прицеп — к грузовику или нуппи; к
 * фургону — ничего. Проверка в базе, а не только в форме.
 */
create or replace function app.vehicle_combo_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.vehicle_class;
  v_kind public.trailer_kind;
begin
  select vehicle_class into v_class from public.vehicles where id = new.vehicle_id and company_id = new.company_id;
  if v_class is null then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  if new.trailer_id is null then
    return new;
  end if;
  select kind into v_kind from public.trailers where id = new.trailer_id and company_id = new.company_id;
  if v_kind is null then
    raise exception 'Прицеп другой компании.' using errcode = '42501';
  end if;
  if (v_kind = 'SEMI' and v_class <> 'TRACTOR')
     or (v_kind <> 'SEMI' and v_class not in ('TRUCK', 'TIPPER')) then
    raise exception 'Такую сцепку не собрать: полуприцеп — к тягачу, прицеп — к грузовику или нуппи.' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function app.vehicle_combo_check() from public, anon, authenticated;

create trigger vehicle_combos_check
  before insert or update of company_id, vehicle_id, trailer_id on public.vehicle_combos
  for each row execute function app.vehicle_combo_check();

alter table public.vehicle_combos enable row level security;

create policy vehicle_combos_own
  on public.vehicle_combos for all to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy vehicle_combos_admin
  on public.vehicle_combos for select to authenticated using ((select app.is_admin()));

grant select, insert, update, delete on public.vehicle_combos to authenticated;

comment on table public.vehicle_combos is
  'Сцепки перевозчика из конструктора: машина + прицеп. Расчёт груза, метров и объёма — сервером по mass.ts.';
