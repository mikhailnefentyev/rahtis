-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · знакомые машины и прямое назначение
--
-- До сих пор заказ шёл одним путём: общий стол → до трёх откликов →
-- выбор заказчиком → подтверждение перевозчиком за пятнадцать минут. Так
-- не работает тот, кто годами возит одними и теми же машинами: ему не
-- нужен выбор из трёх, ему нужен «его» тягач. Такие пары и уводят
-- работу мимо платформы.
--
-- Добавлен второй поток, рядом с первым, а не вместо него.
--
-- ПРЯМОЕ НАЗНАЧЕНИЕ. Заказчик направляет заказ машине, с которой уже
-- возил. Заказ минует стол и сразу встаёт в AWAIT_DRIVER — туда же, куда
-- его ставит выбор отклика, — поэтому подтверждение, отказ, закреплённые
-- рейсы и отклики у заказчика работают без изменений. Отличий три:
--
--   · срока нет. Постоянная работа планируется заранее, и пятнадцать
--     минут на ответ здесь были бы выдуманным дедлайном. Заказ ждёт,
--     пока его не подтвердят или не отменят;
--   · подтвердить может и перевозчик в кабинете, и водитель в
--     приложении;
--   · отмена любой из сторон отправляет заказ на общий стол — и это его
--     первый выход туда, поэтому он рассылается перевозчикам страны
--     забора, как новая публикация.
--
-- Признак прямого назначения в строке — пустой deadline_at у
-- AWAIT_DRIVER. Выбор отклика всегда ставит срок, прямое назначение не
-- ставит никогда.
--
-- СОГЛАСИЕ. Перевозчик решает, кто из заказчиков может направлять его
-- машинам заказы напрямую. После первого закрытого рейса с новым
-- заказчиком перевозчику приходит предложение, и пока он не согласился,
-- заказчик его машин среди знакомых не видит.
--
-- АНОНИМНОСТЬ не меняется. Aivomaa остаётся контрагентом заказчика, и
-- знакомые машины показываются машинами — номер, водитель, класс,
-- рейтинг, — без названия перевозчика. Номер и водителя заказчик и так
-- видел в своих закрытых рейсах.
-- ═══════════════════════════════════════════════════════════════════


-- ── Перечисления ───────────────────────────────────────────────────

create type public.dispatch_mode as enum ('DESK', 'DIRECT');
create type public.offer_origin as enum ('DESK', 'DIRECT');
create type public.link_status as enum ('OFFERED', 'ACTIVE', 'REVOKED');
create type public.direct_outcome as enum ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');


-- ── Поля заказа и отклика ──────────────────────────────────────────

/*
 * Как заказ пришёл к исполнителю. После отмены прямого назначения
 * остаётся DIRECT: это происхождение заказа, а не его состояние.
 */
alter table public.orders
  add column dispatch_mode public.dispatch_mode not null default 'DESK';

comment on column public.orders.dispatch_mode is
  'Как заказ ушёл к исполнителю: общий стол или прямое назначение. Происхождение, не состояние.';

grant select (dispatch_mode) on public.orders to authenticated;

/*
 * Прямое назначение пишет отклик, как стол, — с пометкой. Так всё, что
 * читает отклик и назначение, работает для обоих потоков одинаково.
 */
alter table public.order_offers
  add column origin public.offer_origin not null default 'DESK';


-- ── Согласие перевозчика ───────────────────────────────────────────

create table public.carrier_shipper_links (
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  shipper_company_id uuid not null references public.companies (id) on delete cascade,

  status public.link_status not null default 'OFFERED',

  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),

  primary key (carrier_company_id, shipper_company_id)
);

comment on table public.carrier_shipper_links is
  'Согласие перевозчика на прямые заказы от заказчика. OFFERED — предложено после первого рейса, решения нет.';

create index carrier_shipper_links_shipper_idx
  on public.carrier_shipper_links (shipper_company_id)
  where status = 'ACTIVE';


-- ── «Мои машины» заказчика ─────────────────────────────────────────

