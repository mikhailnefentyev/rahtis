-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · обслуживание парка: план ТО, сервисная книжка, дефекты
-- от водителя, напоминания (13.11.2026)
--
-- Как у лидеров рынка (Fleetio, Samsara, Motive, Webfleet):
--   · план — пункты на машину или прицеп: ТО, katsastus, тахограф,
--     шины, тормоза, кондиционер, холодильник, борт/кран, ADR,
--     огнетушители, своё; интервал в месяцах и/или километрах, срок —
--     что наступит раньше;
--   · отметка «сделано» пишет строку сервисной книжки, пересчитывает
--     следующий срок, сумму кладёт в расходы машины (доходность —
--     только при подписке, как журнал расходов) и закрывает дефекты,
--     исправленные тем же заездом;
--   · дефект сообщает водитель из приложения (с фото, без связи — через
--     очередь телефона) или перевозчик в кабинете. «Нельзя ехать» —
--     отдельная отметка, перевозчик получает уведомление сразу;
--   · пробег машины считается из того, что уже есть: заправки, смены,
--     сервисная книжка, дефекты — без GPS;
--   · напоминания — ежедневный маршрут /api/reminders/certificates:
--     за 30, 7 и 1 день, за 2000 и 500 км и при просрочке. Журнал
--     maintenance_reminders привязан к сроку пункта: сделали — пункт
--     получил новый срок, ступени начинаются заново.
--
-- Раздел не закрыт подпиской: напоминания о katsastus и тахографе —
-- вопрос безопасности, а не дополнительная услуга. Закрыта только
-- запись суммы в доходность — как и сама доходность.
-- ═══════════════════════════════════════════════════════════════════

alter type public.notification_kind add value if not exists 'FLEET';

-- ── Хранилище: фото дефектов ──────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fleet-docs', 'fleet-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

/* Кладёт и удаляет сервер служебным ключом; читать — своя компания (первый сегмент пути). */
create policy fleet_docs_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'fleet-docs'
    and (storage.foldername(name))[1] = (select app.current_company_id())::text
  );

create policy fleet_docs_read_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'fleet-docs' and (select app.is_admin()));

-- ── Машина или прицеп той же компании ─────────────────────────────

/* Общая проверка трёх таблиц: ловит все пути записи, а не только формы. */
create or replace function app.fleet_asset_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vehicle_id is not null
     and not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  if new.trailer_id is not null
     and not exists (select 1 from public.trailers where id = new.trailer_id and company_id = new.company_id) then
    raise exception 'Прицеп другой компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.fleet_asset_check() from public, anon, authenticated;

-- ── План обслуживания ─────────────────────────────────────────────

create table public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  trailer_id uuid references public.trailers (id) on delete cascade,
  /*
   * Тот же список — MAINTENANCE_KINDS в src/lib/maintenance/status.ts.
   * INSPECTION — katsastus (N2/N3, O3/O4 — ежегодно, 2014/45/EU),
   * TACHOGRAPH — проверка тахографа (не реже раза в 2 года, 165/2014 ст. 23).
   */
  kind text not null constraint maintenance_items_kind
    check (kind in ('SERVICE', 'INSPECTION', 'TACHOGRAPH', 'TYRES', 'BRAKES', 'AC', 'REEFER', 'LIFT', 'ADR', 'FIRE', 'OTHER')),
  title text constraint maintenance_items_title check (char_length(btrim(title)) between 2 and 80),
  interval_months smallint constraint maintenance_items_months check (interval_months between 1 and 120),
  interval_km integer constraint maintenance_items_km check (interval_km between 500 and 1000000),
  next_due_on date,
  next_due_km integer constraint maintenance_items_next_km check (next_due_km between 0 and 9999999),
  last_done_on date,
  last_done_km integer constraint maintenance_items_last_km check (last_done_km between 0 and 9999999),
  note text constraint maintenance_items_note check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_items_asset check (num_nonnulls(vehicle_id, trailer_id) = 1),
  constraint maintenance_items_other_title check (kind <> 'OTHER' or title is not null),
  /* У прицепа нет одометра: километры ему не к чему привязать. */
  constraint maintenance_items_trailer_km check (trailer_id is null or (interval_km is null and next_due_km is null and last_done_km is null))
);

