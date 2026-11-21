-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · продажа техники в рассрочку, этап 2 (22.11.2026)
--
-- Компания-продавец (перевозчик, уходящий на пенсию) выставляет свой тягач
-- или грузовик на продажу в рассрочку; проверенный перевозчик находит его
-- в каталоге и предлагает условия; стороны согласуют их по очереди. После
-- согласия RAHTIS даёт договор рассрочки (osamaksusopimus, закон 91/1966)
-- и первый счёт продавца: весь НДС + первоначальный взнос.
--
-- RAHTIS не сторона договора и денег не проводит. Продавец и покупатель —
-- только компании с действующими лицензией и страховкой
-- (app.company_documents_ok); тестовые компании видят только тестовые
-- объявления. Решения и источники: docs/equipment-sale/.
--
-- Этап 3 (передача машины, ежемесячные счета, просрочки) — отдельно.
-- ═══════════════════════════════════════════════════════════════════

create table public.equipment_listings (
  id uuid primary key default gen_random_uuid(),
  seller_company_id uuid not null references public.companies (id) on delete cascade,
  /* Restrict: машину с объявлением удалить нельзя — сделка по ней не должна пропасть (ревью 22.11.2026). */
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  status text not null default 'DRAFT'
    constraint equipment_listings_status check (status in ('DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD', 'WITHDRAWN')),
  /* Условия, которые продавец предлагает по умолчанию; покупатель может предложить свои. */
  price_cents bigint not null constraint equipment_listings_price check (price_cents > 0),
  currency text not null default 'EUR',
  vat_mode text not null default 'STANDARD'
    constraint equipment_listings_vat_mode check (vat_mode in ('STANDARD', 'MARGIN', 'EXEMPT', 'NONE')),
  vat_bps integer not null constraint equipment_listings_vat_bps check (vat_bps between 0 and 3000),
  down_payment_cents bigint not null default 0,
  months smallint not null constraint equipment_listings_months check (months between 1 and 120),
  final_cents bigint,
  annual_rate_bps integer not null default 0 constraint equipment_listings_rate check (annual_rate_bps between 0 and 5000),
  odometer_km integer constraint equipment_listings_odometer check (odometer_km between 0 and 9999999),
  description text not null default '' constraint equipment_listings_description check (length(description) <= 4000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_listings_down check (down_payment_cents >= 0 and down_payment_cents < price_cents),
  constraint equipment_listings_final check (final_cents is null or (final_cents > 0 and final_cents < price_cents - down_payment_cents))
);

/* Одна живая продажа на машину. */
create unique index equipment_listings_vehicle_live
  on public.equipment_listings (vehicle_id) where status in ('DRAFT', 'PUBLISHED', 'RESERVED');
create index equipment_listings_published on public.equipment_listings (published_at desc) where status = 'PUBLISHED';

comment on table public.equipment_listings is
  'Объявления о продаже техники в рассрочку (22.11.2026). Каталог для покупателей — public.equipment_catalog().';

create sequence public.installment_contract_seq;

create table public.installment_deals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.equipment_listings (id) on delete restrict,
  seller_company_id uuid not null references public.companies (id) on delete cascade,
  buyer_company_id uuid not null references public.companies (id) on delete cascade,
  status text not null default 'NEGOTIATING'
    constraint installment_deals_status check (status in ('NEGOTIATING', 'AGREED', 'CANCELLED')),
  /* Текущие условия: последнее предложение или согласованные. */
  price_cents bigint not null constraint installment_deals_price check (price_cents > 0),
  vat_mode text not null constraint installment_deals_vat_mode check (vat_mode in ('STANDARD', 'MARGIN', 'EXEMPT', 'NONE')),
  vat_bps integer not null constraint installment_deals_vat_bps check (vat_bps between 0 and 3000),
  down_payment_cents bigint not null,
  months smallint not null constraint installment_deals_months check (months between 1 and 120),
  final_cents bigint,
  annual_rate_bps integer not null constraint installment_deals_rate check (annual_rate_bps between 0 and 5000),
  handover_date date not null,
  first_due_date date not null,
  /* Кто предложил текущие условия и какая это версия: принять можно только увиденную. */
  proposed_by uuid not null references public.companies (id) on delete cascade,
  version integer not null default 1,
  proposed_at timestamptz not null default now(),
  agreed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.companies (id) on delete set null,
  contract_number text unique,
  /* Снимки: машина — при предложении, стороны — при согласии. Договор не меняется от правок карточек. */
  vehicle_snapshot jsonb not null default '{}'::jsonb,
  parties_snapshot jsonb,
  first_invoice_id uuid references public.carrier_invoices (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint installment_deals_parties check (seller_company_id <> buyer_company_id),
  constraint installment_deals_down check (down_payment_cents >= 0 and down_payment_cents < price_cents),
  constraint installment_deals_final check (final_cents is null or (final_cents > 0 and final_cents < price_cents - down_payment_cents)),
  constraint installment_deals_dates check (first_due_date > handover_date)
);

/* Одна открытая сделка покупателя по объявлению. */
create unique index installment_deals_open
  on public.installment_deals (listing_id, buyer_company_id) where status = 'NEGOTIATING';
create index installment_deals_seller on public.installment_deals (seller_company_id, created_at desc);
create index installment_deals_buyer on public.installment_deals (buyer_company_id, created_at desc);

comment on table public.installment_deals is
  'Сделки рассрочки: согласование условий по очереди (version), договор и первый счёт после согласия (22.11.2026).';

alter table public.equipment_listings enable row level security;
alter table public.installment_deals enable row level security;

create policy equipment_listings_own on public.equipment_listings
  for select to authenticated
  using (seller_company_id = (select app.current_company_id()) or (select app.is_admin()));

create policy installment_deals_parties on public.installment_deals
  for select to authenticated
  using (
    seller_company_id = (select app.current_company_id())
    or buyer_company_id = (select app.current_company_id())
    or (select app.is_admin())
  );

grant select on public.equipment_listings, public.installment_deals to authenticated;

alter table public.carrier_invoices drop constraint carrier_invoices_kind;
alter table public.carrier_invoices
  add constraint carrier_invoices_kind check (kind in ('SITE', 'FREIGHT', 'INSTALLMENT'));

/* Первый счёт продавца покупатель видит как заказчик счёта (политика carrier_invoices_customer). */

-- ── Проверки ─────────────────────────────────────────────────────────

/* Сегодня по Хельсинки: даты договора — по финскому календарю. */
create or replace function app.helsinki_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Europe/Helsinki')::date $$;

/*
 * Может ли компания участвовать в сделке: действующий перевозчик с
 * документами. Этап 2 — только Финляндия: договор по финскому закону о
 * рассрочке и финскому НДС; между странами нужен другой НДС (ревью).
 */
create or replace function app.installment_company_ok(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company and c.kind = 'CARRIER' and c.status = 'ACTIVE' and c.country::text = 'FI'
  ) and app.company_documents_ok(p_company)
$$;

revoke all on function app.installment_company_ok(uuid) from public, anon, authenticated;

/* Главный в действующей компании-перевозчике с документами — иначе ошибка. */
create or replace function app.installment_party()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
begin
  if v_me is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;
  if not (select app.is_company_owner()) then
    raise exception 'Продажу и покупку техники оформляет главный в компании.' using errcode = '42501';
  end if;
  if not app.installment_company_ok(v_me) then
    raise exception 'Только действующий перевозчик из Финляндии с выпиской из реестра и страховкой.' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

revoke all on function app.installment_party() from public, anon, authenticated;

/* Условия в допустимых пределах (те же, что у калькулятора, src/lib/installments/calc.ts). */
create or replace function app.installment_terms_ok(
  p_price bigint, p_vat_mode text, p_vat_bps integer, p_down bigint, p_months integer,
  p_final bigint, p_rate integer
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_price is null or p_price <= 0 then raise exception 'Цена.' using errcode = '22023'; end if;
  if p_vat_mode not in ('STANDARD', 'MARGIN', 'EXEMPT', 'NONE') then raise exception 'НДС.' using errcode = '22023'; end if;
  if p_vat_bps is null or p_vat_bps not between 0 and 3000 then raise exception 'Ставка НДС.' using errcode = '22023'; end if;
  if p_down is null or p_down < 0 or p_down >= p_price then raise exception 'Взнос.' using errcode = '22023'; end if;
  if p_months is null or p_months not between 1 and 120 then raise exception 'Срок.' using errcode = '22023'; end if;
  /* Как калькулятор: при одном взносе отдельного последнего нет; остальные взносы — не меньше цента. */
  if p_final is not null and (p_months = 1 or p_final <= 0 or p_final >= p_price - p_down or p_price - p_down - p_final < p_months - 1) then
    raise exception 'Последний взнос.' using errcode = '22023';
  end if;
  if p_rate is null or p_rate not between 0 and 5000 then raise exception 'Проценты.' using errcode = '22023'; end if;
end;
$$;

-- ── Объявления (продавец) ────────────────────────────────────────────

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
  v_me uuid := app.installment_party();
  v_vat_bps integer;
  v_id uuid;
begin
  if not exists (select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = v_me and v.access = 'APPROVED') then
    raise exception 'Машина не из вашего парка или не одобрена.' using errcode = '42501';
  end if;
  /* Машину и пробег нельзя менять, пока идут переговоры: покупатель видел другое. */
  if p_id is not null and exists (
    select 1 from public.equipment_listings l
    where l.id = p_id and (l.vehicle_id <> p_vehicle_id or l.odometer_km is distinct from p_odometer_km)
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
      seller_company_id, vehicle_id, price_cents, vat_mode, vat_bps, down_payment_cents, months,
      final_cents, annual_rate_bps, odometer_km, description
    )
    values (
      v_me, p_vehicle_id, p_price_cents, p_vat_mode, v_vat_bps, p_down_payment_cents, p_months,
      p_final_cents, p_annual_rate_bps, p_odometer_km, coalesce(p_description, '')
    )
    returning id into v_id;
  else
    update public.equipment_listings
    set vehicle_id = p_vehicle_id, price_cents = p_price_cents, vat_mode = p_vat_mode, vat_bps = v_vat_bps,
        down_payment_cents = p_down_payment_cents, months = p_months, final_cents = p_final_cents,
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

/* Опубликовать или снять. Снятие закрывает открытые переговоры. */
create or replace function public.set_equipment_listing_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
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

-- ── Каталог (покупатель) ─────────────────────────────────────────────

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
  with me as (
    select c.id, c.is_test from public.companies c
    where c.id = (select app.current_company_id())
      and c.kind = 'CARRIER' and c.status = 'ACTIVE'
      and app.company_documents_ok(c.id)
  )
  select l.id, coalesce(s.legal_name, s.name), coalesce(s.legal_city, v.base_city),
         v.make, v.vehicle_class::text, v.plate, v.euro_class::text, v.axles::smallint, l.odometer_km,
         l.price_cents, l.currency, l.vat_mode, l.vat_bps, l.down_payment_cents, l.months, l.final_cents,
         l.annual_rate_bps, l.description, l.published_at,
         (select d.id from public.installment_deals d
          where d.listing_id = l.id and d.buyer_company_id = me.id and d.status <> 'CANCELLED'
          order by d.created_at desc limit 1)
  from me
  join public.equipment_listings l on l.status = 'PUBLISHED' and l.seller_company_id <> me.id
  join public.companies s on s.id = l.seller_company_id and s.is_test = me.is_test and s.status = 'ACTIVE'
  join public.vehicles v on v.id = l.vehicle_id
  order by l.published_at desc;
$$;

-- ── Сделка: начать, предложить, принять, отменить ────────────────────

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
  if not app.installment_company_ok(v_listing.seller_company_id) then
    raise exception 'Объявление недоступно.' using errcode = '55000';
  end if;
  if (select is_test from public.companies where id = v_me)
     is distinct from (select is_test from public.companies where id = v_listing.seller_company_id) then
    raise exception 'Объявление недоступно.' using errcode = '55000';
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
    jsonb_build_object('make', v.make, 'plate', v.plate, 'vehicle_class', v.vehicle_class::text, 'odometer_km', v_listing.odometer_km)
  from public.vehicles v where v.id = v_listing.vehicle_id
  returning id into v_id;
  return v_id;
end;
$$;

/* Встречное предложение любой стороны: заменяет текущие условия, версия +1. */
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
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
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
 * переговоры по нему закрыты.
 */
create or replace function public.accept_installment_terms(p_deal_id uuid, p_version integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
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
  if not app.installment_company_ok(v_deal.seller_company_id) or not app.installment_company_ok(v_deal.buyer_company_id)
     or (select is_test from public.companies where id = v_deal.seller_company_id)
        is distinct from (select is_test from public.companies where id = v_deal.buyer_company_id) then
    raise exception 'Сторона сделки сейчас не может её заключить.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.equipment_listings where id = v_deal.listing_id and status = 'PUBLISHED') then
    raise exception 'Объявление уже недоступно.' using errcode = '55000';
  end if;

  v_number := 'OS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.installment_contract_seq')::text, 5, '0');

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
 * Отменить переговоры (любая сторона) или согласованную сделку до
 * передачи машины (этап 2: передачи ещё нет). Объявление возвращается в
 * каталог.
 */
create or replace function public.cancel_installment_deal(p_deal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
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

/* Сделки компании с карточкой машины и названием второй стороны — для кабинета. */
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
         coalesce(d.vehicle_snapshot->>'make', v.make), coalesce(d.vehicle_snapshot->>'vehicle_class', v.vehicle_class::text),
         coalesce(d.vehicle_snapshot->>'plate', v.plate), d.status, d.price_cents, d.months,
         d.proposed_by = (select app.current_company_id()), d.contract_number, d.proposed_at
  from public.installment_deals d
  join public.equipment_listings l on l.id = d.listing_id
  join public.vehicles v on v.id = l.vehicle_id
  join public.companies o on o.id = case
    when d.seller_company_id = (select app.current_company_id()) then d.buyer_company_id
    else d.seller_company_id end
  where (select app.current_company_id()) in (d.seller_company_id, d.buyer_company_id)
  order by d.proposed_at desc;
$$;

revoke all on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) from public, anon;
revoke all on function public.set_equipment_listing_status(uuid, text) from public, anon;
revoke all on function public.equipment_catalog() from public, anon;
revoke all on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) from public, anon;
revoke all on function public.propose_installment_terms(uuid, bigint, bigint, integer, bigint, integer, date, date) from public, anon;
revoke all on function public.accept_installment_terms(uuid, integer) from public, anon;
revoke all on function public.cancel_installment_deal(uuid) from public, anon;
revoke all on function public.my_installment_deals() from public, anon;
grant execute on function public.save_equipment_listing(uuid, uuid, bigint, text, bigint, integer, bigint, integer, integer, text) to authenticated;
grant execute on function public.set_equipment_listing_status(uuid, text) to authenticated;
grant execute on function public.equipment_catalog() to authenticated;
grant execute on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) to authenticated;
grant execute on function public.propose_installment_terms(uuid, bigint, bigint, integer, bigint, integer, date, date) to authenticated;
grant execute on function public.accept_installment_terms(uuid, integer) to authenticated;
grant execute on function public.cancel_installment_deal(uuid) to authenticated;
grant execute on function public.my_installment_deals() to authenticated;
