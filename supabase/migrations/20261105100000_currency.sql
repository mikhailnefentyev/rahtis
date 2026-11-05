-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · своя валюта компании
--
-- Решения пользователя 5.11.2026:
--   - Деньги платформы (стол «RAHTIS-palvelu», подряд, сборы, счета
--     Aivomaa, претензии к Aivomaa) — только евро, как и раньше.
--   - Деньги самого перевозчика (свои рейсы, доходность машин, расходы,
--     топливо, зарплата, объекты и счета своим клиентам) — в рабочей
--     валюте компании: EUR, SEK, NOK, DKK, PLN.
--   - Прямой заказ «напрямую с перевозчиком» (desk_contract = CARRIER):
--     валюту выбирает заказчик.
--   - Топливо — в валюте чека; итоги пересчитываются в валюту компании
--     по курсу ЕЦБ на день записи.
--   - Компания может сменить валюту: каждая сумма хранит свою валюту,
--     история не переписывается.
--
-- Поэтому валюта живёт в каждой денежной строке (currency), а
-- companies.currency — только то, что подставляется в новые записи.
-- Курсы — справочник ЕЦБ (fx_rates, сколько единиц валюты за 1 €).
-- ═══════════════════════════════════════════════════════════════════

create domain public.currency_code as text
  check (value in ('EUR', 'SEK', 'NOK', 'DKK', 'PLN'));

comment on domain public.currency_code is
  'Валюты платформы. Деньги RAHTIS — всегда EUR; остальные — рабочие валюты перевозчиков и заказчиков.';


-- ── Курсы ЕЦБ ──────────────────────────────────────────────────────

create table public.fx_rates (
  day date not null,
  currency public.currency_code not null,
  per_eur numeric(14, 6) not null check (per_eur > 0),
  fetched_at timestamptz not null default now(),
  primary key (day, currency),
  constraint fx_rates_not_eur check (currency <> 'EUR')
);

comment on table public.fx_rates is
  'Справочные курсы ЕЦБ: сколько единиц валюты за 1 €. Пишет ежедневная загрузка (/api/fx), читают все.';

alter table public.fx_rates enable row level security;
revoke all on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to authenticated;
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);


/* Курс на день: последний опубликованный не позже этого дня (выходные и праздники ЕЦБ). */
create or replace function app.fx_per_eur(p_currency text, p_day date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(p_currency, 'EUR') = 'EUR' then 1::numeric
    else coalesce(
      (select r.per_eur from public.fx_rates r
        where r.currency = p_currency and r.day <= coalesce(p_day, current_date)
        order by r.day desc limit 1),
      /* Дата раньше всей истории — ближайший известный курс, а не пустота. */
      (select r.per_eur from public.fx_rates r
        where r.currency = p_currency
        order by r.day asc limit 1)
    )
  end;
$$;

/*
 * Пересчёт суммы в центах между валютами через евро.
 * Курса нет совсем (справочник пуст) — null: лучше пустая клетка, чем
 * злотые, сложенные с евро как равные.
 */
create or replace function app.fx_convert(p_cents bigint, p_from text, p_to text, p_day date)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_cents is null then null
    when coalesce(p_from, 'EUR') = coalesce(p_to, 'EUR') then p_cents
    else round(p_cents::numeric / app.fx_per_eur(p_from, p_day) * app.fx_per_eur(p_to, p_day))::bigint
  end;
$$;

revoke all on function app.fx_per_eur(text, date) from public, anon;
revoke all on function app.fx_convert(bigint, text, text, date) from public, anon;
grant execute on function app.fx_per_eur(text, date) to authenticated, service_role;
grant execute on function app.fx_convert(bigint, text, text, date) to authenticated, service_role;


-- ── Валюта компании ────────────────────────────────────────────────

alter table public.companies
  add column currency public.currency_code not null default 'EUR';

comment on column public.companies.currency is
  'Рабочая валюта компании: подставляется в новые суммы перевозчика (свои рейсы, расходы, топливо, зарплата, объекты). Деньги RAHTIS — всегда EUR.';

create or replace function app.country_currency(p_country text)
returns public.currency_code
language sql
immutable
set search_path = ''
as $$
  select (case upper(coalesce(p_country, ''))
    when 'SE' then 'SEK'
    when 'NO' then 'NOK'
    when 'DK' then 'DKK'
    when 'PL' then 'PLN'
    else 'EUR'
  end)::public.currency_code;
$$;

/* Только там, где валюта не евро: остальным updated_at трогать незачем. */
update public.companies set currency = app.country_currency(country)
where app.country_currency(country) <> 'EUR';

/* Новая компания получает валюту своей страны; выбрать другую можно в настройках. */
create or replace function app.company_currency_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.currency = 'EUR' then
      new.currency := app.country_currency(new.country);
    end if;
  elsif new.country is distinct from old.country and new.currency = app.country_currency(old.country) then
    /* Страну поправили при заполнении реквизитов — валюта следует, если её не выбирали руками. */
    new.currency := app.country_currency(new.country);
  end if;
  return new;
end;
$$;

revoke all on function app.company_currency_default() from public, anon, authenticated;

create trigger companies_currency_default
  before insert or update of country on public.companies
  for each row execute function app.company_currency_default();

grant update (currency) on public.companies to authenticated;

create or replace function app.company_currency(p_company_id uuid)
returns public.currency_code
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.currency from public.companies c where c.id = p_company_id), 'EUR')::public.currency_code;
$$;

