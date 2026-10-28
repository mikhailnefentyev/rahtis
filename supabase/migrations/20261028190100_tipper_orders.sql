-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · самосвальный заказ: стройка в тоннах и кубах (28.10.2026)
--
-- Заказ TIPPER — работа самосвала на день: где грузят (точка забора) и
-- куда везут (точка доставки), чем (tipper_config), что (material_code)
-- и по какой ставке (site_pricing: час, рейс, тонна; site_rate_cents —
-- без ALV). planned_qty — ориентир (часов, рейсов, тонн), planned_volume_m3
-- — объём, если заказчик считает кубами. Цена заказа на столе —
-- ориентир: ставка × ориентир.
--
-- Работа идёт тем же экраном «Объект», что и у своих объектов
-- перевозчика: когда заказ получает перевозчика, под него заводится
-- site_jobs (order_id), водитель отмечает прибытие, рейсы с весами и
-- конец дня. Закрытие рейса перевозчиком считает итог по факту — часы,
-- рейсы или тонны нетто × ставка — и пишет его в цену заказа; процент
-- платформы считается от неё, как у всех рейсов (freeze_order_fees).
-- CMR у стройки нет: документ рейса — siirtoasiakirja по рейсам объекта.
--
-- Конфигурации (пользователь 28.10.2026):
--   TRUCK    — нуппи (nuppiauto) 3–5 осей;
--   CASSETTE — кассета: нуппи 3–5 осей + прицеп 3–5 осей;
--   SEMI     — тягач 2–3 оси с самосвальным полуприцепом 2–4 оси.
-- ═══════════════════════════════════════════════════════════════════

-- ── Заказ ─────────────────────────────────────────────────────────

alter table public.orders
  add column tipper_config text
    constraint orders_tipper_config check (tipper_config in ('TRUCK', 'CASSETTE', 'SEMI')),
  add column site_pricing public.site_pricing,
  add column site_rate_cents integer
    constraint orders_site_rate check (site_rate_cents between 0 and 10000000),
  add column planned_qty numeric(8, 1)
    constraint orders_planned_qty check (planned_qty > 0 and planned_qty <= 100000),
  add column material_code text
    constraint orders_material_code check (material_code ~ '^[A-Z0-9]{2,12}$'),
  add column planned_volume_m3 numeric(7, 1)
    constraint orders_planned_volume check (planned_volume_m3 > 0 and planned_volume_m3 <= 100000),
  add constraint orders_tipper_shape
    check ((haul_kind = 'TIPPER') = (tipper_config is not null and site_pricing is not null and site_rate_cents is not null));

comment on column public.orders.tipper_config is
  'Самосвальный заказ: TRUCK — самосвал, CASSETTE — кассетник с прицепом, SEMI — тягач с самосвальным полуприцепом.';

/* Погрузочные метры — у грузоперевозок; у стройки их нет. */
alter table public.orders drop constraint orders_ldm_only_for_express;
alter table public.orders
  add constraint orders_ldm_only_for_express
    check ((haul_kind in ('VAN', 'TRUCK', 'SEMI')) = (ldm is not null));

-- ── Объект под заказ ──────────────────────────────────────────────

alter table public.site_jobs
  add column order_id uuid references public.orders (id) on delete cascade;
create unique index site_jobs_order_key on public.site_jobs (order_id) where order_id is not null;

comment on column public.site_jobs.order_id is
  'Объект заведён под самосвальный заказ платформы: счёт идёт через рейс, а не счётом объекта.';

-- ── Ветки и подбор машины ─────────────────────────────────────────

create or replace function app.haul_branch(p_haul_kind public.haul_kind)
returns public.haul_branch
language sql
immutable
set search_path = ''
as $$
  select case
    when p_haul_kind in ('TRAILER', 'CONTAINER') then 'UNIT'::public.haul_branch
    when p_haul_kind = 'TIPPER' then 'TIPPER'::public.haul_branch
    else 'EXPRESS'::public.haul_branch
  end;
$$;

/* Прицеп под кассету у компании: обычный прицеп (не полуприцеп) 3–5 осей. */
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
  );
