-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · самосвал: правила карточки и своя ветка (28.10.2026)
--
--   · у самосвала, как у тягача, нет погрузочных метров и паспортного
--     груза кузова: грузоподъёмность — от массы сцепки по осям;
--   · кузов самосвала — самосвальный или кассетный, оси 3–5;
--   · у грузовика для грузоперевозок самосвального и кассетного кузова
--     больше нет — это теперь самосвал;
--   · своя ветка TIPPER: экспресс-заказы (фургон, грузовик) самосвалу не
--     достаются. Самосвальные заказы — следующим шагом.
-- ═══════════════════════════════════════════════════════════════════

alter table public.vehicles drop constraint vehicles_express_capacity;
alter table public.vehicles
  add constraint vehicles_express_capacity
    check (
      case
        when vehicle_class in ('TRACTOR', 'TIPPER') then payload_kg is null and ldm is null
        else payload_kg is not null and ldm is not null
      end
    ),
  add constraint vehicles_tipper_shape
    check (vehicle_class <> 'TIPPER' or (body_type in ('TIPPER', 'CASSETTE') and axles between 3 and 5)),
  add constraint vehicles_truck_cargo_body
    check (vehicle_class <> 'TRUCK' or body_type is null or body_type not in ('TIPPER', 'CASSETTE'));

/*
 * Объём кузова, м³. Стройка меряется тоннами и кубами (пользователь
 * 28.10.2026): лёгкий грунт упирается в объём раньше, чем в массу.
 * Грузоперевозкам объём не нужен — у них погрузочные метры.
 */
alter table public.vehicles
  add column body_volume_m3 numeric(4, 1)
    constraint vehicles_body_volume_range check (body_volume_m3 between 1 and 99);
alter table public.trailers
  add column body_volume_m3 numeric(4, 1)
    constraint trailers_body_volume_range check (body_volume_m3 between 1 and 99);
grant update (body_volume_m3) on public.vehicles to authenticated;

comment on column public.vehicles.vehicle_class is
  'Тягач, микроавтобус, грузовик для грузоперевозок или самосвал. От класса зависит, какие заказы машина видит и может взять.';

create or replace function app.vehicle_branch(p_vehicle_class public.vehicle_class)
returns public.haul_branch
language sql
immutable
set search_path = ''
as $$
  select case
    when p_vehicle_class = 'TRACTOR' then 'UNIT'::public.haul_branch
    when p_vehicle_class = 'TIPPER' then 'TIPPER'::public.haul_branch
    else 'EXPRESS'::public.haul_branch
  end;
$$;

/*
 * Груз самосвала: предел машины по осям (Финляндия: 3 оси 28 т, 4 — 35 т,
 * 5 — 42 т) минус тара. Тары нет — сам предел, как верхняя граница.
 */
create or replace function app.vehicle_capacity_kg(p_vehicle_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case v.vehicle_class
    when 'TRACTOR' then app.axle_capacity_kg(v.axles)
    when 'TIPPER' then greatest(0,
      (case v.axles when 3 then 28000 when 4 then 35000 else 42000 end) - coalesce(v.tare_kg, 0))
    else v.payload_kg
  end
  from public.vehicles v
  where v.id = p_vehicle_id;
$$;
