-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экспресс: полный полуприцеп 13,6 м до 30 т (28.10.2026)
--
-- Заказ SEMI — груз едет в полуприцепе перевозчика (FTL), не перецеп:
-- единицы, которую забирают и возвращают, нет. Ветка — экспресс, но
-- везёт тягач: машина подходит, если она тягач и у компании есть
-- полуприцеп с нужными погрузочными метрами и пометками.
--
-- Пометки заказа и полуприцепа (semi_features):
--   MEGA          — мега-полуприцеп (внутренняя высота ~3 м, ~100 м³);
--   SIDE_LOADING  — боковая загрузка (тент сдвигается);
--   TOP_LOADING   — верхняя загрузка;
--   LIFTING_ROOF  — поднимающаяся крыша.
-- Пусто у заказа — обычный полуприцеп, подходит любой.
-- ═══════════════════════════════════════════════════════════════════

alter table public.trailers
  add column ldm numeric(4, 1)
    constraint trailers_ldm_range check (ldm is null or (ldm > 0 and ldm <= 20)),
  add column semi_features text[] not null default '{}'
    constraint trailers_semi_features check (semi_features <@ array['MEGA', 'SIDE_LOADING', 'TOP_LOADING', 'LIFTING_ROOF']);

alter table public.orders
  add column semi_features text[] not null default '{}'
    constraint orders_semi_features check (semi_features <@ array['MEGA', 'SIDE_LOADING', 'TOP_LOADING', 'LIFTING_ROOF']);

comment on column public.orders.semi_features is
  'Пометки к полуприцепу у заказа SEMI: MEGA, SIDE_LOADING, TOP_LOADING, LIFTING_ROOF. Пусто — обычный.';

create or replace function app.haul_branch(p_haul_kind public.haul_kind)
returns public.haul_branch
language sql
immutable
set search_path = ''
as $$
  select case
    when p_haul_kind in ('TRAILER', 'CONTAINER') then 'UNIT'::public.haul_branch
    else 'EXPRESS'::public.haul_branch
  end;
$$;

/* Есть ли у компании полуприцеп под заказ SEMI: метры и все пометки. */
create or replace function app.company_has_semi(p_company_id uuid, p_ldm numeric, p_features text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trailers t
    where t.company_id = p_company_id
      and t.kind = 'SEMI'
      and coalesce(t.ldm, 13.6) >= coalesce(p_ldm, 0)
      and t.semi_features @> coalesce(p_features, '{}'::text[])
  );
$$;

revoke all on function app.company_has_semi(uuid, numeric, text[]) from public, anon;
grant execute on function app.company_has_semi(uuid, numeric, text[]) to authenticated, service_role;

/*
 * Подходит ли машина под заказ. Пятый параметр — пометки полуприцепа;
 * четырёхпараметровый вызов (стол, подбор) проверяет только метры, а
 * пометки сверяют отклик и прямое назначение.
 */
create or replace function app.vehicle_fits_haul(
  p_vehicle_id uuid,
  p_haul_kind public.haul_kind,
  p_container_feet smallint,
  p_ldm numeric,
  p_features text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and case
        when p_haul_kind = 'SEMI' then
          v.vehicle_class = 'TRACTOR' and app.company_has_semi(v.company_id, p_ldm, p_features)
        else
          app.vehicle_branch(v.vehicle_class) = app.haul_branch(p_haul_kind)
          and case p_haul_kind
            when 'TRAILER' then true
            when 'CONTAINER' then p_container_feet = any (v.container_feet)
            else p_ldm is not null and v.ldm >= p_ldm
          end
      end
  );
$$;

create or replace function app.vehicle_fits_haul(
  p_vehicle_id uuid,
  p_haul_kind public.haul_kind,
  p_container_feet smallint,
  p_ldm numeric default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.vehicle_fits_haul(p_vehicle_id, p_haul_kind, p_container_feet, p_ldm, '{}'::text[]);
$$;

revoke all on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint, numeric, text[]) from public, anon;
grant execute on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint, numeric, text[]) to authenticated, service_role;