$$;

revoke all on function app.company_has_cassette_trailer(uuid) from public, anon;
grant execute on function app.company_has_cassette_trailer(uuid) to authenticated, service_role;

/* Самосвальный полуприцеп у компании — для конфигурации SEMI. */
create or replace function app.company_has_tipper_semi(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trailers t
    where t.company_id = p_company_id and t.kind = 'SEMI' and t.body_type = 'TIPPER'
  );
$$;

revoke all on function app.company_has_tipper_semi(uuid) from public, anon;
grant execute on function app.company_has_tipper_semi(uuid) to authenticated, service_role;

/*
 * Пятый параметр: у SEMI-фуры — пометки полуприцепа, у самосвального
 * заказа — его конфигурация первым элементом (TRUCK, CASSETTE, SEMI).
 * Пусто у TIPPER — подходит любой самосвал или тягач с самосвальным
 * полуприцепом (так смотрит стол).
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
        when p_haul_kind = 'TIPPER' then
          case coalesce(p_features[1], '')
            /* Нуппи — любой самосвал 3–5 осей; кассета — нуппи и прицеп 3–5 осей у компании. */
            when 'TRUCK' then v.vehicle_class = 'TIPPER'
            when 'CASSETTE' then v.vehicle_class = 'TIPPER' and app.company_has_cassette_trailer(v.company_id)
            when 'SEMI' then v.vehicle_class = 'TRACTOR' and app.company_has_tipper_semi(v.company_id)
            else v.vehicle_class = 'TIPPER'
              or (v.vehicle_class = 'TRACTOR' and app.company_has_tipper_semi(v.company_id))
          end
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
        when p_haul_kind = 'TIPPER' then v.vehicle_class = 'TIPPER'
          or (v.vehicle_class = 'TRACTOR' and app.company_has_tipper_semi(p_company_id))
        else app.vehicle_branch(v.vehicle_class) = app.haul_branch(p_haul_kind)
      end
  );
$$;

-- ── Итог самосвального дня ────────────────────────────────────────

/*
 * Часы, рейсы и тонны по объекту заказа — как в src/lib/sites/work.ts:
 * конец дня — нажатое «закончил» или последняя выгрузка + запас, что
 * позже. День без конца не считается.
 */
create or replace function app.tipper_order_totals(p_order_id uuid)
returns table (days integer, open_days integer, minutes integer, loads integer, net_kg integer)
language sql
stable
security definer
set search_path = ''
as $$
  with d as (
    select sd.id, sd.arrived_at, sd.ended_at, sd.buffer_minutes,
           (select max(l.unloaded_at) from public.site_loads l where l.day_id = sd.id) as last_unload
    from public.site_days sd
    join public.site_jobs j on j.id = sd.job_id
    where j.order_id = p_order_id
  ), e as (
    select d.*,
           case
             when d.ended_at is not null and d.last_unload is not null
               then greatest(d.ended_at, d.last_unload + make_interval(mins => d.buffer_minutes))
             when d.ended_at is not null then d.ended_at
             when d.last_unload is not null then d.last_unload + make_interval(mins => d.buffer_minutes)
           end as day_end
    from d
  )
  select
    count(*)::integer,
    count(*) filter (where e.day_end is null)::integer,
    coalesce(sum(greatest(0, round(extract(epoch from e.day_end - e.arrived_at) / 60))) filter (where e.day_end is not null), 0)::integer,
    (select count(*)::integer from public.site_loads l join public.site_jobs j on j.id = l.job_id where j.order_id = p_order_id),
    (select coalesce(sum(l.net_kg), 0)::integer from public.site_loads l join public.site_jobs j on j.id = l.job_id where j.order_id = p_order_id)
  from e;
$$;

revoke all on function app.tipper_order_totals(uuid) from public, anon;
grant execute on function app.tipper_order_totals(uuid) to authenticated, service_role;

/*
 * Закрытие самосвального заказа: итог по факту → цена заказа → DONE.
 * Точки маршрута отмечаются после смены статуса: проверка «нет CMR»
 * (on_last_stop_without_cmr) смотрит только идущий рейс и молчит.
 */
