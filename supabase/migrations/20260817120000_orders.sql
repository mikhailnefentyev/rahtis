-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 4 · заказы и точки маршрута
--
-- Пять сущностей из ТЗ §5 — забор, выгрузка, доп.точка, продолжение
-- рейса, возврат прицепа — это по сути одно: место в определённое время.
-- Различия сводятся к роли, поэтому они живут одной таблицей order_stops
-- с ролью и ограничениями по ролям, а не пятью наборами колонок в orders
-- и не блоком JSON.
--
-- Почему не JSON. Заказчик вправе вставить точку в середину идущего рейса
-- (§8) — журналу нужно на что сослаться. Стол фильтруется по городу забора —
-- нужен индекс. Этапы рейса (§7) отмечаются по точкам — строке нужно своё
-- состояние. И контакт получателя — персональные данные третьего лица,
-- которые перевозчик до взятия заказа видеть не должен; у строки это
-- решается доступом, у поля внутри JSON — никак.
-- ═══════════════════════════════════════════════════════════════════

-- ── Перечисления ───────────────────────────────────────────────────

create type public.order_type as enum ('TRAILER_SWAP', 'ROUND_TRIP', 'ONE_WAY');

/*
 * Жизненный цикл заказа (ТЗ §6). DRAFT добавлен к списку из ТЗ: форма
 * публикации создаёт заказ сразу открытым, но черновик нужен как состояние
 * «маршрут ещё не полон», в которое заказ откатывается при неудачной
 * публикации.
 */
create type public.order_status as enum (
  'DRAFT', 'OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS', 'DONE', 'CANCELLED'
);

/* Значения совпадают с ключами t.stopKind в словаре интерфейса. */
create type public.stop_role as enum (
  'PICKUP', 'DELIVERY', 'EXTRA_LOAD', 'EXTRA_UNLOAD', 'CONTINUATION', 'TRAILER_RETURN'
);

create type public.place_kind as enum ('PORT', 'TERMINAL', 'PARKING', 'ADDRESS');


-- ── Заказы ─────────────────────────────────────────────────────────

/*
 * Номер заказа генерирует платформа. В прототипе номер выглядел как
 * внутренний номер заказчика (BF-2026-0912), но такие номера у разных
 * заказчиков рано или поздно столкнутся. Поэтому внутренний номер живёт
 * отдельным необязательным полем shipper_ref и показывается рядом.
 */
create sequence public.order_ref_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),

  ref text not null unique
    default 'RS-' || to_char(now(), 'YYYY') || '-' ||
            lpad(nextval('public.order_ref_seq')::text, 4, '0'),

  shipper_ref text,

  shipper_company_id uuid not null,
  /* Заказы бывают только у заказчика — как машины только у перевозчика. */
  shipper_company_kind public.party_role not null default 'SHIPPER',

  order_type public.order_type not null,
  trailer text,
  distance_km integer,

  /* Ставка заказчика в центах. €/км считается на лету и не хранится. */
  rate_cents integer,

  comment text,

  status public.order_status not null default 'DRAFT',
  published_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_company_is_shipper
    check (shipper_company_kind = 'SHIPPER'),

  constraint orders_company_fk
    foreign key (shipper_company_id, shipper_company_kind)
    references public.companies (id, kind) on delete cascade,

  constraint orders_distance_positive
    check (distance_km is null or distance_km between 1 and 20000),

  constraint orders_rate_positive
    check (rate_cents is null or rate_cents between 1 and 100000000),

  /*
   * Опубликованный заказ обязан иметь километраж и ставку: без них
   * перевозчику нечего решать, а платформе нечего считать.
   */
  constraint orders_published_has_numbers
    check (status = 'DRAFT' or (distance_km is not null and rate_cents is not null))
);

comment on table public.orders is
  'Транспортная заявка. Точки маршрута — в order_stops.';

comment on column public.orders.ref is
  'Номер платформы, глобально уникален. Внутренний номер заказчика — shipper_ref.';

create index orders_shipper_idx on public.orders (shipper_company_id, created_at desc);
create index orders_open_idx on public.orders (published_at desc) where status = 'OPEN';

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function app.touch_updated_at();


-- ── Точки маршрута ─────────────────────────────────────────────────

