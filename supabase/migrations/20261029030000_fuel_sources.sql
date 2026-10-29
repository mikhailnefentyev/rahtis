-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · топливо: три источника рядом (29.10.2026)
--
-- Решение пользователя: на графике три линии — отчёт заправщика,
-- водитель и спутник (система GPS перевозчика), чтобы были видны
-- расхождения.
--
-- Одна заправка по-прежнему одна строка, но объём каждого источника
-- хранится отдельно: qty_report, qty_driver, qty_telematics. Колонка
-- quantity — то, что идёт в расход и траты: отчёт (по нему платят),
-- иначе водитель, иначе спутник.
--
-- Слияние теперь одно для всех путей (app.fuel_match):
--   · раньше заправка водителя всегда вставлялась новой строкой, и
--     отчёт, загруженный до неё, давал дубль — теперь водитель тоже
--     ищет пару;
--   · пара — та же машина и продукт, источник, которого у строки ещё
--     нет, и время ±1 ч при любом объёме или тот же день / ±3 ч при
--     объёме ±15 %. Шире прежних ±2 %: расхождение и есть то, что
--     нужно увидеть, а не повод завести вторую строку.
--
-- Спутник: public.telematics_fuel_add — только service_role, для
-- будущего забора заправок у провайдера GPS. Километры спутника лежат
-- отдельно (telematics_km) и в одометр не попадают: счётчик GPS часто
-- не совпадает с приборным, а расход считается по одной шкале.
-- ═══════════════════════════════════════════════════════════════════

alter table public.fuel_entries drop constraint fuel_entries_source;
alter table public.fuel_entries add constraint fuel_entries_source
  check (source in ('DRIVER', 'IMPORT', 'MANUAL', 'TELEMATICS'));

alter table public.fuel_entries
  add column qty_report numeric(8, 2) constraint fuel_entries_qty_report check (qty_report > 0 and qty_report <= 2000),
  add column qty_driver numeric(8, 2) constraint fuel_entries_qty_driver check (qty_driver > 0 and qty_driver <= 2000),
  add column qty_telematics numeric(8, 2) constraint fuel_entries_qty_telematics check (qty_telematics > 0 and qty_telematics <= 2000),
  add column telematics_ref text constraint fuel_entries_telematics_ref check (char_length(telematics_ref) between 1 and 120),
  add column telematics_km integer constraint fuel_entries_telematics_km check (telematics_km between 0 and 5000000);

/* Повтор события провайдера не даёт второй строки. */
create unique index fuel_entries_telematics_ref_idx
  on public.fuel_entries (company_id, telematics_ref) where telematics_ref is not null;

/* Что было до сих пор: водитель — свой объём; строка с отчётом — объём отчёта (при слиянии он расходился с водительским не больше чем на 2 %). */
update public.fuel_entries set qty_driver = quantity where source = 'DRIVER';
update public.fuel_entries set qty_report = quantity where source = 'IMPORT' or import_id is not null;

-- ── Пара для новой строки ─────────────────────────────────────────

