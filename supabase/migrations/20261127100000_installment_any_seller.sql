-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники: продаёт любая проверенная финская компания
-- (решение владельца 23.11.2026)
--
-- «Продавать технику в рассрочку может любая проверенная компания из
-- Финляндии, зарегистрированная в RAHTIS; покупать — только перевозчик».
--
--   Продавец — компания со статусом ACTIVE (прошла проверку оператора) и
--     страной FI, любого вида: перевозчик или нет. Действующие лицензия и
--     страховка продавцу не нужны. Действует главный в компании.
--   Покупатель — как раньше: действующий финский перевозчик с лицензией
--     и страховкой (app.installment_company_ok), главный в компании.
--
-- Машина продавца-неперевозчика. Строка public.vehicles бывает только у
-- перевозчика (составной ключ и проверка vehicles_company_is_carrier из
-- 20260816160000): на ней стоят стол заказов, свободное место, водители,
-- GPS, обслуживание — больше ста миграций читают эту таблицу. Поэтому
-- vehicles не трогаем. У неперевозчика своя короткая карточка машины на
-- продажу — public.equipment_sale_vehicles: номер, марка и модель, класс,
-- эко-класс, оси, а у фургона и грузовика — грузоподъёмность и
-- погрузочные метры (без них строку в парке покупателя не создать).
-- Карточку проверяет оператор (тот же порядок, что у машины парка:
-- черновик → на проверке → одобрена или отклонена). Объявление ссылается
-- либо на машину парка (vehicle_id), либо на такую карточку
-- (sale_vehicle_id) — ровно на одно из двух.
--
-- Передача: у покупателя в парке создаётся машина из карточки (черновик,
-- обычное одобрение), карточка продавца помечается проданной. У продавца
-- нет ни рейсов, ни водителей, ни GPS — отвязывать нечего.
-- Прекращение сделки: карточка продавца освобождается и возвращается в
-- черновик — перед новой продажей её снова проверяет оператор.
--
-- Продажа между перевозчиками работает как раньше: ветка с vehicle_id в
-- каждой функции осталась без изменений.
-- ═══════════════════════════════════════════════════════════════════

-- ── Кто может продавать ─────────────────────────────────────────────

/*
 * Может ли компания продавать: проверена оператором (ACTIVE) и из
 * Финляндии. Вид компании и документы перевозчика не важны (23.11.2026).
 */
create or replace function app.installment_seller_ok(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company and c.status = 'ACTIVE' and c.country::text = 'FI'
      /* Записи справочника «свои клиенты» перевозчика — не участники площадки. */
      and c.client_of is null
  )
$$;

revoke all on function app.installment_seller_ok(uuid) from public, anon, authenticated;

/* Главный в компании, которая может продавать, — иначе ошибка. */
create or replace function app.installment_seller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
begin
  if not app.installment_seller_ok(v_me) then
    raise exception 'Продавать технику в рассрочку может только проверенная компания из Финляндии.' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

revoke all on function app.installment_seller() from public, anon, authenticated;

/*
 * Своя сторона сделки в порядке: продавцу хватает проверенной финской
 * компании, покупателю нужна полная проверка перевозчика (23.11.2026).
 */
create or replace function app.installment_side_ok(p_company uuid, p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_company = p_seller then app.installment_seller_ok(p_company)
    else app.installment_company_ok(p_company)
  end
$$;

revoke all on function app.installment_side_ok(uuid, uuid) from public, anon, authenticated;

-- ── Машина на продажу у компании без парка ──────────────────────────

create table public.equipment_sale_vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  /* Те же правила, что у машины парка: при передаче карточка становится строкой vehicles покупателя. */
  plate text not null
    constraint equipment_sale_vehicles_plate check (plate = upper(plate) and plate ~ '^[A-Z0-9-]{4,12}$'),
  make text not null
    constraint equipment_sale_vehicles_make check (length(btrim(make)) between 2 and 80),
  vehicle_class public.vehicle_class not null,
  euro_class public.euro_class not null,
  axles smallint not null
    constraint equipment_sale_vehicles_axles check (axles between 2 and 5),
  payload_kg integer
    constraint equipment_sale_vehicles_payload check (payload_kg between 100 and 26000),
  ldm numeric(4, 1)
    constraint equipment_sale_vehicles_ldm check (ldm > 0 and ldm <= 20),
  /* Решение оператора — как у машины парка. */
  access public.vehicle_access not null default 'DRAFT',
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  /* Сделка, по которой машину передали покупателю: проданную карточку не выставить и не править. */
  sold_deal_id uuid references public.installment_deals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  /* У тягача и самосвала грузоподъёмность считается по осям; у фургона и грузовика — задаётся (как vehicles_express_capacity). */
  constraint equipment_sale_vehicles_capacity check (
    case
      when vehicle_class in ('TRACTOR', 'TIPPER') then payload_kg is null and ldm is null
      else payload_kg is not null and ldm is not null
    end
  ),
  constraint equipment_sale_vehicles_van_payload check (vehicle_class <> 'VAN' or payload_kg <= 3500),
  constraint equipment_sale_vehicles_tipper_axles check (vehicle_class <> 'TIPPER' or axles between 3 and 5),
  constraint equipment_sale_vehicles_rejection_reason
    check (access <> 'REJECTED' or nullif(btrim(coalesce(rejection_reason, '')), '') is not null),
  constraint equipment_sale_vehicles_company_plate unique (company_id, plate)
);

/* Один номер не может быть одобрен к продаже у двух компаний сразу. */
create unique index equipment_sale_vehicles_approved_plate
  on public.equipment_sale_vehicles (plate) where access = 'APPROVED' and sold_deal_id is null;
create index equipment_sale_vehicles_pending
  on public.equipment_sale_vehicles (submitted_at) where access = 'PENDING';

