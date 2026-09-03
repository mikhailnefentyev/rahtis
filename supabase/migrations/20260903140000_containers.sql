-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · контейнеры рядом с полуприцепами
--
-- Рейс с контейнером устроен так же, как перецеп: заказчик размещает
-- единицу, машина забирает её с площадки — пустую или гружёную, — везёт
-- и оставляет в порту. Тот же жизненный цикл, те же точки, тот же откат.
--
-- ПОЧЕМУ НЕ НОВЫЙ order_type.
--
-- order_type отвечает на вопрос «какой формы рейс»: перецеп, кругорейс,
-- груз в один конец. Что именно тянут за тягачом — вопрос другой оси, и
-- смешивать их нельзя: контейнерный кругорейс существует ровно так же,
-- как перецеп полуприцепа, и в едином перечислении пришлось бы завести
-- шесть значений вместо двух плюс три. ТЗ §14 и просило заложить тип
-- транспорта и тип груза отдельными категориями.
--
-- Поэтому haul_kind — вторая ось: TRAILER или CONTAINER. Существующие
-- заказы получают TRAILER, и ни одна проверка формы рейса не меняется.
--
-- ЧТО ОТЛИЧАЕТСЯ ПО СУТИ — размер. Полуприцеп описывается типом
-- («тент 13,6»), контейнер — длиной в футах, и от неё зависит, влезет ли
-- он на шасси. Отсюда и подбор машины: у контейнера, в отличие от
-- полуприцепа, физическое ограничение не в весе, а в длине. Двадцатка на
-- сорокафутовое шасси станет, сороковка на двадцатифутовое — нет.
--
-- НОМЕР ЕДИНИЦЫ остаётся в trailer_plate. Колонка отвечает на вопрос «по
-- чему водитель находит железо на площадке»: у полуприцепа это
-- регистрационный номер, у контейнера — номер по ISO 6346. Заводить
-- вторую колонку того же смысла значило бы в каждом запросе выбирать,
-- какую из них читать.
--
-- ПОДБОР МАШИНЫ сделан ровно как проверка веса по осям: интерфейс
-- подсказывает, база запрещает. Отклик уходит через take_order, и обойти
-- её нельзя ни из браузера, ни из чужого клиента.
-- ═══════════════════════════════════════════════════════════════════

create type public.haul_kind as enum ('TRAILER', 'CONTAINER');

comment on type public.haul_kind is
  'Что тянут: полуприцеп или контейнер. Форма рейса — отдельная ось, order_type.';


-- ── Заказ ──────────────────────────────────────────────────────────

alter table public.orders
  add column haul_kind public.haul_kind not null default 'TRAILER',

  /*
   * Длина контейнера в футах.
   *
   * Футы, а не метры: контейнеры называют футами во всём мире, включая
   * финские порты и накладные. Пересчёт в метры здесь означал бы, что
   * диспетчер вводит 12,19 вместо 40.
   *
   * Границы 10–53 вместо перечисления: ходовые размеры это 20, 30, 40 и
   * 45, но существуют и 10-футовые, и североамериканские 48 и 53. Форма
   * предлагает ходовые списком, а редкий размер вводится числом и не
   * требует миграции.
   */
  add column container_feet smallint,

  add constraint orders_container_feet_only_for_containers
    check ((haul_kind = 'CONTAINER') = (container_feet is not null)),

  add constraint orders_container_feet_range
    check (container_feet is null or container_feet between 10 and 53);

comment on column public.orders.haul_kind is
  'Полуприцеп или контейнер. Видно перевозчику на столе до отклика.';
comment on column public.orders.container_feet is
  'Длина контейнера в футах. NULL у полуприцепа — см. ограничение.';
comment on column public.orders.trailer_plate is
  'Номер единицы, по которому водитель находит её на площадке: регистрационный у полуприцепа, ISO 6346 у контейнера.';


-- ── Машина ─────────────────────────────────────────────────────────

/*
 * Какие контейнеры берёт эта машина.
 *
 * Массив, а не «максимальная длина»: раздвижное шасси берёт двадцатку и
 * сороковку, но не тридцатку, а платформа под 45 футов не всегда имеет
 * замки под 20. Одно число здесь врёт в обе стороны.
 *
 * Пустой массив — машина контейнеры не возит вовсе, и это умолчание:
 * весь существующий парк заведён под полуприцепы, и приписать ему
 * контейнерный допуск задним числом нельзя.
 */
alter table public.vehicles
  add column container_feet smallint[] not null default '{}',

  add constraint vehicles_container_feet_valid
    check (
      container_feet <@ array[10, 20, 30, 40, 45, 48, 53]::smallint[]
    );

comment on column public.vehicles.container_feet is
  'Длины контейнеров, которые машина может взять. Пустой массив — только полуприцепы.';

/*
 * Колоночный грант обязателен: без него перевозчик не запишет поле, а
 * список машин молча приедет пустым. На этом уже обжигались с
 * trailer_plate и adr.
 */
grant update (container_feet) on public.vehicles to authenticated;


-- ── Подходит ли машина под контейнер заказа ────────────────────────

/*
 * Одно определение на интерфейс и на запрет.
 *
 * Полуприцепный заказ подходит любой машине: тягач с седлом есть у всех,
 * и отдельного признака под это не заводится. Контейнерный требует, чтобы
 * нужная длина стояла в списке машины.
 */
create or replace function app.vehicle_fits_haul(
  p_vehicle_id uuid,
  p_haul_kind public.haul_kind,
  p_container_feet smallint
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_haul_kind = 'TRAILER' then true
    when p_container_feet is null then false
    else exists (
      select 1 from public.vehicles v
      where v.id = p_vehicle_id
        and p_container_feet = any (v.container_feet)
    )
  end;
$$;

comment on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint) is
  'Возьмёт ли машина эту единицу: полуприцеп берут все, контейнер — только шасси нужной длины.';

revoke all on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint) from public, anon;
grant execute on function app.vehicle_fits_haul(uuid, public.haul_kind, smallint)
  to authenticated, service_role;


-- ── Отклик: та же функция плюс проверка шасси ──────────────────────

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
   * Шасси против контейнера.
   *
   * Свой код ошибки, как и у веса: интерфейсу нужно отличить «нет шасси
   * такой длины» от «не хватает грузоподъёмности» и «мест нет», чтобы
   * сказать перевозчику, какая машина подойдёт. Проверка стоит раньше
   * веса: не влезающий контейнер не спасёт никакая грузоподъёмность.
   */
  if not app.vehicle_fits_haul(p_vehicle_id, v_order.haul_kind, v_order.container_feet) then
    raise exception 'Машина не берёт %-футовый контейнер.', v_order.container_feet
      using errcode = '55002';
  end if;

  /*
   * Вес против осей.
   *
   * Отдельный код ошибки, а не общий 55000: интерфейсу нужно отличить
   * «не хватает грузоподъёмности» от «мест нет» и «заказ уже занят»,
   * чтобы сказать перевозчику, какая машина подойдёт.
   *
   * Контейнеры проверяются тем же правилом: гружёная сороковка весит
   * столько же, сколько фура, и осей ей нужно ровно столько же.
   */
  v_needed := app.order_max_weight_kg(p_order_id);
  v_capacity := app.axle_capacity_kg(v_vehicle.axles);

  if v_needed > v_capacity then
    raise exception
      'Груз % кг превышает грузоподъёмность % кг для тягача с % осями.',
      v_needed, v_capacity, v_vehicle.axles
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
  'Отклик перевозчика: проверяет допуск машины, шасси под контейнер, вес против осей и лимит трёх мест.';
