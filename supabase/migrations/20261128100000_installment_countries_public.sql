-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники: страны, открытая страница объявлений,
-- уведомление перевозчикам о новой технике (решения владельца 23.11.2026)
--
--   · Раздел должен работать в каждой стране платформы. Какие страны
--     открыты, решает одна функция — app.installment_country_open; до
--     этого в трёх местах стояло буквальное 'FI'. Сейчас открыта только
--     Финляндия: для остальных стран ещё нет правил и договора.
--   · Сделка всегда внутри одной страны: продавец и покупатель — компании
--     одной страны. Объявления видны перевозчикам всех открытых стран,
--     со страной продавца; предложение — только в своей стране.
--   · Валюта объявления и сделки — валюта страны продавца. Ставит база
--     (не клиент), суммы между валютами не пересчитываются.
--   · Открытая страница показывает технику на продажу всем, без входа:
--     public.public_equipment_listings() отдаёт только безопасные поля —
--     без продавца, номера машины и каких-либо идентификаторов.
--   · О новом объявлении перевозчики своей страны получают уведомление в
--     кабинете — один раз на объявление и компанию.
-- ═══════════════════════════════════════════════════════════════════

-- ── Открытые страны ─────────────────────────────────────────────────

/*
 * Открыт ли раздел рассрочки компаниям этой страны.
 *
 * СПИСОК ПОВТОРЯЕТ РЕЕСТР В КОДЕ: src/lib/installments/countries.ts
 * (страны с open: true). Открываешь страну — новой миграцией переопредели
 * эту функцию и поправь реестр; расхождение ловит тест
 * src/lib/installments/countries.test.mjs.
 */
create or replace function app.installment_country_open(p_country text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select upper(coalesce(p_country, '')) in ('FI')
$$;

revoke all on function app.installment_country_open(text) from public, anon, authenticated;

/* Продавец: проверенная компания открытой страны (23.11.2026: страна — из списка, а не 'FI'). */
create or replace function app.installment_seller_ok(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company and c.status = 'ACTIVE' and app.installment_country_open(c.country::text)
      /* Записи справочника «свои клиенты» перевозчика — не участники площадки. */
      and c.client_of is null
  )
$$;

revoke all on function app.installment_seller_ok(uuid) from public, anon, authenticated;

/* Покупатель: действующий перевозчик открытой страны с лицензией и страховкой. */
create or replace function app.installment_company_ok(p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companies c
    where c.id = p_company and c.kind = 'CARRIER' and c.status = 'ACTIVE' and app.installment_country_open(c.country::text)
  ) and app.company_documents_ok(p_company)
$$;

revoke all on function app.installment_company_ok(uuid) from public, anon, authenticated;

/* Компании из одной страны: сделка в рассрочку — только внутри страны (23.11.2026). */
create or replace function app.installment_same_country(p_seller uuid, p_buyer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.country::text from public.companies c where c.id = p_seller)
    = (select c.country::text from public.companies c where c.id = p_buyer),
    false
  )
$$;

revoke all on function app.installment_same_country(uuid, uuid) from public, anon, authenticated;

-- ── Валюта объявления и сделки ──────────────────────────────────────

/*
 * У объявления столбец currency был с самого начала (всегда 'EUR'); у
 * сделки его не было. Валюта — страны продавца (app.country_currency), а
 * не рабочая валюта компании: договор и счета сделки — по правилам страны.
 */
alter table public.installment_deals
  add column currency text not null default 'EUR'
    constraint installment_deals_currency check (currency ~ '^[A-Z]{3}$');

alter table public.equipment_listings
  add constraint equipment_listings_currency check (currency ~ '^[A-Z]{3}$');

comment on column public.equipment_listings.currency is
  'Валюта страны продавца; ставит триггер equipment_listing_currency, клиент её не задаёт (23.11.2026).';
