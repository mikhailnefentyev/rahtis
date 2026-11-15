-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · обслуживание парка: исправления после вычитки (15.11.2026)
--
-- 1. Дефект от водителя: пробег вне диапазона — пусто, а не отказ
--    (опечатка в 11 цифр клинила очередь телефона, 10–2147 млн —
--    выбрасывала дефект, в том числе «ехать нельзя»). Фото — только по
--    имени этого же действия (company/defects/<event_id>.ext).
-- 2. Дефект и осмотр без связи — на машину, которую водитель видел на
--    экране в момент нажатия (если он был за ней закреплён тогда), а не
--    на ту, за которой он закреплён в момент синхронизации.
-- 3. Осмотр не плодит дефекты: открытый дефект того же узла той же
--    машины — не новый; «ехать нельзя» по нему поднимает серьёзность
--    (триггер ставит блокировку).
-- 4. «Сделано» задним числом не отматывает срок пункта назад (а с ним —
--    ложный ajokielto); дефекты закрываются только этой же машины.
-- 5. Даты — по Хельсинки, как в остальном модуле, а не UTC current_date.
-- 6. Путь документа — строго <company>/docs/<uuid>/<uuid>.<ext>.
-- ═══════════════════════════════════════════════════════════════════

/* Машина водителя на момент действия: присланная, если он был за ней закреплён тогда; иначе текущая. */
create or replace function app.driver_vehicle_at(p_driver uuid, p_vehicle uuid, p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select vd.vehicle_id from public.vehicle_drivers vd
     where vd.driver_id = p_driver and vd.vehicle_id = p_vehicle and vd.during @> p_at
     limit 1),
    (select vd.vehicle_id from public.vehicle_drivers vd
     where vd.driver_id = p_driver and upper_inf(vd.during)
     limit 1));
$$;

revoke all on function app.driver_vehicle_at(uuid, uuid, timestamptz) from public, anon, authenticated;