comment on table public.equipment_sale_vehicles is
  'Машина на продажу в рассрочку у компании без парка (не перевозчика), 23.11.2026. В рейсы, свободное место, к водителям и GPS не попадает: это не строка public.vehicles.';

alter table public.equipment_sale_vehicles enable row level security;

/* Читают своя компания и оператор; запись — только функциями ниже. */
create policy equipment_sale_vehicles_own on public.equipment_sale_vehicles
  for select to authenticated
  using (company_id = (select app.current_company_id()) or (select app.is_admin()));

grant select on public.equipment_sale_vehicles to authenticated;

/* Можно ли выставить карточку: своя, одобрена оператором и не продана. */
create or replace function app.sale_vehicle_sellable(p_vehicle uuid, p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipment_sale_vehicles s
    where s.id = p_vehicle and s.company_id = p_company and s.access = 'APPROVED' and s.sold_deal_id is null
  )
$$;

revoke all on function app.sale_vehicle_sellable(uuid, uuid) from public, anon, authenticated;

-- ── Объявление: машина парка или карточка на продажу ────────────────

alter table public.equipment_listings
  alter column vehicle_id drop not null,
  /* Restrict — как у vehicle_id: карточку с объявлением удалить нельзя. */
  add column sale_vehicle_id uuid references public.equipment_sale_vehicles (id) on delete restrict,
  /* Существующие строки проходят: у всех есть vehicle_id и нет sale_vehicle_id. */
  add constraint equipment_listings_vehicle_source check (num_nonnulls(vehicle_id, sale_vehicle_id) = 1);

comment on column public.equipment_listings.sale_vehicle_id is
  'Машина продавца без парка (public.equipment_sale_vehicles). Ровно одно из двух: vehicle_id или sale_vehicle_id (23.11.2026).';

/* Права на чтение — на всю таблицу (grant select … to authenticated в 20261122100000): новый столбец виден продавцу. */

/* Одна живая продажа на карточку — как на машину парка. */
create unique index equipment_listings_sale_vehicle_live
  on public.equipment_listings (sale_vehicle_id) where status in ('DRAFT', 'PUBLISHED', 'RESERVED');

create or replace function app.equipment_listing_vehicle_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vehicle_id is not null then
    if not app.vehicle_sellable(new.vehicle_id, new.seller_company_id) then
      raise exception 'Машина не одобрена или ещё в рассрочке.' using errcode = '42501';
    end if;
  elsif not app.sale_vehicle_sellable(new.sale_vehicle_id, new.seller_company_id) then
    raise exception 'Машина на продажу не одобрена оператором или уже продана.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger equipment_listing_vehicle_guard on public.equipment_listings;
create trigger equipment_listing_vehicle_guard
  before insert or update of vehicle_id, sale_vehicle_id on public.equipment_listings
  for each row execute function app.equipment_listing_vehicle_guard();

-- ── Карточка машины на продажу: сохранить, отправить, решить ────────

/*
 * Сохранить карточку (главный в проверенной финской компании без парка).
 * Перевозчик продаёт машины из своего парка — карточка ему не нужна.
 * Правка возвращает карточку в черновик: оператор одобрял прежние данные.
 * Карточку на проверке, проданную и с живым объявлением править нельзя.
 */