comment on column public.installment_deals.currency is
  'Валюта сделки — валюта объявления (страны продавца); ставит триггер installment_deal_currency (23.11.2026).';

/* Права на чтение обеих таблиц — на всю таблицу (20261122100000): новый столбец виден сторонам. */

create or replace function app.equipment_listing_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.currency := coalesce(
    (select app.country_currency(c.country::text)::text from public.companies c where c.id = new.seller_company_id),
    'EUR'
  );
  return new;
end;
$$;

revoke all on function app.equipment_listing_currency() from public, anon, authenticated;

create trigger equipment_listing_currency
  before insert or update of currency, seller_company_id on public.equipment_listings
  for each row execute function app.equipment_listing_currency();

create or replace function app.installment_deal_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.currency := coalesce((select l.currency from public.equipment_listings l where l.id = new.listing_id), 'EUR');
  return new;
end;
$$;

revoke all on function app.installment_deal_currency() from public, anon, authenticated;

create trigger installment_deal_currency
  before insert or update of currency, listing_id on public.installment_deals
  for each row execute function app.installment_deal_currency();

/* Существующие строки: все продавцы финские, валюта — евро; запись на случай иного. */
update public.equipment_listings l
set currency = app.country_currency(c.country::text)::text
from public.companies c
where c.id = l.seller_company_id and l.currency is distinct from app.country_currency(c.country::text)::text;

update public.installment_deals d
set currency = l.currency
from public.equipment_listings l
where l.id = d.listing_id and d.currency is distinct from l.currency;

-- ── Каталог: объявления всех открытых стран ─────────────────────────

/*
 * Каталог для покупателя (действующий перевозчик открытой страны с
 * документами). С 23.11.2026 — объявления всех открытых стран со страной
 * продавца; same_country — можно ли сделать предложение (сделка только
 * внутри страны). Состав столбцов изменился — функция создаётся заново.
 */
drop function public.equipment_catalog();

create function public.equipment_catalog()
returns table (
  listing_id uuid,
  seller_name text,
  seller_city text,
  seller_country text,
  same_country boolean,
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
    select c.id, c.is_test, c.country::text as country from public.companies c
    where c.id = (select app.current_company_id())
      and c.kind = 'CARRIER' and c.status = 'ACTIVE' and app.installment_country_open(c.country::text)
      and app.company_documents_ok(c.id)
  )
  /* Машина — из парка продавца или из его карточки на продажу. */
  select l.id, coalesce(s.legal_name, s.name), coalesce(s.legal_city, v.base_city),
         s.country::text, s.country::text = me.country,
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
    and s.client_of is null and app.installment_country_open(s.country::text)
  left join public.vehicles v on v.id = l.vehicle_id
  left join public.equipment_sale_vehicles sv on sv.id = l.sale_vehicle_id
  /* Сначала своя страна: там можно сделать предложение. */
  order by (s.country::text = me.country) desc, l.published_at desc;
$$;

revoke all on function public.equipment_catalog() from public, anon;
grant execute on function public.equipment_catalog() to authenticated;

-- ── Сделка: только внутри одной страны ──────────────────────────────

