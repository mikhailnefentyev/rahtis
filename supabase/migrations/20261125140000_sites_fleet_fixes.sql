-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · объекты, топливо, обслуживание, парк: правки после проверки
-- кода (22.11.2026)
--
--   1. Повторная загрузка того же отчёта о топливе удваивала заправки:
--      app.fuel_match ищет пару строке отчёта только среди строк без
--      объёма отчёта, и строки прошлой загрузки парой не становились.
--      Теперь строка, которая уже пришла из другого отчёта (та же
--      машина, топливо, время и объём), пропускается.
--   2. Заправка в леях из отчёта: в списке валют
--      carrier_fuel_import_confirm не было RON, и «500 RON» записывались
--      как 500 в валюте компании.
--   3. День объекта без конца и без рейсов подтверждался, попадал в счёт
--      нулём часов и закрывался для правок. Такой день не подтверждает
--      ни перевозчик, ни прораб.
--   4. Рейс, добавленный диспетчером без времени, получал «сейчас» и
--      растягивал старый день до сегодняшнего. В не сегодняшний день
--      время обязательно; указанное время должно лежать в этом дне (до
--      06:00 следующих суток — ночная смена).
--   5. Осмотр: узел уже с открытой неисправностью — новое описание
--      водителя терялось, а перевозчик о нём не узнавал. Текст
--      дописывается к открытой неисправности, и она возвращается в
--      списке для уведомления.
--   6. «Сделано» задним числом у пункта без прошлой отметки отматывало
--      срок назад. Срок двигается только вперёд.
--   7. Валюту компании и недельные счета мог переключить диспетчер
--      прямым запросом: колоночный грант не различает людей внутри
--      компании. Теперь это меняет владелец — триггер, как у роли
--      грузовладельца (20261106120000).
--
-- Все функции — целиком, от последнего определения (указано у каждой).
-- ═══════════════════════════════════════════════════════════════════

-- ── 1, 2. Подтверждение отчёта о топливе ──────────────────────────

/*
 * Последнее определение — 20261105100000_currency. Изменено: пропуск
 * строк, уже пришедших из другого отчёта, и RON в списке валют.
 *
 * Повтор узнаётся по объёму отчёта (qty_report) у той же машины и
 * топлива: время то же, а у строки, слитой с отметкой водителя или
 * спутника (время там их, а не отчёта), — тот же день по Хельсинки.
 * Строки этого же отчёта не сравниваются между собой: две одинаковые
 * строки в одном файле остаются на совести файла, как и раньше.
 */
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
  v_skipped integer := 0;
  v_currency text;
  v_amount integer;
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

    /* Эта заправка уже пришла из другого отчёта: тот же файл загружен второй раз или периоды отчётов пересеклись. */
    if exists (
      select 1 from public.fuel_entries e
      where e.vehicle_id = v_vehicle
        and e.product = v_product
        and e.qty_report = round(v_qty, 2)
        and e.import_id is distinct from v_import.id
        and (
          e.filled_at = v_at
          or (
            (e.qty_driver is not null or e.qty_telematics is not null)
            and (e.filled_at at time zone 'Europe/Helsinki')::date = (v_at at time zone 'Europe/Helsinki')::date
          )
        )
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_match := app.fuel_match(v_vehicle, v_product, v_at, v_qty, 'IMPORT');
    v_amount := nullif(v_row ->> 'amount_cents', '')::integer;
    /* Валюта строки отчёта (карта за границей), иначе — компании. */
    v_currency := coalesce(nullif(upper(v_row ->> 'currency'), ''), app.company_currency(v_company));
    if v_currency not in ('EUR', 'SEK', 'NOK', 'DKK', 'PLN', 'RON') then
      v_currency := app.company_currency(v_company);
    end if;

    if v_match is not null then
      /* Объём и сумма отчёта главнее: по нему платят. Время и одометр — у кого они уже есть. */
      update public.fuel_entries
      set qty_report = v_qty,
          quantity = v_qty,
          currency = case when v_amount is not null then v_currency::public.currency_code else currency end,
          amount_cents = coalesce(v_amount, amount_cents),
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
        source, import_id, currency)
      values (
        v_company, v_vehicle, v_at, v_product, v_qty, v_qty,
        nullif(v_row ->> 'amount_cents', '')::integer,
        nullif(v_row ->> 'odometer_km', '')::numeric::integer,
        nullif(left(btrim(coalesce(v_row ->> 'station', '')), 120), ''),
        v_card, 'IMPORT', v_import.id, v_currency::public.currency_code);
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

  return jsonb_build_object('inserted', v_inserted, 'merged', v_merged, 'skipped', v_skipped);