create or replace function public.save_equipment_sale_vehicle(
  p_id uuid,
  p_plate text,
  p_make text,
  p_vehicle_class public.vehicle_class,
  p_euro_class public.euro_class,
  p_axles integer,
  p_payload_kg integer,
  p_ldm numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_seller();
  v_plate text := upper(regexp_replace(coalesce(p_plate, ''), '\s', '', 'g'));
  v_make text := btrim(coalesce(p_make, ''));
  v_cargo boolean := p_vehicle_class in ('VAN', 'TRUCK');
  v_id uuid;
begin
  if exists (select 1 from public.companies c where c.id = v_me and c.kind = 'CARRIER') then
    raise exception 'Перевозчик продаёт машины из своего парка.' using errcode = '42501';
  end if;
  if p_vehicle_class is null or p_euro_class is null or p_axles is null
     or v_plate !~ '^[A-Z0-9-]{4,12}$' or length(v_make) not between 2 and 80
     or p_axles not between 2 and 5
     or (p_vehicle_class = 'TIPPER' and p_axles < 3)
     or (v_cargo and (p_payload_kg is null or p_ldm is null or p_payload_kg not between 100 and 26000 or p_ldm <= 0 or p_ldm > 20))
     or (p_vehicle_class = 'VAN' and p_payload_kg > 3500) then
    raise exception 'Данные машины.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.equipment_sale_vehicles (company_id, plate, make, vehicle_class, euro_class, axles, payload_kg, ldm)
    values (
      v_me, v_plate, v_make, p_vehicle_class, p_euro_class, p_axles,
      case when v_cargo then p_payload_kg end, case when v_cargo then p_ldm end
    )
    returning id into v_id;
  else
    update public.equipment_sale_vehicles s
    set plate = v_plate, make = v_make, vehicle_class = p_vehicle_class, euro_class = p_euro_class, axles = p_axles,
        payload_kg = case when v_cargo then p_payload_kg end, ldm = case when v_cargo then p_ldm end,
        access = 'DRAFT', rejection_reason = null, submitted_at = null, approved_at = null, rejected_at = null,
        updated_at = now()
    where s.id = p_id and s.company_id = v_me and s.access in ('DRAFT', 'REJECTED', 'APPROVED') and s.sold_deal_id is null
      and not exists (
        select 1 from public.equipment_listings l
        where l.sale_vehicle_id = s.id and l.status in ('DRAFT', 'PUBLISHED', 'RESERVED')
      )
    returning s.id into v_id;
    if v_id is null then
      raise exception 'Карточку машины сейчас нельзя изменить.' using errcode = '55000';
    end if;
  end if;
  return v_id;
end;
$$;

/* Отправить карточку оператору на проверку. */
create or replace function public.submit_equipment_sale_vehicle(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_seller();
  v_id uuid;
begin
  update public.equipment_sale_vehicles
  set access = 'PENDING', submitted_at = now(), rejection_reason = null, rejected_at = null, updated_at = now()
  where id = p_id and company_id = v_me and access in ('DRAFT', 'REJECTED') and sold_deal_id is null
  returning id into v_id;
  if v_id is null then
    raise exception 'Карточку машины нельзя отправить на проверку.' using errcode = '55000';
  end if;
end;
$$;

/*
 * Решение оператора по карточке — как decide_vehicle у машины парка, но
 * без проверки документов перевозчика: продавцу они не нужны. Компании —
 * то же уведомление, что о машине парка, со ссылкой в её раздел.
 */
create or replace function public.decide_equipment_sale_vehicle(p_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.equipment_sale_vehicles;
begin
  if not (select app.is_admin()) then
    raise exception 'Решение принимает только администратор.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Недопустимое решение.' using errcode = '22023';
  end if;
  select * into v_row from public.equipment_sale_vehicles where id = p_id for update;
  if v_row.id is null then
    raise exception 'Машина не найдена.' using errcode = 'P0002';
  end if;
  if v_row.access <> 'PENDING' then
    raise exception 'Карточка не находится на проверке.' using errcode = '55000';
  end if;
  if p_decision = 'REJECTED' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Отказ требует причины.' using errcode = '22023';
  end if;

  update public.equipment_sale_vehicles
  set access = p_decision::public.vehicle_access,
      approved_at = case when p_decision = 'APPROVED' then now() else approved_at end,
      rejected_at = case when p_decision = 'REJECTED' then now() else rejected_at end,
      rejection_reason = case when p_decision = 'REJECTED' then btrim(p_note) else null end,
      updated_at = now()
  where id = p_id;

  if p_decision = 'APPROVED' then
    perform app.notify_event(
      v_row.company_id, 'MODERATION', 'vehicle.approved',
      jsonb_build_object('plate', v_row.plate), '/shipper/installments'
    );
  else
    perform app.notify_event(
      v_row.company_id, 'MODERATION', 'vehicle.rejected',
      jsonb_build_object('plate', v_row.plate, 'reason', btrim(p_note)), '/shipper/installments'
    );
  end if;
end;
$$;

revoke all on function public.save_equipment_sale_vehicle(uuid, text, text, public.vehicle_class, public.euro_class, integer, integer, numeric) from public, anon;
revoke all on function public.submit_equipment_sale_vehicle(uuid) from public, anon;
revoke all on function public.decide_equipment_sale_vehicle(uuid, text, text) from public, anon;
grant execute on function public.save_equipment_sale_vehicle(uuid, text, text, public.vehicle_class, public.euro_class, integer, integer, numeric) to authenticated;
grant execute on function public.submit_equipment_sale_vehicle(uuid) to authenticated;
grant execute on function public.decide_equipment_sale_vehicle(uuid, text, text) to authenticated;

-- ── Объявления (продавец) ───────────────────────────────────────────

/*
 * Объявление продавца. Продавец — главный в проверенной финской компании
 * любого вида (23.11.2026). У перевозчика p_vehicle_id — машина парка, у
 * остальных — одобренная карточка машины на продажу. Остальное — как в
 * 20261126100000.
 */
create or replace function public.save_equipment_listing(
  p_id uuid,
  p_vehicle_id uuid,
  p_price_cents bigint,
  p_vat_mode text,
  p_down_payment_cents bigint,
  p_months integer,
  p_final_cents bigint,
  p_annual_rate_bps integer,
  p_odometer_km integer,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_seller();
  v_carrier boolean;
  v_vehicle uuid;
  v_sale_vehicle uuid;
  v_vat_bps integer;
  v_id uuid;
begin
  if p_vat_mode is distinct from 'STANDARD' then
    raise exception 'Продажа в рассрочку — только с обычным НДС.' using errcode = '22023';
  end if;
  select c.kind = 'CARRIER' into v_carrier from public.companies c where c.id = v_me;
  if v_carrier then
    if not exists (select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = v_me and v.access = 'APPROVED') then
      raise exception 'Машина не из вашего парка или не одобрена.' using errcode = '42501';
    end if;
    v_vehicle := p_vehicle_id;
  else
    if not app.sale_vehicle_sellable(p_vehicle_id, v_me) then
      raise exception 'Машина на продажу не ваша, не одобрена оператором или уже продана.' using errcode = '42501';
    end if;
    v_sale_vehicle := p_vehicle_id;
  end if;
  /* Машину и пробег нельзя менять, пока идут переговоры: покупатель видел другое. */
  if p_id is not null and exists (
    select 1 from public.equipment_listings l
    where l.id = p_id
      and (l.vehicle_id is distinct from v_vehicle or l.sale_vehicle_id is distinct from v_sale_vehicle
           or l.odometer_km is distinct from p_odometer_km)
      and exists (select 1 from public.installment_deals d where d.listing_id = l.id and d.status = 'NEGOTIATING')
  ) then
    raise exception 'По объявлению идут переговоры — машину и пробег не изменить.' using errcode = '55000';
  end if;
  /* НДС — по стране регистрации продавца (как у счетов за фрахт). */
  select case c.country::text
    when 'FI' then 2550 when 'SE' then 2500 when 'NO' then 2500 when 'DK' then 2500 when 'EE' then 2400
    when 'LV' then 2100 when 'LT' then 2100 when 'PL' then 2300 when 'DE' then 1900 when 'RO' then 2100
  end into v_vat_bps from public.companies c where c.id = v_me;
  if v_vat_bps is null then
    raise exception 'Страна продавца не поддерживается.' using errcode = '22023';
  end if;
  perform app.installment_terms_ok(p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);

  if p_id is null then
    insert into public.equipment_listings (
      seller_company_id, vehicle_id, sale_vehicle_id, price_cents, vat_mode, vat_bps, down_payment_cents, months,
      final_cents, annual_rate_bps, odometer_km, description
    )
    values (
      v_me, v_vehicle, v_sale_vehicle, p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months,
      p_final_cents, p_annual_rate_bps, p_odometer_km, coalesce(p_description, '')
    )
    returning id into v_id;
  else
    update public.equipment_listings
    set vehicle_id = v_vehicle, sale_vehicle_id = v_sale_vehicle, price_cents = p_price_cents, vat_mode = p_vat_mode,
        vat_bps = v_vat_bps, down_payment_cents = p_down_payment_cents, months = p_months, final_cents = p_final_cents,
        annual_rate_bps = p_annual_rate_bps, odometer_km = p_odometer_km,
        description = coalesce(p_description, ''), updated_at = now()
    where id = p_id and seller_company_id = v_me and status in ('DRAFT', 'PUBLISHED')
    returning id into v_id;
    if v_id is null then
      raise exception 'Объявление нельзя изменить.' using errcode = '55000';
    end if;
  end if;
  return v_id;
end;
$$;

/* Опубликовать или снять (продавец: проверенная финская компания, 23.11.2026). Снятие закрывает открытые переговоры. */
create or replace function public.set_equipment_listing_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_seller();
  v_row public.equipment_listings;
begin
  if p_status not in ('PUBLISHED', 'WITHDRAWN') then
    raise exception 'Статус.' using errcode = '22023';
  end if;
  select * into v_row from public.equipment_listings where id = p_id and seller_company_id = v_me for update;
  if v_row.id is null then
    raise exception 'Нет объявления.' using errcode = '42501';
  end if;
  if v_row.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'По объявлению уже согласована сделка.' using errcode = '55000';
  end if;

  update public.equipment_listings
  set status = p_status,
      published_at = case when p_status = 'PUBLISHED' then coalesce(published_at, now()) else published_at end,
      updated_at = now()
  where id = p_id;

  if p_status = 'WITHDRAWN' then
    update public.installment_deals
    set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_me
    where listing_id = p_id and status = 'NEGOTIATING';
  end if;
end;
$$;

-- ── Каталог (покупатель — как раньше: финский перевозчик с документами) ──

create or replace function public.equipment_catalog()
returns table (
  listing_id uuid,
  seller_name text,
  seller_city text,
  make text,
  vehicle_class text,
  plate text,
  euro_class text,
  axles smallint,
  odometer_km integer,
  price_cents bigint,
  currency text,
  vat_mode text,
  vat_bps integer,
  down_payment_cents bigint,
  months smallint,
  final_cents bigint,
  annual_rate_bps integer,
  description text,
  published_at timestamptz,
  my_deal_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  /* Раздел только для Финляндии: компании из другой страны каталог пуст (22.11.2026). */
  with me as (
    select c.id, c.is_test from public.companies c
    where c.id = (select app.current_company_id())
      and c.kind = 'CARRIER' and c.status = 'ACTIVE' and c.country::text = 'FI'
      and app.company_documents_ok(c.id)
  )
  /* Машина — из парка продавца или из его карточки на продажу (23.11.2026). */
  select l.id, coalesce(s.legal_name, s.name), coalesce(s.legal_city, v.base_city),
         coalesce(v.make, sv.make), coalesce(v.vehicle_class, sv.vehicle_class)::text, coalesce(v.plate, sv.plate),
         coalesce(v.euro_class, sv.euro_class)::text, coalesce(v.axles, sv.axles)::smallint, l.odometer_km,
         l.price_cents, l.currency, l.vat_mode, l.vat_bps, l.down_payment_cents, l.months, l.final_cents,
         l.annual_rate_bps, l.description, l.published_at,
         (select d.id from public.installment_deals d
          where d.listing_id = l.id and d.buyer_company_id = me.id and d.status <> 'CANCELLED'
          order by d.created_at desc limit 1)
  from me
  join public.equipment_listings l on l.status = 'PUBLISHED' and l.seller_company_id <> me.id
  join public.companies s on s.id = l.seller_company_id and s.is_test = me.is_test and s.status = 'ACTIVE'
  left join public.vehicles v on v.id = l.vehicle_id
  left join public.equipment_sale_vehicles sv on sv.id = l.sale_vehicle_id
  order by l.published_at desc;
$$;

-- ── Сделка: начать, предложить, принять, отменить ───────────────────

/*
 * Предложение покупателя по объявлению. Покупатель — как раньше
 * (app.installment_party); продавцу объявления хватает проверенной
 * финской компании (23.11.2026). Снимок машины — из парка продавца или
 * из его карточки на продажу. Остальное — как в 20261126100000.
 */
create or replace function public.start_installment_deal(
  p_listing_id uuid,
  p_price_cents bigint,
  p_down_payment_cents bigint,
  p_months integer,
  p_final_cents bigint,
  p_annual_rate_bps integer,
  p_handover_date date,
  p_first_due_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_listing public.equipment_listings;
  v_id uuid;
begin
  select * into v_listing from public.equipment_listings where id = p_listing_id and status = 'PUBLISHED' for share;
  if v_listing.id is null then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if v_listing.seller_company_id = v_me then
    raise exception 'Своё объявление.' using errcode = '42501';
  end if;
  if not app.installment_seller_ok(v_listing.seller_company_id) then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if (select is_test from public.companies where id = v_me)
     is distinct from (select is_test from public.companies where id = v_listing.seller_company_id) then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if v_listing.vat_mode <> 'STANDARD' then
    raise exception 'Объявление со старым режимом НДС — продавец должен сохранить его заново.' using errcode = '55000';
  end if;
  perform app.installment_terms_ok(p_price_cents, v_listing.vat_mode, v_listing.vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);
  /* Передача не раньше завтрашнего дня: первый счёт должен успеть стать «до передачи». */
  if p_handover_date is null or p_handover_date <= app.helsinki_today() or p_first_due_date is null or p_first_due_date <= p_handover_date then
    raise exception 'Даты.' using errcode = '22023';
  end if;

  insert into public.installment_deals (
    listing_id, seller_company_id, buyer_company_id, price_cents, vat_mode, vat_bps, down_payment_cents,
    months, final_cents, annual_rate_bps, handover_date, first_due_date, proposed_by, vehicle_snapshot
  )
  select
    v_listing.id, v_listing.seller_company_id, v_me, p_price_cents, v_listing.vat_mode, v_listing.vat_bps,
    p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps, p_handover_date, p_first_due_date, v_me,
    jsonb_build_object(
      'make', coalesce(v.make, sv.make), 'plate', coalesce(v.plate, sv.plate),
      'vehicle_class', coalesce(v.vehicle_class, sv.vehicle_class)::text, 'odometer_km', v_listing.odometer_km
    )
  from (select 1) as one
  left join public.vehicles v on v.id = v_listing.vehicle_id
  left join public.equipment_sale_vehicles sv on sv.id = v_listing.sale_vehicle_id
  where v.id is not null or sv.id is not null
  returning id into v_id;
  return v_id;
end;
$$;

/*
 * Встречное предложение любой стороны: заменяет текущие условия, версия +1.
 * Своя сторона проверяется по роли в сделке (23.11.2026): продавец —
 * проверенная финская компания, покупатель — перевозчик с документами.
 */
create or replace function public.propose_installment_terms(
  p_deal_id uuid,
  p_price_cents bigint,
  p_down_payment_cents bigint,
  p_months integer,
  p_final_cents bigint,
  p_annual_rate_bps integer,
  p_handover_date date,
  p_first_due_date date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if not app.installment_side_ok(v_me, v_deal.seller_company_id) then
    raise exception 'Продаёт проверенная компания из Финляндии, покупает действующий перевозчик с выпиской из реестра и страховкой.' using errcode = '42501';
  end if;
  if v_deal.status <> 'NEGOTIATING' then
    raise exception 'Сделка уже не в переговорах.' using errcode = '55000';
  end if;
  perform app.installment_terms_ok(p_price_cents, v_deal.vat_mode, v_deal.vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);
  if p_handover_date is null or p_handover_date <= app.helsinki_today() or p_first_due_date is null or p_first_due_date <= p_handover_date then
    raise exception 'Даты.' using errcode = '22023';
  end if;

  update public.installment_deals
  set price_cents = p_price_cents, down_payment_cents = p_down_payment_cents, months = p_months,
      final_cents = p_final_cents, annual_rate_bps = p_annual_rate_bps, handover_date = p_handover_date,
      first_due_date = p_first_due_date, proposed_by = v_me, version = version + 1, proposed_at = now()
  where id = p_deal_id;
  return v_deal.version + 1;
end;
$$;

/*
 * Принять условия другой стороны. Принимается ровно увиденная версия
 * (p_version): если условия успели заменить — отказ (как у условий счёта).
 * После согласия: номер договора, объявление «зарезервировано», остальные
 * переговоры по нему закрыты. Стороны проверяются по роли (23.11.2026):
 * продавец — проверенная финская компания, покупатель — перевозчик с
 * документами. Остальное — как в 20261125110000.
 */
create or replace function public.accept_installment_terms(p_deal_id uuid, p_version integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_number text;
  v_listing_id uuid;
begin
  /* Порядок блокировок: объявление, потом сделка — как у снятия объявления, без взаимной блокировки. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if not app.installment_side_ok(v_me, v_deal.seller_company_id) then
    raise exception 'Продаёт проверенная компания из Финляндии, покупает действующий перевозчик с выпиской из реестра и страховкой.' using errcode = '42501';
  end if;
  if v_deal.status <> 'NEGOTIATING' then
    raise exception 'Сделка уже не в переговорах.' using errcode = '55000';
  end if;
  if v_deal.proposed_by = v_me then
    raise exception 'Своё предложение принимает другая сторона.' using errcode = '42501';
  end if;
  if p_version is null or v_deal.version is distinct from p_version then
    raise exception 'Условия изменились — посмотрите новые.' using errcode = '40001';
  end if;
  if v_deal.handover_date <= app.helsinki_today() then
    raise exception 'Дата передачи прошла — предложите новую.' using errcode = '22023';
  end if;
  /* Вторая сторона тоже должна быть в порядке на момент согласия. */
  if not app.installment_seller_ok(v_deal.seller_company_id) or not app.installment_company_ok(v_deal.buyer_company_id)
     or (select is_test from public.companies where id = v_deal.seller_company_id)
        is distinct from (select is_test from public.companies where id = v_deal.buyer_company_id) then
    raise exception 'Сторона сделки сейчас не может её заключить.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.equipment_listings where id = v_deal.listing_id and status = 'PUBLISHED') then
    raise exception 'Объявление уже недоступно.' using errcode = '55000';
  end if;

  /* Год — по Хельсинки: договор, согласованный в новогоднюю ночь, получал прошлый год (22.11.2026). */
  v_number := 'OS-' || to_char(now() at time zone 'Europe/Helsinki', 'YYYY') || '-' || lpad(nextval('public.installment_contract_seq')::text, 5, '0');

  update public.installment_deals
  set status = 'AGREED', agreed_at = now(), contract_number = v_number,
      parties_snapshot = (
        select jsonb_object_agg(p.role, jsonb_build_object(
          'name', coalesce(c.legal_name, c.name),
          'business_id', c.business_id,
          'address', concat_ws(', ', c.legal_street, nullif(concat_ws(' ', c.legal_postal_code, c.legal_city), '')),
          'vat_registered', coalesce(c.vat_number, '') <> '',
          'email', coalesce(c.billing_email, c.contact_email)
        ))
        from (values ('seller', v_deal.seller_company_id), ('buyer', v_deal.buyer_company_id)) as p(role, id)
        join public.companies c on c.id = p.id
      )
  where id = p_deal_id;

  update public.equipment_listings set status = 'RESERVED', updated_at = now() where id = v_deal.listing_id;

  update public.installment_deals
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_deal.seller_company_id
  where listing_id = v_deal.listing_id and id <> p_deal_id and status = 'NEGOTIATING';

  return v_number;
end;
$$;

/*
 * Отменить переговоры (любая сторона) или согласованную сделку до первого
 * счёта. Объявление возвращается в каталог. Своя сторона проверяется по
 * роли в сделке (23.11.2026) — иначе продавец без парка отменить не мог бы.
 */
create or replace function public.cancel_installment_deal(p_deal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if not app.installment_side_ok(v_me, v_deal.seller_company_id) then
    raise exception 'Продаёт проверенная компания из Финляндии, покупает действующий перевозчик с выпиской из реестра и страховкой.' using errcode = '42501';
  end if;
  if v_deal.status = 'CANCELLED' then
    return false;
  end if;
  /* Счёт уже выставлен — отмена только с кредит-нотой (этап 3), не одной кнопкой. */
  if v_deal.first_invoice_id is not null then
    raise exception 'Первый счёт уже выставлен — отмена через кредит-ноту.' using errcode = '55000';
  end if;

  update public.installment_deals
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_me
  where id = p_deal_id;

  if v_deal.status = 'AGREED' then
    update public.equipment_listings set status = 'PUBLISHED', updated_at = now()
    where id = v_deal.listing_id and status = 'RESERVED';
  end if;
  return true;
end;
$$;

/* Сделки компании с карточкой машины и названием второй стороны — для кабинета. Машина — из парка или из карточки на продажу. */
create or replace function public.my_installment_deals()
returns table (
  deal_id uuid,
  role text,
  counterparty_name text,
  make text,
  vehicle_class text,
  plate text,
  status text,
  price_cents bigint,
  months smallint,
  proposed_by_me boolean,
  contract_number text,
  proposed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id,
         case when d.seller_company_id = (select app.current_company_id()) then 'SELLER' else 'BUYER' end,
         coalesce(o.legal_name, o.name),
         coalesce(d.vehicle_snapshot->>'make', v.make, sv.make),
         coalesce(d.vehicle_snapshot->>'vehicle_class', v.vehicle_class::text, sv.vehicle_class::text),
         coalesce(d.vehicle_snapshot->>'plate', v.plate, sv.plate), d.status, d.price_cents, d.months,
         d.proposed_by = (select app.current_company_id()), d.contract_number, d.proposed_at
  from public.installment_deals d
  join public.equipment_listings l on l.id = d.listing_id
  left join public.vehicles v on v.id = l.vehicle_id
  left join public.equipment_sale_vehicles sv on sv.id = l.sale_vehicle_id
  join public.companies o on o.id = case
    when d.seller_company_id = (select app.current_company_id()) then d.buyer_company_id
    else d.seller_company_id end
  where (select app.current_company_id()) in (d.seller_company_id, d.buyer_company_id)
  order by d.proposed_at desc;
$$;

-- ── Передача машины ─────────────────────────────────────────────────

/*
 * Подтверждение передачи. Машина парка продавца — как в 20261125110000.
 * Машина продавца без парка (23.11.2026): у покупателя создаётся строка
 * парка из карточки на продажу — черновик, обычное одобрение; карточка
 * продавца помечается проданной. Рейсов, водителей, GPS, свободного места
 * и плана обслуживания у такой машины у продавца нет.
 */
create or replace function public.confirm_installment_handover(p_deal_id uuid, p_odometer_km integer, p_notes text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_listing public.equipment_listings;
  v_new uuid := gen_random_uuid();
  v_buyer_kind public.party_role;
  v_buyer_city text;
  v_seller_city text;
  v_listing_id uuid;
begin
  /* Порядок блокировок как у согласия и отмены: объявление, потом сделка. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if v_deal.status <> 'AGREED' then
    raise exception 'Передача — только по согласованной сделке.' using errcode = '55000';
  end if;
  if v_deal.first_invoice_paid_at is null then
    raise exception 'Первый счёт ещё не оплачен.' using errcode = '55000';
  end if;
  if p_odometer_km is not null and p_odometer_km not between 0 and 9999999 then
    raise exception 'Пробег.' using errcode = '22023';
  end if;
  /* Замечания обеих сторон — не длиннее 2000 знаков (22.11.2026). */
  if char_length(btrim(coalesce(p_notes, ''))) > 2000 then
    raise exception 'Замечания.' using errcode = '22023';
  end if;

  /* Машина не должна быть в работе у продавца: открытые рейсы сначала закрыть или переназначить. */
  if exists (
    select 1 from public.orders o, public.equipment_listings l
    where l.id = v_deal.listing_id and o.assigned_vehicle_id = l.vehicle_id
      and o.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
  ) then
    raise exception 'У машины есть открытые рейсы продавца — закройте или переназначьте их.' using errcode = '55000';
  end if;

  /* Пробег продавца не перезаписывается покупателем. Замечания у каждой стороны свои: ни одна не стирает чужие. */
  update public.installment_deals
  set handover_seller_at = case when v_me = seller_company_id then coalesce(handover_seller_at, now()) else handover_seller_at end,
      handover_buyer_at = case when v_me = buyer_company_id then coalesce(handover_buyer_at, now()) else handover_buyer_at end,
      handover_odometer_km = case when v_me = seller_company_id then coalesce(p_odometer_km, handover_odometer_km)
                                  else coalesce(handover_odometer_km, p_odometer_km) end,
      handover_notes = case when v_me = seller_company_id then coalesce(nullif(btrim(p_notes), ''), handover_notes)
                            else handover_notes end,
      handover_buyer_notes = case when v_me = buyer_company_id then coalesce(nullif(btrim(p_notes), ''), handover_buyer_notes)
                                  else handover_buyer_notes end
  where id = p_deal_id
  returning * into v_deal;

  if v_deal.handover_seller_at is null or v_deal.handover_buyer_at is null then
    return v_deal.status;
  end if;

  select * into v_listing from public.equipment_listings where id = v_deal.listing_id;
  select c.kind, coalesce(c.legal_city, '') into v_buyer_kind, v_buyer_city from public.companies c where c.id = v_deal.buyer_company_id;

  if v_listing.vehicle_id is not null then
    /* Копия машины у покупателя: те же данные, своя компания, черновик — одобрение как у любой машины. */
    insert into public.vehicles
    select (jsonb_populate_record(
      null::public.vehicles,
      to_jsonb(v) || jsonb_build_object(
        'id', v_new,
        'company_id', v_deal.buyer_company_id,
        'company_kind', v_buyer_kind,
        'access', 'DRAFT',
        'approved_at', null,
        'submitted_at', null,
        'rejected_at', null,
        'rejection_reason', null,
        'driver_name', null,
        'whatsapp', null,
        'languages', '[]'::jsonb,
        'base_city', case when v_buyer_city <> '' then v_buyer_city else v.base_city end,
        'base_lat', null,
        'base_lon', null,
        'base_country', null,
        'installment_deal_id', v_deal.id,
        'installment_role', 'HELD',
        'created_at', now(),
        'updated_at', now()
      )
    )).*
    from public.vehicles v where v.id = v_listing.vehicle_id;

    /* Запись продавца: снята с работы, водитель и GPS отвязаны, номер свободен для копии покупателя. */
    update public.vehicles
    set access = 'DRAFT', installment_deal_id = v_deal.id, installment_role = 'SOLD',
        driver_name = null, whatsapp = null, updated_at = now()
    where id = v_listing.vehicle_id;
    update public.vehicle_drivers set during = tstzrange(lower(during), now())
    where vehicle_id = v_listing.vehicle_id and upper_inf(during);
    update public.gps_units set vehicle_id = null where vehicle_id = v_listing.vehicle_id;
    /* Объявления свободного места машины продавца снимаются. */
    update public.capacity_offers set status = 'WITHDRAWN', updated_at = now()
    where vehicle_id = v_listing.vehicle_id and status in ('DRAFT', 'PUBLISHED');
    /* План обслуживания (сроки ТО, katsastus, тахограф) уходит с машиной: напоминания — покупателю. */
    update public.maintenance_items set vehicle_id = v_new, company_id = v_deal.buyer_company_id
    where vehicle_id = v_listing.vehicle_id;
  else
    /*
     * Продавец без парка (23.11.2026): машина покупателя — из карточки на
     * продажу. Остальное (водитель, оснащение, размеры, место стоянки на
     * карте) покупатель заполняет сам перед отправкой на одобрение. Город
     * стоянки — город покупателя; если его нет в реквизитах — продавца.
     */
    select coalesce(c.legal_city, '') into v_seller_city from public.companies c where c.id = v_deal.seller_company_id;
    insert into public.vehicles (
      id, company_id, company_kind, plate, make, vehicle_class, euro_class, axles, payload_kg, ldm, body_type,
      base_city, access, installment_deal_id, installment_role
    )
    select
      v_new, v_deal.buyer_company_id, v_buyer_kind, sv.plate, sv.make, sv.vehicle_class, sv.euro_class, sv.axles,
      sv.payload_kg, sv.ldm,
      /* У самосвала кузов самосвальный (vehicles_tipper_shape). */
      case when sv.vehicle_class = 'TIPPER' then 'TIPPER'::public.body_type end,
      case
        when length(btrim(v_buyer_city)) >= 2 then left(btrim(v_buyer_city), 80)
        when length(btrim(v_seller_city)) >= 2 then left(btrim(v_seller_city), 80)
        else 'Suomi'
      end,
      'DRAFT'::public.vehicle_access, v_deal.id, 'HELD'
    from public.equipment_sale_vehicles sv where sv.id = v_listing.sale_vehicle_id;
    if not found then
      raise exception 'Нет машины на продажу.' using errcode = '55000';
    end if;

    /* Карточка продавца: продана по этой сделке — больше не выставить и не править. */
    update public.equipment_sale_vehicles set sold_deal_id = v_deal.id, updated_at = now()
    where id = v_listing.sale_vehicle_id;
  end if;

  update public.installment_deals
  set status = 'ACTIVE', handed_over_at = now(), buyer_vehicle_id = v_new
  where id = p_deal_id;

  return 'ACTIVE';
end;
$$;

-- ── Прекращение сделки в рассрочке ──────────────────────────────────

/*
 * Продавец записывает, что продажа в рассрочку прекращена. Как в
 * 20261126100000; для продавца без парка (23.11.2026): карточка на
 * продажу освобождается и возвращается в черновик — перед новой продажей
 * её снова проверяет оператор. План обслуживания остаётся у покупателя:
 * у продавца без парка раздела обслуживания нет.
 */
create or replace function public.terminate_installment_deal(p_deal_id uuid, p_reason text, p_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
  v_deal public.installment_deals;
  v_listing public.equipment_listings;
  v_listing_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  /* Порядок блокировок как у согласия, передачи и отмены: объявление, потом сделка. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_deal.seller_company_id <> v_me then
    raise exception 'Прекращение сделки записывает продавец.' using errcode = '42501';
  end if;
  if v_deal.status <> 'ACTIVE' then
    raise exception 'Прекратить можно только сделку в рассрочке.' using errcode = '55000';
  end if;
  if p_reason is null or p_reason not in ('REPOSSESSED', 'AGREEMENT') then
    raise exception 'Причина прекращения.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_note, '')) > 2000 then
    raise exception 'Пояснение.' using errcode = '22023';
  end if;

  /*
   * Машина не должна быть в работе у покупателя: открытые рейсы сначала
   * закрыть или переназначить — как у продавца при передаче. Свой код
   * ошибки: страница объясняет продавцу, чего ждать от покупателя.
   */
  if v_deal.buyer_vehicle_id is not null and exists (
    select 1 from public.orders o
    where o.assigned_vehicle_id = v_deal.buyer_vehicle_id
      and o.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
  ) then
    raise exception 'У машины есть открытые рейсы покупателя — их нужно закрыть или переназначить.' using errcode = '55006';
  end if;

  select * into v_listing from public.equipment_listings where id = v_deal.listing_id;

  if v_deal.buyer_vehicle_id is not null then
    /*
     * Копия у покупателя: снята с работы и больше не «куплена в рассрочку».
     * Состояние — то же, что у записи продавца после передачи: черновик с
     * отметкой SOLD (заново не одобрить, GPS не привязать, не удалить).
     * Строка остаётся: на неё ссылаются рейсы и история покупателя.
     */
    update public.vehicles
    set access = 'DRAFT', installment_role = 'SOLD', driver_name = null, whatsapp = null, updated_at = now()
    where id = v_deal.buyer_vehicle_id;
    update public.vehicle_drivers set during = tstzrange(lower(during), now())
    where vehicle_id = v_deal.buyer_vehicle_id and upper_inf(during);
    update public.gps_units set vehicle_id = null where vehicle_id = v_deal.buyer_vehicle_id;
    update public.capacity_offers set status = 'WITHDRAWN', updated_at = now()
    where vehicle_id = v_deal.buyer_vehicle_id and status in ('DRAFT', 'PUBLISHED');
    /*
     * План обслуживания возвращается с машиной: напоминания — снова продавцу.
     * Сервисную книжку каждая сторона хранит у себя. Продавцу без парка
     * возвращать некуда — план остаётся у покупателя (23.11.2026).
     */
    if v_listing.vehicle_id is not null then
      update public.maintenance_items set vehicle_id = v_listing.vehicle_id, company_id = v_deal.seller_company_id
      where vehicle_id = v_deal.buyer_vehicle_id;
    end if;
  end if;

  /*
   * Запись продавца: ровно обратное передаче — отметка «продана в
   * рассрочку» и привязка к сделке сняты. Допуск остаётся черновиком:
   * продавец отправляет машину на одобрение как любую другую.
   */
  if v_listing.vehicle_id is not null then
    update public.vehicles
    set installment_role = null, installment_deal_id = null, updated_at = now()
    where id = v_listing.vehicle_id and installment_deal_id = v_deal.id and installment_role = 'SOLD';
  else
    /* Карточка продавца без парка: снова его, черновик — на проверку перед новой продажей. */
    update public.equipment_sale_vehicles
    set sold_deal_id = null, access = 'DRAFT', approved_at = null, submitted_at = null, updated_at = now()
    where id = v_listing.sale_vehicle_id and sold_deal_id = v_deal.id;
  end if;

  /* Объявление освобождает машину: новое продавец создаст после одобрения (одна живая продажа на машину). */
  update public.equipment_listings set status = 'WITHDRAWN', updated_at = now()
  where id = v_deal.listing_id and status = 'RESERVED';

  update public.installment_deals
  set status = 'TERMINATED', terminated_at = now(), terminated_reason = p_reason, terminated_note = v_note
  where id = p_deal_id;

  return 'TERMINATED';
end;
$$;

/* Права — как были: только вошедшим пользователям. */
revoke all on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) from public, anon;
revoke all on function public.set_equipment_listing_status(uuid, text) from public, anon;
revoke all on function public.equipment_catalog() from public, anon;
revoke all on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) from public, anon;
revoke all on function public.propose_installment_terms(uuid, bigint, bigint, integer, bigint, integer, date, date) from public, anon;
revoke all on function public.accept_installment_terms(uuid, integer) from public, anon;
revoke all on function public.cancel_installment_deal(uuid) from public, anon;
revoke all on function public.my_installment_deals() from public, anon;
revoke all on function public.confirm_installment_handover(uuid, integer, text) from public, anon;
revoke all on function public.terminate_installment_deal(uuid, text, text) from public, anon;
grant execute on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) to authenticated;
grant execute on function public.set_equipment_listing_status(uuid, text) to authenticated;
grant execute on function public.equipment_catalog() to authenticated;
grant execute on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) to authenticated;
grant execute on function public.propose_installment_terms(uuid, bigint, bigint, integer, bigint, integer, date, date) to authenticated;
grant execute on function public.accept_installment_terms(uuid, integer) to authenticated;
grant execute on function public.cancel_installment_deal(uuid) to authenticated;
grant execute on function public.my_installment_deals() to authenticated;
grant execute on function public.confirm_installment_handover(uuid, integer, text) to authenticated;
grant execute on function public.terminate_installment_deal(uuid, text, text) to authenticated;
