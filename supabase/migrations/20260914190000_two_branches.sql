-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · две ветки вместо четырёх классов
--
-- Предыдущая миграция сверяла класс машины с единицей заказа один в
-- один: заказ на фургон брал только фургон, заказ на грузовик — только
-- грузовик. Рассуждение было такое: заказчик выбрал размер машины
-- сознательно, и смягчение показало бы владельцу грузовика вдвое больше
-- заказов, половину из которых брать невыгодно.
--
-- Рассуждение неверное в своей главной части. «Невыгодно» решает не
-- платформа, а тот, у кого машина едет обратно порожняком: полтонны на
-- обратном плече — это не убыток, а всё, что удалось спасти из пустого
-- пробега. Запрещая такой отклик, мы отнимали деньги у перевозчика и
-- исполнителя у заказчика ради чистоты перечисления.
--
-- Поэтому веток две, и решают они только одно — какую половину витрины
-- человек видит:
--
--   единица едет за машиной  →  тягачи (перецепы и контейнеры);
--   груз едет в машине       →  грузовики и микроавтобусы (экспресс).
--
-- Внутри ветки ограничений по классу нет. Влезет или нет, решают числа,
-- и они уже проверяются: контейнер — длиной шасси, экспресс —
-- погрузочными метрами и грузоподъёмностью. Фургон на 3,4 метра не
-- возьмёт шестиметровый груз, и сказать это числом честнее, чем
-- названием класса.
--
-- Для заказчика выбор между микроавтобусом и грузовиком остаётся: он
-- задаёт ожидание размера и виден на карточке. Он перестал быть
-- запретом — и только.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Ветка вместо класса.
 *
 * Два определения рядом, потому что вопрос один, а спрашивают его с
 * двух сторон: у заказа — чем его выполняют, у машины — что она умеет.
 * Развести их по разным местам значит однажды получить машину, которая
 * видит заказ и не может его взять.
 */
create type public.haul_branch as enum ('UNIT', 'EXPRESS');

comment on type public.haul_branch is
  'Половина витрины: UNIT — единица едет за машиной, EXPRESS — груз едет в машине.';

create or replace function app.haul_branch(p_haul_kind public.haul_kind)
returns public.haul_branch
language sql
immutable
set search_path = ''
as $$
  select case
    when p_haul_kind in ('TRAILER', 'CONTAINER') then 'UNIT'::public.haul_branch
    else 'EXPRESS'::public.haul_branch
  end;
$$;

create or replace function app.vehicle_branch(p_vehicle_class public.vehicle_class)
returns public.haul_branch
language sql
immutable
set search_path = ''
as $$
  select case
    when p_vehicle_class = 'TRACTOR' then 'UNIT'::public.haul_branch
    else 'EXPRESS'::public.haul_branch
  end;
$$;

comment on function app.haul_branch(public.haul_kind) is
  'В какой половине витрины живёт этот заказ.';
comment on function app.vehicle_branch(public.vehicle_class) is
  'В какой половине витрины работает эта машина.';

revoke all on function app.haul_branch(public.haul_kind) from public, anon;
revoke all on function app.vehicle_branch(public.vehicle_class) from public, anon;
grant execute on function app.haul_branch(public.haul_kind) to authenticated, service_role;
grant execute on function app.vehicle_branch(public.vehicle_class) to authenticated, service_role;


-- ── Подходит ли машина под единицу заказа ──────────────────────────

create or replace function app.vehicle_fits_haul(
  p_vehicle_id uuid,
  p_haul_kind public.haul_kind,
  p_container_feet smallint,
  p_ldm numeric default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vehicles v
    where v.id = p_vehicle_id
      and app.vehicle_branch(v.vehicle_class) = app.haul_branch(p_haul_kind)
      and case p_haul_kind
        /* Седло есть у любого тягача — отдельного признака не заводим. */
        when 'TRAILER' then true
        when 'CONTAINER' then p_container_feet = any (v.container_feet)
        /* Метры кузова против метров груза — и ничего про класс. */
        else p_ldm is not null and v.ldm >= p_ldm
      end
  );
$$;

comment on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint, numeric) is
  'Возьмёт ли машина единицу заказа: та же ветка, контейнер по длине шасси, экспресс по погрузочным метрам.';


-- ── Есть ли чем работать в этой ветке ──────────────────────────────

create or replace function app.has_vehicle_for_haul(
  p_company_id uuid,
  p_haul_kind public.haul_kind
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.company_id = p_company_id
      and v.access = 'APPROVED'
      and app.vehicle_branch(v.vehicle_class) = app.haul_branch(p_haul_kind)
  );
$$;

comment on function app.has_vehicle_for_haul(uuid, public.haul_kind) is
  'Есть ли у перевозчика допущенная машина нужной ветки. Гейт витрины и рассылки.';


-- ── Отклик: сообщение об отказе стало про ветку ────────────────────

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
  v_needed integer;
  v_capacity integer;
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

  /*
   * Машина против единицы. Коды разные, потому что перевозчику нужно
   * понять, какая машина подойдёт, а не просто «не получилось»:
   * 55002 — нет шасси нужной длины, 55003 — не та ветка или мало
   * погрузочных метров. Проверка стоит раньше веса: не влезающий груз не
   * спасёт никакая грузоподъёмность.
   */
  if not app.vehicle_fits_haul(p_vehicle_id, v_order.haul_kind, v_order.container_feet, v_order.ldm) then
    if app.vehicle_branch(v_vehicle.vehicle_class) <> app.haul_branch(v_order.haul_kind) then
      if app.haul_carries_unit(v_order.haul_kind) then
        raise exception 'Этот заказ возят тягачом: груз едет за машиной, а не в ней.'
          using errcode = '55003';
      else
        raise exception 'Этот заказ возят грузовиком или микроавтобусом: груз едет в машине.'
          using errcode = '55003';
      end if;
    elsif v_order.haul_kind = 'CONTAINER' then
      raise exception 'Машина не берёт %-футовый контейнер.', v_order.container_feet
        using errcode = '55002';
    else
      raise exception 'Нужен кузов от % погрузочных метров.', v_order.ldm
        using errcode = '55003';
    end if;
  end if;

  /*
   * Вес против вместимости.
   *
   * Отдельный код, а не общий 55000: перевозчику нужно отличить «не
   * хватает грузоподъёмности» от «мест нет» и «заказ уже занят».
   */
  v_needed := app.order_max_weight_kg(p_order_id);
  v_capacity := app.vehicle_capacity_kg(p_vehicle_id);

  if v_needed > v_capacity then
    raise exception 'Груз % кг превышает грузоподъёмность машины % кг.', v_needed, v_capacity
      using errcode = '55001';
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

comment on function public.take_order(uuid, uuid) is
  'Отклик перевозчика: допуск машины, ветка и вместимость под единицу, вес против грузоподъёмности, лимит трёх мест.';


-- ── Прежний перевод единицы в класс больше не нужен ────────────────

/*
 * Функция осталась бы вторым определением того же вопроса и рано или
 * поздно разошлась бы с веткой — ровно та ошибка, от которой она сама и
 * заводилась.
 */
drop function if exists app.haul_vehicle_class(public.haul_kind);