end;
$$;

revoke all on function public.carrier_fuel_import_confirm(uuid, jsonb) from public, anon;
grant execute on function public.carrier_fuel_import_confirm(uuid, jsonb) to authenticated;

-- ── 3. День без конца и без рейсов не подтверждается ──────────────

/*
 * Последнее определение обеих функций — 20261026110000_site_work.
 * День, где водитель отметил только прибытие, в счёте дал бы 0 часов и
 * после счёта уже не правится. Конец дня — отметка «закончил» или
 * последняя выгрузка (src/lib/sites/work.ts: dayEnd); нет ни того, ни
 * другого — подтверждать нечего.
 */
create or replace function public.site_foreman_approve(p_token uuid, p_day_id uuid, p_name text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day public.site_days;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Имя обязательно.' using errcode = '22023';
  end if;

  select d.* into v_day
  from public.site_days d
  join public.site_jobs j on j.id = d.job_id
  where d.id = p_day_id and j.foreman_token = p_token
    and j.status = 'ACTIVE' and d.approved_at is null
  for update of d;

  if v_day.id is null then
    raise exception 'День не найден.' using errcode = 'P0002';
  end if;
  if v_day.ended_at is null and not exists (select 1 from public.site_loads where day_id = v_day.id) then
    raise exception 'День не закончен: нет ни отметки конца, ни рейсов.' using errcode = '55000';
  end if;

  update public.site_days
  set approved_at = now(),
      approved_by = left(btrim(p_name), 120),
      approval_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
  where id = v_day.id;
end;
$$;

revoke all on function public.site_foreman_approve(uuid, uuid, text, text) from public;
grant execute on function public.site_foreman_approve(uuid, uuid, text, text) to anon, authenticated;

create or replace function public.carrier_site_approve_day(p_day_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_name text;
  v_day public.site_days;
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  select * into v_day from public.site_days
  where id = p_day_id and company_id = v_company and approved_at is null
  for update;

  if v_day.id is null then
    raise exception 'День не найден или уже подтверждён.' using errcode = 'P0002';
  end if;
  if v_day.ended_at is null and not exists (select 1 from public.site_loads where day_id = v_day.id) then
    raise exception 'День не закончен: нет ни отметки конца, ни рейсов.' using errcode = '55000';
  end if;

  select coalesce(nullif(btrim(full_name), ''), 'RAHTIS') into v_name
  from public.profiles where id = (select auth.uid());

  update public.site_days
  set approved_at = now(),
      approved_by = left(v_name, 100) || ' (kuljetusliike)',
      approval_note = null
  where id = v_day.id;
end;
$$;

revoke all on function public.carrier_site_approve_day(uuid) from public, anon;
grant execute on function public.carrier_site_approve_day(uuid) to authenticated;

-- ── 4. Время рейса, добавленного диспетчером ──────────────────────

/*
 * Последнее определение — 20261103020000_weigh_tickets. Изменено только
 * время нового рейса.
 *
 * Без времени рейс получал now(): талон за прошлую среду, внесённый в
 * понедельник, делал среду длиной в пять суток — конец дня считается по
 * последней выгрузке. Теперь в не сегодняшний день (по Хельсинки, как
 * site_days.day) время обязательно, а любое указанное время лежит в
 * своём дне: от его начала до 06:00 следующих суток (ночная смена) или
 * до отметки «закончил», если она позже.
 */
create or replace function public.carrier_site_load_save(
  p_day_id uuid,
  p_load_id uuid default null,
  p_data jsonb default '{}'::jsonb,
  p_weigh_ticket_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_day public.site_days;
  v_job public.site_jobs;
  v_load uuid;
  v_material text := nullif(p_data ->> 'material_code', '');
  v_scale uuid;
  v_at timestamptz;
  v_given timestamptz;
  v_until timestamptz;
begin
  if v_company is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;

  select * into v_day from public.site_days where id = p_day_id and company_id = v_company for update;
  if v_day.id is null then
    raise exception 'День не найден.' using errcode = 'P0002';
  end if;
  select * into v_job from public.site_jobs where id = v_day.job_id;
  if v_job.status <> 'ACTIVE' then
    raise exception 'Объект закрыт.' using errcode = '55000';
  end if;
  if v_day.invoice_id is not null then
    raise exception 'День уже в счёте.' using errcode = '55000';
  end if;

  if p_load_id is not null then
    select id into v_load from public.site_loads where id = p_load_id and day_id = v_day.id;
    if v_load is null then
      raise exception 'Рейс не найден.' using errcode = 'P0002';
    end if;
  end if;

  if v_job.order_id is not null then
    if v_load is null then
      raise exception 'Рейсы заказа платформы записывает водитель.' using errcode = '42501';
    end if;
  else
    if v_material is not null and v_material !~ '^[A-Z0-9]{2,12}$' then
      raise exception 'Неверный груз.' using errcode = '22023';
    end if;
    select id into v_scale from public.scale_sites
    where id = nullif(p_data ->> 'scale_site_id', '')::uuid
      and (approved_at is not null or created_by_company = v_company);

    if v_load is null then
      v_given := nullif(p_data ->> 'unloaded_at', '')::timestamptz;
      if v_given is null and v_day.day <> (now() at time zone 'Europe/Helsinki')::date then
        raise exception 'Укажите время выгрузки: день не сегодняшний.' using errcode = '22023';
      end if;
      if v_given is not null then
        v_until := greatest(
          ((v_day.day + 1)::timestamp + interval '6 hours') at time zone 'Europe/Helsinki',
          coalesce(v_day.ended_at, '-infinity'::timestamptz));
        if v_given < (v_day.day::timestamp at time zone 'Europe/Helsinki') or v_given > v_until then
          raise exception 'Время выгрузки не в этом дне.' using errcode = '22023';
        end if;
      end if;
      v_at := greatest(coalesce(v_given, now()), v_day.arrived_at);
      insert into public.site_loads (day_id, job_id, company_id, material_code, scale_site_id, gross_kg, tare_kg, unloaded_at, ticket_no)
      values (
        v_day.id, v_job.id, v_company,
        coalesce(v_material, v_job.material_code),
        v_scale,
        nullif(p_data ->> 'gross_kg', '')::integer,
        nullif(p_data ->> 'tare_kg', '')::integer,
        v_at,
        nullif(left(btrim(coalesce(p_data ->> 'ticket_no', '')), 60), '')
      )
      returning id into v_load;
    else
      update public.site_loads
      set material_code = coalesce(v_material, material_code),
          scale_site_id = v_scale,
          gross_kg = nullif(p_data ->> 'gross_kg', '')::integer,
          tare_kg = nullif(p_data ->> 'tare_kg', '')::integer,
          ticket_no = nullif(left(btrim(coalesce(p_data ->> 'ticket_no', '')), 60), '')
      where id = v_load;
    end if;

    update public.site_days
    set approved_at = null, approved_by = null, approval_note = null
    where id = v_day.id and approved_at is not null;
  end if;

  if p_weigh_ticket_id is not null then
    update public.weigh_tickets
    set load_id = v_load
    where id = p_weigh_ticket_id and company_id = v_company and job_id = v_job.id
      and (load_id is null or load_id = v_load);
  end if;

  return v_load;
end;
$$;

revoke all on function public.carrier_site_load_save(uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.carrier_site_load_save(uuid, uuid, jsonb, uuid) to authenticated;

-- ── 5. Осмотр: узел с уже открытой неисправностью ─────────────────

/*
 * Последнее определение — 20261115130000_maintenance_fixes. Изменена
 * только ветка «тот же узел уже открыт»: раньше новое описание водителя
 * пропадало, а перевозчик узнавал о нём лишь при переходе в «ехать
 * нельзя». Теперь новый текст дописывается к открытой неисправности с
 * датой осмотра, и она попадает в defect_ids — перевозчик получает
 * уведомление. Слово в слово то же описание (водитель каждый день
 * повторяет известное) ничего не меняет и уведомления не шлёт.
 */
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
  v_text text;
  v_add text;
  v_raise boolean;
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
      v_raise := v_severity = 'UNSAFE' and v_existing.severity <> 'UNSAFE';
      v_text := btrim(v_item ->> 'description');
      /* Новое о ней — дописывается: место под запись есть всегда, старый текст при нехватке укорачивается с конца. */
      v_add := case
        when position(lower(v_text) in lower(v_existing.description)) = 0 then
          E'\n' || to_char(v_at at time zone 'Europe/Helsinki', 'DD.MM.YYYY') || ': ' || left(v_text, 480)
      end;
      if v_raise or v_add is not null then
        update public.vehicle_defects
        set severity = case when v_raise then 'UNSAFE' else severity end,
            description = case
              when v_add is null then description
              else left(description, 1000 - char_length(v_add)) || v_add
            end
        where id = v_existing.id;
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

-- ── 6. «Сделано» задним числом не отматывает срок ─────────────────

/*
 * Последнее определение — 20261115130000_maintenance_fixes. Изменён
 * только пересчёт срока пункта.
 *
 * Проверка «дата работ не раньше прошлой отметки» у пункта без прошлой
 * отметки проходила всегда: katsastus со сроком в декабре, в книжку
 * вносят прошлогодний — срок уезжал в прошлое, и ночная проверка снимала
 * машину с рейсов. Срок, посчитанный от даты работ, теперь не может
 * оказаться раньше уже стоящего; то же с пробегом. Срок, указанный в
 * форме явно, пишется как есть — это решение человека.
 */
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
   * Работы раньше прошлой отметки пункт не трогают вовсе; у остальных
   * срок от даты работ не может стать раньше уже стоящего (greatest
   * пропускает пустой срок).
   */
  if v_item.id is not null and v_done >= coalesce(v_item.last_done_on, v_done) then
    update public.maintenance_items
    set last_done_on = v_done,
        last_done_km = coalesce(v_km, last_done_km),
        next_due_on = coalesce(
          v_next_on,
          case when interval_months is not null
            then greatest(next_due_on, (v_done + make_interval(months => interval_months))::date) end),
        next_due_km = coalesce(
          v_next_km,
          case when interval_km is not null and v_km is not null
            then greatest(next_due_km, v_km + interval_km) end)
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

-- ── 7. Валюту и недельные счета меняет владелец ───────────────────

/*
 * Колонки currency (20261105100000) и weekly_invoicing (20261117140000)
 * открыты authenticated колоночным грантом, а политика
 * companies_update_own пускает любого участника компании: действия
 * сервера проверяли владельца, но диспетчер мог отправить PATCH мимо
 * них. Проверка — здесь, как у shipper_role (20261106120000): владелец,
 * оператор и служебный ключ меняют, диспетчер — нет.
 */
create or replace function app.company_money_settings_owner_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.currency is distinct from old.currency or new.weekly_invoicing is distinct from old.weekly_invoicing)
     and (select auth.uid()) is not null
     and not app.is_admin()
     and exists (
       select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.member_kind = 'DISPATCHER'
     ) then
    raise exception 'Валюту и недельные счета меняет владелец компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.company_money_settings_owner_only() from public, anon, authenticated;

create trigger companies_money_settings_owner_only
  before update of currency, weekly_invoicing on public.companies
  for each row execute function app.company_money_settings_owner_only();
