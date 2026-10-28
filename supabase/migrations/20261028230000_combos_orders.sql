-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · конструктор сцепок, этап B: заказы по сцепкам (28.10.2026)
--
-- Решение пользователя 28.10.2026: сцепка собирается под заказ, отклик
-- идёт выбранной сцепкой. План: docs/fleet-constructor/PLAN.md.
--
--   1. vehicle_combos пишет только сервер (служебный ключ, после
--      проверки, что машина и прицеп свои): расчётные поля больше нельзя
--      вписать из браузера (проверка 1814ea3). Отклонённая машина в
--      сцепку не идёт.
--   2. Заказ: нужный кузов (required_body) и загрузка (required_loading).
--   3. Отклик сцепкой — take_order_combo: подходит ли сцепка, база
--      решает по живым машине и прицепу (вид, метры, кузов, загрузка,
--      пометки фуры), груз — по расчёту сцепки. Прицеп рейса — в отклике
--      (order_offers.trailer_id).
--   4. Стол отдаёт требования заказа (desk_orders.requirements).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Сцепки — только сервер ─────────────────────────────────────

revoke insert, update on public.vehicle_combos from authenticated;

create or replace function app.vehicle_combo_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.vehicle_class;
  v_access public.vehicle_access;
  v_kind public.trailer_kind;
begin
  select vehicle_class, access into v_class, v_access
  from public.vehicles where id = new.vehicle_id and company_id = new.company_id;
  if v_class is null then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  if v_access = 'REJECTED' then
    raise exception 'Отклонённая машина в сцепку не идёт.' using errcode = '22023';
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

-- ── 2. Требования заказа ──────────────────────────────────────────

alter table public.orders
  add column required_body text
    constraint orders_required_body check (required_body in ('CURTAIN', 'BOX', 'REEFER', 'ISOTHERM', 'FLATBED', 'LOWBED', 'TANK', 'CONTAINER')),
  add column required_loading text[] not null default '{}'
    constraint orders_required_loading check (required_loading <@ array['TOP', 'SIDE', 'REAR']);

comment on column public.orders.required_body is 'Нужный кузов у экспресс-заказа: тент, фургон, реф, изотерм, борт, трал… Пусто — любой.';

alter table public.order_offers
  add column combo_id uuid references public.vehicle_combos (id) on delete set null,
  add column trailer_id uuid references public.trailers (id) on delete set null;

-- ── 3. Подходит ли сцепка заказу ──────────────────────────────────

/*
 * Причина отказа или null. Всё, кроме груза, — по живым машине и
 * прицепу, а не по сохранённому расчёту: размеры могли поменяться.
 */
create or replace function app.combo_fit_reason(p_combo public.vehicle_combos, p_order public.orders)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_trailer public.trailers;
  v_kind text;
  v_ldm numeric;
  v_bodies text[];
  v_loading text[];
