-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · требования к кузову — на всех путях отклика (28.10.2026)
--
-- Проверка 99ec975: кузов и загрузку заказа сверял только отклик
-- сцепкой (take_order_combo). Отклик машиной (take_order) и прямое
-- назначение (app.assert_vehicle_fits_order) их не смотрели — на заказ
-- «реф» можно было откликнуться тентом. Теперь общий помощник
-- app.vehicle_meets_requirements: у фургона и грузовика — свой кузов и
-- загрузка; у фуры с требованиями машиной не ответить — только сцепкой.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.vehicle_meets_requirements(p_vehicle_id uuid, p_order public.orders)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
begin
  if p_order.required_body is null and coalesce(array_length(p_order.required_loading, 1), 0) = 0 then
    return null;
  end if;
  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.vehicle_class = 'TRACTOR' then
    return 'У заказа требования к кузову полуприцепа — откликнитесь сцепкой с подходящим полуприцепом.';
  end if;
  if p_order.required_body is not null and v_vehicle.body_type::text is distinct from p_order.required_body then
    return 'Нужен другой кузов.';
  end if;
  if not (coalesce(v_vehicle.loading, '{}') @> coalesce(p_order.required_loading, '{}')) then
    return 'Нет нужного способа загрузки.';
  end if;
  return null;
end;
$$;

revoke all on function app.vehicle_meets_requirements(uuid, public.orders) from public, anon, authenticated;

do $$
declare
  v_fn text;
  v_def text;
  v_new text;
begin
  foreach v_fn in array array['public.take_order(uuid, uuid)', 'app.assert_vehicle_fits_order(public.orders, public.vehicles)'] loop
    v_def := replace(pg_get_functiondef(v_fn::regprocedure), E'\r\n', E'\n');
    if v_fn like 'public.take_order%' then
      v_new := replace(v_def,
        E'  v_needed := app.order_max_weight_kg(p_order_id);',
        E'  if app.vehicle_meets_requirements(p_vehicle_id, v_order) is not null then\n    raise exception ''%'', app.vehicle_meets_requirements(p_vehicle_id, v_order) using errcode = ''55003'';\n  end if;\n\n  v_needed := app.order_max_weight_kg(p_order_id);');
    else
      v_new := replace(v_def,
        E'  v_needed := app.order_max_weight_kg(p_order.id);',
        E'  if app.vehicle_meets_requirements(p_vehicle.id, p_order) is not null then\n    raise exception ''%'', app.vehicle_meets_requirements(p_vehicle.id, p_order) using errcode = ''55003'';\n  end if;\n\n  v_needed := app.order_max_weight_kg(p_order.id);');
    end if;
    if v_new = v_def then
      raise exception '%: место правки не найдено', v_fn;
    end if;
    execute v_new;
  end loop;
end;
$$;

-- ── Кассета — только самосвальная (пользователь 28.10.2026) ────────
/*
 * «Касетти — только к самосвалам: нуппи затягивает на себя лаву с
 * прицепа, едет выгружает, потом возвращает её на прицеп. Все остальные
 * сцепки нуппи + прицеп или грузовик + прицеп — это TPV
 * (täysperävaunuyhdistelmä)». Кассета = нуппи + прицеп с самосвальным
 * (или кассетным) кузовом; нуппи + трал, тент и т. п. — TPV
 * (TRUCK_TRAILER), например трал под трактор на стройку.
 */
create or replace function app.company_has_cassette_trailer(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trailers t
    where t.company_id = p_company_id and t.kind = 'FULL' and t.axles between 3 and 5
      and t.body_type in ('TIPPER', 'CASSETTE')
  );
$$;

/* Уже сохранённые «кассеты» с не самосвальным прицепом — это TPV. */
update public.vehicle_combos c
set kind = 'TRUCK_TRAILER'
from public.trailers t
where c.trailer_id = t.id and c.kind = 'KASETTI' and t.body_type is distinct from 'TIPPER' and t.body_type is distinct from 'CASSETTE';

do $$
declare
  v_def text := replace(pg_get_functiondef('app.combo_fit_reason(public.vehicle_combos, public.orders)'::regprocedure), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(v_def,
    $f$    when v_vehicle.vehicle_class = 'TIPPER' then case when v_trailer.id is null then 'NUPPI' else 'KASETTI' end$f$,
    $f$    when v_vehicle.vehicle_class = 'TIPPER' then
      case when v_trailer.id is null then 'NUPPI' when v_trailer.body_type in ('TIPPER', 'CASSETTE') then 'KASETTI' else 'TRUCK_TRAILER' end$f$);
  if v_new = v_def then
    raise exception 'combo_fit_reason: место правки не найдено';
  end if;
  execute v_new;
end;
$$;
