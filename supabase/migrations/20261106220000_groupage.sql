-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · догрузы: свободное место в машине по ходу рейса (6.11.2026)
--
-- Идея экспедитора, решение пользователя 6.11.2026: машина в рейсе с
-- местом может взять ещё груз, и другие участники это видят.
--
--   · место считает сервер (src/lib/capacity/compute.ts, тесты): вместимость
--     сцепки рейса минус грузы закреплённых заказов по участкам;
--   · показывается только с согласия перевозчика: по умолчанию RAHTIS
--     спрашивает («Требует действия»), перевозчик публикует одним нажатием
--     и может поправить цифры. Режим на компанию и на машину: ASK (по
--     умолчанию) / AUTO (публикуется сам, перевозчику уведомление) / NEVER.
--     Уход из AUTO снимает автоматически опубликованное, NEVER — всё.
--     История смен режима — capacity_publish_history;
--   · заказчик и экспедитор видят город, страну, даты, место, кузов, имя
--     перевозчика и значок проверки. Адресов и номера машины нет — номер
--     после принятия (уведомление direct.accepted). Координаты — сетка
--     0,1°, и расстояния для другой стороны считаются только по ней;
--   · запрос — по своему заказу (черновик или на столе без откликов) с
--     ценой. Принятие делает его обычным прямым заказом этой машине
--     (договор заказчик — перевозчик, 0 %, Aivomaa не сторона), сразу
--     подтверждённым: перевозчик согласился, нажав «Принять»;
--   · каботаж (рег. 1072/2009, ст. 8 в ред. 2020/1055): если перевозчик
--     из другой страны, чем погрузка и выгрузка, обе стороны видят
--     предупреждение и число таких рейсов перевозчика в стране за 7 дней.
--     Справка, не запрет: ответственность перевозчика.
--   · место снимается само, когда машина прошла начало отрезка или дата
--     прошла (capacity_expire, проверка при каждом чтении).
-- ═══════════════════════════════════════════════════════════════════


-- ── Режим публикации ───────────────────────────────────────────────

create table public.capacity_publish_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  /* NULL — режим компании по умолчанию. */
  vehicle_id uuid references public.vehicles (id) on delete cascade,
  mode text not null default 'ASK'
    constraint capacity_publish_settings_mode check (mode in ('ASK', 'AUTO', 'NEVER')),
  changed_by uuid default auth.uid() references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create unique index capacity_publish_settings_scope
  on public.capacity_publish_settings (company_id, vehicle_id) nulls not distinct;

comment on table public.capacity_publish_settings is
  'Догрузы: показывать ли свободное место. ASK — спрашивать (по умолчанию), AUTO — публиковать с уведомлением, NEVER — не предлагать. vehicle_id NULL — режим компании.';

/* Кто включил автопубликацию и когда — без внешних ключей: строка переживает машину. */
create table public.capacity_publish_history (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid,
  plate text,
  old_mode text,
  new_mode text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index capacity_publish_history_company on public.capacity_publish_history (company_id, changed_at desc);

comment on table public.capacity_publish_history is
  'Догрузы: журнал смен режима публикации (кто и когда включил или отозвал автопубликацию).';

/* Режим машины: своя строка, иначе компании, иначе «спрашивать». */
create or replace function app.capacity_mode(p_vehicle_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.mode from public.capacity_publish_settings s where s.vehicle_id = p_vehicle_id),
    (select s.mode
     from public.capacity_publish_settings s
     join public.vehicles v on v.company_id = s.company_id
     where v.id = p_vehicle_id and s.vehicle_id is null),
    'ASK'
  );
$$;

revoke all on function app.capacity_mode(uuid) from public, anon, authenticated;

create or replace function app.capacity_settings_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.company_id := old.company_id;
    new.vehicle_id := old.vehicle_id;
  end if;
  if new.vehicle_id is not null
     and not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  new.changed_by := auth.uid();
  new.changed_at := now();
  return new;
end;
$$;

revoke all on function app.capacity_settings_stamp() from public, anon, authenticated;

create trigger capacity_publish_settings_stamp
  before insert or update on public.capacity_publish_settings
  for each row execute function app.capacity_settings_stamp();

/*
 * Журнал и отзыв. Уход из AUTO снимает автоматически опубликованное,
 * NEVER — всё опубликованное: согласие отозвано.
 */
create or replace function app.capacity_settings_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_new text;
  v_company uuid;
  v_vehicle uuid;
begin
  if tg_op = 'DELETE' then
    v_old := old.mode;
    v_company := old.company_id;
    v_vehicle := old.vehicle_id;
  elsif tg_op = 'UPDATE' then
    v_old := old.mode;
    v_new := new.mode;
    v_company := new.company_id;
    v_vehicle := new.vehicle_id;
  else
    v_new := new.mode;
    v_company := new.company_id;
    v_vehicle := new.vehicle_id;
  end if;

  if v_old is not distinct from v_new then
    return null;
  end if;

  /* Компания удаляется каскадом — журнал ей уже не нужен. */
  if not exists (select 1 from public.companies where id = v_company) then
    return null;
  end if;

  insert into public.capacity_publish_history (company_id, vehicle_id, plate, old_mode, new_mode, changed_by)
  values (v_company, v_vehicle, (select plate from public.vehicles where id = v_vehicle), v_old, v_new, auth.uid());

  update public.capacity_offers o
  set status = 'WITHDRAWN'
  where o.company_id = v_company
    and o.status in ('DRAFT', 'PUBLISHED')
    and (v_vehicle is null or o.vehicle_id = v_vehicle)
    and ((o.auto and app.capacity_mode(o.vehicle_id) <> 'AUTO') or app.capacity_mode(o.vehicle_id) = 'NEVER');

  return null;