create table public.order_stops (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null references public.orders (id) on delete cascade,

  /* Порядок в маршруте. Правка §8 вставляет точку, сдвигая последующие. */
  sequence smallint not null,

  role public.stop_role not null,

  /* Порт / терминал / парковка / адрес — только у забора (ТЗ §5). */
  place_kind public.place_kind,

  place_name text,
  company_name text,
  address text not null,

  /* Город отдельной колонкой: по нему фильтр стола и рассылка машинам. */
  city text not null,

  /*
   * Контакт на месте — персональные данные третьего лица. Перевозчик
   * видит их только после того, как заказ закреплён за ним; на столе
   * функция desk_orders эти колонки не отдаёт.
   */
  contact_name text,
  contact_phone text,

  /*
   * Местное настенное время, а не момент. «Быть на терминале в 08:00»
   * означает 08:00 по месту: Хельсинки живёт в EET, Стокгольм в CET,
   * и timestamptz потребовал бы угадывать пояс каждой исторической строки
   * при выходе за Финляндию. Время необязательно — у возврата прицепа
   * его обычно нет.
   */
  scheduled_date date,
  scheduled_time time,

  /* Номер заказа у продолжения рейса (ТЗ §5). */
  external_ref text,

  /* «С грузом» или «без груза» у возврата прицепа. */
  returns_loaded boolean,

  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_stops_sequence_key unique (order_id, sequence),

  constraint order_stops_address_length
    check (length(btrim(address)) between 3 and 300),

  constraint order_stops_city_length
    check (length(btrim(city)) between 2 and 80),

  constraint order_stops_pickup_has_place_kind
    check (role <> 'PICKUP' or place_kind is not null),

  constraint order_stops_delivery_has_company
    check (role <> 'DELIVERY' or nullif(btrim(coalesce(company_name, '')), '') is not null),

  constraint order_stops_return_has_cargo_flag
    check (role <> 'TRAILER_RETURN' or returns_loaded is not null),

  constraint order_stops_phone_format
    check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{6,14}$')
);

comment on table public.order_stops is
  'Точки маршрута одним упорядоченным списком: забор, выгрузка, доп.точки, продолжение, возврат.';

/*
 * Забор и выгрузка — ровно по одной на заказ, продолжение и возврат —
 * не более одного. Доп.точек сколько угодно. Выражено частичными
 * уникальными индексами, а не триггером.
 */
create unique index order_stops_one_pickup on public.order_stops (order_id) where role = 'PICKUP';
create unique index order_stops_one_delivery on public.order_stops (order_id) where role = 'DELIVERY';
create unique index order_stops_one_continuation on public.order_stops (order_id) where role = 'CONTINUATION';
create unique index order_stops_one_return on public.order_stops (order_id) where role = 'TRAILER_RETURN';

/* Фильтр стола по региону забора. */
create index order_stops_pickup_city_idx on public.order_stops (city) where role = 'PICKUP';
create index order_stops_order_idx on public.order_stops (order_id, sequence);

create trigger order_stops_touch_updated_at
  before update on public.order_stops
  for each row execute function app.touch_updated_at();


-- ── Журнал заказа ──────────────────────────────────────────────────

create table public.order_events (
  id bigint generated always as identity primary key,

  order_id uuid not null references public.orders (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,

  from_status public.order_status,
  to_status public.order_status not null,
  note text,

  created_at timestamptz not null default now()
);

comment on table public.order_events is
  'Журнал смен статуса заказа. Правки маршрута (ТЗ §8) — отдельная история, Этап 6.';

create index order_events_order_idx on public.order_events (order_id, created_at desc);

create or replace function app.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := coalesce(
    nullif(current_setting('app.actor_id', true), '')::uuid,
    (select auth.uid())
  );

  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, actor_id, from_status, to_status)
    values (new.id, v_actor, null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, actor_id, from_status, to_status)
    values (new.id, v_actor, old.status, new.status);
  end if;

  return new;
end;
$$;

create trigger orders_log_status_insert
  after insert on public.orders
  for each row execute function app.log_order_status_change();

create trigger orders_log_status_update
  after update of status on public.orders
  for each row execute function app.log_order_status_change();


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.orders enable row level security;
alter table public.order_stops enable row level security;
alter table public.order_events enable row level security;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_stops from anon, authenticated;
revoke all on public.order_events from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_stops to authenticated;
grant select on public.order_events to authenticated;
grant delete on public.orders to authenticated;

/*
 * Политик чтения для перевозчика здесь нет намеренно.
 *
 * Стол он видит через public.desk_orders — функцию, которая проверяет
 * допуск и не отдаёт контактные поля. Это даёт одно очевидное место,
 * где определено «что перевозчик видит до того, как взял заказ», вместо
 * россыпи условий по политикам. На Этапе 5 назначенный перевозчик
 * получит обычную политику и увидит контакты.
 *
 * Колоночные гранты для этого не годятся: они действуют на роль целиком,
 * а заказчику контакты своих же заказов нужны.
 */

