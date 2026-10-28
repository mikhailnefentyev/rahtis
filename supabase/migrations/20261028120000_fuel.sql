-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · топливо: заправки, месячный отчёт, расход (28.10.2026)
--
-- Три источника, одна таблица:
--   DRIVER — водитель вносит заправку в приложении (одометр, литры или
--            кг, AdBlue, сумма, фото чека); очередь без связи;
--   IMPORT — перевозчик загружает месячный отчёт заправщика (PDF или
--            CSV), строки распознаёт n8n + OpenAI, перевозчик проверяет
--            и подтверждает;
--   MANUAL — перевозчик вносит заправку в кабинете.
--
-- Одна заправка из двух источников (водитель внёс, потом пришла в
-- отчёте) сливается в одну строку: та же машина и продукт, тот же день
-- или ±3 часа, объём ±2 % — у строки водителя появляются сумма и
-- станция из отчёта. Повторная загрузка того же отчёта ничего не задваивает.
--
-- Карта → машина запоминается (fuel_cards): в отчётах Neste и St1 часто
-- стоит номер карты, а не номер машины.
--
-- Расход считает сайт (src/lib/fuel/stats.ts) из строк этой таблицы.
-- Хранение — 24 месяца (политика 8.4), удаляет /api/retention/photos
-- вместе с фото чеков и файлами отчётов.
-- ═══════════════════════════════════════════════════════════════════

-- ── Хранилище: фото чеков и файлы отчётов ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fuel-docs', 'fuel-docs', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/csv', 'text/plain'])
on conflict (id) do nothing;

/* Кладёт и удаляет сервер служебным ключом; читать — своя компания (первый сегмент пути). */
create policy fuel_docs_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fuel-docs'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy fuel_docs_read_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'fuel-docs' and (select app.is_admin()));

-- ── Загруженные отчёты ────────────────────────────────────────────

create table public.fuel_imports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  file_path text not null,
  file_name text not null,
  /* REVIEW — распознано, ждёт проверки; DONE — подтверждено; FAILED — не распознано. */
  status text not null default 'REVIEW' constraint fuel_imports_status check (status in ('REVIEW', 'DONE', 'FAILED')),
  supplier text,
  /* Распознанные строки до подтверждения — как их вернул разбор. */
  rows jsonb not null default '[]'::jsonb,
  error text,
  inserted integer,
  merged integer,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

/*
 * Путь файла привязан к компании строки: иначе перевозчик, вставив строку
 * напрямую через API с чужим путём, заставил бы сервер (служебным ключом)
 * удалить чужой файл при удалении отчёта или по сроку хранения.
 */
alter table public.fuel_imports
  add constraint fuel_imports_path
  check (file_path like company_id::text || '/reports/%' and file_path !~ '\.\.' and file_path ~ '^[0-9a-f-]+/reports/[0-9a-f-]+\.(pdf|csv)$');

create index fuel_imports_company_idx on public.fuel_imports (company_id, created_at desc);

alter table public.fuel_imports enable row level security;

create policy fuel_imports_own
  on public.fuel_imports for all to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy fuel_imports_admin
  on public.fuel_imports for select to authenticated using ((select app.is_admin()));

grant select, insert, delete on public.fuel_imports to authenticated;
grant update (rows, status, supplier, error) on public.fuel_imports to authenticated;

-- ── Топливные карты ───────────────────────────────────────────────

create table public.fuel_cards (
  company_id uuid not null references public.companies (id) on delete cascade,
  /* Номер карты как в отчёте, без пробелов. */
  card_ref text not null constraint fuel_cards_ref check (card_ref ~ '^[A-Za-z0-9*-]{3,40}$'),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (company_id, card_ref)
);

alter table public.fuel_cards enable row level security;

create policy fuel_cards_own
  on public.fuel_cards for select to authenticated
  using (company_id = (select app.current_company_id()));

grant select on public.fuel_cards to authenticated;

-- ── Заправки ──────────────────────────────────────────────────────