end;
$$;

revoke all on function app.capacity_settings_audit() from public, anon, authenticated;


-- ── Свободное место ────────────────────────────────────────────────

create table public.capacity_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  /* Первый заказ отрезка: вместе с машиной — ключ предложения. */
  order_id uuid references public.orders (id) on delete set null,
  trip_order_ids uuid[] not null default '{}',
  from_city text not null constraint capacity_offers_from_city check (char_length(btrim(from_city)) between 1 and 80),
  from_country text constraint capacity_offers_from_country check (from_country ~ '^[A-Z]{2}$'),
  from_lat double precision,
  from_lon double precision,
  to_city text not null constraint capacity_offers_to_city check (char_length(btrim(to_city)) between 1 and 80),
  to_country text constraint capacity_offers_to_country check (to_country ~ '^[A-Z]{2}$'),
  to_lat double precision,
  to_lon double precision,
  available_from date not null,
  available_to date not null,
  free_ldm numeric(4, 1) constraint capacity_offers_free_ldm check (free_ldm between 0 and 20),
  free_kg integer constraint capacity_offers_free_kg check (free_kg between 0 and 60000),
  free_pallets smallint constraint capacity_offers_free_pallets check (free_pallets between 0 and 66),
  /* Что насчитал RAHTIS — чтобы видеть поправку перевозчика. */
  computed_ldm numeric(4, 1),
  computed_kg integer,
  body text constraint capacity_offers_body check (char_length(body) <= 20),
  vehicle_class public.vehicle_class,
  status text not null default 'PUBLISHED'
    constraint capacity_offers_status check (status in ('DRAFT', 'PUBLISHED', 'WITHDRAWN', 'EXPIRED', 'FILLED')),
  auto boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  closed_at timestamptz,
  constraint capacity_offers_dates check (available_to >= available_from),
  constraint capacity_offers_some_space check (free_ldm is not null or free_kg is not null)
);

comment on table public.capacity_offers is
  'Догрузы: свободное место машины на отрезке рейса. Показывается другим только PUBLISHED (с согласия перевозчика), городами и сеткой 0,1°, без номера машины.';

create unique index capacity_offers_live on public.capacity_offers (vehicle_id, order_id)
  where status in ('DRAFT', 'PUBLISHED');
create index capacity_offers_published on public.capacity_offers (available_from) where status = 'PUBLISHED';
create index capacity_offers_company on public.capacity_offers (company_id, created_at desc);
create index capacity_offers_order on public.capacity_offers (order_id);

/*
 * Сетка 0,1° — в базе, а не только в форме: точная точка сюда не
 * попадает ни из какого клиента. Машина и заказ — свои; закрытое
 * предложение не открывается снова (новое — новой строкой).
 */
create or replace function app.capacity_offer_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.from_lat := round(new.from_lat::numeric, 1)::double precision;
  new.from_lon := round(new.from_lon::numeric, 1)::double precision;
  new.to_lat := round(new.to_lat::numeric, 1)::double precision;
  new.to_lon := round(new.to_lon::numeric, 1)::double precision;
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    new.company_id := old.company_id;
    new.vehicle_id := old.vehicle_id;
    new.order_id := old.order_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if old.status in ('WITHDRAWN', 'EXPIRED', 'FILLED') and new.status is distinct from old.status then
      raise exception 'Предложение уже закрыто.' using errcode = '55000';
    end if;
  else
    if not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
      raise exception 'Машина другой компании.' using errcode = '42501';
    end if;
    if new.order_id is not null and not exists (
      select 1 from public.orders o
      where o.id = new.order_id
        and o.assigned_company_id = new.company_id
        and o.assigned_vehicle_id = new.vehicle_id
        and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    ) then
      raise exception 'Рейс не этой машины.' using errcode = '42501';
    end if;
    if new.status = 'PUBLISHED' and app.capacity_mode(new.vehicle_id) = 'NEVER' then
      raise exception 'Для этой машины выбрано «никогда не показывать».' using errcode = '55000';
    end if;
  end if;

  if new.status = 'PUBLISHED' and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED') then
    new.published_at := now();
  end if;
  if new.status in ('WITHDRAWN', 'EXPIRED', 'FILLED') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    new.closed_at := now();
  end if;
  return new;
end;
$$;

revoke all on function app.capacity_offer_stamp() from public, anon, authenticated;

create trigger capacity_offers_stamp
  before insert or update on public.capacity_offers
  for each row execute function app.capacity_offer_stamp();


-- ── Запросы на место ───────────────────────────────────────────────