comment on table public.maintenance_items is
  'План обслуживания машины или прицепа: пункт, интервал (мес./км, что раньше), следующий срок. Статус считает src/lib/maintenance/status.ts.';

create index maintenance_items_company_idx on public.maintenance_items (company_id);
create index maintenance_items_vehicle_idx on public.maintenance_items (vehicle_id) where vehicle_id is not null;
create index maintenance_items_trailer_idx on public.maintenance_items (trailer_id) where trailer_id is not null;

create trigger maintenance_items_touch_updated_at
  before update on public.maintenance_items
  for each row execute function app.touch_updated_at();

create trigger maintenance_items_check
  before insert or update of vehicle_id, trailer_id, company_id on public.maintenance_items
  for each row execute function app.fleet_asset_check();

alter table public.maintenance_items enable row level security;

create policy maintenance_items_own
  on public.maintenance_items for all to authenticated
  using (company_id = (select app.current_company_id()))
  with check (company_id = (select app.current_company_id()));

create policy maintenance_items_admin
  on public.maintenance_items for select to authenticated using ((select app.is_admin()));

grant select, delete on public.maintenance_items to authenticated;
grant insert (company_id, vehicle_id, trailer_id, kind, title, interval_months, interval_km, next_due_on, next_due_km, last_done_on, last_done_km, note)
  on public.maintenance_items to authenticated;
grant update (kind, title, interval_months, interval_km, next_due_on, next_due_km, last_done_on, last_done_km, note)
  on public.maintenance_items to authenticated;

-- ── Сервисная книжка ──────────────────────────────────────────────

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  trailer_id uuid references public.trailers (id) on delete cascade,
  item_id uuid references public.maintenance_items (id) on delete set null,
  kind text not null constraint maintenance_records_kind
    check (kind in ('SERVICE', 'INSPECTION', 'TACHOGRAPH', 'TYRES', 'BRAKES', 'AC', 'REEFER', 'LIFT', 'ADR', 'FIRE', 'REPAIR', 'OTHER')),
  title text constraint maintenance_records_title check (char_length(btrim(title)) between 2 and 80),
  done_on date not null,
  odometer_km integer constraint maintenance_records_km check (odometer_km between 0 and 9999999),
  workshop text constraint maintenance_records_workshop check (char_length(workshop) <= 120),
  amount_cents integer constraint maintenance_records_amount check (amount_cents between 0 and 10000000),
  currency public.currency_code,
  note text constraint maintenance_records_note check (char_length(note) <= 500),
  /* Строка расходов машины (доходность), если сумма туда записалась. */
  cost_id uuid references public.vehicle_costs (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint maintenance_records_asset check (num_nonnulls(vehicle_id, trailer_id) = 1)
);

comment on table public.maintenance_records is
  'Сервисная книжка: что сделано, когда, на каком пробеге, где и за сколько. Пишет public.carrier_maintenance_done.';

create index maintenance_records_vehicle_idx on public.maintenance_records (vehicle_id, done_on desc) where vehicle_id is not null;
create index maintenance_records_trailer_idx on public.maintenance_records (trailer_id, done_on desc) where trailer_id is not null;
create index maintenance_records_company_idx on public.maintenance_records (company_id, done_on desc);

create trigger maintenance_records_check
  before insert or update of vehicle_id, trailer_id, company_id on public.maintenance_records
  for each row execute function app.fleet_asset_check();

alter table public.maintenance_records enable row level security;

create policy maintenance_records_own
  on public.maintenance_records for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy maintenance_records_delete_own
  on public.maintenance_records for delete to authenticated
  using (company_id = (select app.current_company_id()));

create policy maintenance_records_admin
  on public.maintenance_records for select to authenticated using ((select app.is_admin()));

grant select, delete on public.maintenance_records to authenticated;

-- ── Дефекты ───────────────────────────────────────────────────────

