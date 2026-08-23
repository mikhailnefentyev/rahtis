-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · допуск ADR и грузоподъёмность по осям тягача
--
-- Две вещи про машину, которых не хватало.
--
-- ADR — допуск к опасным грузам. Пока это только метка в карточке: она
-- нужна оператору при допуске машины и заказчику при выборе отклика.
-- Подбор заказов по ней появится, когда у заказа будет поле «нужен ADR».
--
-- Оси решают, сколько машина может взять. Двухосный тягач с трёхосным
-- полуприцепом — это пять осей и 48 тонн полной массы, то есть около 25
-- тонн груза. Трёхосный даёт шесть осей, 60 тонн и около 32 тонн груза.
-- Раньше платформа этого не знала и позволяла двухоснику взять фуру на
-- тридцать тонн: на весовой это штраф перевозчику и сорванный рейс
-- заказчику.
--
-- Проверка стоит в take_order, а не только в интерфейсе. Интерфейс
-- подсказывает, база запрещает: отклик уходит через функцию, и обойти её
-- нельзя ни из браузера, ни из чужого клиента.
-- ═══════════════════════════════════════════════════════════════════

-- ── ADR ────────────────────────────────────────────────────────────

alter table public.vehicles
  add column if not exists adr boolean not null default false;

comment on column public.vehicles.adr is
  'Есть ли у машины и водителя допуск ADR к опасным грузам.';

/*
 * Колоночный грант обязателен: без него перевозчик не сможет записать
 * поле, а список машин молча приедет пустым. На этом уже обжигались с
 * trailer_plate.
 */
grant update (adr) on public.vehicles to authenticated;


-- ── Грузоподъёмность ───────────────────────────────────────────────

/*
 * Сколько груза берёт тягач с таким числом осей.
 *
 * Числа даны оператором и совпадают с финскими нормами полной массы
 * автопоезда. Для четырёх и пяти осей отдельного правила нет: там
 * остаётся общий потолок 76 тонн, он же предел HCT-состава и он же
 * ограничение order_stops_weight_range.
 */
create or replace function app.axle_capacity_kg(p_axles smallint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_axles
    when 2 then 25000
    when 3 then 32000
    else 76000
  end;
$$;

comment on function app.axle_capacity_kg(smallint) is
  'Предельный вес груза для тягача с данным числом осей, килограммы.';


/*
 * Самая тяжёлая точка заказа.
 *
 * Вес указывается по точкам, а не на заказ целиком: на маршруте бывает
 * несколько загрузок. Машина должна выдержать самую тяжёлую из них —
 * сумму брать нельзя, груз с первой точки к третьей уже выгружен.
 */
create or replace function app.order_max_weight_kg(p_order_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(max(cargo_weight_kg), 0)::integer
  from public.order_stops
  where order_id = p_order_id;
$$;

comment on function app.order_max_weight_kg(uuid) is
  'Вес самой тяжёлой точки заказа. Ноль, если вес нигде не указан.';


-- ── Отклик перевозчика: та же функция плюс проверка веса ───────────

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
   * Вес против осей.
   *
   * Отдельный код ошибки, а не общий 55000: интерфейсу нужно отличить
   * «не хватает грузоподъёмности» от «мест нет» и «заказ уже занят»,
   * чтобы сказать перевозчику, какая машина подойдёт.
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