begin
  select * into v_vehicle from public.vehicles where id = p_combo.vehicle_id;
  if p_combo.trailer_id is not null then
    select * into v_trailer from public.trailers where id = p_combo.trailer_id;
  end if;

  v_kind := case
    when v_vehicle.vehicle_class = 'VAN' then 'VAN'
    when v_vehicle.vehicle_class = 'TRACTOR' then
      case when v_trailer.id is null then 'TRACTOR_SOLO' when v_trailer.body_type = 'TIPPER' then 'PUOLIKAS' else 'SEMI' end
    when v_vehicle.vehicle_class = 'TIPPER' then case when v_trailer.id is null then 'NUPPI' else 'KASETTI' end
    else case when v_trailer.id is null then 'TRUCK' else 'TRUCK_TRAILER' end
  end;
  v_ldm := coalesce(case when v_vehicle.vehicle_class <> 'TRACTOR' then v_vehicle.ldm end, 0) + coalesce(v_trailer.ldm, 0);
  v_bodies := array_remove(array[
    case when v_vehicle.vehicle_class <> 'TRACTOR' then v_vehicle.body_type::text end,
    v_trailer.body_type::text], null);
  v_loading := coalesce(v_vehicle.loading, '{}') || coalesce(v_trailer.loading, '{}');

  /* Ветвление через if/elsif: загрузчик миграций Supabase неверно режет оператор выбора внутри функции. */
  if p_order.haul_kind = 'TRAILER' then
    if v_kind <> 'TRACTOR_SOLO' then return 'Перецеп берёт тягач без своего полуприцепа.'; end if;
  elsif p_order.haul_kind = 'CONTAINER' then
    if v_kind <> 'TRACTOR_SOLO' or not (p_order.container_feet = any (v_vehicle.container_feet)) then
      return format('Нужен тягач с шасси под %s-футовый контейнер.', p_order.container_feet);
    end if;
  elsif p_order.haul_kind = 'SEMI' then
    if v_kind <> 'SEMI' then return 'Нужен тягач с полуприцепом.'; end if;
    if v_ldm < coalesce(p_order.ldm, 0) then return format('Нужно от %s погрузочных метров.', p_order.ldm); end if;
    if not (coalesce(v_trailer.semi_features, '{}') @> coalesce(p_order.semi_features, '{}')) then
      return 'У полуприцепа нет пометок заказа (MEGA, загрузка, крыша).';
    end if;
  elsif p_order.haul_kind = 'TIPPER' then
    if v_kind <> (case p_order.tipper_config when 'TRUCK' then 'NUPPI' when 'CASSETTE' then 'KASETTI' else 'PUOLIKAS' end) then
      return 'Сцепка не того вида: нужен нуппи, кассета (нуппи + прицеп) или puolikas (тягач + самосвальный полуприцеп).';
    end if;
  else
    /* Фургон и грузовик: груз в кузове сцепки. */
    if v_kind not in ('VAN', 'TRUCK', 'TRUCK_TRAILER') then return 'Нужен фургон или грузовик (можно с прицепом).'; end if;
    if v_ldm < coalesce(p_order.ldm, 0) then return format('Нужно от %s погрузочных метров.', p_order.ldm); end if;
  end if;

  if p_order.required_body is not null and not (p_order.required_body = any (v_bodies)) then
    return 'Нужен другой кузов.';
  end if;
  if not (v_loading @> coalesce(p_order.required_loading, '{}')) then
    return 'Нет нужного способа загрузки.';
  end if;
  return null;
end;
$$;

revoke all on function app.combo_fit_reason(public.vehicle_combos, public.orders) from public, anon, authenticated;

/* Отклик сцепкой: те же проверки стола, что у take_order, но подбор и груз — по сцепке. */
create or replace function public.take_order_combo(p_order_id uuid, p_combo_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_combo public.vehicle_combos;
  v_company_id uuid;
  v_offers integer;
  v_needed integer;
  v_capacity integer;
  v_reason text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Откликаться может только перевозчик.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  select * into v_combo from public.vehicle_combos where id = p_combo_id and company_id = v_company_id;
  if v_combo.id is null then
    raise exception 'Сцепка не найдена.' using errcode = '42501';
  end if;

  if not app.vehicle_is_dispatchable(v_combo.vehicle_id) then
    raise exception 'Машина не допущена к заказам или документы компании просрочены.' using errcode = '55000';
  end if;

  v_order := app.release_expired_order(p_order_id);
  if v_order.id is null or not app.same_world(v_order.shipper_company_id, v_company_id) then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;
  if v_order.status <> 'OPEN' and v_order.status <> 'REQUESTED' then
    raise exception 'Заказ уже не на столе, текущий статус: %.', v_order.status using errcode = '55000';
  end if;
  if not app.desk_contract_allows(v_order.desk_contract, v_company_id) then
    raise exception 'Заказ «напрямую с перевозчиком» берут только перевозчики на подписке.' using errcode = '55006';
  end if;
  if v_order.group_until > now() then
    raise exception 'Заказ сейчас предложен машинам заказчика — его берут кнопкой прямого заказа.' using errcode = '55005';
  end if;

  v_reason := app.combo_fit_reason(v_combo, v_order);
  if v_reason is not null then
    raise exception '%', v_reason using errcode = '55003';
  end if;

  v_needed := app.order_max_weight_kg(p_order_id);
  v_capacity := coalesce(v_combo.payload_kg, app.vehicle_capacity_kg(v_combo.vehicle_id));
  if v_needed > v_capacity then
    raise exception 'Груз % кг превышает грузоподъёмность сцепки % кг.', v_needed, v_capacity using errcode = '55001';
  end if;

  select count(*) into v_offers from public.order_offers where order_id = p_order_id;
  if v_offers >= 3 then
    raise exception 'Мест нет: на заказ уже откликнулись три машины.' using errcode = '55000';
  end if;

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, combo_id, trailer_id, created_by)
  values (p_order_id, v_company_id, v_combo.vehicle_id, v_combo.id, v_combo.trailer_id, (select auth.uid()));

  update public.orders
  set status = 'REQUESTED',
      deadline_at = coalesce(deadline_at, now() + interval '15 minutes')
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.take_order_combo(uuid, uuid) from public, anon;
grant execute on function public.take_order_combo(uuid, uuid) to authenticated;

