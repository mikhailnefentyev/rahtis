-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 5 · матчинг
--
-- Отклики до трёх машин, выбор заказчиком, подтверждение водителем,
-- таймауты 15 минут и откаты (ТЗ §6).
--
-- Главное решение — как устроены таймауты.
--
-- Планировщик, который раз в минуту переводит просроченные заказы в OPEN,
-- оставляет окно: до его срабатывания заказ ещё заперт, хотя срок вышел.
-- А если планировщик остановится, заказы запрутся навсегда.
--
-- Поэтому срок действует сразу и без него: любое действие над заказом
-- сначала снимает истёкшую бронь в той же транзакции, а стол показывает
-- просроченный заказ как открытый. Планировщик остаётся, но его работа —
-- прибраться и дать повод для уведомлений, а не обеспечить правильность.
-- ═══════════════════════════════════════════════════════════════════

-- ── Отклики ────────────────────────────────────────────────────────

create table public.order_offers (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null references public.orders (id) on delete cascade,
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint order_offers_one_per_vehicle unique (order_id, vehicle_id),

  /*
   * Одна компания — один отклик на заказ.
   *
   * ТЗ говорит «до трёх машин», и буквально это допускало бы, что один
   * перевозчик занимает все три места своими тягачами. Но заказчик по ТЗ
   * «выбирает одного из трёх» по рейтингу, а рейтинг копится на компанию:
   * три машины одного перевозчика — это один и тот же выбор, показанный
   * трижды. Настоящего выбора у заказчика при этом нет, а двум другим
   * перевозчикам места не остаётся.
   */
  constraint order_offers_one_per_company unique (order_id, carrier_company_id)
);

comment on table public.order_offers is
  'Отклики перевозчиков. Не больше трёх на заказ, по одному от компании (ТЗ §6).';

create index order_offers_order_idx on public.order_offers (order_id, created_at);
create index order_offers_company_idx on public.order_offers (carrier_company_id, created_at desc);


-- ── Поля матчинга у заказа ─────────────────────────────────────────

alter table public.orders
  /*
   * Момент, до которого действует текущее решение: выбор заказчика или
   * подтверждение водителя. NULL означает, что заказ никого не ждёт.
   */
  add column deadline_at timestamptz,

  add column chosen_offer_id uuid references public.order_offers (id) on delete set null,

  /*
   * Назначенные перевозчик и машина. Выводятся из выбранного отклика, но
   * хранятся отдельно: по ним работает политика доступа назначенного
   * перевозчика и отчётность Этапа 7, а join к откликам в каждой политике
   * стоил бы дороже, чем две колонки.
   */
  add column assigned_company_id uuid references public.companies (id) on delete set null,
  add column assigned_vehicle_id uuid references public.vehicles (id) on delete set null,

  add constraint orders_deadline_only_while_waiting
    check (deadline_at is null or status in ('REQUESTED', 'AWAIT_DRIVER')),

  add constraint orders_assignment_consistent
    check (
      (assigned_company_id is null) = (assigned_vehicle_id is null)
    );

create index orders_deadline_idx on public.orders (deadline_at)
  where status in ('REQUESTED', 'AWAIT_DRIVER');

create index orders_assigned_idx on public.orders (assigned_company_id)
  where assigned_company_id is not null;


-- ── Срок как факт, а не как задание планировщика ───────────────────

/*
 * Истёк ли срок ожидания у заказа прямо сейчас.
 *
 * Одно определение на всё: и для чтения стола, и для проверок внутри
 * функций действия. Иначе «просрочен» на столе и «просрочен» при попытке
 * взять заказ разошлись бы.
 */
