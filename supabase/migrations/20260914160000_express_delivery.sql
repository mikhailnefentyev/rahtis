-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · экспресс-доставка: фургон и грузовик
--
-- Новая ветка рядом с перецепом и контейнером. Заказчик выбирает не
-- единицу, которую надо забрать и вернуть, а машину, в которой поедет
-- груз: микроавтобус до 3,5 тонн или грузовик до 26 тонн. Дальше всё то
-- же самое — стол, три отклика, пятнадцать минут на решение, рейс,
-- документы, отчёт.
--
-- ЧТО ОТЛИЧАЕТСЯ ПО СУТИ — одна вещь: единицы нет. У перецепа и
-- контейнера рейс начинается с забора железа и заканчивается его
-- возвратом, а груз — это то, что в него кладут по дороге. У экспресса
-- груз и есть рейс: забрали по одному адресу, привезли по другому.
-- Отсюда всё остальное:
--
--   • номер единицы не спрашивается — искать на площадке нечего;
--   • точка возврата не нужна, форма рейса всегда «в один конец»;
--   • вместимость меряется не осями, а грузоподъёмностью и
--     погрузочными метрами.
--
-- ПОГРУЗОЧНЫЕ МЕТРЫ (LDM) — на заказе, вес — на точке забора.
--
-- Соблазн положить рядом оба поля заказа сильный, но вес уже живёт в
-- order_stops.cargo_weight_kg, и по нему считает app.order_max_weight_kg,
-- которой проверяется каждый отклик. Второй экземпляр веса на заказе
-- разошёлся бы с первым на первой же правке маршрута, и отклик
-- проверялся бы не по тому числу, которое видит водитель.
--
-- Метры, наоборот, свойство рейса целиком: это место в кузове, занятое
-- на всю дорогу, а не характеристика точки. Габариты остаются в
-- описании — коробка 120×80×160 не сводится к одному числу, а
-- раскладывать её на три колонки значит требовать точности, которой у
-- заказчика в момент публикации нет.
--
-- КЛАСС МАШИНЫ — отдельный тип, а не «оси, но по-другому».
--
-- axle_capacity_kg переводит число осей в тонны, и для седельного тягача
-- это верно. К фургону оно неприменимо: у него две оси и полторы тонны
-- грузоподъёмности, а правило выдало бы двадцать пять. Поэтому у машины
-- появляется класс, и вместимость читается по классу: у тягача по осям,
-- у фургона и грузовика — по заявленной грузоподъёмности.
--
-- СТРОГОЕ СОВПАДЕНИЕ КЛАССА. Заказ на фургон берёт фургон, заказ на
-- грузовик — грузовик. Грузовик физически увезёт и фургонный груз, но
-- заказчик выбирал размер машины сознательно и заплатил за него; а на
-- столе смягчение означало бы, что владелец грузовика видит вдвое больше
-- заказов, половину из которых брать невыгодно.
--
-- ОБОРУДОВАНИЕ ЗАЯВЛЯЕТ ПЕРЕВОЗЧИК, А НЕ ТРЕБУЕТ ЗАКАЗЧИК. Гидроборт,
-- боковая загрузка и холодильная установка стоят в карточке машины и
-- видны при выборе отклика. Требованием заказа они намеренно не
-- сделаны: пока таких машин в парке единицы, обязательное требование
-- превратилось бы в заказ, который некому взять, и заказчик об этом
-- даже не узнал бы. Когда парк наберётся, требование добавится — оно
-- ляжет поверх, а не вместо.
--
-- КОЛОНОЧНЫЕ ГРАНТЫ. На них уже обжигались дважды — с trailer_plate и с
-- haul_kind, — и оба раза кабинет заказчика показывал «заказов нет» при
-- полной базе: Postgres отказывает не в колонке, а в запросе целиком.
-- Поэтому каждая новая колонка здесь получает грант явно, в этой же
-- миграции.
-- ═══════════════════════════════════════════════════════════════════


-- ── Класс машины ───────────────────────────────────────────────────

create type public.vehicle_class as enum ('TRACTOR', 'VAN', 'TRUCK');

comment on type public.vehicle_class is
  'Чем работает машина: седельный тягач, микроавтобус до 3,5 т или грузовик до 26 т.';

/*
 * Весь существующий парк — тягачи, и умолчание это фиксирует. Приписать
 * машине класс задним числом нельзя ниоткуда: ни оси, ни эко-класс о нём
 * не говорят.
 */