-- ── 4. Стол и создание заказа ─────────────────────────────────────

do $$
declare
  v_def text;
  v_new text;
begin
  /* Стол: требования заказа одной колонкой в конце (меняется тип результата — пересоздание). */
  v_def := replace(pg_get_functiondef('public.desk_orders(text, integer)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(v_def,
    'group_vehicle_ids uuid[], desk_contract contract_party)',
    'group_vehicle_ids uuid[], desk_contract contract_party, requirements jsonb)');
  v_new := replace(v_new,
    E'    o.desk_contract\n  from public.orders o',
    E'    o.desk_contract,\n    jsonb_build_object(''body'', o.required_body, ''loading'', o.required_loading, ''semi'', o.semi_features,\n      ''tipper'', o.tipper_config, ''pricing'', o.site_pricing, ''unit_rate_cents'', o.site_rate_cents, ''planned_qty'', o.planned_qty)\n  from public.orders o');
  if position('requirements jsonb' in v_new) = 0 or position('''body'', o.required_body' in v_new) = 0 then
    raise exception 'desk_orders: место правки не найдено';
  end if;
  drop function public.desk_orders(text, integer);
  execute v_new;
  revoke all on function public.desk_orders(text, integer) from public, anon;
  grant execute on function public.desk_orders(text, integer) to authenticated;

  /* Создание заказа: кузов и загрузка у экспресса (фургон, грузовик, фура). */
  v_def := replace(pg_get_functiondef('app.create_order_for(uuid, jsonb, jsonb, boolean, uuid)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(v_def,
    E'    tipper_config, site_pricing, site_rate_cents, planned_qty, material_code, planned_volume_m3,\n',
    E'    tipper_config, site_pricing, site_rate_cents, planned_qty, material_code, planned_volume_m3,\n    required_body, required_loading,\n');
  v_new := replace(v_new,
    E'    case when v_haul = ''TIPPER'' then nullif(p_order->>''planned_volume_m3'', '''')::numeric end,\n',
    E'    case when v_haul = ''TIPPER'' then nullif(p_order->>''planned_volume_m3'', '''')::numeric end,\n    case when v_haul in (''VAN'', ''TRUCK'', ''SEMI'') then nullif(p_order->>''required_body'', '''') end,\n    case when v_haul in (''VAN'', ''TRUCK'', ''SEMI'') and jsonb_typeof(p_order->''required_loading'') = ''array''\n      then array(select distinct jsonb_array_elements_text(p_order->''required_loading'')) else ''{}''::text[] end,\n');
  if position('required_body, required_loading' in v_new) = 0 or position('p_order->>''required_body''' in v_new) = 0 then
    raise exception 'create_order_for: место правки не найдено';
  end if;
  execute v_new;
end;
$$;