revoke all on function app.company_currency(uuid) from public, anon;
grant execute on function app.company_currency(uuid) to authenticated, service_role;


-- ── Валюта в денежных строках перевозчика ──────────────────────────

/*
 * Общий триггер: пустая валюта строки = валюта компании из колонки,
 * названной в аргументе. Записанная валюта не трогается.
 */
create or replace function app.fill_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_company uuid;
begin
  if nullif(v_row ->> 'currency', '') is not null then
    return new;
  end if;
  v_company := nullif(v_row ->> tg_argv[0], '')::uuid;
  new := jsonb_populate_record(new, jsonb_build_object('currency', app.company_currency(v_company)));
  return new;
end;
$$;

revoke all on function app.fill_currency() from public, anon, authenticated;

/*
 * Всё, что записано до сегодня, — в евро: другой валюты в системе не было.
 * Значение по умолчанию ставится на время добавления колонки и сразу
 * снимается: без UPDATE по живым строкам (их триггеры не трогаются), а
 * новые строки без валюты дальше заполняет триггер компании.
 */
alter table public.vehicle_finance add column currency public.currency_code not null default 'EUR';
alter table public.vehicle_finance alter column currency drop default;
alter table public.vehicle_costs add column currency public.currency_code not null default 'EUR';
alter table public.vehicle_costs alter column currency drop default;
alter table public.fuel_entries add column currency public.currency_code not null default 'EUR';
alter table public.fuel_entries alter column currency drop default;
alter table public.site_jobs add column currency public.currency_code not null default 'EUR';
alter table public.site_jobs alter column currency drop default;
alter table public.carrier_invoices add column currency public.currency_code not null default 'EUR';
alter table public.carrier_invoices alter column currency drop default;
alter table public.driver_pay_profiles add column currency public.currency_code not null default 'EUR';
alter table public.driver_pay_profiles alter column currency drop default;
alter table public.tes_rule_sets add column currency public.currency_code not null default 'EUR';
alter table public.tes_rule_sets alter column currency drop default;

create trigger vehicle_finance_currency before insert on public.vehicle_finance
  for each row execute function app.fill_currency('company_id');
create trigger vehicle_costs_currency before insert on public.vehicle_costs
  for each row execute function app.fill_currency('company_id');
create trigger fuel_entries_currency before insert on public.fuel_entries
  for each row execute function app.fill_currency('company_id');
/*
 * Шаблоны TES оператора (company_id is null) — финские, в евро. Копия
 * шаблона (based_on) остаётся в валюте шаблона: финские евро под знаком
 * злотого были бы неправдой. Свой набор с нуля — в валюте компании.
 */
create or replace function app.fill_tes_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null then
    new.currency := coalesce(
      (select r.currency from public.tes_rule_sets r where r.id = new.based_on),
      app.company_currency(new.company_id)
    );
  end if;
  return new;
end;
$$;

revoke all on function app.fill_tes_currency() from public, anon, authenticated;