/*
 * Предложение покупателя по объявлению — как в 20261127100000, плюс
 * правило 23.11.2026: покупатель и продавец из одной страны. Свой код
 * ошибки RC001 — страница объясняет отказ на языке читающего.
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
  if not app.installment_same_country(v_listing.seller_company_id, v_me) then
    raise exception 'Сделка в рассрочку — только между компаниями одной страны.' using errcode = 'RC001';
  end if;
  if v_listing.vat_mode <> 'STANDARD' then
    raise exception 'Объявление со старым режимом НДС — продавец должен сохранить его заново.' using errcode = '55000';
  end if;
  perform app.installment_terms_ok(p_price_cents, v_listing.vat_mode, v_listing.vat_bps, p_down_payment_cents, p_months, p_final_cents, p_annual_rate_bps);
  /* Передача не раньше завтрашнего дня: первый счёт должен успеть стать «до передачи». */
  if p_handover_date is null or p_handover_date <= app.helsinki_today() or p_first_due_date is null or p_first_due_date <= p_handover_date then
    raise exception 'Даты.' using errcode = '22023';
  end if;

  /* Валюту сделки ставит триггер installment_deal_currency — из объявления. */
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
 * Принять условия другой стороны — как в 20261127100000, плюс правило
 * 23.11.2026: на момент согласия стороны по-прежнему из одной страны
 * (компания могла сменить страну после начала переговоров).
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
    raise exception 'Продаёт проверенная компания открытой страны, покупает действующий перевозчик с выпиской из реестра и страховкой.' using errcode = '42501';
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
  /* Вторая сторона тоже должна быть в порядке на момент согласия; обе — из одной страны. */
  if not app.installment_seller_ok(v_deal.seller_company_id) or not app.installment_company_ok(v_deal.buyer_company_id)
     or not app.installment_same_country(v_deal.seller_company_id, v_deal.buyer_company_id)
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

revoke all on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) from public, anon;
revoke all on function public.accept_installment_terms(uuid, integer) from public, anon;
grant execute on function public.start_installment_deal(uuid, bigint, bigint, integer, bigint, integer, date, date) to authenticated;
grant execute on function public.accept_installment_terms(uuid, integer) to authenticated;

-- ── Сделки компании: с валютой ──────────────────────────────────────

/* Как в 20261127100000, плюс валюта сделки (23.11.2026). Состав столбцов изменился — функция создаётся заново. */
drop function public.my_installment_deals();