create table public.shipper_vehicle_pool (
  shipper_company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,

  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),

  primary key (shipper_company_id, vehicle_id)
);

comment on table public.shipper_vehicle_pool is
  'Постоянные машины заказчика. Пишется только pool_add_vehicle: машина должна быть знакомой.';


-- ── История прямых назначений ──────────────────────────────────────

/*
 * Отклики стираются при каждом возврате на стол, а вопрос «кому мы
 * направляли и кто отказался» остаётся. Поэтому история отдельно.
 */
create table public.order_direct_requests (
  id bigint generated always as identity primary key,

  order_id uuid not null references public.orders (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  carrier_company_id uuid not null references public.companies (id) on delete cascade,

  outcome public.direct_outcome not null default 'PENDING',

  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  decided_at timestamptz,

  constraint order_direct_requests_decided
    check ((outcome = 'PENDING') = (decided_at is null))
);

/* У заказа не бывает двух ждущих прямых назначений. */
create unique index order_direct_requests_one_pending
  on public.order_direct_requests (order_id)
  where outcome = 'PENDING';

create index order_direct_requests_carrier_idx
  on public.order_direct_requests (carrier_company_id, sent_at desc);


-- ── Входящие водителя ──────────────────────────────────────────────

/*
 * Уведомления водителю в приложении. Отдельно от notifications: те
 * принадлежат компании и читаются всем кабинетом, а это — одному
 * человеку за рулём.
 */
create table public.driver_notifications (
  id bigint generated always as identity primary key,

  driver_id uuid not null references public.drivers (id) on delete cascade,

  code text not null,
  params jsonb not null default '{}'::jsonb,
  order_id uuid references public.orders (id) on delete cascade,

  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint driver_notifications_params_object
    check (jsonb_typeof(params) = 'object')
);

create index driver_notifications_driver_idx
  on public.driver_notifications (driver_id, created_at desc);

create or replace function app.notify_driver(
  p_driver_id uuid,
  p_code text,
  p_params jsonb,
  p_order_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.driver_notifications (driver_id, code, params, order_id)
  select p_driver_id, p_code, coalesce(p_params, '{}'::jsonb), p_order_id
  where p_driver_id is not null;
$$;

revoke all on function app.notify_driver(uuid, text, jsonb, uuid) from public, anon, authenticated;


-- ── Знакома ли машина заказчику ────────────────────────────────────

/*
 * Машина знакома заказчику, если она довезла хотя бы один его рейс и
 * её перевозчик согласился на прямые заказы от него. Одно определение
 * на список знакомых, пул и само назначение: иначе машина, которую
 * видно в списке, не назначалась бы, или наоборот.
 */
create or replace function app.shipper_knows_vehicle(p_shipper_id uuid, p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vehicles v
    join public.carrier_shipper_links l
      on l.carrier_company_id = v.company_id
     and l.shipper_company_id = p_shipper_id
     and l.status = 'ACTIVE'
    where v.id = p_vehicle_id
      and exists (
        select 1 from public.orders o
        where o.shipper_company_id = p_shipper_id
          and o.assigned_vehicle_id = v.id
          and o.status = 'DONE'
      )
  );
$$;

revoke all on function app.shipper_knows_vehicle(uuid, uuid) from public, anon, authenticated;


-- ── Подходит ли машина заказу ──────────────────────────────────────

/*
 * Те же проверки и те же коды ошибок, что у отклика со стола: кузов
 * против единицы, затем вес против грузоподъёмности. Вынесены, чтобы
 * прямое назначение не отправило машине заказ, который она не
 * смогла бы взять со стола.
 */
create or replace function app.assert_vehicle_fits_order(p_order public.orders, p_vehicle public.vehicles)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_needed integer;
  v_capacity integer;
begin
  if not app.vehicle_fits_haul(p_vehicle.id, p_order.haul_kind, p_order.container_feet, p_order.ldm) then
    if app.vehicle_branch(p_vehicle.vehicle_class) <> app.haul_branch(p_order.haul_kind) then
      if app.haul_carries_unit(p_order.haul_kind) then
        raise exception 'Этот заказ возят тягачом: груз едет за машиной, а не в ней.'
          using errcode = '55003';
      else
        raise exception 'Этот заказ возят грузовиком или микроавтобусом: груз едет в машине.'
          using errcode = '55003';
      end if;
    elsif p_order.haul_kind = 'CONTAINER' then
      raise exception 'Машина не берёт %-футовый контейнер.', p_order.container_feet
        using errcode = '55002';
    else
      raise exception 'Нужен кузов от % погрузочных метров.', p_order.ldm
        using errcode = '55003';
    end if;
  end if;

  v_needed := app.order_max_weight_kg(p_order.id);
  v_capacity := app.vehicle_capacity_kg(p_vehicle.id);

  if v_needed > v_capacity then
    raise exception 'Груз % кг превышает грузоподъёмность машины % кг.', v_needed, v_capacity
      using errcode = '55001';
  end if;
end;
$$;

revoke all on function app.assert_vehicle_fits_order(public.orders, public.vehicles)
  from public, anon, authenticated;


-- ── Прямое назначение ──────────────────────────────────────────────

/*
 * Ставит заказ на знакомую машину в обход стола.
 *
 * Принимает черновик, который create_order только что проверил на
 * полноту, или заказ на столе, на который ещё никто не откликнулся.
 * С откликами — нет: люди уже ждут решения заказчика, и увести заказ
 * у них из-под руки значит обмануть тех, кто откликнулся честно.
 *
 * Машина обязана быть знакомой, допущенной и подходящей заказу. Занятость
 * не проверяется: постоянная работа планируется заранее, и машина,
 * которая сейчас в рейсе, подтвердит следующий, когда освободится.
 * Интерфейс предупреждает о занятости, но не запрещает.
 */
create or replace function app.direct_assign(p_order_id uuid, p_vehicle_id uuid)
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

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_order.shipper_company_id is distinct from (select app.current_company_id()) then
    raise exception 'Направить заказ может только его заказчик.' using errcode = '42501';
  end if;

  if not (
       v_order.status = 'DRAFT'
    or (v_order.status = 'OPEN'
        and not exists (select 1 from public.order_offers where order_id = p_order_id))
  ) then
    raise exception 'Направить напрямую можно только заказ без откликов, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  /* Блокировка машины: два заказчика, направляющие её одновременно, не мешают друг другу, но и не читают её полуизменённой. */
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for share;

  if v_vehicle.id is null or not app.shipper_knows_vehicle(v_order.shipper_company_id, p_vehicle_id) then
    raise exception 'Машина не среди ваших знакомых.' using errcode = '42501';
  end if;

  if not app.vehicle_is_dispatchable(p_vehicle_id) then
    raise exception 'Машина сейчас не выходит на рейсы.' using errcode = '55004';
  end if;

  perform app.assert_vehicle_fits_order(v_order, v_vehicle);

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, created_by, origin)
  values (p_order_id, v_vehicle.company_id, p_vehicle_id, (select auth.uid()), 'DIRECT')
  returning id into v_offer_id;

  insert into public.order_direct_requests (order_id, vehicle_id, carrier_company_id, sent_by)
  values (p_order_id, p_vehicle_id, v_vehicle.company_id, (select auth.uid()));

  update public.orders
  set status = 'AWAIT_DRIVER',
      dispatch_mode = 'DIRECT',
      chosen_offer_id = v_offer_id,
      assigned_company_id = v_vehicle.company_id,
      assigned_vehicle_id = p_vehicle_id,
      /* Без срока — см. шапку миграции. */
      deadline_at = null
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function app.direct_assign(uuid, uuid) from public, anon, authenticated;

/* Заказ со стола, на который никто не откликнулся, — знакомой машине. */
create or replace function public.direct_assign_order(p_order_id uuid, p_vehicle_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
begin
  select status into v_status from public.orders where id = p_order_id;

  /* Черновик идёт только через create_order: там он проверяется на полноту. */
  if v_status = 'DRAFT' then
    raise exception 'Сначала опубликуйте заказ.' using errcode = '55000';
  end if;

  return app.direct_assign(p_order_id, p_vehicle_id);
end;
$$;

comment on function public.direct_assign_order(uuid, uuid) is
  'Прямое назначение заказа со стола (без откликов) знакомой машине. Срока нет: ждёт подтверждения или отмены.';

revoke all on function public.direct_assign_order(uuid, uuid) from public, anon;
grant execute on function public.direct_assign_order(uuid, uuid) to authenticated;


-- ── Подтверждение: перевозчик или водитель ─────────────────────────

create or replace function public.confirm_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_driver_id uuid := (select app.current_driver_id());
begin
  v_order := app.release_expired_order(p_order_id);

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  /*
   * Водитель подтверждает свой рейс сам, из приложения. Кабинет
   * перевозчика сохраняет право подтвердить за него.
   */
  if v_order.assigned_company_id is distinct from (select app.current_company_id())
     and (v_driver_id is null or v_order.assigned_driver_id is distinct from v_driver_id) then
    raise exception 'Подтвердить может только выбранный перевозчик.' using errcode = '42501';
  end if;

  if v_order.status <> 'AWAIT_DRIVER' then
    raise exception 'Подтверждение больше недоступно, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  update public.orders
  set status = 'IN_PROGRESS',
      deadline_at = null
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;


-- ── Откат: заказчик, перевозчик или водитель ───────────────────────

create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_company_id uuid;
  v_driver_id uuid := (select app.current_driver_id());
begin
  v_order := app.release_expired_order(p_order_id);

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_company_id := (select app.current_company_id());

  if v_order.shipper_company_id is distinct from v_company_id
     and v_order.assigned_company_id is distinct from v_company_id
     and (v_driver_id is null or v_order.assigned_driver_id is distinct from v_driver_id
          or v_order.status <> 'AWAIT_DRIVER') then
    raise exception 'Отменить может только заказчик или выбранный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status not in ('REQUESTED', 'AWAIT_DRIVER') then
    raise exception 'Откат возможен только до начала рейса, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  delete from public.order_offers where order_id = p_order_id;

  update public.orders
  set status = 'OPEN',
      deadline_at = null,
      chosen_offer_id = null,
      assigned_company_id = null,
      assigned_vehicle_id = null
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;


-- ── Первый выход на стол ───────────────────────────────────────────

/*
 * Момент публикации ставится при первом переходе в OPEN, откуда бы он
 * ни пришёл. Прежде это делала только create_order, и заказ, впервые
 * попавший на стол после отказа от прямого назначения, остался бы без
 * даты публикации — и без рассылки.
 */
create or replace function app.stamp_first_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'OPEN' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger orders_stamp_publication
  before update of status on public.orders
  for each row execute function app.stamp_first_publication();

/*
 * Рассылка — при первом выходе на стол, а не только из черновика:
 * заказ, отменённый после прямого назначения, перевозчики страны забора
 * ещё не видели. Возврат уже опубликованного заказа по-прежнему не
 * рассылается — он поднимает order.released.
 */
create or replace function app.on_order_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (new.status = 'OPEN' and old.status <> 'OPEN' and old.published_at is null) then
    return new;
  end if;

  insert into public.notifications (company_id, kind, code, params, link)
  select
    a.id,
    'ORDER',
    'order.published',
    jsonb_build_object(
      'ref', new.ref,
      'from', coalesce(pickup.city, ''),
      /*
       * Отцепка запасным вариантом, а не город забора: подменять второй
       * конец первым — это и была прежняя ошибка.
       */
      'to', coalesce(finish.city, ret.city, '')
    ),
    '/carrier/desk'
  from app.dispatch_audience(new.id) a
  left join public.order_stops pickup
    on pickup.order_id = new.id and pickup.role = 'PICKUP'
  left join public.order_stops ret
    on ret.order_id = new.id and ret.role = 'TRAILER_RETURN'
  left join lateral app.route_end(new.id) finish on true;

  return new;
end;
$$;


-- ── Уведомления о смене статуса ────────────────────────────────────

/*
 * Прежние ветки сохранены как есть. Добавлено:
 *
 *   · прямое назначение — свой код, без срока, с номером машины и
 *     названием заказчика: перевозчик видит заказчика и на столе;
 *   · водитель назначенной машины получает то же во входящие
 *     приложения — и при выборе отклика, и при прямом назначении;
 *   · заказчик узнаёт, что прямое назначение подтвердили или отменили.
 */
create or replace function app.on_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plate text;
  v_direct boolean := old.status = 'AWAIT_DRIVER' and old.deadline_at is null;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'AWAIT_DRIVER' and new.assigned_company_id is not null then
    select plate into v_plate from public.vehicles where id = new.assigned_vehicle_id;

    if new.deadline_at is null then
      perform app.notify_event(
        new.assigned_company_id,
        'ORDER',
        'order.direct',
        jsonb_build_object(
          'ref', new.ref,
          'plate', coalesce(v_plate, ''),
          'shipper', coalesce((select name from public.companies where id = new.shipper_company_id), '')
        ),
        '/carrier/desk'
      );

      perform app.notify_driver(
        new.assigned_driver_id,
        'order.direct',
        jsonb_build_object('ref', new.ref, 'plate', coalesce(v_plate, '')),
        new.id
      );
    else
      /*
       * Выбрали перевозчика. Срок в подстановке, а не в тексте: пятнадцать
       * минут — настройка матчинга, и менять её в двух местах нельзя.
       */
      perform app.notify_event(
        new.assigned_company_id,
        'ORDER',
        'offer.chosen',
        jsonb_build_object('ref', new.ref, 'minutes', 15),
        '/carrier/desk'
      );

      perform app.notify_driver(
        new.assigned_driver_id,
        'offer.chosen',
        jsonb_build_object('ref', new.ref, 'plate', coalesce(v_plate, ''), 'minutes', 15),
        new.id
      );
    end if;

  /* Прямое назначение подтверждено — заказчик ждал без срока и должен узнать. */
  elsif new.status = 'IN_PROGRESS' and v_direct then
    select plate into v_plate from public.vehicles where id = new.assigned_vehicle_id;

    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'direct.accepted',
      jsonb_build_object('ref', new.ref, 'plate', coalesce(v_plate, '')),
      '/shipper/orders'
    );

  /*
   * Заказ вернулся на стол. Причина не различается намеренно: срок
   * вышел, водитель отказался или заказчик откатил — для обеих сторон
   * это один факт, заказ снова свободен.
   *
   * После прямого назначения заказчику уходит свой код: он направлял
   * заказ конкретной машине и должен понять, что теперь заказ на общем
   * столе, а не у неё.
   *
   * Перевозчик берётся из OLD: в этой же строке назначение уже снято.
   */
  elsif new.status = 'OPEN' and old.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS') then
    if v_direct then
      select plate into v_plate from public.vehicles where id = old.assigned_vehicle_id;

      perform app.notify_event(
        new.shipper_company_id,
        'ORDER',
        'direct.released',
        jsonb_build_object('ref', new.ref, 'plate', coalesce(v_plate, '')),
        '/shipper/orders'
      );
    else
      perform app.notify_event(
        new.shipper_company_id,
        'ORDER',
        'order.released',
        jsonb_build_object('ref', new.ref),
        '/shipper/orders'
      );
    end if;

    if old.assigned_company_id is not null then
      perform app.notify_event(
        old.assigned_company_id,
        'ORDER',
        'order.released',
        jsonb_build_object('ref', new.ref),
        '/carrier/desk'
      );
    end if;

    perform app.notify_driver(
      old.assigned_driver_id,
      'order.released',
      jsonb_build_object('ref', new.ref),
      new.id
    );

  /*
   * Рейс снят.
   *
   * Уведомляются обе стороны, а кто именно снял — не различается: тот,
   * кто нажал, и так знает. Перевозчик берётся из NEW, а не из OLD:
   * withdraw_order назначение не стирает, оставляя его историей рейса,
   * и OLD здесь дал бы то же значение только по совпадению.
   */
  elsif new.status = 'CANCELLED' then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.cancelled',
      jsonb_build_object('ref', new.ref),
      '/shipper/orders'
    );

    if coalesce(new.assigned_company_id, old.assigned_company_id) is not null then
      perform app.notify_event(
        coalesce(new.assigned_company_id, old.assigned_company_id),
        'ORDER',
        'order.cancelled',
        jsonb_build_object('ref', new.ref),
        '/carrier/desk'
      );
    end if;

    perform app.notify_driver(
      coalesce(new.assigned_driver_id, old.assigned_driver_id),
      'order.cancelled',
      jsonb_build_object('ref', new.ref),
      new.id
    );

  /* Рейс закрыт: документы у заказчика. */
  elsif new.status = 'DONE' then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.closed',
      jsonb_build_object('ref', new.ref),
      '/shipper/done'
    );
  end if;

  return new;
