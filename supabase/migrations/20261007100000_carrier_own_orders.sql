-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · свои заказы перевозчика
--
-- 7.10.2026 решение пользователя: заказчик мог отдавать рейсы своим
-- перевозчикам, а перевозчик своим же машинам — нет. Теперь перевозчик
-- заводит рейс своего клиента и сразу направляет его своей машине:
-- водитель видит его в приложении, проходит точки, снимает CMR, а рейс
-- попадает в недельный отчёт перевозчика.
--
-- Деньги. Это рейс по договору перевозчика с его клиентом
-- (contract_party = 'CARRIER'): процента нет ни с кого, счёт клиенту
-- выставляет перевозчик сам. Платный доступ к своим заказам — подписка
-- (29,90 € за машину); перевозчик по подряду может попробовать их в
-- бесплатный первый период (app.free_until), дальше — по подписке.
-- Процент остаётся только у заказов со стола, как и было.
--
-- Модель. Заказ обязан принадлежать заказчику (orders_company_fk и
-- orders_company_is_shipper), поэтому клиент перевозчика — строка
-- companies вида SHIPPER с client_of = перевозчик. Это запись
-- справочника, а не участник платформы: входа у неё нет, условий она
-- не принимает, уведомлений и отчётов не получает, в списках оператора
-- её нет. Статус APPROVED: реквизиты не нужны, а проверка принятых
-- условий (app.assert_legal_current) смотрит только на ACTIVE.
--
-- Отказ. Свой рейс не уходит на стол: если водитель отказался или
-- перевозчик откатил назначение, рейс снимается (CANCELLED), а не
-- становится OPEN. Стол — это заказы, за которые отвечаем мы.
--
-- Ссылка для клиента. У своего рейса есть track_token — по нему клиент
-- без входа видит ход рейса (/track/…). Почта клиента необязательна:
-- если она указана, ссылка уходит письмом при создании.
-- ═══════════════════════════════════════════════════════════════════

-- ── Клиенты перевозчика ────────────────────────────────────────────

alter table public.companies
  add column client_of uuid references public.companies (id) on delete cascade,
  add constraint companies_client_is_shipper
    check (client_of is null or kind = 'SHIPPER');

comment on column public.companies.client_of is
  'Клиент перевозчика для его своих заказов: запись справочника без входа на платформу.';

create index companies_client_of_idx on public.companies (client_of) where client_of is not null;

/* У клиента перевозчика Y-tunnus и почта необязательны. */
alter table public.companies
  drop constraint companies_business_id_format,
  add constraint companies_business_id_format
    check (country <> 'FI' or business_id ~ '^\d{7}-\d$' or (client_of is not null and business_id = '')),
  drop constraint companies_email_normalised,
  add constraint companies_email_normalised
    check (
      (contact_email = lower(contact_email) and position('@' in contact_email) > 1)
      or (client_of is not null and contact_email = '')
    );

/* Один Y-tunnus — одна компания платформы; клиенты перевозчиков в это правило не входят. */
drop index public.companies_business_id_key;
create unique index companies_business_id_key
  on public.companies (country, business_id)
  where status <> 'REJECTED' and client_of is null;

create unique index companies_client_business_id_key
  on public.companies (client_of, country, business_id)
  where client_of is not null and business_id <> '';

grant select (client_of) on public.companies to authenticated;


-- ── Ссылка на ход рейса ────────────────────────────────────────────

alter table public.orders add column track_token text;

create unique index orders_track_token_key on public.orders (track_token) where track_token is not null;

comment on column public.orders.track_token is
  'Ссылка для клиента перевозчика: ход своего рейса без входа на платформу.';


-- ── Клиент перевозчика — не участник платформы ─────────────────────

create or replace function app.is_carrier_client(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.companies where id = p_company_id and client_of is not null);
$$;

revoke all on function app.is_carrier_client(uuid) from public, anon;
grant execute on function app.is_carrier_client(uuid) to authenticated;