create or replace function app.order_deadline_passed(
  p_status public.order_status,
  p_deadline timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('REQUESTED', 'AWAIT_DRIVER')
     and p_deadline is not null
     and p_deadline < now();
$$;

/*
 * Снимает истёкшую бронь: заказ возвращается на стол, отклики стираются.
 *
 * Вызывается в начале каждой операции над заказом, поэтому просроченная
 * бронь не доживает до момента, когда на неё кто-то мог бы опереться.
 * Планировщику остаётся уборка, а не правильность.
 */
create or replace function app.release_expired_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if v_order.id is null then
    return null;
  end if;

  if not app.order_deadline_passed(v_order.status, v_order.deadline_at) then
    return v_order;
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

comment on function app.release_expired_order(uuid) is
  'Возвращает заказ на стол, если срок решения истёк. Идемпотентна.';

/*
 * Уборка по расписанию. Правильность от неё не зависит — она нужна, чтобы
 * просроченные заказы возвращались на стол без чьего-либо действия и
 * чтобы у уведомлений (Этап 8) был повод сработать.
 *
 * Вызывается планировщиком: pg_cron, Supabase scheduled function или n8n
 * по расписанию (ТЗ §6).
 */
create or replace function public.expire_order_deadlines()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id from public.orders
    where status in ('REQUESTED', 'AWAIT_DRIVER')
      and deadline_at is not null
      and deadline_at < now()
    for update skip locked
  loop
    perform app.release_expired_order(v_order.id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_order_deadlines() is
  'Возвращает на стол все заказы с истёкшим сроком. Для планировщика.';

revoke all on function public.expire_order_deadlines() from public, anon, authenticated;
grant execute on function public.expire_order_deadlines() to service_role;


-- ── Отклик перевозчика ─────────────────────────────────────────────

/*
 * «Беру».
 *
 * Заказ блокируется на время проверки: без этого два перевозчика,
 * нажавшие одновременно, могли бы оба увидеть «мест 2 из 3» и оба
 * записаться четвёртым и пятым.
 */
create or replace function public.take_order(p_order_id uuid, p_vehicle_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_vehicle public.vehicles;
  v_company_id uuid;
  v_offers integer;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Откликаться может только перевозчик.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;

  if v_vehicle.id is null or v_vehicle.company_id is distinct from v_company_id then
    raise exception 'Машина не найдена в вашем автопарке.' using errcode = '42501';
  end if;

  if not app.vehicle_is_dispatchable(p_vehicle_id) then
    raise exception 'Машина не допущена к заказам или документы компании просрочены.'
      using errcode = '55000';
  end if;

  /* Истёкшая бронь снимается здесь же — заказ мог освободиться минуту назад. */
  v_order := app.release_expired_order(p_order_id);

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_order.status <> 'OPEN' and v_order.status <> 'REQUESTED' then
    raise exception 'Заказ уже не на столе, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  select count(*) into v_offers from public.order_offers where order_id = p_order_id;

  if v_offers >= 3 then
    raise exception 'Мест нет: на заказ уже откликнулись три машины.' using errcode = '55000';
  end if;

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, created_by)
  values (p_order_id, v_company_id, p_vehicle_id, (select auth.uid()));

  /*
   * Отсчёт запускает первый отклик и дальше не сдвигается: пятнадцать
   * минут даётся заказчику на решение, а не каждому новому отклику.
   */
  update public.orders
  set status = 'REQUESTED',
      deadline_at = coalesce(deadline_at, now() + interval '15 minutes')
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;


-- ── Выбор заказчика ────────────────────────────────────────────────

create or replace function public.choose_offer(p_offer_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.order_offers;
  v_order public.orders;
begin
  select * into v_offer from public.order_offers where id = p_offer_id;

  if v_offer.id is null then
    raise exception 'Отклик не найден.' using errcode = 'P0002';
  end if;

  v_order := app.release_expired_order(v_offer.order_id);

  if v_order.shipper_company_id is distinct from (select app.current_company_id()) then
    raise exception 'Выбирать перевозчика может только заказчик этого заказа.'
      using errcode = '42501';
  end if;

  /*
   * Если срок вышел, бронь уже снята выше вместе с откликами — значит
   * выбирать нечего. Сообщаем прямо, а не молча ничего не делаем.
   */
  if v_order.status <> 'REQUESTED' then
    raise exception 'Выбор больше недоступен, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  update public.orders
  set status = 'AWAIT_DRIVER',
      chosen_offer_id = v_offer.id,
      assigned_company_id = v_offer.carrier_company_id,
      assigned_vehicle_id = v_offer.vehicle_id,
      /* Пятнадцать минут теперь у водителя (ТЗ §6). */
      deadline_at = now() + interval '15 minutes'
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;


-- ── Подтверждение водителем ────────────────────────────────────────

create or replace function public.confirm_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  v_order := app.release_expired_order(p_order_id);

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_order.assigned_company_id is distinct from (select app.current_company_id()) then
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


-- ── Откат ──────────────────────────────────────────────────────────

/*
 * Отмена до старта: заказ возвращается на стол, отклики стираются.
 *
 * Право есть у обеих сторон (ТЗ §6): у заказчика — всегда до старта,
 * у назначенного перевозчика — пока он не подтвердил. После старта рейс
 * уже идёт, и это другая история.
 */
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_company_id uuid;
begin
  v_order := app.release_expired_order(p_order_id);

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_company_id := (select app.current_company_id());

  if v_order.shipper_company_id is distinct from v_company_id
     and v_order.assigned_company_id is distinct from v_company_id then
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


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.order_offers enable row level security;
revoke all on public.order_offers from anon, authenticated;
grant select on public.order_offers to authenticated;

/* Заказчик видит отклики на свои заказы — из них он и выбирает. */
create policy order_offers_select_shipper
  on public.order_offers for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.shipper_company_id = (select app.current_company_id())
    )
  );

/* Перевозчик видит только свои отклики, но не чужие: сколько машин уже
   откликнулось, ему сообщает стол числом, а кто именно — не его дело. */
create policy order_offers_select_own
  on public.order_offers for select to authenticated
  using (carrier_company_id = (select app.current_company_id()));

create policy order_offers_select_admin
  on public.order_offers for select to authenticated
  using ((select app.is_admin()));

/*
 * Назначенный перевозчик получает доступ к заказу и маршруту целиком —
 * вместе с контактами получателя. До закрепления заказа за ним контакты
 * скрывались функцией стола; теперь они нужны ему для работы.
 */
create policy orders_select_assigned
  on public.orders for select to authenticated
  using (assigned_company_id = (select app.current_company_id()));

create policy order_stops_select_assigned
  on public.order_stops for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.assigned_company_id = (select app.current_company_id())
    )
  );

revoke all on function public.take_order(uuid, uuid) from public, anon;
revoke all on function public.choose_offer(uuid) from public, anon;
revoke all on function public.confirm_order(uuid) from public, anon;
revoke all on function public.cancel_order(uuid) from public, anon;

grant execute on function public.take_order(uuid, uuid) to authenticated, service_role;
grant execute on function public.choose_offer(uuid) to authenticated, service_role;
grant execute on function public.confirm_order(uuid) to authenticated, service_role;
grant execute on function public.cancel_order(uuid) to authenticated, service_role;