end;
$$;


-- ── Исход прямого назначения ───────────────────────────────────────

/*
 * Кто отменил, различается здесь, а не в уведомлении: заказчик,
 * забравший заказ у машины, — это WITHDRAWN, перевозчик или водитель,
 * отказавшиеся, — DECLINED. По этой разнице потом видно, какие машины
 * берут прямые заказы, а какие от них отказываются.
 */
create or replace function app.on_direct_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outcome public.direct_outcome;
begin
  if new.status is not distinct from old.status
     or not (old.status = 'AWAIT_DRIVER' and old.deadline_at is null) then
    return new;
  end if;

  v_outcome := case
    when new.status = 'IN_PROGRESS' then 'ACCEPTED'
    when (select app.current_company_id()) = new.shipper_company_id
      or (select app.is_admin()) then 'WITHDRAWN'
    else 'DECLINED'
  end;

  update public.order_direct_requests
  set outcome = v_outcome,
      decided_at = now()
  where order_id = new.id
    and outcome = 'PENDING';

  return new;
end;
$$;

create trigger orders_direct_outcome
  after update of status on public.orders
  for each row execute function app.on_direct_outcome();


-- ── Отклик со стола, а не прямое назначение ────────────────────────

/*
 * «Пришёл отклик» заказчику при прямом назначении — ложь: он сам
 * направил заказ этой машине и ждёт подтверждения, а не выбора.
 */
