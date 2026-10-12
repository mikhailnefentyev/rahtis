-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · свои рейсы: правка рейса и справочник клиентов
--
-- Прогон 12.10.2026 на тестовом перевозчике показал, что свой рейс после
-- создания нельзя исправить: пробег и ставку «меняет заказчик или
-- оператор», маршрут «правит только заказчик этого рейса». Но заказчик
-- своего рейса — запись справочника без входа (companies.client_of), и
-- опечатку в адресе или цене не мог поправить никто, кроме оператора.
--
-- Теперь перевозчик правит свой рейс теми же функциями, что заказчик —
-- свой заказ: reprice_order, amend_stop, add_stop, remove_stop,
-- store_route. Правила правки не меняются: точки — только у идущего
-- рейса и только непройденные, пробег и ставка — до закрытия. Процента
-- со своего рейса нет, так что эти числа идут только в отчёт перевозчика.
--
-- Справочник клиентов. Имя с лишними пробелами заводило второго клиента
-- с тем же названием, почта вида «a@» проходила проверку, а исправить
-- или убрать клиента было негде. Имя теперь сжимается, почта проверяется
-- на домен, а у перевозчика появились carrier_update_client и
-- carrier_delete_client (удаление — только клиента без рейсов).
-- ═══════════════════════════════════════════════════════════════════

-- ── Чей это свой рейс ──────────────────────────────────────────────

/* Заказчик рейса — клиент перевозчика, который сейчас вошёл. */
create or replace function app.is_own_order_of_caller(p_shipper_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.client_of = (select app.current_company_id())
       and (select app.current_party_role()) = 'CARRIER'
    from public.companies c
    where c.id = p_shipper_company_id and c.client_of is not null
  ), false);
$$;

revoke all on function app.is_own_order_of_caller(uuid) from public, anon;
grant execute on function app.is_own_order_of_caller(uuid) to authenticated;


-- ── Правка своего рейса ────────────────────────────────────────────

/*
 * Три функции проверяют «это заказчик рейса или оператор». Условие
 * дополняется на месте, а тело не переписывается: так правка не затрёт
 * того, что в этих функциях менялось после их первой миграции. Место
 * правки не найдено — миграция падает, а не проходит молча.
 */
do $$
declare
  v_proc regprocedure;
  v_def text;
  v_new text;
begin
  foreach v_proc in array array[
    'app.assert_amendable(public.order_stops)'::regprocedure,
    'public.store_route(uuid, jsonb)'::regprocedure
  ] loop
    /* Тело могло быть записано с CRLF: сравниваем по LF. */
    v_def := replace(pg_get_functiondef(v_proc), E'\r\n', E'\n');

    if position('is_own_order_of_caller' in v_def) > 0 then
      continue;
    end if;

    v_new := regexp_replace(
      v_def,
      $p$v_order\.shipper_company_id = \(select app\.current_company_id\(\)\)(\s+)or \(select app\.is_admin\(\)\)$p$,
      $r$v_order.shipper_company_id = (select app.current_company_id())\1or app.is_own_order_of_caller(v_order.shipper_company_id)\1or (select app.is_admin())$r$
    );

    if v_new = v_def then
      raise exception '%: место правки не найдено', v_proc;
    end if;

    execute v_new;
  end loop;

  v_def := replace(pg_get_functiondef('public.reprice_order(uuid, integer, integer)'::regprocedure), E'\r\n', E'\n');

  if position('is_own_order_of_caller' in v_def) = 0 then
    v_new := regexp_replace(
      v_def,
      $p$coalesce\(v_party, ''\) not in \('SHIPPER', 'ADMIN'\)$p$,
      $r$coalesce(v_party, '') not in ('SHIPPER', 'ADMIN')
     and not app.is_own_order_of_caller(v_order.shipper_company_id)$r$
    );

    if v_new = v_def then
      raise exception 'reprice_order: место правки не найдено';
    end if;

    execute v_new;
  end if;
end;
$$;


-- ── Клиент: имя без лишних пробелов, почта с доменом ───────────────

create or replace function app.clean_client_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
$$;

/* Пусто — можно: почта клиента необязательна. */
create or replace function app.client_email_ok(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_email, '') = '' or p_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';
$$;

revoke all on function app.clean_client_name(text), app.client_email_ok(text) from public, anon;
grant execute on function app.clean_client_name(text), app.client_email_ok(text) to authenticated;


/*
 * Свой рейс перевозчика — то же тело, что в 20261007100000, с двумя
 * правками: имя клиента сжимается, почта проверяется на домен.
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
  v_name text := app.clean_client_name(p_client->>'name');
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

  if not app.client_email_ok(v_email) then
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
      and ((v_bid <> '' and business_id = v_bid)
        or (v_bid = '' and lower(app.clean_client_name(name)) = lower(v_name)))
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


-- ── Справочник клиентов: правка и удаление ─────────────────────────

/*
 * Имя, Y-tunnus и почта клиента. Правит перевозчик, чей это клиент.
 * Уже заведённые рейсы продолжают ссылаться на ту же строку: в отчётах
 * и на странице хода рейса клиент станет называться по-новому.
 */
create or replace function public.carrier_update_client(
  p_client_id uuid, p_name text, p_business_id text, p_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
  v_name text := app.clean_client_name(p_name);
  v_bid text := upper(btrim(coalesce(p_business_id, '')));
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' or v_me is null then
    raise exception 'Клиентов правит перевозчик.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.companies where id = p_client_id and client_of = v_me) then
    raise exception 'Клиент не найден.' using errcode = 'P0002';
  end if;

  if length(v_name) < 2 or length(v_name) > 200 then
    raise exception 'Укажите имя клиента.' using errcode = '22023';
  end if;

  if not app.client_email_ok(v_email) then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  if v_bid <> '' and v_bid !~ '^\d{7}-\d$' then
    raise exception 'Y-tunnus клиента: 1234567-8.' using errcode = '22023';
  end if;

  /* Второй клиент с тем же именем или Y-tunnus — это дубль, а не правка. */
  if exists (
    select 1 from public.companies c
    where c.client_of = v_me and c.id <> p_client_id
      and ((v_bid <> '' and c.business_id = v_bid)
        or lower(app.clean_client_name(c.name)) = lower(v_name))
  ) then
    raise exception 'Такой клиент уже есть.' using errcode = '23505';
  end if;

  update public.companies
  set name = v_name, business_id = v_bid, contact_email = v_email
  where id = p_client_id and client_of = v_me;
end;
$$;

revoke all on function public.carrier_update_client(uuid, text, text, text) from public, anon;
grant execute on function public.carrier_update_client(uuid, text, text, text) to authenticated;


/*
 * Убрать клиента из справочника. Только того, у кого нет ни одного
 * рейса: рейсы — это отчёты и документы, их держат шесть лет, и клиент
 * в них должен остаться названным.
 */
create or replace function public.carrier_delete_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' or v_me is null then
    raise exception 'Клиентов правит перевозчик.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.companies where id = p_client_id and client_of = v_me) then
    raise exception 'Клиент не найден.' using errcode = 'P0002';
  end if;

  if exists (select 1 from public.orders where shipper_company_id = p_client_id) then
    raise exception 'У клиента есть рейсы — удалить его нельзя.' using errcode = '55000';
  end if;

  delete from public.companies where id = p_client_id and client_of = v_me;
end;
$$;

revoke all on function public.carrier_delete_client(uuid) from public, anon;
grant execute on function public.carrier_delete_client(uuid) to authenticated;