create trigger tes_rule_sets_currency before insert on public.tes_rule_sets
  for each row execute function app.fill_tes_currency();

/* Ставка водителя — в валюте его компании. */
create or replace function app.fill_pay_profile_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null then
    new.currency := coalesce(
      (select r.currency from public.tes_rule_sets r where r.id = new.tes_rule_set_id),
      app.company_currency((select d.company_id from public.drivers d where d.id = new.driver_id))
    );
  end if;
  return new;
end;
$$;

revoke all on function app.fill_pay_profile_currency() from public, anon, authenticated;

create trigger driver_pay_profiles_currency before insert on public.driver_pay_profiles
  for each row execute function app.fill_pay_profile_currency();

/* Объект из самосвального заказа — в валюте заказа; свой объект — в валюте компании. */
create or replace function app.fill_site_job_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is not null then
    new.currency := (select o.currency from public.orders o where o.id = new.order_id);
  end if;
  if new.currency is null then
    new.currency := app.company_currency(new.company_id);
  end if;
  return new;
end;
$$;

revoke all on function app.fill_site_job_currency() from public, anon, authenticated;

create trigger site_jobs_currency before insert on public.site_jobs
  for each row execute function app.fill_site_job_currency();

/* Счёт своему клиенту — в валюте объекта. */
create or replace function app.fill_carrier_invoice_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency is null then
    new.currency := coalesce(
      (select j.currency from public.site_jobs j where j.id = new.job_id),
      app.company_currency(new.company_id)
    );
  end if;
  return new;
end;
$$;

revoke all on function app.fill_carrier_invoice_currency() from public, anon, authenticated;

create trigger carrier_invoices_currency before insert on public.carrier_invoices
  for each row execute function app.fill_carrier_invoice_currency();


-- ── Валюта заказа ──────────────────────────────────────────────────

alter table public.orders
  add column currency public.currency_code not null default 'EUR';

comment on column public.orders.currency is
  'Валюта цены рейса. Не EUR — только у своего рейса перевозчика и у заказа «напрямую с перевозчиком» (desk_contract = CARRIER); рейс по договору RAHTIS — всегда EUR.';

/* Колонки orders открыты поколоночно (см. 20261028234000_orders_select_new_columns). */
grant select (currency) on public.orders to authenticated;

/*
 * Валюта при создании.
 *
 * create_order_for собирает вставку из jsonb по списку колонок, и
 * переписывать его ради одной колонки — значит тащить копию на 250
 * строк. Вместо этого обёртки кладут выбранную валюту в настройку
 * транзакции rahtis.order_currency, а этот триггер её читает. Без
 * выбора: свой рейс — в валюте перевозчика, остальное — в евро.
 */
create or replace function app.order_currency_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested text := nullif(current_setting('rahtis.order_currency', true), '');
  v_client_of uuid;
begin
  select c.client_of into v_client_of from public.companies c where c.id = new.shipper_company_id;

  if v_client_of is not null then
    new.currency := coalesce(v_requested, app.company_currency(v_client_of))::public.currency_code;
  else
    new.currency := coalesce(v_requested, 'EUR')::public.currency_code;
  end if;
  return new;
end;
$$;

revoke all on function app.order_currency_fill() from public, anon, authenticated;

create trigger orders_currency_fill
  before insert on public.orders
  for each row execute function app.order_currency_fill();

/*
 * Деньги RAHTIS — только в евро.
 *
 * Имя с «zz»: BEFORE-триггеры идут по алфавиту, и проверка должна
 * видеть сторону договора, которую уже проставил
 * orders_stamp_contract_party.
 */
create or replace function app.order_currency_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.currency = 'EUR' then
    return new;
  end if;

  if not app.is_carrier_client(new.shipper_company_id) and new.desk_contract <> 'CARRIER' then
    raise exception 'Цена в другой валюте — только у заказа «напрямую с перевозчиком». Через RAHTIS — в евро.'
      using errcode = '22023';
  end if;

  if new.assigned_company_id is not null and new.contract_party = 'RAHTIS' then
    raise exception 'Этот перевозчик работает через RAHTIS — цена рейса только в евро.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function app.order_currency_guard() from public, anon, authenticated;