/* Уведомлений клиенту перевозчика не пишем: читать их некому. */
create or replace function app.notify_event(
  p_company_id uuid, p_kind public.notification_kind, p_code text,
  p_params jsonb default '{}'::jsonb, p_link text default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (company_id, kind, code, params, link)
  select p_company_id, p_kind, p_code, coalesce(p_params, '{}'::jsonb), p_link
  where not app.is_carrier_client(p_company_id)
  returning id;
$$;


/* Рейс клиента перевозчика — всегда по договору перевозчика. */
create or replace function app.contract_party_of(p_carrier uuid, p_offer uuid)
returns public.contract_party
language sql
stable
set search_path = ''
as $$
  select case
    when p_carrier is null then 'RAHTIS'::public.contract_party
    when exists (
      select 1 from public.order_offers f
      join public.orders o on o.id = f.order_id
      join public.companies s on s.id = o.shipper_company_id
      where f.id = p_offer and s.client_of = p_carrier
    ) then 'CARRIER'::public.contract_party
    when (select c.partnership from public.companies c where c.id = p_carrier) = 'SUBSCRIBER'
         and (
           coalesce((select f.origin from public.order_offers f where f.id = p_offer), 'DIRECT'::public.offer_origin) <> 'DESK'
           or (select o.desk_contract from public.order_offers f join public.orders o on o.id = f.order_id
               where f.id = p_offer) = 'CARRIER'
         )
      then 'CARRIER'::public.contract_party
    else 'RAHTIS'::public.contract_party
  end;
$$;


/*
 * Свой рейс на стол не уходит.
 *
 * Все пути возврата на стол (откат, отказ водителя, отказ перевозчика,
 * истёкший срок) пишут status = 'OPEN' и снимают назначение. У рейса
 * клиента перевозчика вместо этого — снятие с назначением на месте:
 * иначе перевозчик перестал бы видеть собственный рейс.
 */
create or replace function app.own_order_never_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'OPEN' and old.status is distinct from 'OPEN'
     and app.is_carrier_client(new.shipper_company_id) then
    new.status := 'CANCELLED';
    new.assigned_company_id := old.assigned_company_id;
    new.assigned_vehicle_id := old.assigned_vehicle_id;
    new.deadline_at := null;
  end if;
  return new;
end;
$$;

revoke all on function app.own_order_never_open() from public, anon, authenticated;

create trigger orders_own_never_open
  before update of status on public.orders
  for each row execute function app.own_order_never_open();


-- ── Заказ: общее тело ──────────────────────────────────────────────

/*
 * Тело create_order вынесено сюда без изменений по смыслу: им пользуются
 * и заказчик (create_order), и перевозчик для своего рейса
 * (carrier_create_own_order). Разница одна — p_own_vehicle: свой рейс
 * сразу назначается своей машине перевозчика.
 */
create or replace function app.create_order_for(
  p_company_id uuid, p_order jsonb, p_stops jsonb, p_publish boolean, p_own_vehicle uuid default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_stop jsonb;
  v_role text;
  v_seq smallint := 0;
  v_has_pickup boolean := false;
  v_has_work boolean := false;
  v_has_delivery boolean := false;
  v_has_return boolean := false;
  v_geometry text;
  v_haul public.haul_kind;
  v_type public.order_type;
  v_unit boolean;
  v_feet smallint;
  v_ldm numeric;
  v_direct uuid;
  v_group uuid[];
  v_minutes integer;
begin
  v_geometry := nullif(btrim(coalesce(p_order->>'route_geometry', '')), '');

  v_haul := coalesce(nullif(p_order->>'haul_kind', ''), 'TRAILER')::public.haul_kind;
  v_unit := app.haul_carries_unit(v_haul);
  v_feet := nullif(p_order->>'container_feet', '')::smallint;
  v_ldm := nullif(p_order->>'ldm', '')::numeric;

  /*
   * Размер спрашивается здесь, а не при публикации.
   *
   * Ограничение таблицы всё равно не пропустит контейнер без длины, но
   * скажет об этом кодом 23514 и текстом про имя ограничения. Проверка
   * до вставки даёт человеку фразу, по которой понятно, что заполнить.
   */
  if v_haul = 'CONTAINER' and v_feet is null then
    raise exception 'Укажите длину контейнера в футах.' using errcode = '22023';
  end if;

  if not v_unit and v_ldm is null then
    raise exception 'Укажите погрузочные метры груза.' using errcode = '22023';
  end if;

  /*
   * Лишнее обнуляется здесь, а не в форме.
   *
   * Переключение типа единицы оставляет в форме поля предыдущего:
   * футы от контейнера, метры от фургона, номер прицепа. Ограничения
   * таблицы отвергли бы такой заказ целиком, и человек увидел бы отказ
   * на форме, которую заполнил правильно.
   */
  if v_haul <> 'CONTAINER' then v_feet := null; end if;
  if v_unit then v_ldm := null; end if;

  /*
   * Форма рейса у экспресса одна: забрать здесь, привезти туда.
   * Принимать её от клиента значит допускать «перецеп фургоном».
   */
  v_type := case when v_unit then (p_order->>'order_type')::public.order_type else 'ONE_WAY' end;

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, haul_kind, container_feet, ldm,
    trailer, trailer_plate,
    distance_km, rate_cents, comment, created_by, status,
    distance_source, distance_auto_km,
    route_geometry, route_bounds, route_fingerprint, route_computed_at,
    desk_contract
  )
  values (
    p_company_id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    v_type,
    v_haul,
    v_feet,
    v_ldm,
    case when v_unit then nullif(btrim(coalesce(p_order->>'trailer', '')), '') end,
    case when v_unit then nullif(upper(btrim(coalesce(p_order->>'trailer_plate', ''))), '') end,
    nullif(p_order->>'distance_km', '')::integer,
    nullif(p_order->>'rate_cents', '')::integer,
    nullif(btrim(coalesce(p_order->>'comment', '')), ''),
    (select auth.uid()),
    'DRAFT',
    coalesce(nullif(p_order->>'distance_source', ''), 'MANUAL')::public.distance_source,
    nullif(p_order->>'distance_auto_km', '')::integer,
    v_geometry,
    case when p_order ? 'route_bounds' then p_order->'route_bounds' end,
    nullif(btrim(coalesce(p_order->>'route_fingerprint', '')), ''),
    case when v_geometry is not null then now() end,
    /* Стол «напрямую»: договор между сторонами, берут только подписчики. */
    case when p_order->>'desk_contract' = 'CARRIER' then 'CARRIER' else 'RAHTIS' end::public.contract_party
  )
  returning * into v_order;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    insert into public.order_stops (
      order_id, sequence, role, place_kind, place_name, company_name,
      address, city, country, contact_name, contact_phone,
      scheduled_date, scheduled_time, external_ref, trailer_loaded, note,
      cargo_weight_kg, consignee, seal_required,
      lat, lon, geocode_score, leg_distance_m, leg_duration_s
    )
    values (
      v_order.id,
      v_seq,
      (v_stop->>'role')::public.stop_role,
      nullif(v_stop->>'place_kind', '')::public.place_kind,
      nullif(btrim(coalesce(v_stop->>'place_name', '')), ''),
      nullif(btrim(coalesce(v_stop->>'company_name', '')), ''),
      btrim(coalesce(v_stop->>'address', '')),
      btrim(coalesce(v_stop->>'city', '')),
      nullif(upper(btrim(coalesce(v_stop->>'country', ''))), ''),
      nullif(btrim(coalesce(v_stop->>'contact_name', '')), ''),
      nullif(regexp_replace(coalesce(v_stop->>'contact_phone', ''), '[\s-]', '', 'g'), ''),
      nullif(v_stop->>'scheduled_date', '')::date,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(btrim(coalesce(v_stop->>'external_ref', '')), ''),
      case when v_stop ? 'trailer_loaded' then (v_stop->>'trailer_loaded')::boolean end,
      nullif(btrim(coalesce(v_stop->>'note', '')), ''),
      nullif(v_stop->>'cargo_weight_kg', '')::integer,
      nullif(btrim(coalesce(v_stop->>'consignee', '')), ''),
      case when v_stop ? 'seal_required' then (v_stop->>'seal_required')::boolean end,
      nullif(v_stop->>'lat', '')::double precision,
      nullif(v_stop->>'lon', '')::double precision,
      nullif(v_stop->>'geocode_score', '')::numeric,
      nullif(v_stop->>'leg_distance_m', '')::integer,
      nullif(v_stop->>'leg_duration_s', '')::integer
    );

    v_role := v_stop->>'role';

    if v_role = 'PICKUP' then v_has_pickup := true; end if;
    if v_role = 'TRAILER_RETURN' then v_has_return := true; end if;
    if v_role = 'DELIVERY' then v_has_delivery := true; end if;
    if v_role in ('DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'CONTINUATION') then
      v_has_work := true;
    end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not v_has_pickup then
      if v_unit then
        raise exception 'Маршрут неполон: нужна точка забора прицепа.' using errcode = '22023';
      else
        raise exception 'Укажите адрес, где забрать груз.' using errcode = '22023';
      end if;
    end if;

    if v_unit then
      if not v_has_work then
        raise exception 'Добавьте хотя бы одно действие: выгрузку или загрузку.'
          using errcode = '22023';
      end if;

      if v_order.order_type = 'TRAILER_SWAP' and not v_has_return then
        raise exception 'Перецеп заканчивается отцепкой прицепа — укажите, где его оставить.'
          using errcode = '22023';
      end if;

      /*
       * Единицу ищут по номеру. Без него водитель приедет на площадку и
       * не поймёт, что цеплять: сотня прицепов выглядит одинаково, а
       * описание «Тент 13.6, 3 оси» подходит к половине из них. У
       * контейнеров то же самое и хуже: на терминале их тысячи, и
       * различает их только номер по ISO 6346.
       *
       * У экспресса искать нечего: груз выдают по адресу, и номера у
       * него нет. Спрашивать его там означало бы требовать выдумать.
       */
      if v_order.trailer_plate is null then
        if v_order.haul_kind = 'CONTAINER' then
          raise exception 'Укажите номер контейнера — по нему водитель находит его на терминале.'
            using errcode = '22023';
        else
          raise exception 'Укажите регистрационный номер прицепа — по нему водитель его находит.'
            using errcode = '22023';
        end if;
      end if;

    else
      if not v_has_delivery then
        raise exception 'Укажите адрес доставки.' using errcode = '22023';
      end if;

      /*
       * Вес — не украшение карточки, а то, чем проверяется отклик.
       * Без него app.order_max_weight_kg вернёт ноль, и полторы тонны
       * уедут в фургон, который берёт восемьсот килограммов.
       */
      if app.order_max_weight_kg(v_order.id) = 0 then
        raise exception 'Укажите вес груза — по нему подбирается машина.' using errcode = '22023';
      end if;
    end if;

    if v_order.distance_km is null or v_order.rate_cents is null then
      raise exception 'Укажите пробег и ставку.' using errcode = '22023';
    end if;

    /* Свой рейс перевозчика — сразу своей машине, мимо стола. */
    if p_own_vehicle is not null then
      return app.own_assign(v_order.id, p_own_vehicle);
    end if;

    /*
     * Прямое назначение знакомой машине вместо стола. Проверки полноты
     * выше общие: заказ, ушедший напрямую, при отмене попадает на стол,
     * и там он обязан быть таким же полным, как любой другой.
     */
    v_direct := nullif(p_order->>'direct_vehicle_id', '')::uuid;

    /*
     * Группа своих машин: заказ на столе, но первые минуты его видят и
     * берут только перевозчики этих машин (app.group_take). Потом — всем.
     */
    v_group := case
      when jsonb_typeof(p_order->'group_vehicle_ids') = 'array'
        then array(select distinct x::uuid from jsonb_array_elements_text(p_order->'group_vehicle_ids') x)
    end;
    v_minutes := nullif(p_order->>'group_minutes', '')::integer;

    if v_direct is not null then
      v_order := app.direct_assign(v_order.id, v_direct);
    elsif coalesce(cardinality(v_group), 0) > 0 then
      perform app.assert_group(v_order, v_group, v_minutes);

      update public.orders
      set status = 'OPEN', published_at = now(),
          group_vehicle_ids = v_group,
          group_until = now() + make_interval(mins => v_minutes)
      where id = v_order.id
      returning * into v_order;
    else
      update public.orders
      set status = 'OPEN', published_at = now()
      where id = v_order.id
      returning * into v_order;
    end if;
  end if;

  return v_order;
end;
$$;

revoke all on function app.create_order_for(uuid, jsonb, jsonb, boolean, uuid) from public, anon, authenticated;


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

  return app.create_order_for(v_company.id, p_order, p_stops, p_publish, null);
end;
$$;


-- ── Свой рейс: назначение своей машине ─────────────────────────────

/*
 * Как прямое назначение (app.direct_assign), только машина своя: рейс
 * ждёт подтверждения водителя без срока. В order_direct_requests не
 * пишется — это счёт откликов перевозчика на чужие заказы, и свои рейсы
 * его бы искажали.
 */
create or replace function app.own_assign(p_order_id uuid, p_vehicle_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_vehicle public.vehicles;
  v_offer_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id for share;

  if v_vehicle.id is null
     or v_vehicle.company_id is distinct from (select client_of from public.companies where id = v_order.shipper_company_id) then
    raise exception 'Машина не из вашего парка.' using errcode = '42501';
  end if;

  if not app.vehicle_is_dispatchable(p_vehicle_id) then
    raise exception 'Машина сейчас не выходит на рейсы.' using errcode = '55004';
  end if;

  perform app.assert_vehicle_fits_order(v_order, v_vehicle);

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, created_by, origin)
  values (p_order_id, v_vehicle.company_id, p_vehicle_id, (select auth.uid()), 'DIRECT')
  returning id into v_offer_id;

  update public.orders
  set status = 'AWAIT_DRIVER',
      dispatch_mode = 'DIRECT',
      published_at = now(),
      chosen_offer_id = v_offer_id,
      assigned_company_id = v_vehicle.company_id,
      assigned_vehicle_id = p_vehicle_id,
      deadline_at = null,
      track_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function app.own_assign(uuid, uuid) from public, anon, authenticated;


/*
 * Свои рейсы открыты подписчику; перевозчику по подряду — на бесплатный
 * первый период, чтобы попробовать.
 */
create or replace function app.own_orders_allowed(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select c.partnership = 'SUBSCRIBER'
      or coalesce(app.free_until(c.id) >= (now() at time zone 'Europe/Helsinki')::date, false)
  from public.companies c
  where c.id = p_company_id and c.kind = 'CARRIER';
$$;

revoke all on function app.own_orders_allowed(uuid) from public, anon;
grant execute on function app.own_orders_allowed(uuid) to authenticated;


/* Клиенты перевозчика для формы своего рейса. */
create or replace function public.carrier_clients()
returns table (id uuid, name text, business_id text, contact_email text, orders integer, last_order_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.business_id, c.contact_email,
         (select count(*)::integer from public.orders o where o.shipper_company_id = c.id),
         (select max(o.created_at) from public.orders o where o.shipper_company_id = c.id)
  from public.companies c
  where c.client_of = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  order by 6 desc nulls last, c.name;
$$;

revoke all on function public.carrier_clients() from public, anon;
grant execute on function public.carrier_clients() to authenticated;


/*
 * Свой рейс перевозчика.
 *
 * p_client — клиент: {"id"} из справочника или {"name", "business_id",
 * "email"} нового; знакомый по Y-tunnus или имени берётся из
 * справочника, а не заводится второй раз. Почта и Y-tunnus
 * необязательны.
 */
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
  v_name text := btrim(coalesce(p_client->>'name', ''));
  v_bid text := upper(btrim(coalesce(p_client->>'business_id', '')));
  v_email text := lower(btrim(coalesce(p_client->>'email', '')));
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

  if v_email <> '' and position('@' in v_email) <= 1 then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  if v_bid <> '' and v_bid !~ '^\d{7}-\d$' then
    raise exception 'Y-tunnus клиента: 1234567-8.' using errcode = '22023';
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
      and ((v_bid <> '' and business_id = v_bid) or (v_bid = '' and lower(name) = lower(v_name)))
    order by created_at
    limit 1;

    if v_client is null then
      /* Клиент тестового перевозчика — тестовый: контуры не смешиваются. */
      insert into public.companies (kind, status, name, country, business_id, contact_email, language, client_of, is_test)
      values ('SHIPPER', 'APPROVED', v_name, 'FI', v_bid, v_email, v_carrier.language, v_carrier.id, v_carrier.is_test)
      returning id into v_client;
    end if;
  end if;

  /* Новая почта клиента заменяет старую: ссылку отправляют на неё. */
  if v_email <> '' then
    update public.companies set contact_email = v_email where id = v_client and contact_email <> v_email;
  end if;

  return app.create_order_for(
    v_client,
    p_order - 'direct_vehicle_id' - 'group_vehicle_ids' - 'group_minutes' - 'desk_contract',
    p_stops, true, p_vehicle_id);
end;
$$;

revoke all on function public.carrier_create_own_order(jsonb, jsonb, jsonb, uuid) from public, anon;
grant execute on function public.carrier_create_own_order(jsonb, jsonb, jsonb, uuid) to authenticated;


-- ── Списки оператора ───────────────────────────────────────────────

/* Клиент перевозчика не проходит онбординг: входа у него нет. */
do $$
declare
  v_def text := pg_get_functiondef('public.onboarding_status()'::regprocedure);
begin
  v_def := replace(v_def, 'where not co.is_test', 'where not co.is_test
      and co.client_of is null');
  if v_def = pg_get_functiondef('public.onboarding_status()'::regprocedure) then
    raise exception 'onboarding_status: место правки не найдено';
  end if;
  execute v_def;
end;
$$;


/* Свой рейс перевозчик заводит сам — уведомлять его о нём же незачем; водителю — как обычно. */
do $$
declare
  /* Тело могло быть записано с CRLF: сравниваем по LF. */
  v_def text := replace(pg_get_functiondef('app.on_order_status()'::regprocedure), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(v_def,
$a$    if new.deadline_at is null then
      perform app.notify_event(
        new.assigned_company_id,
        'ORDER',
        'order.direct',$a$,
$b$    if new.deadline_at is null then
      if not app.is_carrier_client(new.shipper_company_id) then
      perform app.notify_event(
        new.assigned_company_id,
        'ORDER',
        'order.direct',$b$);
  v_new := replace(v_new,
$a$        '/carrier/desk'
      );

      perform app.notify_driver(
        new.assigned_driver_id,
        'order.direct',$a$,
$b$        '/carrier/desk'
      );
      end if;

      perform app.notify_driver(
        new.assigned_driver_id,
        'order.direct',$b$);
  if v_new = v_def or v_new !~ 'end if;\s+perform app.notify_driver\(\s+new.assigned_driver_id,\s+''order.direct''' then
    raise exception 'on_order_status: место правки не найдено';
  end if;
  execute v_new;
end;
$$;


/* Свои машины перевозчика для формы своего рейса: кто за рулём, занята ли, выходит ли на рейсы. */
create or replace function public.carrier_own_vehicles()
returns table (vehicle_id uuid, plate text, driver_name text, vehicle_class public.vehicle_class, busy boolean, available boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    v.id,
    v.plate,
    coalesce(d.full_name, v.driver_name),
    v.vehicle_class,
    exists (
      select 1 from public.orders o
      where o.assigned_vehicle_id = v.id and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    ),
    coalesce(app.vehicle_is_dispatchable(v.id), false)
  from public.vehicles v
  left join public.drivers d on d.id = app.vehicle_driver_at(v.id, now())
  where v.company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
  order by v.plate;
$$;

revoke all on function public.carrier_own_vehicles() from public, anon;
grant execute on function public.carrier_own_vehicles() to authenticated;


/* Открыты ли свои рейсы текущему перевозчику — для кабинета. */
create or replace function public.own_orders_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.own_orders_allowed((select app.current_company_id())), false);
$$;

revoke all on function public.own_orders_access() from public, anon;
grant execute on function public.own_orders_access() to authenticated;


/*
 * Связь «заказчик — перевозчик» после первого общего рейса — про прямые
 * заказы заказчика платформы. Своему клиенту перевозчик её не даёт: тот
 * не заказывает сам, рейсы ему заводит перевозчик.
 */
create or replace function app.on_first_trip_together()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if new.status is not distinct from old.status
     or new.status <> 'DONE'
     or new.assigned_company_id is null
     or app.is_carrier_client(new.shipper_company_id) then
    return new;
  end if;

  insert into public.carrier_shipper_links (carrier_company_id, shipper_company_id)
  values (new.assigned_company_id, new.shipper_company_id)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    perform app.notify_event(
      new.assigned_company_id,
      'ORDER',
      'link.offer',
      jsonb_build_object(
        'shipper', coalesce((select name from public.companies where id = new.shipper_company_id), '')
      ),
      '/carrier/partners'
    );
  end if;

  return new;
end;
$$;


/* Цены своих рейсов — частный договор перевозчика с клиентом: в подсказку цены не идут. */
do $$
declare
  v_def text := replace(pg_get_functiondef('public.price_guide(public.haul_kind, integer)'::regprocedure), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(v_def, '      and (not c.is_test or (select is_test from me))',
    '      and (not c.is_test or (select is_test from me))
      and c.client_of is null');
  if v_new = v_def then
    raise exception 'price_guide: место правки не найдено';
  end if;
  execute v_new;
end;
$$;