create policy orders_select_own
  on public.orders for select to authenticated
  using (shipper_company_id = (select app.current_company_id()));

create policy orders_select_admin
  on public.orders for select to authenticated
  using ((select app.is_admin()));

create policy orders_delete_own_draft
  on public.orders for delete to authenticated
  using (
    shipper_company_id = (select app.current_company_id())
    and status = 'DRAFT'
  );

create policy order_stops_select_own
  on public.order_stops for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.shipper_company_id = (select app.current_company_id())
    )
  );

create policy order_stops_select_admin
  on public.order_stops for select to authenticated
  using ((select app.is_admin()));

create policy order_events_select_own
  on public.order_events for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.shipper_company_id = (select app.current_company_id())
    )
  );

create policy order_events_select_admin
  on public.order_events for select to authenticated
  using ((select app.is_admin()));


-- ── Публикация ─────────────────────────────────────────────────────

/*
 * Создание заказа вместе с маршрутом одной транзакцией.
 *
 * Заказ и его точки лежат в разных таблицах, а форма публикации по ТЗ §5
 * не пошаговая: человек заполняет всё и нажимает один раз. Половина
 * маршрута без второй половины — состояние, которого быть не должно,
 * поэтому запись идёт одним вызовом.
 *
 * Точки приходят массивом JSON: их число и состав полей зависят от того,
 * что заполнил заказчик. Правильность каждой точки проверяют ограничения
 * таблицы, а не разбор здесь.
 */
create or replace function public.create_order(
  p_order jsonb,
  p_stops jsonb,
  p_publish boolean default true
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_company public.companies;
  v_stop jsonb;
  v_seq smallint := 0;
  v_has_pickup boolean := false;
  v_has_delivery boolean := false;
begin
  select * into v_company
  from public.companies
  where id = (select app.current_company_id());

  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;

  /*
   * Заказ можно публиковать только активной компании: пока не заполнены
   * реквизиты, платформе некому выставить счёт за этот рейс.
   */
  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.'
      using errcode = '55000';
  end if;

  insert into public.orders (
    shipper_company_id, shipper_ref, order_type, trailer,
    distance_km, rate_cents, comment, created_by, status
  )
  values (
    v_company.id,
    nullif(btrim(coalesce(p_order->>'shipper_ref', '')), ''),
    (p_order->>'order_type')::public.order_type,
    nullif(btrim(coalesce(p_order->>'trailer', '')), ''),
    nullif(p_order->>'distance_km', '')::integer,
    nullif(p_order->>'rate_cents', '')::integer,
    nullif(btrim(coalesce(p_order->>'comment', '')), ''),
    (select auth.uid()),
    'DRAFT'
  )
  returning * into v_order;

  for v_stop in select * from jsonb_array_elements(p_stops) loop
    insert into public.order_stops (
      order_id, sequence, role, place_kind, place_name, company_name,
      address, city, contact_name, contact_phone,
      scheduled_date, scheduled_time, external_ref, returns_loaded, note
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
      nullif(btrim(coalesce(v_stop->>'contact_name', '')), ''),
      nullif(regexp_replace(coalesce(v_stop->>'contact_phone', ''), '[\s-]', '', 'g'), ''),
      nullif(v_stop->>'scheduled_date', '')::date,
      nullif(v_stop->>'scheduled_time', '')::time,
      nullif(btrim(coalesce(v_stop->>'external_ref', '')), ''),
      case when v_stop ? 'returns_loaded' then (v_stop->>'returns_loaded')::boolean end,
      nullif(btrim(coalesce(v_stop->>'note', '')), '')
    );

    if (v_stop->>'role') = 'PICKUP' then v_has_pickup := true; end if;
    if (v_stop->>'role') = 'DELIVERY' then v_has_delivery := true; end if;

    v_seq := v_seq + 1;
  end loop;

  if p_publish then
    if not (v_has_pickup and v_has_delivery) then
      raise exception 'Маршрут неполон: нужны забор и выгрузка.' using errcode = '22023';
    end if;

    if v_order.distance_km is null or v_order.rate_cents is null then
      raise exception 'Укажите пробег и ставку.' using errcode = '22023';
    end if;

    update public.orders
    set status = 'OPEN', published_at = now()
    where id = v_order.id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

comment on function public.create_order(jsonb, jsonb, boolean) is
  'Создаёт заказ вместе с маршрутом одной транзакцией и, по умолчанию, публикует.';

revoke all on function public.create_order(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.create_order(jsonb, jsonb, boolean) to authenticated, service_role;