create table public.vehicle_defects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  trailer_id uuid references public.trailers (id) on delete cascade,
  /* Кто сообщил: водитель из приложения или человек кабинета (driver_id пуст). */
  driver_id uuid references public.drivers (id) on delete set null,
  reported_by uuid references auth.users (id) on delete set null default auth.uid(),
  reported_at timestamptz not null default now(),
  area text not null constraint vehicle_defects_area
    check (area in ('ENGINE', 'BRAKES', 'TYRES', 'LIGHTS', 'ELECTRICAL', 'BODY', 'COUPLING', 'HYDRAULICS', 'LEAK', 'TACHOGRAPH', 'OTHER')),
  /* CAN_DRIVE — доехать можно, чинить при первой возможности; UNSAFE — ехать нельзя. */
  severity text not null default 'CAN_DRIVE' constraint vehicle_defects_severity check (severity in ('CAN_DRIVE', 'UNSAFE')),
  description text not null constraint vehicle_defects_description check (char_length(btrim(description)) between 3 and 1000),
  odometer_km integer constraint vehicle_defects_km check (odometer_km between 0 and 9999999),
  photo_path text,
  status text not null default 'OPEN' constraint vehicle_defects_status check (status in ('OPEN', 'FIXED', 'DISMISSED')),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text constraint vehicle_defects_resolution check (char_length(resolution_note) <= 300),
  record_id uuid references public.maintenance_records (id) on delete set null,
  event_id uuid,
  constraint vehicle_defects_asset check (num_nonnulls(vehicle_id, trailer_id) = 1),
  constraint vehicle_defects_resolved check ((status = 'OPEN') = (resolved_at is null)),
  /* Путь фото собирает сервер, но верить ему на слово незачем. */
  constraint vehicle_defects_photo check (
    photo_path is null
    or photo_path ~ ('^' || company_id::text || '/defects/[0-9a-f-]{36}\.(jpg|png|webp)$')
  )
);

comment on table public.vehicle_defects is
  'Дефекты машин и прицепов: от водителя из приложения или из кабинета. Закрываются отметкой в сервисной книжке или решением перевозчика.';

create index vehicle_defects_company_idx on public.vehicle_defects (company_id, reported_at desc);
create index vehicle_defects_open_idx on public.vehicle_defects (company_id) where status = 'OPEN';
create index vehicle_defects_vehicle_idx on public.vehicle_defects (vehicle_id, reported_at desc) where vehicle_id is not null;
create index vehicle_defects_trailer_idx on public.vehicle_defects (trailer_id, reported_at desc) where trailer_id is not null;
create index vehicle_defects_driver_idx on public.vehicle_defects (driver_id, reported_at desc) where driver_id is not null;

create or replace function app.vehicle_defect_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.driver_id is not null
     and not exists (select 1 from public.drivers where id = new.driver_id and company_id = new.company_id) then
    raise exception 'Водитель другой компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.vehicle_defect_check() from public, anon, authenticated;

create trigger vehicle_defects_check
  before insert or update of vehicle_id, trailer_id, company_id on public.vehicle_defects
  for each row execute function app.fleet_asset_check();

create trigger vehicle_defects_driver_check
  before insert or update of driver_id, company_id on public.vehicle_defects
  for each row execute function app.vehicle_defect_check();

alter table public.vehicle_defects enable row level security;

create policy vehicle_defects_own
  on public.vehicle_defects for select to authenticated
  using (company_id = (select app.current_company_id()));

/* Из кабинета — только открытый дефект без водителя и фото: строки водителя ставит driver_defect_add. */
create policy vehicle_defects_insert_own
  on public.vehicle_defects for insert to authenticated
  with check (
    company_id = (select app.current_company_id())
    and driver_id is null
    and photo_path is null
    and status = 'OPEN'
  );

create policy vehicle_defects_admin
  on public.vehicle_defects for select to authenticated using ((select app.is_admin()));

grant select on public.vehicle_defects to authenticated;
grant insert (company_id, vehicle_id, trailer_id, area, severity, description, odometer_km)
  on public.vehicle_defects to authenticated;

-- ── Пробег ────────────────────────────────────────────────────────