create trigger orders_zz_currency_guard
  before insert or update of currency, desk_contract, assigned_company_id, chosen_offer_id, contract_party
  on public.orders
  for each row execute function app.order_currency_guard();


/* Обёртки создания: выбранная валюта — в настройку транзакции. */
create or replace function public.create_order(p_order jsonb, p_stops jsonb, p_publish boolean default true)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  select * into v_company
  from public.companies
  where id = (select app.current_company_id());

  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;

  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.'
      using errcode = '55000';
  end if;

  perform set_config('rahtis.order_currency', coalesce(nullif(upper(p_order ->> 'currency'), ''), ''), true);
  return app.create_order_for(v_company.id, p_order, p_stops, p_publish, null);
end;
$$;


-- ── Свой рейс: валюта перевозчика или выбранная ───────────────────

create or replace function public.carrier_create_own_order(
  p_client jsonb, p_order jsonb, p_stops jsonb, p_vehicle_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carrier public.companies;
  v_client uuid;
  v_name text := app.clean_client_name(p_client->>'name');
  v_bid text := upper(btrim(coalesce(p_client->>'business_id', '')));
  v_email text := lower(btrim(coalesce(p_client->>'email', '')));
  v_country text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Свой рейс заводит перевозчик.' using errcode = '42501';
  end if;

  select * into v_carrier from public.companies where id = (select app.current_company_id());

  if v_carrier.id is null or v_carrier.status <> 'ACTIVE' or v_carrier.frozen_at is not null then
    raise exception 'Свои рейсы — у активной компании.' using errcode = '55000';
  end if;

  perform app.assert_legal_current(v_carrier.id);

  if not app.own_orders_allowed(v_carrier.id) then
    raise exception 'Свои рейсы — по подписке.' using errcode = '55010';
  end if;

  if p_vehicle_id is null then
    raise exception 'Выберите машину.' using errcode = '22023';
  end if;

  if not app.client_email_ok(v_email) then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  v_country := upper(btrim(coalesce(nullif(p_client->>'country', ''), v_carrier.country)));
  if v_country !~ '^[A-Z]{2}$' or not app.business_id_ok(v_country, v_bid) then
    raise exception 'Номер клиента указан неверно.' using errcode = '22023';
  end if;

  if nullif(p_client->>'id', '') is not null then
    select id into v_client from public.companies
    where id = (p_client->>'id')::uuid and client_of = v_carrier.id;
    if v_client is null then
      raise exception 'Клиент не найден.' using errcode = 'P0002';
    end if;
  else
    if length(v_name) < 2 or length(v_name) > 200 then
      raise exception 'Укажите имя клиента.' using errcode = '22023';
    end if;

    select id into v_client from public.companies
    where client_of = v_carrier.id
      and ((v_bid <> '' and country = v_country and business_id = v_bid)
        or (v_bid = '' and lower(app.clean_client_name(name)) = lower(v_name)))
    order by created_at
    limit 1;

    if v_client is null then
      /* Клиент тестового перевозчика — тестовый: контуры не смешиваются. */
      insert into public.companies (kind, status, name, country, business_id, contact_email, language, client_of, is_test)
      values ('SHIPPER', 'APPROVED', v_name, v_country, v_bid, v_email, v_carrier.language, v_carrier.id, v_carrier.is_test)
      returning id into v_client;
    end if;
  end if;

  /* Новая почта клиента заменяет старую: ссылку отправляют на неё. */
  if v_email <> '' then
    update public.companies set contact_email = v_email where id = v_client and contact_email <> v_email;
  end if;

  perform set_config('rahtis.order_currency', coalesce(nullif(upper(p_order ->> 'currency'), ''), v_carrier.currency), true);

  return app.create_order_for(
    v_client,
    p_order - 'direct_vehicle_id' - 'group_vehicle_ids' - 'group_minutes' - 'desk_contract',
    p_stops, true, p_vehicle_id);
end;
$$;


-- ── Топливо: валюта чека ───────────────────────────────────────────

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
  v_currency text;
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
  /* Валюта чека: заправка за границей — в местной валюте; не выбрана — валюта компании. */
  v_currency := coalesce(nullif(upper(p_data ->> 'currency'), ''), app.company_currency(v_driver.company_id));
  if v_currency not in ('EUR', 'SEK', 'NOK', 'DKK', 'PLN') then
    v_currency := app.company_currency(v_driver.company_id);
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
          currency = case when amount_cents is null and v_first and v_amount is not null then v_currency::public.currency_code else currency end,
          amount_cents = coalesce(amount_cents, case when v_first then v_amount end),
          station = coalesce(station, v_station),
          receipt_path = coalesce(receipt_path, case when v_first then v_receipt end),
          /* Время спутника точнее всех, водителя — точнее отчёта (там его часто нет). */
          filled_at = case when qty_telematics is null then v_at else filled_at end
      where id = v_match;
    else
      insert into public.fuel_entries (
        company_id, vehicle_id, driver_id, filled_at, product, quantity, qty_driver, amount_cents, odometer_km,
        full_tank, station, source, receipt_path, event_id, currency)
      values (
        v_driver.company_id, v_vehicle, v_driver.id, v_at, v_product, v_qty, v_qty,
        case when v_first then v_amount end,
        v_odometer, v_full, v_station, 'DRIVER',
        case when v_first then v_receipt end,
        p_event_id,
        v_currency::public.currency_code
      );
    end if;
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
    v_match := app.fuel_match(v_vehicle, v_product, v_at, v_qty, 'IMPORT');
    v_amount := nullif(v_row ->> 'amount_cents', '')::integer;
    /* Валюта строки отчёта (карта за границей), иначе — компании. */
    v_currency := coalesce(nullif(upper(v_row ->> 'currency'), ''), app.company_currency(v_company));
    if v_currency not in ('EUR', 'SEK', 'NOK', 'DKK', 'PLN') then
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

  return jsonb_build_object('inserted', v_inserted, 'merged', v_merged);
end;
$$;


-- ── Доля водителя от рейса — в валюте его ставки ───────────────────

create or replace function public.driver_earnings(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
begin
  if v_driver is null then
    raise exception 'Заработок виден только водителю.' using errcode = '42501';
  end if;

  if p_to < p_from or p_to - p_from > 62 then
    raise exception 'Период не больше двух месяцев.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    /*
     * Смены с запасом в две недели: сверхурочные по TES считаются за
     * 2-недельный период, и первый день месяца может быть его серединой.
     */
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'odometer_start', s.odometer_start,
        'odometer_end', s.odometer_end,
        'breaks', coalesce((
          select jsonb_agg(jsonb_build_object('started_at', b.started_at, 'ended_at', b.ended_at))
          from public.driver_breaks b
          where b.shift_id = s.id
        ), '[]'::jsonb)
      ) order by s.started_at)
      from public.driver_shifts s
      where s.driver_id = v_driver
        and s.started_at >= (p_from - 14)::timestamptz
        and s.started_at < (p_to + 2)::timestamptz
    ), '[]'::jsonb),

    'trips', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id,
        'ref', o.ref,
        'closed_at', o.closed_at,
        'distance_km', o.distance_km,
        'stops_done', (select count(*) from public.order_stops s
                        where s.order_id = o.id and s.completed_at is not null),
        'route_from', (select s.city from public.order_stops s
                        where s.order_id = o.id order by s.sequence limit 1),
        'route_to', (select e.city from app.route_end(o.id) e),
        'share_cents', coalesce((
          select round(app.fx_convert(app.payout_cents(o.rate_cents, coalesce(o.commission_bps, 0)), o.currency, p.currency,
                                       (o.closed_at at time zone 'Europe/Helsinki')::date) * p.trip_bps / 10000.0)::integer
          from public.driver_pay_profiles p
          where p.driver_id = v_driver
            and p.valid_from <= (o.closed_at at time zone 'Europe/Helsinki')::date
          order by p.valid_from desc
          limit 1
        ), 0)
      ) order by o.closed_at)
      from public.orders o
      where o.assigned_driver_id = v_driver
        and o.status = 'DONE'
        and (o.closed_at at time zone 'Europe/Helsinki')::date between p_from and p_to
    ), '[]'::jsonb),

    /* Ставки без процента: доля уже посчитана в share_cents. */
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'valid_from', p.valid_from,
        'model', p.model,
        'currency', p.currency,
        'per_km_cents', p.per_km_cents,
        'hourly_cents', p.hourly_cents,
        'tes_grade', p.tes_grade,
        'tes_experience_since', p.tes_experience_since,
        'tes', case when r.id is null then null else to_jsonb(r) - 'company_id' - 'created_by' end,
        'rates', coalesce((
          select jsonb_agg(jsonb_build_object('grade', w.grade, 'valid_from', w.valid_from, 'hourly_cents', w.hourly_cents))
          from public.tes_wage_rates w
          where w.rule_set_id = r.id
        ), '[]'::jsonb)
      ) order by p.valid_from)
      from public.driver_pay_profiles p
      left join public.tes_rule_sets r on r.id = p.tes_rule_set_id
      where p.driver_id = v_driver
    ), '[]'::jsonb)
  );