create table public.fuel_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete set null,
  filled_at timestamptz not null,
  product text not null
    constraint fuel_entries_product check (product in ('DIESEL', 'HVO', 'ADBLUE', 'PETROL', 'LNG', 'LBG', 'CNG', 'CBG', 'OTHER')),
  quantity numeric(8, 2) not null constraint fuel_entries_quantity check (quantity > 0 and quantity <= 2000),
  /* Газ — в килограммах, всё остальное — в литрах. */
  unit text generated always as (case when product in ('LNG', 'LBG', 'CNG', 'CBG') then 'kg' else 'l' end) stored,
  /* Сумма с ALV, в центах; у строки водителя — по чеку, если внёс. */
  amount_cents integer constraint fuel_entries_amount check (amount_cents between 0 and 10000000),
  odometer_km integer constraint fuel_entries_odometer check (odometer_km between 0 and 5000000),
  /* Полный бак: от такой заправки до следующей полной считается расход. */
  full_tank boolean not null default true,
  station text constraint fuel_entries_station check (char_length(station) <= 120),
  card_ref text,
  source text not null constraint fuel_entries_source check (source in ('DRIVER', 'IMPORT', 'MANUAL')),
  import_id uuid references public.fuel_imports (id) on delete set null,
  receipt_path text,
  event_id uuid,
  created_at timestamptz not null default now()
);

create index fuel_entries_company_idx on public.fuel_entries (company_id, filled_at desc);
create index fuel_entries_vehicle_idx on public.fuel_entries (vehicle_id, filled_at);
create index fuel_entries_driver_idx on public.fuel_entries (driver_id, filled_at desc) where driver_id is not null;

/* Машина и водитель — той же компании, что и строка. Ловит все пути записи, а не только формы. */
create or replace function app.fuel_entry_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  if new.driver_id is not null
     and not exists (select 1 from public.drivers where id = new.driver_id and company_id = new.company_id) then
    raise exception 'Водитель другой компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.fuel_entry_check() from public, anon, authenticated;

create trigger fuel_entries_check
  before insert or update of vehicle_id, driver_id, company_id on public.fuel_entries
  for each row execute function app.fuel_entry_check();

alter table public.fuel_entries enable row level security;

create policy fuel_entries_own
  on public.fuel_entries for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy fuel_entries_delete_own
  on public.fuel_entries for delete to authenticated
  using (company_id = (select app.current_company_id()));

/* Вручную в кабинете — только MANUAL: строки водителя и отчёта ставят функции ниже. */
create policy fuel_entries_insert_own
  on public.fuel_entries for insert to authenticated
  with check (company_id = (select app.current_company_id()) and source = 'MANUAL');

create policy fuel_entries_update_own
  on public.fuel_entries for update to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy fuel_entries_admin
  on public.fuel_entries for select to authenticated using ((select app.is_admin()));

grant select, delete on public.fuel_entries to authenticated;
grant insert (company_id, vehicle_id, driver_id, filled_at, product, quantity, amount_cents, odometer_km, full_tank, station, source)
  on public.fuel_entries to authenticated;
grant update (vehicle_id, filled_at, product, quantity, amount_cents, odometer_km, full_tank, station)
  on public.fuel_entries to authenticated;

-- ── Приложение водителя ───────────────────────────────────────────

/*
 * Экран «Заправка»: машина водителя, последний известный одометр по ней
 * (для подсказки «меньше прошлого») и десять последних заправок водителя.
 */