/*
 * Последний известный пробег машины: наибольшее показание из заправок,
 * смен, сервисной книжки и дефектов. Так же считает driver_fuel_state.
 */
create or replace function app.vehicle_odometer(p_vehicle uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(km) from (
    select max(odometer_km) as km from public.fuel_entries where vehicle_id = p_vehicle
    union all
    select max(greatest(odometer_start, odometer_end)) from public.driver_shifts where vehicle_id = p_vehicle
    union all
    select max(odometer_km) from public.maintenance_records where vehicle_id = p_vehicle
    union all
    select max(odometer_km) from public.vehicle_defects where vehicle_id = p_vehicle
  ) k;
$$;

revoke all on function app.vehicle_odometer(uuid) from public, anon, authenticated;

/* Пробег всех машин своей компании — для экрана обслуживания и карточек парка. */
create or replace function public.fleet_odometers()
returns table (vehicle_id uuid, km integer)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, app.vehicle_odometer(v.id)
  from public.vehicles v
  where v.company_id = (select app.current_company_id());
$$;

revoke all on function public.fleet_odometers() from public, anon;
grant execute on function public.fleet_odometers() to authenticated;

-- ── Отметка «сделано» ─────────────────────────────────────────────

/*
 * Строка сервисной книжки одним действием. p_data:
 *   item_id       — пункт плана (тогда машина, вид и название — его);
 *   vehicle_id / trailer_id, kind, title — без пункта (разовый ремонт);
 *   done_on, odometer_km, workshop, note;
 *   amount_cents, currency — сумма без ALV;
 *   cost_note     — подпись строки расходов на языке кабинета (её готовит сайт);
 *   next_due_on, next_due_km — свой следующий срок вместо расчётного;
 *   defect_ids    — дефекты, исправленные этим заездом.
 *
 * Следующий срок: дата + интервал месяцев, пробег + интервал км.
 * Сумма по машине ложится в vehicle_costs (TYRES — шины, иначе REPAIR),
 * только если компании открыта доходность (app.own_orders_allowed).
 */
create or replace function public.carrier_maintenance_done(p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
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
  if v_done is null or v_done > current_date + 1 then
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
  end if;

  /* Пробег прицепа не пишем: у прицепа его нет. */
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

  if v_item.id is not null then
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

  if jsonb_typeof(p_data -> 'defect_ids') = 'array' then
    update public.vehicle_defects
    set status = 'FIXED', resolved_at = now(), resolved_by = auth.uid(), record_id = v_record
    where company_id = v_company
      and status = 'OPEN'
      and id in (select value::uuid from jsonb_array_elements_text(p_data -> 'defect_ids'));
  end if;

  return v_record;
end;
$$;

revoke all on function public.carrier_maintenance_done(jsonb) from public, anon;
grant execute on function public.carrier_maintenance_done(jsonb) to authenticated;

/* Закрыть дефект без работ (исправлен в пути, ошибка) или открыть снова. */
create or replace function public.carrier_defect_resolve(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
begin
  if p_status not in ('OPEN', 'FIXED', 'DISMISSED') then
    raise exception 'Статус дефекта.' using errcode = '22023';
  end if;

  update public.vehicle_defects
  set status = p_status,
      resolved_at = case when p_status = 'OPEN' then null else now() end,
      resolved_by = case when p_status = 'OPEN' then null else auth.uid() end,
      resolution_note = case when p_status = 'OPEN' then null else nullif(left(btrim(coalesce(p_note, '')), 300), '') end,
      record_id = case when p_status = 'OPEN' then null else record_id end
  where id = p_id and company_id = v_company;

  if not found then
    raise exception 'Дефект не найден.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.carrier_defect_resolve(uuid, text, text) from public, anon;
grant execute on function public.carrier_defect_resolve(uuid, text, text) to authenticated;

-- ── Приложение водителя ───────────────────────────────────────────

/*
 * Экран «Vika / huolto»: машина водителя, прицепы компании (дефект
 * бывает и у прицепа), пробег, ближайшие сроки машины (30 дней или
 * 2000 км, и просроченные) и дефекты: открытые по машине и свои последние.
 */
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
          i.next_due_on <= current_date + 30
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

/*
 * Дефект от водителя. p_data:
 *   trailer_id  — прицеп компании; пусто — машина, за которой водитель закреплён;
 *   area, severity, description, odometer_km;
 *   photo_path  — фото, уже положенное сервером в fleet-docs.
 * Возвращает новый дефект или null, если это повтор из очереди телефона.
 */
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

  if nullif(p_data ->> 'trailer_id', '') is not null then
    select id into v_trailer from public.trailers
    where id = (p_data ->> 'trailer_id')::uuid and company_id = v_driver.company_id;
    if v_trailer is null then
      raise exception 'Прицеп не найден.' using errcode = 'P0002';
    end if;
  else
    select vehicle_id into v_vehicle from public.vehicle_drivers
    where driver_id = v_driver.id and upper_inf(during);
    if v_vehicle is null then
      raise exception 'Водитель не закреплён за машиной.' using errcode = '55000';
    end if;
  end if;

  if v_photo is not null
     and v_photo !~ ('^' || v_driver.company_id::text || '/defects/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    v_photo := null;
  end if;

  insert into public.vehicle_defects (
    company_id, vehicle_id, trailer_id, driver_id, reported_by, reported_at,
    area, severity, description, odometer_km, photo_path, event_id)
  values (
    v_driver.company_id, v_vehicle, v_trailer, v_driver.id, auth.uid(),
    coalesce(app.client_time(p_at), clock_timestamp()),
    coalesce(nullif(p_data ->> 'area', ''), 'OTHER'),
    coalesce(nullif(p_data ->> 'severity', ''), 'CAN_DRIVE'),
    btrim(coalesce(p_data ->> 'description', '')),
    case when v_vehicle is not null then nullif(p_data ->> 'odometer_km', '')::numeric::integer end,
    v_photo,
    p_event_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.driver_defect_add(jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.driver_defect_add(jsonb, timestamptz, uuid) to authenticated;

-- ── Напоминания ───────────────────────────────────────────────────

create table public.maintenance_reminders (
  item_id uuid not null references public.maintenance_items (id) on delete cascade,
  /* Срок, о котором напомнили: «дата|км». Новый срок — новые ступени. */
  due_key text not null,
  stage text not null constraint maintenance_reminders_stage
    check (stage in ('D30', 'D7', 'D1', 'K2000', 'K500', 'OVERDUE')),
  sent_at timestamptz not null default now(),
  primary key (item_id, due_key, stage)
);

comment on table public.maintenance_reminders is
  'Какие напоминания о сроках обслуживания ушли. Пишет и читает только сервер (src/lib/maintenance/reminders.ts).';

alter table public.maintenance_reminders enable row level security;
revoke all on public.maintenance_reminders from anon, authenticated;

/*
 * Пункты, у которых срок близко (p_days дней или p_km километров) или
 * прошёл, — с пробегом машины, номером и текущим водителем. Зовёт
 * ежедневный маршрут служебным ключом.
 */
create or replace function public.maintenance_due_candidates(p_days integer default 30, p_km integer default 2000)
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
      i.next_due_on <= current_date + p_days
      or (i.next_due_km is not null and o.km is not null and i.next_due_km - o.km <= p_km)
    );
$$;

revoke all on function public.maintenance_due_candidates(integer, integer) from public, anon, authenticated;
grant execute on function public.maintenance_due_candidates(integer, integer) to service_role;

-- ── Хранение ──────────────────────────────────────────────────────

/*
 * Закрытые дефекты старше 24 месяцев с закрытия — вместе с фото
 * (политика 8.4). Открытые не удаляются: они ещё не исправлены.
 * Сервисная книжка остаётся, пока машина в парке: это история машины.
 */
create or replace function public.retention_defect_candidates(p_limit integer default 500)
returns table (id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.photo_path
  from public.vehicle_defects d
  where d.status <> 'OPEN' and d.resolved_at < now() - interval '24 months'
  order by d.resolved_at
  limit p_limit;
$$;

revoke all on function public.retention_defect_candidates(integer) from public, anon, authenticated;
grant execute on function public.retention_defect_candidates(integer) to service_role;