create function public.my_installment_deals()
returns table (
  deal_id uuid,
  role text,
  counterparty_name text,
  make text,
  vehicle_class text,
  plate text,
  status text,
  price_cents bigint,
  currency text,
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
         coalesce(d.vehicle_snapshot->>'plate', v.plate, sv.plate), d.status, d.price_cents, d.currency, d.months,
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

revoke all on function public.my_installment_deals() from public, anon;
grant execute on function public.my_installment_deals() to authenticated;

-- ── Открытая страница объявлений ────────────────────────────────────

/*
 * Техника на продажу для открытой страницы сайта — всем, без входа.
 * Только безопасные поля: марка и модель, класс, пробег, цена без НДС в
 * валюте объявления, взнос, срок, страна и день публикации. НЕТ продавца,
 * контактов, номера машины, описания (свободный текст продавца) и
 * никаких идентификаторов — по ответу нельзя перебрать компании.
 * Только опубликованные объявления проверенных не тестовых продавцов
 * открытых стран. Не больше 300 строк.
 */
create or replace function public.public_equipment_listings()
returns table (
  make text,
  vehicle_class text,
  odometer_km integer,
  price_cents bigint,
  currency text,
  down_payment_cents bigint,
  months smallint,
  country text,
  published_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(v.make, sv.make), coalesce(v.vehicle_class, sv.vehicle_class)::text, l.odometer_km,
         l.price_cents, l.currency, l.down_payment_cents, l.months, s.country::text,
         (l.published_at at time zone 'UTC')::date
  from public.equipment_listings l
  join public.companies s on s.id = l.seller_company_id
    and s.status = 'ACTIVE' and not s.is_test and s.client_of is null
    and app.installment_country_open(s.country::text)
  left join public.vehicles v on v.id = l.vehicle_id
  left join public.equipment_sale_vehicles sv on sv.id = l.sale_vehicle_id
  where l.status = 'PUBLISHED' and l.vat_mode = 'STANDARD' and coalesce(v.id, sv.id) is not null
  order by l.published_at desc nulls last
  limit 300;
$$;

revoke all on function public.public_equipment_listings() from public;
grant execute on function public.public_equipment_listings() to anon, authenticated, service_role;

comment on function public.public_equipment_listings() is
  'Объявления о продаже техники в рассрочку для открытой страницы сайта: без продавца, номера машины и идентификаторов (23.11.2026).';

-- ── Уведомление перевозчикам о новом объявлении ─────────────────────

/*
 * Кому о каком объявлении уже сказано. Строка — навсегда: снятие и
 * повторная публикация того же объявления второй раз никого не уведомят.
 * Читает и пишет только функция ниже; пользователям таблица закрыта.
 */
create table public.equipment_listing_announcements (
  listing_id uuid not null references public.equipment_listings (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  announced_at timestamptz not null default now(),
  primary key (listing_id, company_id)
);

comment on table public.equipment_listing_announcements is
  'Какой компании о каком объявлении рассрочки уже отправлено уведомление (23.11.2026): одно на объявление и компанию.';

alter table public.equipment_listing_announcements enable row level security;
revoke all on public.equipment_listing_announcements from public, anon, authenticated;

/*
 * Уведомить перевозчиков об опубликованном объявлении: каждый, кто может
 * его купить (та же страна, проверен, действующие лицензия и страховка,
 * тот же признак тестовой компании, не сам продавец), получает ОДНО
 * уведомление в кабинете — код installment.new_listing, текст собирается
 * на языке читающего. За вызов — не больше p_limit компаний (до 500):
 * сервер вызывает функцию, пока она возвращает полную порцию. Отметка и
 * уведомление пишутся одним запросом: повтор и параллельный вызов никого
 * не уведомят дважды. Вызывает только сервер (service_role) после
 * публикации; действие продавца от неё не зависит.
 */
create or replace function public.announce_equipment_listing(p_listing_id uuid, p_limit integer default 200)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.equipment_listings;
  v_country text;
  v_is_test boolean;
  v_make text;
  v_class text;
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_count integer;
begin
  select * into v_listing from public.equipment_listings where id = p_listing_id and status = 'PUBLISHED';
  if v_listing.id is null or not app.installment_seller_ok(v_listing.seller_company_id) then
    return 0;
  end if;
  select c.country::text, c.is_test into v_country, v_is_test
  from public.companies c where c.id = v_listing.seller_company_id;
  select coalesce(v.make, sv.make), coalesce(v.vehicle_class, sv.vehicle_class)::text into v_make, v_class
  from (select 1) as one
  left join public.vehicles v on v.id = v_listing.vehicle_id
  left join public.equipment_sale_vehicles sv on sv.id = v_listing.sale_vehicle_id;
  if v_make is null then
    return 0;
  end if;

  with picked as (
    select c.id
    from public.companies c
    where c.kind = 'CARRIER' and c.status = 'ACTIVE' and c.client_of is null
      and c.country::text = v_country and c.is_test = v_is_test
      and c.id <> v_listing.seller_company_id
      and app.company_documents_ok(c.id)
      and not exists (
        select 1 from public.equipment_listing_announcements a
        where a.listing_id = p_listing_id and a.company_id = c.id
      )
    order by c.id
    limit v_limit
  ),
  marked as (
    insert into public.equipment_listing_announcements (listing_id, company_id)
    select p_listing_id, picked.id from picked
    on conflict do nothing
    returning company_id
  ),
  sent as (
    insert into public.notifications (company_id, kind, code, params, link)
    select marked.company_id, 'BILLING'::public.notification_kind, 'installment.new_listing',
           jsonb_build_object(
             'make', v_make, 'vehicleClass', v_class, 'priceCents', v_listing.price_cents,
             'currency', v_listing.currency, 'months', v_listing.months, 'country', v_country
           ),
           '/carrier/installments?tab=catalog'
    from marked
    returning 1
  )
  select count(*)::integer into v_count from sent;
  return v_count;
end;
$$;

revoke all on function public.announce_equipment_listing(uuid, integer) from public, anon, authenticated;
grant execute on function public.announce_equipment_listing(uuid, integer) to service_role;