create table public.capacity_requests (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.capacity_offers (id) on delete cascade,
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  shipper_company_id uuid not null references public.companies (id) on delete cascade,
  /* Заказ заказчика: при принятии он и становится прямым заказом. */
  order_id uuid references public.orders (id) on delete set null,
  from_city text not null,
  from_country text,
  from_lat double precision,
  from_lon double precision,
  to_city text not null,
  to_country text,
  to_lat double precision,
  to_lon double precision,
  date_from date not null,
  date_to date not null,
  ldm numeric(4, 1),
  weight_kg integer,
  pallets smallint constraint capacity_requests_pallets check (pallets between 1 and 66),
  description text constraint capacity_requests_description check (char_length(description) <= 500),
  price_cents integer not null constraint capacity_requests_price check (price_cents between 100 and 100000000),
  currency text not null constraint capacity_requests_currency check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'PENDING'
    constraint capacity_requests_status check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
  decline_reason text constraint capacity_requests_reason check (char_length(decline_reason) <= 300),
  created_order_id uuid references public.orders (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null,
  constraint capacity_requests_dates check (date_to >= date_from),
  constraint capacity_requests_decided check ((status = 'PENDING') = (decided_at is null))
);

comment on table public.capacity_requests is
  'Догрузы: запрос заказчика на свободное место со своим грузом и ценой. Городами и сеткой 0,1°; адреса перевозчик видит после принятия.';

create unique index capacity_requests_one_pending on public.capacity_requests (offer_id, order_id) where status = 'PENDING';
create index capacity_requests_carrier on public.capacity_requests (carrier_company_id, created_at desc);
create index capacity_requests_shipper on public.capacity_requests (shipper_company_id, created_at desc);
create index capacity_requests_order on public.capacity_requests (order_id);

/*
 * Место закрылось (снято, истекло, заполнено) — ждущие запросы
 * истекают, заказчик узнаёт. Автопубликация — уведомление перевозчику:
 * «Опубликовано: …, снять?».
 */
create or replace function app.capacity_offer_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plate text;
begin
  if new.status = 'PUBLISHED' and new.auto and (tg_op = 'INSERT' or old.status is distinct from 'PUBLISHED') then
    select plate into v_plate from public.vehicles where id = new.vehicle_id;
    perform app.notify_event(
      new.company_id,
      'ORDER',
      'capacity.published',
      jsonb_build_object(
        'plate', coalesce(v_plate, ''),
        'from', new.from_city,
        'to', new.to_city,
        'date', to_char(new.available_from, 'DD.MM.'),
        'ldm', coalesce(new.free_ldm::text, '–'),
        'tonnes', coalesce(round(new.free_kg / 1000.0, 1)::text, '–')
      ),
      '/carrier/capacity'
    );
  end if;

  if tg_op = 'UPDATE' and old.status = 'PUBLISHED' and new.status <> 'PUBLISHED' then
    with gone as (
      update public.capacity_requests r
      set status = 'EXPIRED', decided_at = now()
      where r.offer_id = new.id and r.status = 'PENDING'
      returning r.shipper_company_id
    )
    insert into public.notifications (company_id, kind, code, params, link)
    select distinct g.shipper_company_id, 'ORDER'::public.notification_kind, 'capacity.expired',
      jsonb_build_object('from', new.from_city, 'to', new.to_city),
      '/shipper/capacity'
    from gone g;
  end if;
  return null;
end;
$$;

revoke all on function app.capacity_offer_after() from public, anon, authenticated;

create trigger capacity_offers_after
  after insert or update of status on public.capacity_offers
  for each row execute function app.capacity_offer_after();

create trigger capacity_publish_settings_audit
  after insert or update or delete on public.capacity_publish_settings
  for each row execute function app.capacity_settings_audit();


-- ── Права ──────────────────────────────────────────────────────────

alter table public.capacity_publish_settings enable row level security;
alter table public.capacity_publish_history enable row level security;
alter table public.capacity_offers enable row level security;
alter table public.capacity_requests enable row level security;

revoke all on public.capacity_publish_settings from anon, authenticated;
revoke all on public.capacity_publish_history from anon, authenticated;
revoke all on public.capacity_offers from anon, authenticated;
revoke all on public.capacity_requests from anon, authenticated;

grant select, insert, update, delete on public.capacity_publish_settings to authenticated;
grant select on public.capacity_publish_history to authenticated;
/* Удаления нет: место снимают (WITHDRAWN), история остаётся. */
grant select, insert, update on public.capacity_offers to authenticated;
/* Запросы пишут только функции ниже. */
grant select on public.capacity_requests to authenticated;

create policy capacity_publish_settings_own
  on public.capacity_publish_settings for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
  with check (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER');

create policy capacity_publish_settings_admin
  on public.capacity_publish_settings for select to authenticated using ((select app.is_admin()));

create policy capacity_publish_history_own
  on public.capacity_publish_history for select to authenticated
  using (company_id = (select app.current_company_id()) or (select app.is_admin()));

/* Перевозчик — своё. Заказчики читают опубликованное только функциями (без машины и рейса). */
create policy capacity_offers_own
  on public.capacity_offers for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
  with check (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER');

create policy capacity_offers_admin
  on public.capacity_offers for select to authenticated using ((select app.is_admin()));

create policy capacity_requests_party
  on public.capacity_requests for select to authenticated
  using (
    shipper_company_id = (select app.current_company_id())
    or carrier_company_id = (select app.current_company_id())
    or (select app.is_admin())
  );

/* Новые таблицы mfa_required сами не получают (20261106190000_two_step). */
create policy mfa_required on public.capacity_publish_settings
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

create policy mfa_required on public.capacity_publish_history
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

create policy mfa_required on public.capacity_offers
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));

create policy mfa_required on public.capacity_requests
  as restrictive for all to authenticated
  using ((select app.mfa_satisfied()))
  with check ((select app.mfa_satisfied()));


-- ── Рейсы для расчёта ──────────────────────────────────────────────

/*
 * Закреплённые рейсы машин компании с тем, что нужно расчёту: метры и
 * вес заказа, точки, вместимость машины, прицепа рейса и сцепки из
 * конструктора. Считает src/lib/capacity/compute.ts.
 */
create or replace function app.capacity_trips(p_company_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'company_id', o.assigned_company_id,
    'company_country', c.country,
    'order_id', o.id,
    'ref', o.ref,
    'status', o.status,
    'haul_kind', o.haul_kind,
    'ldm', o.ldm,
    'vehicle_id', v.id,
    'plate', v.plate,
    'vehicle_class', v.vehicle_class,
    'vehicle_body', v.body_type,
    'vehicle_ldm', v.ldm,
    'vehicle_kg', v.payload_kg,
    'trailer_id', t.id,
    'trailer_body', t.body_type,
    'trailer_ldm', t.ldm,
    'trailer_kg', t.payload_kg,
    'combo_ldm', k.ldm,
    'combo_kg', k.payload_kg,
    'stops', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'sequence', s.sequence,
        'role', s.role,
        'city', s.city,
        'country', s.country,
        'lat', s.lat,
        'lon', s.lon,
        'date', s.scheduled_date,
        'time', s.scheduled_time,
        'kg', s.cargo_weight_kg,
        'done', s.completed_at is not null
      ) order by s.sequence), '[]'::jsonb)
      from public.order_stops s
      where s.order_id = o.id
    )
  ) order by v.plate, o.id), '[]'::jsonb)
  from public.orders o
  join public.companies c on c.id = o.assigned_company_id
  join public.vehicles v on v.id = o.assigned_vehicle_id
  left join public.trailers t on t.id = o.assigned_trailer_id
  left join public.vehicle_combos k
    on k.vehicle_id = v.id and k.trailer_id is not distinct from o.assigned_trailer_id
  where o.assigned_company_id = any (p_company_ids)
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS');
$$;