end;
$$;


-- ── Отчёт за период и выполненные: валюта строки ───────────────────

drop function public.period_report(date, date, uuid);

create function public.period_report(p_from date, p_to date, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, closed_on date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, vehicle_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_fee_cents integer, shipper_id uuid, shipper_name text, shipper_country text, carrier_id uuid, carrier_name text, carrier_country text, route text, stops_count integer, documents_count integer, cmr_count integer, photos_count integer, claims jsonb, contract_party contract_party, currency text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Неверный период.' using errcode = '22023';
  end if;

  if p_to - p_from > 366 then
    raise exception 'Период длиннее года.' using errcode = '22023';
  end if;

  if not v_admin and v_role not in ('SHIPPER', 'CARRIER') then
    raise exception 'Отчёт недоступен.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    app.closed_day(o),
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.trailer,
    o.trailer_plate,
    v.plate,
    o.distance_km,
    o.rate_cents,

    case when v_admin or v_role = 'CARRIER' then app.order_bps(o) end,
    case when v_admin or v_role = 'CARRIER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_admin or v_role = 'CARRIER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,
    /* Плата заказчика 3 % за заказ со стола — заказчику и оператору. */
    case when v_admin or v_role = 'SHIPPER'
      then app.shipper_fee_cents(o.rate_cents, o.shipper_fee_bps) end,

    case when v_admin then sh.id end,
    case when v_admin or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then sh.name end,
    case when v_admin or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then sh.country::text end,
    case when v_admin then ca.id end,
    case when v_admin or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then ca.name end,
    case when v_admin or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then ca.country::text end,

    (
      select string_agg(coalesce(nullif(s.city, ''), s.place_name, '?'), ' - ' order by s.sequence)
      from public.order_stops s where s.order_id = o.id
    ),
    (select count(*)::integer from public.order_stops s where s.order_id = o.id),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id and d.kind = 'CMR'),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id and d.kind <> 'CMR'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ref', c.ref,
          'kind', c.kind,
          'status', c.status,
          'filed_by_role', c.filed_by_role,
          'amount_cents', c.amount_cents
        )
        order by c.created_at
      )
      from public.claims c where c.order_id = o.id
    ), '[]'::jsonb),
    o.contract_party,
    o.currency::text
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.status = 'DONE'
    and app.closed_day(o) between p_from and p_to
    and (
      (v_admin and (p_company is null or p_company in (o.shipper_company_id, o.assigned_company_id)))
      or (not v_admin and v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (not v_admin and v_role = 'CARRIER' and o.assigned_company_id = v_company)
    )
  order by app.closed_moment(o), o.ref;
end;
$function$;

revoke all on function public.period_report(date, date, uuid) from public, anon;
grant execute on function public.period_report(date, date, uuid) to authenticated, service_role;

drop function public.completed_orders(date, date);

CREATE FUNCTION public.completed_orders(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, week date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_name text, carrier_name text, vehicle_plate text, route_geometry text, route_bounds jsonb, rating_score smallint, rating_comment text, can_rate boolean, stops jsonb, documents jsonb, contract_party contract_party, currency text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role public.party_role;
  v_company uuid;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    app.report_week(app.closed_moment(o)),
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,

    case when v_role <> 'SHIPPER' then app.order_bps(o) end,
    case when v_role <> 'SHIPPER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_role <> 'SHIPPER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,

    case when v_role = 'ADMIN' or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then shipper.name end,
    case when v_role = 'ADMIN' or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then carrier.name end,
    v.plate,

    o.route_geometry,
    o.route_bounds,

    r.score,
    r.comment,
    (v_role = 'SHIPPER' and o.assigned_company_id is not null),

    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    ),
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'kind', d.kind,
          'file_name', d.file_name,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'size_bytes', d.size_bytes,
          'stop_id', d.stop_id,
          'created_at', d.created_at
        )
        order by d.created_at
      )
      from public.order_documents d
      where d.order_id = o.id
    ),
    o.contract_party,
    o.currency::text
  from public.orders o
  join public.companies shipper on shipper.id = o.shipper_company_id
  left join public.companies carrier on carrier.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  left join public.order_ratings r on r.order_id = o.id
  where o.status = 'DONE'
    and (
      (v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (v_role = 'CARRIER' and o.assigned_company_id = v_company)
      or v_role = 'ADMIN'
    )
    and (p_from is null or app.report_week(app.closed_moment(o)) >= p_from)
    and (p_to is null or app.report_week(app.closed_moment(o)) <= p_to)
  order by app.closed_moment(o) desc;
end;
$function$;

revoke all on function public.completed_orders(date, date) from public, anon;
grant execute on function public.completed_orders(date, date) to authenticated;


-- ── Рейсы водителей для расчёта зарплаты — в валюте компании ───────

/* Процент от рейса: рейс стола в евро и свой в злотых складываются только после пересчёта. */
create or replace function public.driver_trips(p_from date, p_to date)
returns table (
  order_id uuid,
  ref text,
  driver_id uuid,
  plate text,
  started_at timestamptz,
  closed_at timestamptz,
  distance_km integer,
  stops_done integer,
  payout_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.ref,
    o.assigned_driver_id,
    v.plate,
    (select min(s.completed_at) from public.order_stops s where s.order_id = o.id),
    o.closed_at,
    o.distance_km,
    (select count(*)::integer from public.order_stops s
      where s.order_id = o.id and s.completed_at is not null),
    app.fx_convert(
      app.payout_cents(o.rate_cents, coalesce(o.commission_bps, 0)),
      o.currency,
      app.company_currency(o.assigned_company_id),
      (o.closed_at at time zone 'Europe/Helsinki')::date
    )::integer
  from public.orders o
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_company_id = (select app.current_company_id())
    and o.status = 'DONE'
    and o.assigned_driver_id is not null
    and (o.closed_at at time zone 'Europe/Helsinki')::date between p_from and p_to
  order by o.closed_at;
$$;


-- ── Итоги недель — в валюте смотрящего ─────────────────────────────

/*
 * Оператор видит оборот платформы в евро; компания — в своей валюте,
 * каждый рейс пересчитан по курсу дня закрытия.
 */
create or replace function public.weekly_totals(p_weeks integer default 8)
returns table (
  week date,
  orders_count integer,
  distance_km bigint,
  rate_cents bigint,
  commission_cents bigint,
  payout_cents bigint,
  shipper_fee_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.party_role;
  v_company uuid;
  v_currency text;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());
  v_currency := case when v_role = 'ADMIN' then 'EUR' else app.company_currency(v_company) end;

  return query
  select
    app.report_week(app.closed_moment(o)) as w,
    count(*)::integer,
    sum(coalesce(o.distance_km, 0))::bigint,
    sum(app.fx_convert(coalesce(o.rate_cents, 0), o.currency, v_currency, app.closed_day(o)))::bigint,
    case when v_role <> 'SHIPPER'
      then sum(app.fx_convert(app.commission_cents(o.rate_cents, app.order_bps(o)), o.currency, v_currency, app.closed_day(o)))::bigint end,
    case when v_role <> 'SHIPPER'
      then sum(app.fx_convert(app.payout_cents(o.rate_cents, app.order_bps(o)), o.currency, v_currency, app.closed_day(o)))::bigint end,
    case when v_role <> 'CARRIER'
      then sum(app.fx_convert(app.shipper_fee_cents(o.rate_cents, o.shipper_fee_bps), o.currency, v_currency, app.closed_day(o)))::bigint end
  from public.orders o
  where o.status = 'DONE'
    and (
      (v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (v_role = 'CARRIER' and o.assigned_company_id = v_company)
      or v_role = 'ADMIN'
    )
  group by w
  order by w desc
  limit greatest(1, least(coalesce(p_weeks, 8), 104));
end;
$$;


-- ── Справочник цен — только евро ───────────────────────────────────

create or replace function public.price_guide(p_haul_kind public.haul_kind, p_distance_km integer)
returns table (samples integer, median_cents integer, low_cents integer, high_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select coalesce((select c.is_test from public.companies c where c.id = (select app.current_company_id())), false) as is_test
  ), s as (
    select o.rate_cents::numeric * p_distance_km / o.distance_km as cents
    from public.orders o
    join public.companies c on c.id = o.shipper_company_id
    where o.status = 'DONE'
      and o.currency = 'EUR'
      and o.haul_kind = p_haul_kind
      and o.closed_at > now() - interval '12 months'
      and o.distance_km > 0 and o.rate_cents > 0
      and o.distance_km between p_distance_km * 0.7 and p_distance_km * 1.3
      and (not c.is_test or (select is_test from me))
  )
  select count(*)::integer,
         round(percentile_cont(0.5) within group (order by cents))::integer,
         round(percentile_cont(0.25) within group (order by cents))::integer,
         round(percentile_cont(0.75) within group (order by cents))::integer
  from s
  where p_distance_km between 1 and 5000
    and (select app.current_party_role()) in ('SHIPPER', 'ADMIN')
  having count(*) >= 5
$$;


-- ── Будильник курсов ───────────────────────────────────────────────

insert into app.runtime_config (key, value, note)
select 'fx_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/fx'),
       'Загрузка курсов ЕЦБ в fx_rates. Будит app.run_fx_refresh.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_fx_refresh()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select value into v_url from app.runtime_config where key = 'fx_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';

  if v_url is null or v_secret is null then
    raise notice 'Курсы не загружены: в app.runtime_config нет fx_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'fx-refresh')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_fx_refresh() from public, anon, authenticated;

/* ЕЦБ публикует курсы около 16:00 по Франкфурту; 15:30 UTC — после публикации, плюс утренний повтор. */
select cron.schedule('rahtis-fx-refresh', '30 15 * * 1-5', $$ select app.run_fx_refresh(); $$);
select cron.schedule('rahtis-fx-refresh-morning', '0 6 * * *', $$ select app.run_fx_refresh(); $$);


-- ── Водитель: валюта компании для заработка и заправки ─────────────

create or replace function public.driver_me()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'full_name', d.full_name,
    'phone', d.phone,
    'languages', d.languages,
    'app_language', d.app_language,
    'company_name', c.name,
    'company_country', c.country::text,
    'company_currency', c.currency::text,
    'vehicle_id', vd.vehicle_id,
    'plate', v.plate,
    'shift', (
      select jsonb_build_object(
        'id', s.id,
        'started_at', s.started_at,
        'break_started_at', (
          select b.started_at from public.driver_breaks b
          where b.shift_id = s.id and b.ended_at is null
        ),
        'break_minutes', (
          select coalesce(sum(extract(epoch from (b.ended_at - b.started_at)) / 60), 0)::integer
          from public.driver_breaks b
          where b.shift_id = s.id and b.ended_at is not null
        )
      )
      from public.driver_shifts s
      where s.driver_id = d.id and s.ended_at is null
    ),
    'unread', (
      select count(*) from public.driver_notifications n
      where n.driver_id = d.id and n.read_at is null
    )
  )
  from public.drivers d
  join public.companies c on c.id = d.company_id
  left join public.vehicle_drivers vd on vd.driver_id = d.id and upper_inf(vd.during)
  left join public.vehicles v on v.id = vd.vehicle_id
  where d.id = (select app.current_driver_id());
$$;


-- ── Топливо: права на валюту и валюта в списке водителя ────────────

/* Ручная запись в кабинете вставляет валюту чека (поколоночные права, 20261028120000_fuel). */
grant insert (currency), update (currency) on public.fuel_entries to authenticated;

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
          'amount_cents', e.amount_cents, 'currency', e.currency, 'odometer_km', e.odometer_km, 'station', e.station,
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