create or replace function app.close_tipper_order(p_order public.orders)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_totals record;
  v_amount integer;
  v_order public.orders;
begin
  select * into v_totals from app.tipper_order_totals(p_order.id);

  if coalesce(v_totals.days, 0) = 0 then
    raise exception 'Водитель ещё не отметил прибытие на объект.' using errcode = '55000';
  end if;
  if v_totals.open_days > 0 then
    raise exception 'День на объекте не закончен: нет ни рейса, ни отметки «закончил».' using errcode = '55000';
  end if;

  v_amount := case p_order.site_pricing
    when 'HOUR' then round(v_totals.minutes / 60.0 * p_order.site_rate_cents)
    when 'LOAD' then v_totals.loads * p_order.site_rate_cents
    else round(v_totals.net_kg / 1000.0 * p_order.site_rate_cents)
  end;

  if p_order.site_pricing = 'TONNE' and v_totals.net_kg = 0 then
    raise exception 'Оплата по тоннам, а у рейсов нет весов.' using errcode = '55000';
  end if;

  update public.orders
  set rate_cents = v_amount,
      planned_qty = case p_order.site_pricing
        when 'HOUR' then round(v_totals.minutes / 60.0, 1)
        when 'LOAD' then v_totals.loads
        else round(v_totals.net_kg / 1000.0, 1)
      end,
      status = 'DONE',
      closed_at = now(),
      commission_bps = app.current_commission_bps()
  where id = p_order.id
  returning * into v_order;

  update public.order_stops set completed_at = coalesce(completed_at, now())
  where order_id = p_order.id and completed_at is null;

  update public.site_jobs set status = 'CLOSED' where order_id = p_order.id;

  return v_order;
end;
$$;

revoke all on function app.close_tipper_order(public.orders) from public, anon, authenticated;

/*
 * Объект под заказ: заводится, когда у заказа появился перевозчик, и
 * закрывается, когда заказ ушёл (снят, отменён, закрыт). Счёт объекта —
 * вручную и не используется: оплата идёт через рейс платформы.
 */
create or replace function app.on_tipper_order_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pickup public.order_stops;
  v_shipper public.companies;
  v_job uuid;
begin
  if new.haul_kind <> 'TIPPER' then
    return new;
  end if;

  select id into v_job from public.site_jobs where order_id = new.id;

  if new.assigned_company_id is not null and new.status in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    if v_job is not null then
      update public.site_jobs set status = 'ACTIVE', company_id = new.assigned_company_id
      where id = v_job and (status <> 'ACTIVE' or company_id <> new.assigned_company_id);
      return new;
    end if;

    select * into v_pickup from public.order_stops
    where order_id = new.id and role = 'PICKUP' order by sequence limit 1;
    select * into v_shipper from public.companies where id = new.shipper_company_id;

    insert into public.site_jobs (
      company_id, order_id, name, address, lat, lon, country,
      customer_name, customer_business_id, customer_email, customer_country,
      pricing, rate_cents, material_code, invoice_schedule)
    values (
      new.assigned_company_id, new.id,
      left(new.ref || ' · ' || coalesce(v_pickup.place_name, v_pickup.company_name, v_pickup.city, ''), 120),
      nullif(concat_ws(', ', v_pickup.address, v_pickup.city), ''),
      v_pickup.lat, v_pickup.lon,
      coalesce(nullif(v_pickup.country, ''), 'FI'),
      coalesce(nullif(btrim(v_shipper.name), ''), new.ref),
      v_shipper.business_id, v_shipper.contact_email,
      coalesce(nullif(v_shipper.country, ''), 'FI'),
      new.site_pricing, new.site_rate_cents, coalesce(new.material_code, '170504'), 'MANUAL');
    return new;
  end if;

  if v_job is not null then
    update public.site_jobs set status = 'CLOSED' where id = v_job and status <> 'CLOSED';
  end if;
  return new;
end;
$$;

revoke all on function app.on_tipper_order_assigned() from public, anon, authenticated;