alter table public.vehicles
  add column vehicle_class public.vehicle_class not null default 'TRACTOR',

  /* Сколько килограммов берёт кузов. У тягача считается по осям. */
  add column payload_kg integer,

  /* Погрузочные метры кузова: длина пола, занятая грузом. */
  add column ldm numeric(4, 1),

  add column tail_lift boolean not null default false,
  add column side_loading boolean not null default false,
  add column reefer boolean not null default false,

  /* До какого числа действует техосмотр холодильной установки. */
  add column reefer_inspection_until date,

  add constraint vehicles_express_capacity
    check (
      case vehicle_class
        when 'TRACTOR' then payload_kg is null and ldm is null
        else payload_kg is not null and ldm is not null
      end
    ),

  /* Микроавтобус — это общая масса 3,5 тонны, груза в нём меньше. */
  add constraint vehicles_van_payload
    check (vehicle_class <> 'VAN' or payload_kg <= 3500),

  add constraint vehicles_payload_range
    check (payload_kg is null or payload_kg between 100 and 26000),

  add constraint vehicles_ldm_range
    check (ldm is null or (ldm > 0 and ldm <= 20)),

  /*
   * Заявленный холодильник без даты техосмотра — это обещание, которое
   * нечем проверить. Дату спрашиваем сразу, вместе с галочкой.
   */
  add constraint vehicles_reefer_inspection
    check (not reefer or reefer_inspection_until is not null),

  /* Контейнерное шасси бывает только у тягача. */
  add constraint vehicles_container_feet_tractor_only
    check (vehicle_class = 'TRACTOR' or container_feet = '{}'::smallint[]);

comment on column public.vehicles.vehicle_class is
  'Тягач, микроавтобус или грузовик. От класса зависит, какие заказы машина видит и может взять.';
comment on column public.vehicles.payload_kg is
  'Грузоподъёмность кузова в килограммах. NULL у тягача: там считают по осям.';
comment on column public.vehicles.ldm is
  'Погрузочные метры кузова. NULL у тягача.';
comment on column public.vehicles.reefer_inspection_until is
  'Срок техосмотра холодильной установки. Обязателен, если холодильник заявлен.';

/*
 * Без колоночного гранта перевозчик не запишет поле, а форма отдаст
 * ошибку прав там, где человек видит обычное сохранение.
 */
grant update (
  vehicle_class, payload_kg, ldm, tail_lift, side_loading, reefer, reefer_inspection_until
) on public.vehicles to authenticated;

/*
 * Смена класса, грузоподъёмности или метров возвращает карточку на
 * проверку: оператор допускал машину определённого размера, и молчаливое
 * превращение фургона в грузовик обесценило бы это решение.
 *
 * Гидроборт, боковая загрузка и холодильник сюда не входят намеренно.
 * Это оснащение, а не класс: отправлять карточку на повторный допуск
 * из-за галочки «есть гидроборт» значит отучить её заполнять.
 */
create or replace function app.reset_vehicle_access_on_material_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.access = 'APPROVED' and (
       new.plate is distinct from old.plate
    or new.driver_name is distinct from old.driver_name
    or new.axles is distinct from old.axles
    or new.euro_class is distinct from old.euro_class
    or new.vehicle_class is distinct from old.vehicle_class
    or new.payload_kg is distinct from old.payload_kg
    or new.ldm is distinct from old.ldm
  ) then
    new.access := 'PENDING';
    new.submitted_at := now();
    new.approved_at := null;
  end if;

  return new;
end;
$$;


-- ── Заказ ──────────────────────────────────────────────────────────

alter table public.orders
  add column ldm numeric(4, 1),

  add constraint orders_ldm_only_for_express
    check ((haul_kind in ('VAN', 'TRUCK')) = (ldm is not null)),

  add constraint orders_ldm_range
    check (ldm is null or (ldm > 0 and ldm <= 20));

comment on column public.orders.ldm is
  'Погрузочные метры груза. Только у экспресса: у перецепа и контейнера место меряет сама единица.';

grant select (ldm) on public.orders to authenticated;


-- ── Какая машина нужна этому заказу ────────────────────────────────

/*
 * Одно правило перевода единицы в класс машины. Записано один раз,
 * потому что его спрашивают стол, рассылка и отклик, и разойтись им
 * нельзя: заказ, который виден на столе, но не берётся, хуже невидимого.
 */
create or replace function app.haul_vehicle_class(p_haul_kind public.haul_kind)
returns public.vehicle_class
language sql
immutable
set search_path = ''
as $$
  select case p_haul_kind
    when 'VAN' then 'VAN'::public.vehicle_class
    when 'TRUCK' then 'TRUCK'::public.vehicle_class
    else 'TRACTOR'::public.vehicle_class
  end;
$$;

comment on function app.haul_vehicle_class(public.haul_kind) is
  'Класс машины, которым выполняется единица рейса. Совпадение строгое.';