create or replace function app.fuel_match(
  p_vehicle uuid,
  p_product text,
  p_at timestamptz,
  p_qty numeric,
  p_kind text
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.fuel_entries e
  where e.vehicle_id = p_vehicle
    and e.product = p_product
    and (
      (p_kind = 'IMPORT' and e.qty_report is null)
      or (p_kind = 'DRIVER' and e.qty_driver is null)
      or (p_kind = 'TELEMATICS' and e.qty_telematics is null)
    )
    and (
      abs(extract(epoch from e.filled_at - p_at)) <= 3600
      or (
        (
          abs(extract(epoch from e.filled_at - p_at)) <= 3 * 3600
          or (e.filled_at at time zone 'Europe/Helsinki')::date = (p_at at time zone 'Europe/Helsinki')::date
        )
        and abs(e.quantity - p_qty) <= greatest(1, p_qty * 0.15)
      )
    )
  order by abs(extract(epoch from e.filled_at - p_at))
  limit 1;
$$;

revoke all on function app.fuel_match(uuid, text, timestamptz, numeric, text) from public, anon, authenticated;

-- ── Водитель ──────────────────────────────────────────────────────

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
  v_station text;
  v_full boolean;
  v_product text;
  v_qty numeric;
  v_match uuid;
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
  v_station := nullif(left(btrim(coalesce(p_data ->> 'station', '')), 120), '');
  v_full := coalesce((p_data ->> 'full_tank')::boolean, true);

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
    v_product := v_line ->> 'product';
    v_qty := (v_line ->> 'quantity')::numeric;
    v_match := app.fuel_match(v_vehicle, v_product, v_at, v_qty, 'DRIVER');

    if v_match is not null then
      /* Отчёт или спутник уже есть: водитель добавляет свой объём, одометр, полный бак и чек; сумма отчёта главнее. */
      update public.fuel_entries
      set qty_driver = v_qty,
          quantity = coalesce(qty_report, v_qty),
          driver_id = v_driver.id,
          event_id = coalesce(event_id, p_event_id),
          odometer_km = coalesce(v_odometer, odometer_km),
          full_tank = v_full,
          amount_cents = coalesce(amount_cents, case when v_first then v_amount end),
          station = coalesce(station, v_station),
          receipt_path = coalesce(receipt_path, case when v_first then v_receipt end),
          /* Время спутника точнее всех, водителя — точнее отчёта (там его часто нет). */
          filled_at = case when qty_telematics is null then v_at else filled_at end
      where id = v_match;
    else
      insert into public.fuel_entries (
        company_id, vehicle_id, driver_id, filled_at, product, quantity, qty_driver, amount_cents, odometer_km,
        full_tank, station, source, receipt_path, event_id)
      values (
        v_driver.company_id, v_vehicle, v_driver.id, v_at, v_product, v_qty, v_qty,
        case when v_first then v_amount end,
        v_odometer, v_full, v_station, 'DRIVER',
        case when v_first then v_receipt end,
        p_event_id
      );
    end if;
    v_first := false;
  end loop;
end;
$$;

revoke all on function public.driver_fuel_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_fuel_add(jsonb, timestamptz, uuid) to authenticated;

-- ── Отчёт заправщика ──────────────────────────────────────────────

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
    v_match := app.fuel_match(v_vehicle, v_product, v_at, v_qty, 'IMPORT');

    if v_match is not null then
      /* Объём и сумма отчёта главнее: по нему платят. Время и одометр — у кого они уже есть. */
      update public.fuel_entries
      set qty_report = v_qty,
          quantity = v_qty,
          amount_cents = coalesce(nullif(v_row ->> 'amount_cents', '')::integer, amount_cents),
          station = coalesce(station, nullif(left(btrim(coalesce(v_row ->> 'station', '')), 120), '')),
          odometer_km = coalesce(odometer_km, nullif(v_row ->> 'odometer_km', '')::numeric::integer),
          card_ref = coalesce(card_ref, v_card),
          import_id = coalesce(import_id, v_import.id),
          /* Строка одного спутника — без отметки о полном баке; отчёт, как и раньше, считается полным. */
          full_tank = case when qty_driver is null then true else full_tank end
      where id = v_match;
      v_merged := v_merged + 1;
    else
      insert into public.fuel_entries (
        company_id, vehicle_id, filled_at, product, quantity, qty_report, amount_cents, odometer_km, station, card_ref,
        source, import_id)
      values (
        v_company, v_vehicle, v_at, v_product, v_qty, v_qty,
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

revoke all on function public.carrier_fuel_import_confirm(uuid, jsonb) from public, anon;
grant execute on function public.carrier_fuel_import_confirm(uuid, jsonb) to authenticated;

-- ── Спутник ───────────────────────────────────────────────────────

/*
 * Заправки, которые увидела система GPS перевозчика (датчик уровня или
 * CAN). Зовёт только сервер (service_role) при заборе данных у провайдера.
 * p_events: [{ref, filled_at, product?, quantity, mileage_km?}]
 *   ref        — id события у провайдера: повтор не даёт второй строки;
 *   product    — по умолчанию DIESEL;
 *   mileage_km — счётчик пробега GPS, в одометр не идёт.
 * Без подписки — ничего не пишет: топливо входит в подписку.
 */
create or replace function public.telematics_fuel_add(p_vehicle uuid, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_event jsonb;
  v_ref text;
  v_at timestamptz;
  v_product text;
  v_qty numeric;
  v_km integer;
  v_match uuid;
  v_inserted integer := 0;
  v_merged integer := 0;
  v_skipped integer := 0;
begin
  select company_id into v_company from public.vehicles where id = p_vehicle;
  if v_company is null then
    raise exception 'Машина не найдена.' using errcode = 'P0002';
  end if;
  if not coalesce(app.own_orders_allowed(v_company), false) then
    return jsonb_build_object('inserted', 0, 'merged', 0, 'skipped', 0, 'locked', true);
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 500 then
    raise exception 'События не разобраны.' using errcode = '22023';
  end if;

  for v_event in select * from jsonb_array_elements(p_events) loop
    v_ref := nullif(left(btrim(coalesce(v_event ->> 'ref', '')), 120), '');
    v_at := (v_event ->> 'filled_at')::timestamptz;
    v_product := upper(coalesce(nullif(v_event ->> 'product', ''), 'DIESEL'));
    v_qty := round((v_event ->> 'quantity')::numeric, 2);
    v_km := nullif(v_event ->> 'mileage_km', '')::numeric::integer;

    if v_ref is null or v_at is null or v_qty is null or v_qty <= 0 or v_qty > 2000
       or v_product not in ('DIESEL', 'HVO', 'ADBLUE', 'PETROL', 'LNG', 'LBG', 'CNG', 'CBG', 'OTHER')
       or exists (select 1 from public.fuel_entries where company_id = v_company and telematics_ref = v_ref) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_match := app.fuel_match(p_vehicle, v_product, v_at, v_qty, 'TELEMATICS');
    if v_match is not null then
      update public.fuel_entries
      set qty_telematics = v_qty,
          telematics_ref = v_ref,
          telematics_km = coalesce(v_km, telematics_km),
          filled_at = v_at
      where id = v_match;
      v_merged := v_merged + 1;
    else
      /* Полного бака спутник не знает: строка не открывает интервал расхода, её литры входят в тот, где она лежит. */
      insert into public.fuel_entries (
        company_id, vehicle_id, filled_at, product, quantity, qty_telematics, telematics_ref, telematics_km,
        full_tank, source)
      values (v_company, p_vehicle, v_at, v_product, v_qty, v_qty, v_ref, v_km, false, 'TELEMATICS');
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'merged', v_merged, 'skipped', v_skipped);
end;
$$;

revoke all on function public.telematics_fuel_add(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.telematics_fuel_add(uuid, jsonb) to service_role;