create or replace function app.has_vehicle_for_haul(p_company_id uuid, p_haul_kind public.haul_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.company_id = p_company_id
      and v.access = 'APPROVED'
      and case
        when p_haul_kind = 'SEMI' then v.vehicle_class = 'TRACTOR' and app.company_has_semi(p_company_id, null, null)
        else app.vehicle_branch(v.vehicle_class) = app.haul_branch(p_haul_kind)
      end
  );
$$;

/*
 * Отклик и прямое назначение: пометки полуприцепа и отдельная фраза для
 * SEMI. Тексты функций берутся из базы и меняются точечно, как в
 * 20261013120000_reprice_no_lowering.
 */
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
        'if not app.vehicle_fits_haul(p_vehicle_id, v_order.haul_kind, v_order.container_feet, v_order.ldm) then',
        'if not app.vehicle_fits_haul(p_vehicle_id, v_order.haul_kind, v_order.container_feet, v_order.ldm, v_order.semi_features) then
    if v_order.haul_kind = ''SEMI'' then
      raise exception ''Нужен тягач и полуприцеп от % погрузочных метров с пометками заказа.'', v_order.ldm
        using errcode = ''55003'';
    end if;');
    else
      v_new := replace(v_def,
        'if not app.vehicle_fits_haul(p_vehicle.id, p_order.haul_kind, p_order.container_feet, p_order.ldm) then',
        'if not app.vehicle_fits_haul(p_vehicle.id, p_order.haul_kind, p_order.container_feet, p_order.ldm, p_order.semi_features) then
    if p_order.haul_kind = ''SEMI'' then
      raise exception ''Нужен тягач и полуприцеп от % погрузочных метров с пометками заказа.'', p_order.ldm
        using errcode = ''55003'';
    end if;');
    end if;

    if v_new = v_def then
      raise exception '%: место правки не найдено', v_fn;
    end if;
    execute v_new;
  end loop;

  /* Создание заказа: пометки полуприцепа и потолок груза 30 т. */
  v_def := replace(pg_get_functiondef('app.create_order_for(uuid, jsonb, jsonb, boolean, uuid)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(v_def,
    'shipper_company_id, shipper_ref, order_type, haul_kind, container_feet, ldm,
    trailer, trailer_plate,',
    'shipper_company_id, shipper_ref, order_type, haul_kind, container_feet, ldm,
    semi_features,
    trailer, trailer_plate,');
  v_new := replace(v_new,
    '    v_feet,
    v_ldm,
    case when v_unit then',
    '    v_feet,
    v_ldm,
    case when v_haul = ''SEMI'' and jsonb_typeof(p_order->''semi_features'') = ''array''
      then array(select distinct jsonb_array_elements_text(p_order->''semi_features''))
      else ''{}''::text[] end,
    case when v_unit then');
  v_new := replace(v_new,
    'if v_haul in (''VAN'', ''TRUCK'')
     and app.order_max_weight_kg(v_order.id) > (case v_haul when ''VAN'' then 1500 else 15000 end) then
    raise exception ''Груз тяжелее класса машины: фургон — до 1500 кг, грузовик — до 15000 кг.''',
    'if v_haul in (''VAN'', ''TRUCK'', ''SEMI'')
     and app.order_max_weight_kg(v_order.id) > (case v_haul when ''VAN'' then 1500 when ''TRUCK'' then 15000 else 30000 end) then
    raise exception ''Груз тяжелее класса машины: фургон — до 1500 кг, грузовик — до 15000 кг, полуприцеп — до 30000 кг.''');
  if v_new = v_def or position('semi_features,' in v_new) = 0 or position('30000' in v_new) = 0 then
    raise exception 'create_order_for: место правки не найдено';
  end if;
  execute v_new;
end;
$$;