create or replace function app.on_offer_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if new.origin = 'DIRECT' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then return new; end if;

  perform app.notify_event(
    v_order.shipper_company_id,
    'ORDER',
    'offer.received',
    jsonb_build_object('ref', v_order.ref),
    '/shipper/orders'
  );

  return new;
end;
$$;


-- ── Предложение постоянной работы ──────────────────────────────────

/*
 * Первый закрытый рейс пары «перевозчик — заказчик» заводит строку
 * согласия в состоянии OFFERED и спрашивает перевозчика. Спрашивает
 * один раз: следующие рейсы находят строку и молчат, в каком бы
 * состоянии она ни была, — отказавшегося не уговаривают.
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
     or new.assigned_company_id is null then
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

create trigger orders_offer_link
  after update of status on public.orders
  for each row execute function app.on_first_trip_together();

/* Пары, уже возившие вместе, получают строку без уведомления: спрашивает страница. */
insert into public.carrier_shipper_links (carrier_company_id, shipper_company_id)
select distinct o.assigned_company_id, o.shipper_company_id
from public.orders o
where o.status = 'DONE' and o.assigned_company_id is not null
on conflict do nothing;


-- ── Решение перевозчика ────────────────────────────────────────────

create or replace function public.set_shipper_link(p_shipper_id uuid, p_allow boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := (select app.current_company_id());
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Решать может только перевозчик.' using errcode = '42501';
  end if;

  update public.carrier_shipper_links
  set status = case when p_allow then 'ACTIVE' else 'REVOKED' end::public.link_status,
      decided_by = (select auth.uid()),
      decided_at = now()
  where carrier_company_id = v_company_id
    and shipper_company_id = p_shipper_id;

  if not found then
    raise exception 'С этим заказчиком у вас ещё не было рейсов.' using errcode = '55000';
  end if;

  /*
   * Отзыв согласия убирает машины из пула заказчика сразу. Уже
   * назначенные заказы не трогаются: их отменяют кнопкой, осознанно.
   */
  if not p_allow then
    delete from public.shipper_vehicle_pool p
    using public.vehicles v
    where p.vehicle_id = v.id
      and v.company_id = v_company_id
      and p.shipper_company_id = p_shipper_id;
  end if;
end;
$$;

revoke all on function public.set_shipper_link(uuid, boolean) from public, anon;
grant execute on function public.set_shipper_link(uuid, boolean) to authenticated;

/* Заказчики, с которыми перевозчик возил, и его решение по каждому. */
create or replace function public.carrier_partners()
returns table (
  shipper_id uuid,
  shipper_name text,
  trips integer,
  last_trip_at timestamptz,
  status public.link_status,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.shipper_company_id,
    c.name,
    (select count(*)::integer from public.orders o
      where o.assigned_company_id = l.carrier_company_id
        and o.shipper_company_id = l.shipper_company_id
        and o.status = 'DONE'),
    (select max(o.closed_at) from public.orders o
      where o.assigned_company_id = l.carrier_company_id
        and o.shipper_company_id = l.shipper_company_id
        and o.status = 'DONE'),
    l.status,
    l.decided_at
  from public.carrier_shipper_links l
  join public.companies c on c.id = l.shipper_company_id
  where l.carrier_company_id = (select app.current_company_id())
  order by (l.status = 'OFFERED') desc, c.name;
$$;

revoke all on function public.carrier_partners() from public, anon;
grant execute on function public.carrier_partners() to authenticated;


-- ── Знакомые машины заказчика ──────────────────────────────────────

/*
 * Явный список колонок, как у offers_for_shipper: здесь записано, что
 * заказчик видит о знакомой машине. Названия и идентификатора
 * перевозчика нет — см. шапку. Телефона водителя нет тоже.
 *
 * busy — машина уже везёт рейс или ждёт подтверждения другого.
 * Назначению это не мешает, но заказчику стоит знать, что ответа
 * может не быть до конца текущего рейса.
 */
create or replace function public.known_vehicles_for_shipper()
returns table (
  vehicle_id uuid,
  plate text,
  driver_name text,
  vehicle_class public.vehicle_class,
  make text,
  axles smallint,
  euro_class public.euro_class,
  payload_kg integer,
  ldm numeric,
  container_feet smallint[],
  rating numeric,
  trips integer,
  last_trip_at timestamptz,
  in_pool boolean,
  busy boolean,
  available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select app.current_company_id() as id),
  history as (
    select o.assigned_vehicle_id as vehicle_id,
           count(*)::integer as trips,
           max(o.closed_at) as last_trip_at
    from public.orders o, me
    where o.shipper_company_id = me.id
      and o.status = 'DONE'
      and o.assigned_vehicle_id is not null
    group by o.assigned_vehicle_id
  )
  select
    v.id,
    v.plate,
    v.driver_name,
    v.vehicle_class,
    v.make,
    v.axles,
    v.euro_class,
    v.payload_kg,
    v.ldm,
    v.container_feet,
    app.company_rating(v.company_id),
    h.trips,
    h.last_trip_at,
    exists (
      select 1 from public.shipper_vehicle_pool p, me
      where p.shipper_company_id = me.id and p.vehicle_id = v.id
    ),
    exists (
      select 1 from public.orders o
      where o.assigned_vehicle_id = v.id
        and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    ),
    coalesce(app.vehicle_is_dispatchable(v.id), false)
  from history h
  join public.vehicles v on v.id = h.vehicle_id
  cross join me
  join public.carrier_shipper_links l
    on l.carrier_company_id = v.company_id
   and l.shipper_company_id = me.id
   and l.status = 'ACTIVE'
  where (select app.current_party_role()) = 'SHIPPER'
  order by 14 desc, h.trips desc, v.plate;
$$;

revoke all on function public.known_vehicles_for_shipper() from public, anon;
grant execute on function public.known_vehicles_for_shipper() to authenticated;

create or replace function public.pool_add_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := (select app.current_company_id());
begin
  if (select app.current_party_role()) is distinct from 'SHIPPER'
     or not app.shipper_knows_vehicle(v_company_id, p_vehicle_id) then
    raise exception 'Машина не среди ваших знакомых.' using errcode = '42501';
  end if;

  insert into public.shipper_vehicle_pool (shipper_company_id, vehicle_id, added_by)
  values (v_company_id, p_vehicle_id, (select auth.uid()))
  on conflict do nothing;
end;
$$;

create or replace function public.pool_remove_vehicle(p_vehicle_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.shipper_vehicle_pool
  where shipper_company_id = (select app.current_company_id())
    and vehicle_id = p_vehicle_id;
$$;

revoke all on function public.pool_add_vehicle(uuid), public.pool_remove_vehicle(uuid) from public, anon;
grant execute on function public.pool_add_vehicle(uuid), public.pool_remove_vehicle(uuid) to authenticated;


-- ── Права на новые таблицы ─────────────────────────────────────────

alter table public.carrier_shipper_links enable row level security;
alter table public.shipper_vehicle_pool enable row level security;
alter table public.order_direct_requests enable row level security;
alter table public.driver_notifications enable row level security;

revoke all on public.carrier_shipper_links from anon, authenticated;
revoke all on public.shipper_vehicle_pool from anon, authenticated;
revoke all on public.order_direct_requests from anon, authenticated;
revoke all on public.driver_notifications from anon, authenticated;

/*
 * Строку согласия читает перевозчик. Заказчику она не отдаётся:
 * в ней идентификатор перевозчика, а его заказчик не видит.
 */
grant select on public.carrier_shipper_links to authenticated;

create policy carrier_shipper_links_select_carrier
  on public.carrier_shipper_links for select to authenticated
  using (carrier_company_id = (select app.current_company_id()));

create policy carrier_shipper_links_select_admin
  on public.carrier_shipper_links for select to authenticated
  using ((select app.is_admin()));

grant select on public.shipper_vehicle_pool to authenticated;

create policy shipper_vehicle_pool_select_own
  on public.shipper_vehicle_pool for select to authenticated
  using (shipper_company_id = (select app.current_company_id()));

/*
 * История прямых назначений: перевозчику — свои, оператору — все.
 * Заказчик видит исход через уведомления и карточку заказа, а в
 * строке здесь идентификатор перевозчика.
 */
grant select on public.order_direct_requests to authenticated;

create policy order_direct_requests_select_carrier
  on public.order_direct_requests for select to authenticated
  using (carrier_company_id = (select app.current_company_id()));

create policy order_direct_requests_select_admin
  on public.order_direct_requests for select to authenticated
  using ((select app.is_admin()));

grant select on public.driver_notifications to authenticated;
grant update (read_at) on public.driver_notifications to authenticated;

create policy driver_notifications_select_self
  on public.driver_notifications for select to authenticated
  using (driver_id = (select app.current_driver_id()));

create policy driver_notifications_update_self
  on public.driver_notifications for update to authenticated
  using (driver_id = (select app.current_driver_id()))
  with check (driver_id = (select app.current_driver_id()));


-- ── Публикация знает прямое назначение ─────────────────────────────

/*
 * Тело прежнее (20260914170000_express_visible), кроме последнего шага:
 * p_order->>'direct_vehicle_id' отправляет проверенный заказ знакомой
 * машине вместо стола. Сигнатура не меняется — поле в том же JSON, что
 * и остальные поля заказа.
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
    route_geometry, route_bounds, route_fingerprint, route_computed_at
  )
  values (
    v_company.id,
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
    case when v_geometry is not null then now() end
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

    /*
     * Прямое назначение знакомой машине вместо стола. Проверки полноты
     * выше общие: заказ, ушедший напрямую, при отмене попадает на стол,
     * и там он обязан быть таким же полным, как любой другой.
     */
    v_direct := nullif(p_order->>'direct_vehicle_id', '')::uuid;

    if v_direct is not null then
      v_order := app.direct_assign(v_order.id, v_direct);
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