create trigger orders_tipper_site_job
  after insert or update of status, assigned_company_id on public.orders
  for each row execute function app.on_tipper_order_assigned();

-- ── Точечные правки существующих функций ──────────────────────────

do $$
declare
  v_def text;
  v_new text;
  v_fn text;
begin
  /* Отклик и прямое назначение: конфигурация самосвала вместо пометок фуры. */
  foreach v_fn in array array['public.take_order(uuid, uuid)', 'app.assert_vehicle_fits_order(public.orders, public.vehicles)'] loop
    v_def := replace(pg_get_functiondef(v_fn::regprocedure), E'\r\n', E'\n');
    if v_fn like 'public.take_order%' then
      v_new := replace(v_def,
        'v_order.ldm, v_order.semi_features) then',
        'v_order.ldm, case when v_order.haul_kind = ''TIPPER'' then array[v_order.tipper_config] else v_order.semi_features end) then
    if v_order.haul_kind = ''TIPPER'' then
      raise exception ''Нужна машина под этот самосвальный заказ: нуппи, нуппи с прицепом 3–5 осей (кассета) или тягач с самосвальным полуприцепом.''
        using errcode = ''55003'';
    end if;');
    else
      v_new := replace(v_def,
        'p_order.ldm, p_order.semi_features) then',
        'p_order.ldm, case when p_order.haul_kind = ''TIPPER'' then array[p_order.tipper_config] else p_order.semi_features end) then
    if p_order.haul_kind = ''TIPPER'' then
      raise exception ''Нужна машина под этот самосвальный заказ: нуппи, нуппи с прицепом 3–5 осей (кассета) или тягач с самосвальным полуприцепом.''
        using errcode = ''55003'';
    end if;');
    end if;
    if v_new = v_def then
      raise exception '%: место правки не найдено', v_fn;
    end if;
    execute v_new;
  end loop;

  /* Закрытие рейса: самосвальный — по факту объекта, без CMR. */
  v_def := replace(pg_get_functiondef('public.close_order(uuid)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(v_def,
    '  select count(*) into v_pending',
    '  if v_order.haul_kind = ''TIPPER'' then
    return app.close_tipper_order(v_order);
  end if;

  select count(*) into v_pending');
  if v_new = v_def then
    raise exception 'close_order: место правки не найдено';
  end if;
  execute v_new;

  /* Экран «Объект» водителя: у объекта под заказ — номер заказа. */
  v_def := replace(pg_get_functiondef('public.driver_site_state()'::regprocedure), E'\r\n', E'\n');
  v_new := replace(v_def,
    '''id'', j.id, ''name'', j.name,',
    '''id'', j.id, ''order_id'', j.order_id, ''name'', j.name,');
  if v_new = v_def then
    raise exception 'driver_site_state: место правки не найдено';
  end if;
  execute v_new;

  /* Создание заказа: поля стройки, ориентир цены, без метров и веса на точке. */
  v_def := replace(pg_get_functiondef('app.create_order_for(uuid, jsonb, jsonb, boolean, uuid)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(v_def,
    'if not v_unit and v_ldm is null then',
    'if not v_unit and v_haul <> ''TIPPER'' and v_ldm is null then');
  v_new := replace(v_new,
    'if v_unit then v_ldm := null; end if;',
    'if v_unit or v_haul = ''TIPPER'' then v_ldm := null; end if;

  if v_haul = ''TIPPER'' and (
       coalesce(p_order->>''tipper_config'', '''') not in (''TRUCK'', ''CASSETTE'', ''SEMI'')
    or coalesce(p_order->>''site_pricing'', '''') not in (''HOUR'', ''LOAD'', ''TONNE'')
    or nullif(p_order->>''site_rate_cents'', '''') is null) then
    raise exception ''Укажите, чем возить, как считать оплату и ставку.'' using errcode = ''22023'';
  end if;');
  v_new := replace(v_new,
    '    semi_features,
    trailer, trailer_plate,',
    '    semi_features,
    tipper_config, site_pricing, site_rate_cents, planned_qty, material_code, planned_volume_m3,
    trailer, trailer_plate,');
  v_new := replace(v_new,
    '      else ''{}''::text[] end,
    case when v_unit then',
    '      else ''{}''::text[] end,
    case when v_haul = ''TIPPER'' then p_order->>''tipper_config'' end,
    case when v_haul = ''TIPPER'' then (p_order->>''site_pricing'')::public.site_pricing end,
    case when v_haul = ''TIPPER'' then nullif(p_order->>''site_rate_cents'', '''')::integer end,
    case when v_haul = ''TIPPER'' then nullif(p_order->>''planned_qty'', '''')::numeric end,
    case when v_haul = ''TIPPER'' then nullif(p_order->>''material_code'', '''') end,
    case when v_haul = ''TIPPER'' then nullif(p_order->>''planned_volume_m3'', '''')::numeric end,
    case when v_unit then');
  v_new := replace(v_new,
    '    nullif(p_order->>''rate_cents'', '''')::integer,
    nullif(btrim(coalesce(p_order->>''comment'', '''')), ''''),',
    '    /* У стройки цена на столе — ориентир: ставка × ориентир часов, рейсов или тонн. */
    case when v_haul = ''TIPPER''
      then round(nullif(p_order->>''site_rate_cents'', '''')::numeric * coalesce(nullif(p_order->>''planned_qty'', '''')::numeric, 1))::integer
      else nullif(p_order->>''rate_cents'', '''')::integer end,
    nullif(btrim(coalesce(p_order->>''comment'', '''')), ''''),');
  v_new := replace(v_new,
    'if app.order_max_weight_kg(v_order.id) = 0 then',
    'if v_order.haul_kind <> ''TIPPER'' and app.order_max_weight_kg(v_order.id) = 0 then');
  if position('tipper_config, site_pricing' in v_new) = 0
     or position('v_haul <> ''TIPPER'' and v_ldm is null' in v_new) = 0
     or position('v_unit or v_haul = ''TIPPER''' in v_new) = 0
     or position('ставка × ориентир' in v_new) = 0
     or position('v_order.haul_kind <> ''TIPPER'' and app.order_max_weight_kg' in v_new) = 0
     or position('then p_order->>''tipper_config'' end' in v_new) = 0 then
    raise exception 'create_order_for: не все места правки найдены';
  end if;
  execute v_new;
end;
$$;

-- ── Сводка для кабинетов ──────────────────────────────────────────

/*
 * Сколько наработано по самосвальному заказу и сколько это стоит по
 * ставке — для панели закрытия у перевозчика и карточки у заказчика.
 * Видят назначенный перевозчик, заказчик и оператор.
 */
create or replace function public.tipper_order_summary(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_company uuid := (select app.current_company_id());
  v_totals record;
begin
  select * into v_order from public.orders where id = p_order_id and haul_kind = 'TIPPER';
  if v_order.id is null then
    return null;
  end if;
  if not coalesce(v_company in (v_order.assigned_company_id, v_order.shipper_company_id) or (select app.is_admin()), false) then
    raise exception 'Нет доступа к заказу.' using errcode = '42501';
  end if;

  select * into v_totals from app.tipper_order_totals(p_order_id);

  return jsonb_build_object(
    'days', coalesce(v_totals.days, 0),
    'open_days', coalesce(v_totals.open_days, 0),
    'minutes', coalesce(v_totals.minutes, 0),
    'loads', coalesce(v_totals.loads, 0),
    'net_kg', coalesce(v_totals.net_kg, 0),
    'pricing', v_order.site_pricing,
    'unit_rate_cents', v_order.site_rate_cents,
    'amount_cents', case v_order.site_pricing
      when 'HOUR' then round(coalesce(v_totals.minutes, 0) / 60.0 * v_order.site_rate_cents)
      when 'LOAD' then coalesce(v_totals.loads, 0) * v_order.site_rate_cents
      else round(coalesce(v_totals.net_kg, 0) / 1000.0 * v_order.site_rate_cents)
    end
  );
end;
$$;

revoke all on function public.tipper_order_summary(uuid) from public, anon;
grant execute on function public.tipper_order_summary(uuid) to authenticated;
