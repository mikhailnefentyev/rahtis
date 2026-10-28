-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · топливо: подписка в базе и повтор заправки (28.10.2026)
--
-- Проверка коммита ff66324:
--   · раздел «Топливо» входит в подписку, но база этого не знала —
--     запись напрямую через API обходила закрытую страницу. Теперь
--     вставка отчёта и ручной заправки и подтверждение отчёта требуют
--     app.own_orders_allowed (подписчик или бесплатный период);
--   · driver_fuel_add разбирал числа до проверки повтора: повтор из
--     очереди с теми же полями — норма, а падать он должен только на
--     новом событии.
-- Заправки водителя подпиской не закрыты: данные копятся и с первого
-- дня подписки уже дают расход.
-- ═══════════════════════════════════════════════════════════════════

drop policy fuel_entries_insert_own on public.fuel_entries;
create policy fuel_entries_insert_own
  on public.fuel_entries for insert to authenticated
  with check (
    company_id = (select app.current_company_id())
    and source = 'MANUAL'
    and coalesce(app.own_orders_allowed(company_id), false)
  );

drop policy fuel_imports_own on public.fuel_imports;
create policy fuel_imports_own
  on public.fuel_imports for select to authenticated
  using (company_id = (select app.current_company_id()));
create policy fuel_imports_insert_own
  on public.fuel_imports for insert to authenticated
  with check (company_id = (select app.current_company_id()) and coalesce(app.own_orders_allowed(company_id), false));
create policy fuel_imports_update_own
  on public.fuel_imports for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));
create policy fuel_imports_delete_own
  on public.fuel_imports for delete to authenticated
  using (company_id = (select app.current_company_id()));

create or replace function public.driver_fuel_add(
  p_data jsonb,
  p_at timestamptz default null,
  p_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
  v_at timestamptz := coalesce(app.client_time(p_at), clock_timestamp());
  v_line jsonb;
  v_first boolean := true;
  v_odometer integer;
  v_amount integer;
  v_receipt text := nullif(p_data ->> 'receipt_path', '');
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'FUEL', p_at) then
    return;
  end if;

  /* Числа — после проверки повтора: повтор с кривыми полями не должен падать вместо «уже было». */
  v_odometer := nullif(p_data ->> 'odometer_km', '')::numeric::integer;
  v_amount := round(nullif(p_data ->> 'amount', '')::numeric * 100)::integer;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);
  if v_vehicle is null then
    raise exception 'Водитель не закреплён за машиной.' using errcode = '55000';
  end if;

  if jsonb_typeof(p_data -> 'lines') <> 'array' or jsonb_array_length(p_data -> 'lines') not between 1 and 4 then
    raise exception 'Нет строк заправки.' using errcode = '22023';
  end if;

  /* Фото чека — только из папки своей компании: путь собирает сервер, но верить ему на слово незачем. */
  if v_receipt is not null
     and v_receipt !~ ('^' || v_driver.company_id::text || '/receipts/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    v_receipt := null;
  end if;

  for v_line in select * from jsonb_array_elements(p_data -> 'lines') loop
    insert into public.fuel_entries (
      company_id, vehicle_id, driver_id, filled_at, product, quantity, amount_cents, odometer_km,
      full_tank, station, source, receipt_path, event_id)
    values (
      v_driver.company_id, v_vehicle, v_driver.id, v_at,
      v_line ->> 'product',
      (v_line ->> 'quantity')::numeric,
      case when v_first then v_amount end,
      v_odometer,
      coalesce((p_data ->> 'full_tank')::boolean, true),
      nullif(left(btrim(coalesce(p_data ->> 'station', '')), 120), ''),
      'DRIVER',
      case when v_first then v_receipt end,
      p_event_id
    );
    v_first := false;
  end loop;
end;
$$;

create or replace function public.carrier_fuel_import_confirm(p_import_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_import public.fuel_imports;
  v_row jsonb;
  v_vehicle uuid;
  v_at timestamptz;
  v_product text;
  v_qty numeric;
  v_card text;
  v_match uuid;
  v_inserted integer := 0;
  v_merged integer := 0;
begin
  if not coalesce(app.own_orders_allowed(v_company), false) then
    raise exception 'Топливо входит в подписку.' using errcode = '42501';
  end if;

  select * into v_import from public.fuel_imports
  where id = p_import_id and company_id = v_company
  for update;
  if v_import.id is null then
    raise exception 'Отчёт не найден.' using errcode = 'P0002';
  end if;
  if v_import.status <> 'REVIEW' then
    raise exception 'Отчёт уже подтверждён.' using errcode = '55000';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Строки отчёта не разобраны.' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    select id into v_vehicle from public.vehicles
    where id = nullif(v_row ->> 'vehicle_id', '')::uuid and company_id = v_company;
    continue when v_vehicle is null;

    v_at := (v_row ->> 'filled_at')::timestamptz;
    v_product := v_row ->> 'product';
    v_qty := (v_row ->> 'quantity')::numeric;
    v_card := nullif(regexp_replace(coalesce(v_row ->> 'card_ref', ''), '\s', '', 'g'), '');

    select e.id into v_match
    from public.fuel_entries e
    where e.vehicle_id = v_vehicle
      and e.product = v_product
      and (
        abs(extract(epoch from e.filled_at - v_at)) <= 3 * 3600
        or (e.filled_at at time zone 'Europe/Helsinki')::date = (v_at at time zone 'Europe/Helsinki')::date
      )
      and abs(e.quantity - v_qty) <= greatest(0.5, v_qty * 0.02)
    order by abs(extract(epoch from e.filled_at - v_at))
    limit 1;

    if v_match is not null then
      update public.fuel_entries
      set amount_cents = coalesce(amount_cents, nullif(v_row ->> 'amount_cents', '')::integer),
          station = coalesce(station, nullif(left(btrim(coalesce(v_row ->> 'station', '')), 120), '')),
          odometer_km = coalesce(odometer_km, nullif(v_row ->> 'odometer_km', '')::numeric::integer),
          card_ref = coalesce(card_ref, v_card),
          import_id = coalesce(import_id, v_import.id)
      where id = v_match;
      v_merged := v_merged + 1;
    else
      insert into public.fuel_entries (
        company_id, vehicle_id, filled_at, product, quantity, amount_cents, odometer_km, station, card_ref, source, import_id)
      values (
        v_company, v_vehicle, v_at, v_product, v_qty,
        nullif(v_row ->> 'amount_cents', '')::integer,
        nullif(v_row ->> 'odometer_km', '')::numeric::integer,
        nullif(left(btrim(coalesce(v_row ->> 'station', '')), 120), ''),
        v_card, 'IMPORT', v_import.id);
      v_inserted := v_inserted + 1;
    end if;

    if v_card is not null and v_card ~ '^[A-Za-z0-9*-]{3,40}$' then
      insert into public.fuel_cards (company_id, card_ref, vehicle_id)
      values (v_company, v_card, v_vehicle)
      on conflict (company_id, card_ref) do update set vehicle_id = excluded.vehicle_id, updated_at = now();
    end if;
  end loop;

  update public.fuel_imports
  set status = 'DONE', confirmed_at = now(), inserted = v_inserted, merged = v_merged
  where id = v_import.id;

  return jsonb_build_object('inserted', v_inserted, 'merged', v_merged);
end;
$$;