/*
 * Везут ли единицу отдельно от машины.
 *
 * По этому вопросу расходится половина формы: забор и возврат единицы,
 * её номер, подписи точек. Проверять «haul_kind in (TRAILER, CONTAINER)»
 * на местах значило бы получить пятый и шестой список при следующей
 * единице.
 */
create or replace function app.haul_carries_unit(p_haul_kind public.haul_kind)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_haul_kind in ('TRAILER', 'CONTAINER');
$$;

comment on function app.haul_carries_unit(public.haul_kind) is
  'Есть ли у рейса единица, которую забирают и возвращают. У экспресса груз едет в машине.';

revoke all on function app.haul_vehicle_class(public.haul_kind) from public, anon;
revoke all on function app.haul_carries_unit(public.haul_kind) from public, anon;
grant execute on function app.haul_vehicle_class(public.haul_kind) to authenticated, service_role;
grant execute on function app.haul_carries_unit(public.haul_kind) to authenticated, service_role;


-- ── Подходит ли машина под единицу заказа ──────────────────────────

drop function if exists app.vehicle_fits_haul(uuid, public.haul_kind, smallint);

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
      and v.vehicle_class = app.haul_vehicle_class(p_haul_kind)
      and case p_haul_kind
        /* Седло есть у любого тягача — отдельного признака не заводим. */
        when 'TRAILER' then true
        when 'CONTAINER' then p_container_feet = any (v.container_feet)
        /* Метры кузова против метров груза. */
        else p_ldm is not null and v.ldm >= p_ldm
      end
  );
$$;

comment on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint, numeric) is
  'Возьмёт ли машина единицу заказа: класс строго, контейнер по длине шасси, экспресс по погрузочным метрам.';

revoke all on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint, numeric)
  from public, anon;
grant execute on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint, numeric)
  to authenticated, service_role;


/*
 * Есть ли у компании хоть одна допущенная машина нужного класса.
 *
 * Грубее, чем проверка отклика: метры и грузоподъёмность здесь не
 * смотрятся. Так и задумано — стол остаётся витриной, на которой видно
 * пограничные заказы, но не показывает целую ветку тому, кто в ней
 * работать не может.
 */
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
      and v.vehicle_class = app.haul_vehicle_class(p_haul_kind)
  );
$$;

comment on function app.has_vehicle_for_haul(uuid, public.haul_kind) is
  'Есть ли у перевозчика допущенная машина подходящего класса. Гейт стола и рассылки.';

revoke all on function app.has_vehicle_for_haul(uuid, public.haul_kind) from public, anon;
grant execute on function app.has_vehicle_for_haul(uuid, public.haul_kind)
  to authenticated, service_role;


-- ── Вместимость машины ─────────────────────────────────────────────

/*
 * Сколько килограммов берёт эта машина.
 *
 * У тягача — по осям, как было: там вес держит не кузов, а дорога.
 * У фургона и грузовика — по заявленной грузоподъёмности: правило осей
 * выдало бы двухосному фургону двадцать пять тонн.
 */
create or replace function app.vehicle_capacity_kg(p_vehicle_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case v.vehicle_class
    when 'TRACTOR' then app.axle_capacity_kg(v.axles)
    else v.payload_kg
  end
  from public.vehicles v
  where v.id = p_vehicle_id;
$$;

comment on function app.vehicle_capacity_kg(uuid) is
  'Грузоподъёмность машины в килограммах: у тягача по осям, у фургона и грузовика по кузову.';

revoke all on function app.vehicle_capacity_kg(uuid) from public, anon;
grant execute on function app.vehicle_capacity_kg(uuid) to authenticated, service_role;


-- ── Отклик ─────────────────────────────────────────────────────────

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
   * 55002 — нет шасси нужной длины, 55003 — не тот класс или мало
   * погрузочных метров. Проверка стоит раньше веса: не влезающий груз не
   * спасёт никакая грузоподъёмность.
   */
  if not app.vehicle_fits_haul(p_vehicle_id, v_order.haul_kind, v_order.container_feet, v_order.ldm) then
    if v_order.haul_kind = 'CONTAINER' then
      raise exception 'Машина не берёт %-футовый контейнер.', v_order.container_feet
        using errcode = '55002';
    elsif app.haul_carries_unit(v_order.haul_kind) then
      raise exception 'Заказ на полуприцеп берёт седельный тягач.' using errcode = '55003';
    else
      raise exception 'Нужна машина класса % с кузовом от % погрузочных метров.',
        v_order.haul_kind, v_order.ldm
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
  'Отклик перевозчика: допуск машины, класс и вместимость под единицу, вес против грузоподъёмности, лимит трёх мест.';