create or replace function public.driver_fuel_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver public.drivers;
  v_vehicle uuid;
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  select vehicle_id into v_vehicle from public.vehicle_drivers
  where driver_id = v_driver.id and upper_inf(during);

  return jsonb_build_object(
    'company_id', v_driver.company_id,
    'vehicle', (select jsonb_build_object('id', v.id, 'plate', v.plate) from public.vehicles v where v.id = v_vehicle),
    'last_odometer', (
      select max(km) from (
        select e.odometer_km as km from public.fuel_entries e where e.vehicle_id = v_vehicle and e.odometer_km is not null
        union all
        select greatest(s.odometer_start, s.odometer_end) from public.driver_shifts s where s.vehicle_id = v_vehicle
      ) k
    ),
    'entries', coalesce((
      select jsonb_agg(x order by x ->> 'filled_at' desc)
      from (
        select jsonb_build_object(
          'id', e.id, 'filled_at', e.filled_at, 'product', e.product, 'quantity', e.quantity, 'unit', e.unit,
          'amount_cents', e.amount_cents, 'odometer_km', e.odometer_km, 'station', e.station,
          'plate', (select plate from public.vehicles where id = e.vehicle_id),
          'has_receipt', e.receipt_path is not null) as x
        from public.fuel_entries e
        where e.driver_id = v_driver.id
        order by e.filled_at desc
        limit 10
      ) recent
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.driver_fuel_state() from public, anon;
grant execute on function public.driver_fuel_state() to authenticated;

/*
 * Заправка водителя. p_data:
 *   lines        — [{product, quantity}], до четырёх (дизель + AdBlue);
 *   odometer_km  — показания одометра;
 *   amount       — сумма по чеку с ALV, евро (ложится на первую строку);
 *   station      — станция, необязательно;
 *   full_tank    — полный бак (по умолчанию да);
 *   receipt_path — фото чека, уже положенное сервером в fuel-docs.
 * Машина — та, за которой водитель сейчас закреплён.
 */
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
  v_odometer integer := nullif(p_data ->> 'odometer_km', '')::numeric::integer;
  v_amount integer := round(nullif(p_data ->> 'amount', '')::numeric * 100)::integer;
  v_receipt text := nullif(p_data ->> 'receipt_path', '');
begin
  select * into v_driver from public.drivers where id = (select app.current_driver_id());
  if v_driver.id is null then
    raise exception 'Вход водителя не найден.' using errcode = '42501';
  end if;

  if app.driver_event_seen(p_event_id, 'FUEL', p_at) then
    return;
  end if;

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

revoke all on function public.driver_fuel_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_fuel_add(jsonb, timestamptz, uuid) to authenticated;

-- ── Подтверждение отчёта перевозчиком ─────────────────────────────

/*
 * Строки отчёта после проверки → заправки. p_rows:
 *   [{vehicle_id, filled_at, product, quantity, amount_cents, odometer_km, station, card_ref}]
 *
 * Совпавшая заправка (та же машина и продукт, тот же день по Хельсинки
 * или ±3 часа, объём ±2 % или ±0,5) не вставляется второй раз: у неё
 * заполняются пустые сумма, станция, одометр и карта. Так водитель и
 * отчёт дают одну строку, а повторная загрузка отчёта — ни одной новой.
 *
 * Номер карты, у которой выбрана машина, запоминается для следующих отчётов.
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
begin
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

revoke all on function public.carrier_fuel_import_confirm(uuid, jsonb) from public, anon;
grant execute on function public.carrier_fuel_import_confirm(uuid, jsonb) to authenticated;

-- ── Хранение: 24 месяца ───────────────────────────────────────────

/*
 * Что пора удалить: заправки и отчёты старше 24 месяцев. Удаляет маршрут
 * /api/retention/photos — сначала файлы (фото чеков, отчёты), потом строки.
 */
create or replace function public.retention_fuel_candidates(p_limit integer default 500)
returns table (kind text, id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  (select 'ENTRY'::text, e.id, e.receipt_path
   from public.fuel_entries e
   where e.filled_at < now() - interval '24 months'
   order by e.filled_at
   limit p_limit)
  union all
  (select 'IMPORT'::text, i.id, i.file_path
   from public.fuel_imports i
   where i.created_at < now() - interval '24 months'
   order by i.created_at
   limit p_limit);
$$;

revoke all on function public.retention_fuel_candidates(integer) from public, anon, authenticated;
grant execute on function public.retention_fuel_candidates(integer) to service_role;