revoke all on function app.capacity_trips(uuid[]) from public, anon, authenticated;

create or replace function public.capacity_fleet_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Только перевозчику.' using errcode = '42501';
  end if;
  return app.capacity_trips(array[(select app.current_company_id())]);
end;
$$;

comment on function public.capacity_fleet_trips() is
  'Догрузы: закреплённые рейсы своих машин для расчёта свободного места (src/lib/capacity).';

revoke all on function public.capacity_fleet_trips() from public, anon;
grant execute on function public.capacity_fleet_trips() to authenticated;

/* Ночной расчёт и автопубликация — служебным ключом. */
create or replace function public.capacity_fleet_trips_for(p_company_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select app.capacity_trips(p_company_ids);
$$;

revoke all on function public.capacity_fleet_trips_for(uuid[]) from public, anon, authenticated;
grant execute on function public.capacity_fleet_trips_for(uuid[]) to service_role;


-- ── Живо ли место ──────────────────────────────────────────────────

/*
 * Опубликовано, дата отрезка не прошла, рейс по-прежнему у этой машины
 * и ни одна его точка не пройдена (машина не выехала с начала отрезка).
 */
create or replace function app.capacity_offer_live(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.capacity_offers p
    join public.companies c on c.id = p.company_id
    where p.id = p_offer_id
      and p.status = 'PUBLISHED'
      and p.available_from >= (now() at time zone 'Europe/Helsinki')::date
      and c.status = 'ACTIVE'
      and c.frozen_at is null
      and (
        p.order_id is null
        or exists (
          select 1 from public.orders o
          where o.id = p.order_id
            and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
            and o.assigned_vehicle_id = p.vehicle_id
            and not exists (
              select 1 from public.order_stops s where s.order_id = o.id and s.completed_at is not null
            )
        )
      )
  );
$$;

revoke all on function app.capacity_offer_live(uuid) from public, anon, authenticated;

/* Истёкшее — EXPIRED. Перевозчик — своё, служебный ключ — всё. */
create or replace function public.capacity_expire()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_count integer;
begin
  if (select auth.role()) is distinct from 'service_role' then
    if (select app.current_party_role()) is distinct from 'CARRIER' then
      raise exception 'Только перевозчику.' using errcode = '42501';
    end if;
    v_company := (select app.current_company_id());
  end if;

  update public.capacity_offers p
  set status = 'EXPIRED'
  where p.status in ('DRAFT', 'PUBLISHED')
    and (v_company is null or p.company_id = v_company)
    and (
      p.available_from < (now() at time zone 'Europe/Helsinki')::date
      or (p.status = 'PUBLISHED' and not app.capacity_offer_live(p.id))
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.capacity_expire() from public, anon;
grant execute on function public.capacity_expire() to authenticated, service_role;


-- ── Каботаж ────────────────────────────────────────────────────────

/*
 * Погрузка и выгрузка в одной стране, перевозчик из другой — каботаж.
 * Число его рейсов целиком внутри этой страны с датой за последние
 * 7 дней и вперёд (уже закреплённые) — справка к пределу «3 за 7 дней».
 */
create or replace function app.capacity_cabotage_ops(p_carrier uuid, p_from text, p_to text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.country is null or p_from is null or p_from is distinct from p_to or p_from = c.country then null
    else (
      select count(*)::integer
      from public.orders o
      where o.assigned_company_id = p_carrier
        and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS', 'DONE')
        and not exists (
          select 1 from public.order_stops s
          where s.order_id = o.id and coalesce(s.country, '') <> p_from
        )
        and exists (
          select 1 from public.order_stops s
          where s.order_id = o.id
            and s.scheduled_date >= (now() at time zone 'Europe/Helsinki')::date - 7
        )
    )
  end
  from public.companies c
  where c.id = p_carrier;
$$;

revoke all on function app.capacity_cabotage_ops(uuid, text, text) from public, anon, authenticated;


-- ── Заказчик: поиск и подсказки ────────────────────────────────────

/* Кто может смотреть место: заказчик или экспедитор допущенной компании. */
create or replace function app.capacity_viewer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null or v_company.kind <> 'SHIPPER' or v_company.status not in ('APPROVED', 'ACTIVE')
     or v_company.frozen_at is not null or v_company.client_of is not null then
    raise exception 'Свободное место видят заказчики с допуском.' using errcode = '42501';
  end if;
  return v_company.id;
end;
$$;

revoke all on function app.capacity_viewer() from public, anon, authenticated;

/*
 * «Свободное место по пути»: города, даты, место, кузов, имя перевозчика
 * и значок проверки. Ни машины, ни рейса, ни координат.
 */
create or replace function public.capacity_offers_search(
  p_country text default null,
  p_city text default null,
  p_date_from date default null,
  p_date_to date default null
)
returns table(
  offer_id uuid,
  from_city text,
  from_country text,
  to_city text,
  to_country text,
  available_from date,
  available_to date,
  free_ldm numeric,
  free_kg integer,
  free_pallets smallint,
  body text,
  vehicle_class public.vehicle_class,
  carrier_name text,
  carrier_country text,
  verified boolean,
  cabotage_ops integer,
  my_pending integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := app.capacity_viewer();
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
  v_country text := nullif(upper(btrim(coalesce(p_country, ''))), '');
begin
  return query
  select
    p.id,
    p.from_city,
    p.from_country,
    p.to_city,
    p.to_country,
    p.available_from,
    p.available_to,
    p.free_ldm,
    p.free_kg,
    p.free_pallets,
    p.body,
    p.vehicle_class,
    c.name,
    c.country,
    app.company_verified(c.id),
    app.capacity_cabotage_ops(c.id, p.from_country, p.to_country),
    (select count(*)::integer from public.capacity_requests r
      where r.offer_id = p.id and r.shipper_company_id = v_me and r.status = 'PENDING')
  from public.capacity_offers p
  join public.companies c on c.id = p.company_id
  where p.status = 'PUBLISHED'
    and c.id <> v_me
    and c.client_of is null
    and app.same_world(v_me, c.id)
    and app.capacity_offer_live(p.id)
    and (v_country is null or p.from_country = v_country or p.to_country = v_country)
    and (v_city is null
      or position(lower(v_city) in lower(p.from_city)) > 0
      or position(lower(v_city) in lower(p.to_city)) > 0)
    and (p_date_from is null or p.available_to >= p_date_from)
    and (p_date_to is null or p.available_from <= p_date_to)
  order by p.available_from, p.from_city, p.id
  limit 200;
end;
$$;

comment on function public.capacity_offers_search(text, text, date, date) is
  'Догрузы для заказчика: опубликованное свободное место — городами, без машины и координат.';

revoke all on function public.capacity_offers_search(text, text, date, date) from public, anon;
grant execute on function public.capacity_offers_search(text, text, date, date) to authenticated;

/* Сколько крюка по пути: F→P→D→T минус F→T, всё по сетке 0,1°. */
create or replace function app.capacity_detour_km(
  p_from_lat double precision, p_from_lon double precision,
  p_to_lat double precision, p_to_lon double precision,
  p_pick_lat double precision, p_pick_lon double precision,
  p_drop_lat double precision, p_drop_lon double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select app.km_between(p_from_lat, p_from_lon, round(p_pick_lat::numeric, 1)::double precision, round(p_pick_lon::numeric, 1)::double precision)
       + app.km_between(round(p_pick_lat::numeric, 1)::double precision, round(p_pick_lon::numeric, 1)::double precision,
                        round(p_drop_lat::numeric, 1)::double precision, round(p_drop_lon::numeric, 1)::double precision)
       + app.km_between(round(p_drop_lat::numeric, 1)::double precision, round(p_drop_lon::numeric, 1)::double precision, p_to_lat, p_to_lon)
       - app.km_between(p_from_lat, p_from_lon, p_to_lat, p_to_lon);
$$;

revoke all on function app.capacity_detour_km(double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) from public, anon, authenticated;

/* Заказ, с которым можно просить место: свой, ещё не назначен, без откликов, груз в кузове. */
create or replace function app.capacity_order_ready(p_order public.orders)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_order.status in ('DRAFT', 'OPEN')
    and p_order.assigned_company_id is null
    and p_order.haul_kind in ('VAN', 'TRUCK', 'SEMI')
    and p_order.ldm is not null
    and p_order.distance_km is not null
    and not exists (select 1 from public.order_offers f where f.order_id = p_order.id)
    and exists (select 1 from public.order_stops s where s.order_id = p_order.id and s.role = 'PICKUP')
    and exists (select 1 from public.order_stops s where s.order_id = p_order.id and s.role = 'DELIVERY')
    and app.order_max_weight_kg(p_order.id) > 0;
$$;

revoke all on function app.capacity_order_ready(public.orders) from public, anon, authenticated;

/*
 * Подсказки к частичным грузам заказчика: машины с местом, которым по
 * пути (крюк не больше 50 км + 15 % отрезка), в нужный день и с
 * достаточным местом. До пяти на заказ, ближние — выше.
 */
create or replace function public.capacity_suggestions(p_order_ids uuid[])
returns table(
  order_id uuid,
  offer_id uuid,
  from_city text,
  to_city text,
  available_from date,
  available_to date,
  free_ldm numeric,
  free_kg integer,
  free_pallets smallint,
  body text,
  vehicle_class public.vehicle_class,
  carrier_name text,
  verified boolean,
  detour_km integer,
  cabotage_ops integer,
  my_pending integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := app.capacity_viewer();
begin
  return query
  with mine as (
    select
      o.id as oid,
      o.ldm as oldm,
      app.order_max_weight_kg(o.id) as okg,
      pk.lat as plat, pk.lon as plon, pk.country as pcountry, pk.scheduled_date as pdate,
      dl.lat as dlat, dl.lon as dlon, dl.country as dcountry
    from public.orders o
    join lateral (
      select s.* from public.order_stops s where s.order_id = o.id and s.role = 'PICKUP' order by s.sequence limit 1
    ) pk on true
    join lateral (
      select s.* from public.order_stops s where s.order_id = o.id and s.role = 'DELIVERY' order by s.sequence desc limit 1
    ) dl on true
    where o.id = any (p_order_ids)
      and o.shipper_company_id = v_me
      and app.capacity_order_ready(o)
      and pk.lat is not null and pk.lon is not null and dl.lat is not null and dl.lon is not null
  ),
  cand as (
    select
      m.oid,
      p.id as pid,
      p.from_city as fcity,
      p.to_city as tcity,
      p.available_from as afrom,
      p.available_to as ato,
      p.free_ldm as fldm,
      p.free_kg as fkg,
      p.free_pallets as fpal,
      p.body as pbody,
      p.vehicle_class as pclass,
      c.id as cid,
      c.name as cname,
      app.capacity_detour_km(p.from_lat, p.from_lon, p.to_lat, p.to_lon, m.plat, m.plon, m.dlat, m.dlon) as detour,
      app.km_between(p.from_lat, p.from_lon, p.to_lat, p.to_lon) as span,
      m.pcountry,
      m.dcountry
    from mine m
    join public.capacity_offers p on p.status = 'PUBLISHED'
    join public.companies c on c.id = p.company_id
    where p.from_lat is not null and p.from_lon is not null and p.to_lat is not null and p.to_lon is not null
      and c.id <> v_me
      and c.client_of is null
      and app.same_world(v_me, c.id)
      and (m.pdate is null or m.pdate between p.available_from and p.available_to)
      and (p.free_ldm is null or m.oldm <= p.free_ldm)
      and (p.free_kg is null or m.okg <= p.free_kg)
      and app.capacity_offer_live(p.id)
  ),
  ranked as (
    select x.*, row_number() over (partition by x.oid order by x.detour, x.afrom, x.pid) as rn
    from cand x
    where x.detour <= 50 + 0.15 * x.span
  )
  select
    r.oid,
    r.pid,
    r.fcity,
    r.tcity,
    r.afrom,
    r.ato,
    r.fldm,
    r.fkg,
    r.fpal,
    r.pbody,
    r.pclass,
    r.cname,
    app.company_verified(r.cid),
    (round(greatest(r.detour, 0) / 5) * 5)::integer,
    app.capacity_cabotage_ops(r.cid, r.pcountry, r.dcountry),
    (select count(*)::integer from public.capacity_requests q
      where q.offer_id = r.pid and q.order_id = r.oid and q.status = 'PENDING')
  from ranked r
  where r.rn <= 5
  order by r.oid, r.rn;
end;
$$;

comment on function public.capacity_suggestions(uuid[]) is
  'Догрузы: машины с местом по пути к частичным грузам заказчика. Крюк — по сетке 0,1°.';

revoke all on function public.capacity_suggestions(uuid[]) from public, anon;
grant execute on function public.capacity_suggestions(uuid[]) to authenticated;


-- ── Запрос ─────────────────────────────────────────────────────────

create or replace function public.capacity_request_create(
  p_offer_id uuid,
  p_order_id uuid,
  p_price_cents integer,
  p_date_from date default null,
  p_date_to date default null,
  p_pallets integer default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.capacity_viewer();
  v_offer public.capacity_offers;
  v_order public.orders;
  v_pick public.order_stops;
  v_drop public.order_stops;
  v_kg integer;
  v_from date;
  v_to date;
  v_id uuid;
begin
  if (select status from public.companies where id = v_me) <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании.' using errcode = '55000';
  end if;

  select * into v_offer from public.capacity_offers where id = p_offer_id;
  if v_offer.id is null or not app.capacity_offer_live(v_offer.id) or v_offer.company_id = v_me
     or not app.same_world(v_me, v_offer.company_id) then
    raise exception 'Место больше не предлагается.' using errcode = '55000';
  end if;

  select * into v_order from public.orders where id = p_order_id and shipper_company_id = v_me;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;
  if not app.capacity_order_ready(v_order) then
    raise exception 'Место просят для заказа, который ещё не взят и без откликов.' using errcode = '55000';
  end if;

  select * into v_pick from public.order_stops where order_id = v_order.id and role = 'PICKUP' order by sequence limit 1;
  select * into v_drop from public.order_stops where order_id = v_order.id and role = 'DELIVERY' order by sequence desc limit 1;
  v_kg := app.order_max_weight_kg(v_order.id);

  if (v_offer.free_ldm is not null and v_order.ldm > v_offer.free_ldm)
     or (v_offer.free_kg is not null and v_kg > v_offer.free_kg)
     or (v_offer.free_pallets is not null and p_pallets is not null and p_pallets > v_offer.free_pallets) then
    raise exception 'Груз не помещается в свободное место.' using errcode = '22023';
  end if;

  v_from := coalesce(p_date_from, v_pick.scheduled_date, v_offer.available_from);
  v_to := coalesce(p_date_to, v_pick.scheduled_date, v_from);
  if v_to < v_from or v_from > v_offer.available_to or v_to < v_offer.available_from then
    raise exception 'Даты не совпадают с местом.' using errcode = '22023';
  end if;

  if p_price_cents is null or p_price_cents < 100 then
    raise exception 'Укажите цену.' using errcode = '22023';
  end if;

  insert into public.capacity_requests (
    offer_id, carrier_company_id, shipper_company_id, order_id,
    from_city, from_country, from_lat, from_lon,
    to_city, to_country, to_lat, to_lon,
    date_from, date_to, ldm, weight_kg, pallets, description,
    price_cents, currency
  )
  values (
    v_offer.id, v_offer.company_id, v_me, v_order.id,
    v_pick.city, v_pick.country, round(v_pick.lat::numeric, 1)::double precision, round(v_pick.lon::numeric, 1)::double precision,
    v_drop.city, v_drop.country, round(v_drop.lat::numeric, 1)::double precision, round(v_drop.lon::numeric, 1)::double precision,
    v_from, v_to, v_order.ldm, v_kg, p_pallets, nullif(btrim(left(coalesce(p_description, ''), 500)), ''),
    p_price_cents, v_order.currency
  )
  returning id into v_id;

  perform app.notify_event(
    v_offer.company_id,
    'ORDER',
    'capacity.request',
    jsonb_build_object('from', v_pick.city, 'to', v_drop.city, 'date', to_char(v_from, 'DD.MM.')),
    '/carrier/capacity'
  );

  return v_id;
end;
$$;

comment on function public.capacity_request_create(uuid, uuid, integer, date, date, integer, text) is
  'Догрузы: запрос заказчика на место со своим заказом (черновик или на столе без откликов) и ценой.';

revoke all on function public.capacity_request_create(uuid, uuid, integer, date, date, integer, text) from public, anon;
grant execute on function public.capacity_request_create(uuid, uuid, integer, date, date, integer, text) to authenticated;

create or replace function public.capacity_request_cancel(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.capacity_requests
  set status = 'CANCELLED', decided_at = now(), decided_by = auth.uid()
  where id = p_request_id
    and shipper_company_id = (select app.current_company_id())
    and status = 'PENDING';
  if not found then
    raise exception 'Запрос уже решён.' using errcode = '55000';
  end if;
end;
$$;

revoke all on function public.capacity_request_cancel(uuid) from public, anon;
grant execute on function public.capacity_request_cancel(uuid) to authenticated;


-- ── Ответ перевозчика ──────────────────────────────────────────────

/*
 * Отказ — запрос закрыт, заказчик узнаёт.
 *
 * Принятие — заказ заказчика становится прямым заказом этой машине (как
 * app.direct_assign: отклик DIRECT и запись прямого назначения) и сразу
 * подтверждённым: перевозчик согласился здесь же. Цена — из запроса.
 * Прицеп — тот же, что у рейса, на котором место. Уведомление
 * direct.accepted уходит заказчику с номером машины: номер — только
 * теперь. Место уменьшается на груз; осталось мало — FILLED.
 */
create or replace function public.capacity_request_decide(p_request_id uuid, p_accept boolean, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_request public.capacity_requests;
  v_offer public.capacity_offers;
  v_order public.orders;
  v_trailer uuid;
  v_offer_row uuid;
  v_plate text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Отвечает перевозчик.' using errcode = '42501';
  end if;

  select * into v_request from public.capacity_requests where id = p_request_id for update;
  if v_request.id is null or v_request.carrier_company_id is distinct from v_company then
    raise exception 'Запрос не найден.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Запрос уже решён.' using errcode = '55000';
  end if;

  if not p_accept then
    update public.capacity_requests
    set status = 'DECLINED', decided_at = now(), decided_by = auth.uid(),
        decline_reason = nullif(btrim(left(coalesce(p_reason, ''), 300)), '')
    where id = v_request.id;

    perform app.notify_event(
      v_request.shipper_company_id,
      'ORDER',
      'capacity.declined',
      jsonb_build_object('from', v_request.from_city, 'to', v_request.to_city),
      '/shipper/capacity'
    );
    return null;
  end if;

  select * into v_offer from public.capacity_offers where id = v_request.offer_id for update;
  if not app.capacity_offer_live(v_offer.id) then
    raise exception 'Место уже не опубликовано.' using errcode = '55000';
  end if;

  select * into v_order from public.orders where id = v_request.order_id for update;
  if v_order.id is null or not app.capacity_order_ready(v_order) then
    raise exception 'Заказ уже взят или изменён.' using errcode = '55000';
  end if;

  if (v_offer.free_ldm is not null and v_order.ldm > v_offer.free_ldm)
     or (v_offer.free_kg is not null and app.order_max_weight_kg(v_order.id) > v_offer.free_kg) then
    raise exception 'Груз не помещается в свободное место.' using errcode = '22023';
  end if;

  if not app.vehicle_is_dispatchable(v_offer.vehicle_id) then
    raise exception 'Машина сейчас не выходит на рейсы.' using errcode = '55004';
  end if;

  if v_order.currency is distinct from v_request.currency then
    raise exception 'Валюта заказа изменилась.' using errcode = '55000';
  end if;

  select o.assigned_trailer_id into v_trailer from public.orders o where o.id = v_offer.order_id;

  update public.orders
  set rate_cents = v_request.price_cents,
      pricing_mode = 'FIXED',
      rate_per_km_cents = null
  where id = v_order.id;

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, trailer_id, created_by, origin)
  values (v_order.id, v_company, v_offer.vehicle_id, v_trailer, (select auth.uid()), 'DIRECT')
  returning id into v_offer_row;

  insert into public.order_direct_requests (order_id, vehicle_id, carrier_company_id, sent_by)
  values (v_order.id, v_offer.vehicle_id, v_company, v_request.created_by);

  update public.orders
  set status = 'AWAIT_DRIVER',
      dispatch_mode = 'DIRECT',
      chosen_offer_id = v_offer_row,
      assigned_company_id = v_company,
      assigned_vehicle_id = v_offer.vehicle_id,
      assigned_trailer_id = v_trailer,
      deadline_at = null
  where id = v_order.id;

  update public.orders set status = 'IN_PROGRESS' where id = v_order.id;

  /*
   * «Новый прямой заказ» перевозчику лишний — он сам его только что
   * принял; «прямой заказ подтверждён» заказчику заменяет capacity.accepted
   * ниже (с маршрутом и номером машины).
   */
  delete from public.notifications
  where ((company_id = v_company and code = 'order.direct')
      or (company_id = v_request.shipper_company_id and code = 'direct.accepted'))
    and params->>'ref' = v_order.ref;

  update public.capacity_requests
  set status = 'ACCEPTED', decided_at = now(), decided_by = auth.uid(), created_order_id = v_order.id
  where id = v_request.id;

  /* Тот же заказ ждал и других машин — больше не ждёт. */
  update public.capacity_requests
  set status = 'EXPIRED', decided_at = now()
  where order_id = v_order.id and status = 'PENDING';

  update public.capacity_offers
  set free_ldm = case when free_ldm is null then null else greatest(free_ldm - coalesce(v_order.ldm, 0), 0) end,
      free_kg = case when free_kg is null then null else greatest(free_kg - app.order_max_weight_kg(v_order.id), 0) end,
      free_pallets = case when free_pallets is null then null else greatest(free_pallets - coalesce(v_request.pallets, 0), 0)::smallint end,
      /* Расчёт тоже: ночной пересчёт увидит этот груз и не вычтет его второй раз. */
      computed_ldm = case when computed_ldm is null then null else greatest(computed_ldm - coalesce(v_order.ldm, 0), 0) end,
      computed_kg = case when computed_kg is null then null else greatest(computed_kg - app.order_max_weight_kg(v_order.id), 0) end,
      trip_order_ids = trip_order_ids || v_order.id
  where id = v_offer.id;

  update public.capacity_offers
  set status = 'FILLED'
  where id = v_offer.id
    and ((free_ldm is not null and free_ldm < 1) or (free_kg is not null and free_kg < 500));

  select plate into v_plate from public.vehicles where id = v_offer.vehicle_id;
  perform app.notify_event(
    v_request.shipper_company_id,
    'ORDER',
    'capacity.accepted',
    jsonb_build_object('ref', v_order.ref, 'plate', coalesce(v_plate, ''), 'from', v_request.from_city, 'to', v_request.to_city),
    '/shipper/orders'
  );

  return v_order.id;
end;
$$;

comment on function public.capacity_request_decide(uuid, boolean, text) is
  'Догрузы: перевозчик принимает (заказ становится прямым и подтверждённым на этой машине) или отклоняет запрос.';

revoke all on function public.capacity_request_decide(uuid, boolean, text) from public, anon;
grant execute on function public.capacity_request_decide(uuid, boolean, text) to authenticated;


-- ── Перевозчик: входящие запросы ───────────────────────────────────

/* Запросы к своим местам с каботажной справкой — без адресов (их нет и в строке). */
create or replace function public.capacity_requests_for_carrier()
returns table(
  request_id uuid,
  offer_id uuid,
  status text,
  shipper_name text,
  shipper_verified boolean,
  from_city text,
  from_country text,
  to_city text,
  to_country text,
  date_from date,
  date_to date,
  ldm numeric,
  weight_kg integer,
  pallets smallint,
  description text,
  price_cents integer,
  currency text,
  created_at timestamptz,
  created_order_id uuid,
  cabotage_ops integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_company uuid := (select app.current_company_id());
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Только перевозчику.' using errcode = '42501';
  end if;

  return query
  select
    r.id, r.offer_id, r.status, s.name, app.company_verified(s.id),
    r.from_city, r.from_country, r.to_city, r.to_country,
    r.date_from, r.date_to, r.ldm, r.weight_kg, r.pallets, r.description,
    r.price_cents, r.currency, r.created_at, r.created_order_id,
    app.capacity_cabotage_ops(v_company, r.from_country, r.to_country)
  from public.capacity_requests r
  join public.companies s on s.id = r.shipper_company_id
  where r.carrier_company_id = v_company
    and (r.status = 'PENDING' or r.created_at > now() - interval '30 days')
  order by (r.status = 'PENDING') desc, r.created_at desc
  limit 200;
end;
$$;

revoke all on function public.capacity_requests_for_carrier() from public, anon;
grant execute on function public.capacity_requests_for_carrier() to authenticated;

/* Заказчик: свои запросы со справкой о каботаже и тем, куда ушёл ответ. */
create or replace function public.capacity_requests_for_shipper()
returns table(
  request_id uuid,
  offer_id uuid,
  order_id uuid,
  order_ref text,
  status text,
  carrier_name text,
  from_city text,
  to_city text,
  date_from date,
  date_to date,
  price_cents integer,
  currency text,
  decline_reason text,
  created_at timestamptz,
  cabotage_ops integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_me uuid := (select app.current_company_id());
begin
  return query
  select
    r.id, r.offer_id, r.order_id, o.ref, r.status, c.name,
    r.from_city, r.to_city, r.date_from, r.date_to, r.price_cents, r.currency,
    r.decline_reason, r.created_at,
    app.capacity_cabotage_ops(c.id, r.from_country, r.to_country)
  from public.capacity_requests r
  join public.companies c on c.id = r.carrier_company_id
  left join public.orders o on o.id = r.order_id
  where r.shipper_company_id = v_me
    and (r.status = 'PENDING' or r.created_at > now() - interval '30 days')
  order by (r.status = 'PENDING') desc, r.created_at desc
  limit 200;
end;
$$;

revoke all on function public.capacity_requests_for_shipper() from public, anon;
grant execute on function public.capacity_requests_for_shipper() to authenticated;