/* Целое из jsonb в диапазоне одометра; мусор и вне диапазона — null. */
create or replace function app.km_or_null(p_value text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  v := p_value::numeric;
  if v < 0 or v > 9999999 then
    return null;
  end if;
  return round(v)::integer;
exception when others then
  return null;
end;
$$;

-- ── 1, 2. Дефект от водителя ──────────────────────────────────────

create or replace function public.driver_defect_add(
  p_data jsonb,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_trailer uuid;
  v_at timestamptz;
  v_photo text := nullif(p_data ->> 'photo_path', '');
  v_id uuid;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'DEFECT', p_at) then
    return null;
  end if;

  v_at := coalesce(app.client_time(p_at), clock_timestamp());

  if nullif(p_data ->> 'trailer_id', '') is not null then
    select id into v_trailer from public.trailers
    where id = (p_data ->> 'trailer_id')::uuid and company_id = v_driver.company_id;
    if v_trailer is null then
      raise exception 'Прицеп не найден.' using errcode = 'P0002';
    end if;
  else
    v_vehicle := app.driver_vehicle_at(v_driver.id, nullif(p_data ->> 'vehicle_id', '')::uuid, v_at);
    if v_vehicle is null then
      raise exception 'Водитель не закреплён за машиной.' using errcode = '55000';
    end if;
  end if;

  /* Фото — только своё: имя файла — идентификатор этого же действия. */
  if v_photo is not null
     and (p_event_id is null
          or v_photo !~ ('^' || v_driver.company_id::text || '/defects/' || p_event_id::text || '\.(jpg|png|webp)$')) then
    v_photo := null;
  end if;

  insert into public.vehicle_defects (
    company_id, vehicle_id, trailer_id, driver_id, reported_by, reported_at,
    area, severity, description, odometer_km, photo_path, event_id)
  values (
    v_driver.company_id, v_vehicle, v_trailer, v_driver.id, auth.uid(), v_at,
    coalesce(nullif(p_data ->> 'area', ''), 'OTHER'),
    coalesce(nullif(p_data ->> 'severity', ''), 'CAN_DRIVE'),
    btrim(coalesce(p_data ->> 'description', '')),
    case when v_vehicle is not null then app.km_or_null(p_data ->> 'odometer_km') end,
    v_photo,
    p_event_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.driver_defect_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_defect_add(jsonb, timestamptz, uuid) to authenticated;

-- ── 2, 3. Осмотр от водителя ──────────────────────────────────────

create or replace function public.driver_inspection_add(
  p_data jsonb,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_at timestamptz;
  v_km integer;
  v_item jsonb;
  v_key text;
  v_area text;
  v_severity text;
  v_results jsonb := '{}'::jsonb;
  v_faults jsonb := '[]'::jsonb;
  v_id uuid;
  v_defect uuid;
  v_existing public.vehicle_defects;
  v_defects uuid[] := '{}';
  v_keys constant text[] := array['TYRES', 'BRAKES', 'LIGHTS', 'FLUIDS', 'DASHBOARD', 'VISIBILITY', 'COUPLING', 'TACHOGRAPH', 'SAFETY'];
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'INSPECTION', p_at) then
    return null;
  end if;

  v_at := coalesce(app.client_time(p_at), clock_timestamp());
  v_vehicle := app.driver_vehicle_at(v_driver.id, nullif(p_data ->> 'vehicle_id', '')::uuid, v_at);
  if v_vehicle is null then
    raise exception 'Водитель не закреплён за машиной.' using errcode = '55000';
  end if;

  if jsonb_typeof(p_data -> 'items') is distinct from 'array' then
    raise exception 'Нет пунктов осмотра.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_data -> 'items') loop
    v_key := v_item ->> 'key';
    if not (v_key = any (v_keys)) or v_results ? v_key then
      raise exception 'Неизвестный или повторный пункт осмотра.' using errcode = '22023';
    end if;
    if coalesce((v_item ->> 'ok')::boolean, false) then
      v_results := v_results || jsonb_build_object(v_key, 'OK');
    else
      if char_length(btrim(coalesce(v_item ->> 'description', ''))) < 3 then
        raise exception 'Опишите неисправность.' using errcode = '22023';
      end if;
      v_results := v_results || jsonb_build_object(v_key, 'DEFECT');
      v_faults := v_faults || jsonb_build_array(v_item);
    end if;
  end loop;

  if (select count(*) from jsonb_object_keys(v_results)) <> cardinality(v_keys) then
    raise exception 'Осмотр не по всем пунктам.' using errcode = '22023';
  end if;

  v_km := app.km_or_null(p_data ->> 'odometer_km');

  insert into public.vehicle_inspections (company_id, vehicle_id, driver_id, inspected_at, odometer_km, results, defects, event_id)
  values (v_driver.company_id, v_vehicle, v_driver.id, v_at, v_km, v_results, jsonb_array_length(v_faults), p_event_id)
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(v_faults) loop
    v_area := app.inspection_area(v_item ->> 'key');
    v_severity := case when v_item ->> 'severity' = 'UNSAFE' then 'UNSAFE' else 'CAN_DRIVE' end;

    /* Тот же узел уже открыт — это известная неисправность, а не новая. */
    select * into v_existing from public.vehicle_defects
    where vehicle_id = v_vehicle and area = v_area and status = 'OPEN'
    order by reported_at desc
    limit 1;

    if v_existing.id is not null then
      if v_severity = 'UNSAFE' and v_existing.severity <> 'UNSAFE' then
        update public.vehicle_defects set severity = 'UNSAFE' where id = v_existing.id;
        v_defects := v_defects || v_existing.id;
      end if;
      continue;
    end if;

    insert into public.vehicle_defects (
      company_id, vehicle_id, driver_id, reported_by, reported_at,
      area, severity, description, odometer_km, inspection_id)
    values (
      v_driver.company_id, v_vehicle, v_driver.id, auth.uid(), v_at,
      v_area, v_severity,
      left(btrim(v_item ->> 'description'), 1000),
      v_km,
      v_id)
    returning id into v_defect;
    v_defects := v_defects || v_defect;
  end loop;

  return jsonb_build_object('inspection_id', v_id, 'defect_ids', to_jsonb(v_defects));
end;
$$;

revoke all on function public.driver_inspection_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_inspection_add(jsonb, timestamptz, uuid) to authenticated;

-- ── 4, 5. «Сделано» ───────────────────────────────────────────────

create or replace function public.carrier_maintenance_done(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_today date := (now() at time zone 'Europe/Helsinki')::date;
  v_item public.maintenance_items;
  v_vehicle uuid;
  v_trailer uuid;
  v_kind text;
  v_title text;
  v_done date := (p_data ->> 'done_on')::date;
  v_km integer := nullif(p_data ->> 'odometer_km', '')::numeric::integer;
  v_amount integer := nullif(p_data ->> 'amount_cents', '')::integer;
  v_workshop text := nullif(left(btrim(coalesce(p_data ->> 'workshop', '')), 120), '');
  v_next_on date := nullif(p_data ->> 'next_due_on', '')::date;
  v_next_km integer := nullif(p_data ->> 'next_due_km', '')::numeric::integer;
  v_cost uuid;
  v_record uuid;
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;
  if v_done is null or v_done > v_today + 1 then
    raise exception 'Дата работ.' using errcode = '22023';
  end if;

  if nullif(p_data ->> 'item_id', '') is not null then
    select * into v_item from public.maintenance_items
    where id = (p_data ->> 'item_id')::uuid and company_id = v_company
    for update;
    if v_item.id is null then
      raise exception 'Пункт не найден.' using errcode = 'P0002';
    end if;
    v_vehicle := v_item.vehicle_id;
    v_trailer := v_item.trailer_id;
    v_kind := v_item.kind;
    v_title := v_item.title;
  else
    v_vehicle := nullif(p_data ->> 'vehicle_id', '')::uuid;
    v_trailer := nullif(p_data ->> 'trailer_id', '')::uuid;
    v_kind := coalesce(nullif(p_data ->> 'kind', ''), 'REPAIR');
    v_title := nullif(left(btrim(coalesce(p_data ->> 'title', '')), 80), '');

    /*
     * Машина или прицеп — ровно одно и своей компании, до любой записи.
     * Триггер fleet_asset_check на книжке и так откатил бы чужую машину,
     * но строка расходов пишется раньше книжки — проверка здесь не
     * держится на порядке вставок.
     */
    if num_nonnulls(v_vehicle, v_trailer) <> 1 then
      raise exception 'Укажите машину или прицеп.' using errcode = '22023';
    end if;
    if v_vehicle is not null and not exists (select 1 from public.vehicles where id = v_vehicle and company_id = v_company) then
      raise exception 'Машина не найдена.' using errcode = 'P0002';
    end if;
    if v_trailer is not null and not exists (select 1 from public.trailers where id = v_trailer and company_id = v_company) then
      raise exception 'Прицеп не найден.' using errcode = 'P0002';
    end if;
  end if;

  if v_trailer is not null then
    v_km := null;
  end if;

  if v_vehicle is not null and v_amount > 0 and coalesce(app.own_orders_allowed(v_company), false) then
    insert into public.vehicle_costs (company_id, vehicle_id, spent_on, category, amount_cents, currency, note, supplier, created_by)
    values (
      v_company, v_vehicle, v_done,
      case when v_kind = 'TYRES' then 'TYRES' else 'REPAIR' end,
      v_amount,
      coalesce(nullif(p_data ->> 'currency', '')::public.currency_code,
               (select currency from public.companies where id = v_company)),
      nullif(left(btrim(coalesce(p_data ->> 'cost_note', '')), 200), ''),
      v_workshop,
      auth.uid())
    returning id into v_cost;
  end if;

  insert into public.maintenance_records (
    company_id, vehicle_id, trailer_id, item_id, kind, title, done_on, odometer_km, workshop,
    amount_cents, currency, note, cost_id)
  values (
    v_company, v_vehicle, v_trailer, v_item.id, v_kind, v_title, v_done, v_km, v_workshop,
    v_amount,
    case when v_amount is not null then
      coalesce(nullif(p_data ->> 'currency', '')::public.currency_code,
               (select currency from public.companies where id = v_company))
    end,
    nullif(left(btrim(coalesce(p_data ->> 'note', '')), 500), ''),
    v_cost)
  returning id into v_record;

  /*
   * Срок пункта двигается только вперёд: запись задним числом (старый
   * katsastus в книжку) остаётся историей и не отматывает срок назад —
   * иначе ночная проверка сочла бы машину просроченной и сняла с рейсов.
   */
  if v_item.id is not null and v_done >= coalesce(v_item.last_done_on, v_done) then
    update public.maintenance_items
    set last_done_on = v_done,
        last_done_km = coalesce(v_km, last_done_km),
        next_due_on = coalesce(
          v_next_on,
          case when interval_months is not null then (v_done + make_interval(months => interval_months))::date end),
        next_due_km = coalesce(
          v_next_km,
          case when interval_km is not null and v_km is not null then v_km + interval_km end)
    where id = v_item.id;
  end if;

  /* Исправлены этим заездом — только дефекты этой же машины или прицепа. */
  if jsonb_typeof(p_data -> 'defect_ids') = 'array' then
    update public.vehicle_defects
    set status = 'FIXED', resolved_at = now(), resolved_by = auth.uid(), record_id = v_record
    where company_id = v_company
      and status = 'OPEN'
      and vehicle_id is not distinct from v_vehicle
      and trailer_id is not distinct from v_trailer
      and id in (select value::uuid from jsonb_array_elements_text(p_data -> 'defect_ids'));
  end if;

  return v_record;
end;
$$;

revoke all on function public.carrier_maintenance_done(jsonb) from public, anon;
grant execute on function public.carrier_maintenance_done(jsonb) to authenticated;

-- ── 5. Даты по Хельсинки: сроки для водителя и напоминаний ─────────

create or replace function public.driver_maintenance_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_km integer;
  v_today date := (now() at time zone 'Europe/Helsinki')::date;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);
  v_km := case when v_vehicle is not null then app.vehicle_odometer(v_vehicle) end;

  return jsonb_build_object(
    'company_id', v_driver.company_id,
    'vehicle', (select jsonb_build_object('id', v.id, 'plate', v.plate) from public.vehicles v where v.id = v_vehicle),
    'last_odometer', v_km,
    'trailers', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'plate', t.plate) order by t.plate)
      from public.trailers t where t.company_id = v_driver.company_id
    ), '[]'::jsonb),
    'due', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', i.kind, 'title', i.title, 'next_due_on', i.next_due_on, 'next_due_km', i.next_due_km)
        order by i.next_due_on nulls last)
      from public.maintenance_items i
      where i.vehicle_id = v_vehicle
        and (
          i.next_due_on <= v_today + 30
          or (i.next_due_km is not null and v_km is not null and i.next_due_km - v_km <= 2000)
        )
    ), '[]'::jsonb),
    'defects', coalesce((
      select jsonb_agg(x order by x ->> 'reported_at' desc)
      from (
        select jsonb_build_object(
          'id', d.id, 'reported_at', d.reported_at, 'area', d.area, 'severity', d.severity,
          'description', d.description, 'status', d.status, 'mine', d.driver_id = v_driver.id,
          'plate', coalesce(
            (select plate from public.vehicles where id = d.vehicle_id),
            (select plate from public.trailers where id = d.trailer_id))) as x
        from public.vehicle_defects d
        where d.company_id = v_driver.company_id
          and (d.driver_id = v_driver.id or (d.vehicle_id = v_vehicle and d.status = 'OPEN'))
        order by d.reported_at desc
        limit 15
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_maintenance_state() from public, anon;
grant execute on function public.driver_maintenance_state() to authenticated;

create or replace function public.maintenance_due_candidates(p_days integer, p_km integer)
returns table (
  item_id uuid,
  company_id uuid,
  vehicle_id uuid,
  trailer_id uuid,
  plate text,
  kind text,
  title text,
  next_due_on date,
  next_due_km integer,
  current_km integer,
  driver_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.company_id, i.vehicle_id, i.trailer_id,
         coalesce(v.plate, t.plate),
         i.kind, i.title, i.next_due_on, i.next_due_km, o.km,
         (select vd.driver_id from public.vehicle_drivers vd
          where vd.vehicle_id = i.vehicle_id and upper_inf(vd.during) limit 1)
  from public.maintenance_items i
  left join public.vehicles v on v.id = i.vehicle_id
  left join public.trailers t on t.id = i.trailer_id
  left join lateral (
    select case when i.vehicle_id is not null and i.next_due_km is not null then app.vehicle_odometer(i.vehicle_id) end as km
  ) o on true
  join public.companies c on c.id = i.company_id
  where c.status = 'ACTIVE'
    and (
      i.next_due_on <= (now() at time zone 'Europe/Helsinki')::date + p_days
      or (i.next_due_km is not null and o.km is not null and i.next_due_km - o.km <= p_km)
    );
$$;

revoke all on function public.maintenance_due_candidates(integer, integer) from public, anon, authenticated;
grant execute on function public.maintenance_due_candidates(integer, integer) to service_role;

-- ── 6. Путь документа — строго ───────────────────────────────────

alter table public.maintenance_documents drop constraint maintenance_documents_path;
alter table public.maintenance_documents add constraint maintenance_documents_path check (
  storage_path ~ ('^' || company_id::text || '/docs/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$')
);
