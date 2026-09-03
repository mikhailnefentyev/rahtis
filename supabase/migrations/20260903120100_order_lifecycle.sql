-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · сбои и расхождения: снятие, отказ, пересчёт, удаление
--
-- До сих пор у заказа был ровно один способ уйти из работы — доехать.
-- Откат (cancel_order) возвращал его на стол из REQUESTED и AWAIT_DRIVER,
-- и на этом всё: заказ, опубликованный по ошибке, висел на столе вечно;
-- перевозчик, у которого сломалась машина, не мог отказаться; заказчик,
-- увидевший, что километраж посчитан не тот, не мог ни исправить цену,
-- ни снять заказ. Статус CANCELLED существовал в перечислении и не
-- ставился ничем.
--
-- Четыре действия закрывают это, и все четыре пишут в журнал заказа.
-- Журнал здесь — не побочный эффект, а смысл: спор о том, почему рейс
-- сорвался и откуда взялась сумма в счёте, разбирается по нему.
--
-- ГЛАВНОЕ РЕШЕНИЕ — про деньги.
--
-- Раньше distance_km после публикации был неизменен, и это защищало
-- перевозчика: ставка согласована, менять её задним числом нельзя.
-- Защита оказалась дороже пользы. Маршрут удлинился на сто километров —
-- перевозчик везёт их бесплатно, потому что цифру в заказе трогать
-- нечем. Теперь пересчёт есть, и он сохраняет не сумму, а €/км: цена
-- пропорциональна пробегу, то есть ровно та, о которой договаривались.
-- Пропорция, а не хранимая ставка за километр, потому что округление
-- к целым центам за километр само по себе двигало бы сумму.
--
-- Молча цена не меняется никогда: пересчёт вызывает заказчик, увидев
-- предложенные числа. Перевозчик видит их в журнале как правку.
-- ═══════════════════════════════════════════════════════════════════


-- ── Журнал принимает события заказа, а не только точек ─────────────

/*
 * У события заказа точки нет. Роль и название места были NOT NULL,
 * потому что других записей и не бывало.
 */
alter table public.order_amendments
  alter column stop_role drop not null,
  alter column stop_label drop not null;

/*
 * Но у события ТОЧКИ они обязаны остаться: запись «переставили что-то»
 * бесполезна. Обязательность переезжает из колонки в правило.
 */
alter table public.order_amendments
  add constraint order_amendments_stop_fields
    check (
      (kind in ('STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED'))
      = (stop_role is not null and stop_label is not null)
    );

comment on column public.order_amendments.stop_role is
  'Роль точки. NULL у событий самого заказа: снятие, отказ, пересчёт.';


-- ── Кто есть кто в этом заказе ─────────────────────────────────────

/*
 * Три роли на одном заказе, и каждой функции ниже нужен один и тот же
 * ответ. Вынесено сюда, чтобы право не разъехалось между действиями:
 * четыре копии одного условия расходятся на пятой правке.
 */
create or replace function app.order_party(p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select app.is_admin()) then 'ADMIN'
    when p_order.shipper_company_id = (select app.current_company_id()) then 'SHIPPER'
    when p_order.assigned_company_id = (select app.current_company_id()) then 'CARRIER'
    else null
  end;
$$;

comment on function app.order_party(public.orders) is
  'Кем приходится заказу текущий пользователь: SHIPPER, CARRIER, ADMIN или никем.';


-- ── Снятие заказа ──────────────────────────────────────────────────

/*
 * Заказ уходит из работы совсем: статус CANCELLED.
 *
 * Отличается от отката (cancel_order) тем, что заказ не возвращается на
 * стол. Откат означает «пусть возьмёт кто-то другой», снятие — «везти не
 * надо». Смешивать их в одной кнопке нельзя: заказчик, нажавший «отмена»
 * с намерением снять груз, получил бы его обратно на стол и новые
 * отклики.
 *
 * Доступно заказчику и оператору на любой стадии до закрытия. Выполненный
 * рейс не снимается: он уже сделан, документы приложены, деньги
 * посчитаны. Отменять его — задача бухгалтерии, а не кнопки.
 *
 * Отклики стираются: заказа больше нет, держать чей-то отклик незачем.
 * А назначение остаётся, и это важно. Перевозчик видит заказ по колонке
 * исполнителя (app.party_to_order); обнулив её, мы отняли бы у него и
 * заказ, и журнал — то есть возможность узнать, почему рейс, к которому
 * он уже выехал, исчез. Снятый заказ и так не показывается в рабочих
 * списках, а кто его вёл — это история, а не состояние.
 */
create or replace function public.withdraw_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_before public.orders;
  v_party text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_before := v_order;
  v_party := app.order_party(v_order);

  /*
   * coalesce обязателен: посторонний получает из order_party NULL, а
   * `NULL not in (…)` — это NULL, а не истина. Без него проверка прав
   * молча пропускала бы того, у кого прав нет вовсе.
   */
  if coalesce(v_party, '') not in ('SHIPPER', 'ADMIN') then
    raise exception 'Снять заказ может заказчик или оператор.' using errcode = '42501';
  end if;

  if v_order.status = 'DONE' then
    raise exception 'Выполненный рейс снять нельзя.' using errcode = '55000';
  end if;

  if v_order.status = 'CANCELLED' then
    raise exception 'Заказ уже снят.' using errcode = '55000';
  end if;

  delete from public.order_offers where order_id = p_order_id;

  update public.orders
  set status = 'CANCELLED',
      deadline_at = null
  where id = p_order_id
  returning * into v_order;

  /*
   * В журнале — прежний статус, а не роль снявшего: «было OPEN, стало
   * CANCELLED» отвечает на вопрос, что случилось с рейсом. Кто это
   * сделал, известно из actor_id, а роль записывается отдельным полем,
   * потому что читателю журнала важна сторона, а не имя человека.
   */
  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (
    p_order_id,
    'ORDER_CANCELLED',
    jsonb_build_object(
      'status', jsonb_build_object('from', v_before.status::text, 'to', 'CANCELLED'),
      'by', jsonb_build_object('to', v_party),
      'reason', jsonb_build_object('to', coalesce(v_reason, ''))
    ),
    (select auth.uid())
  );

  return v_order;
end;
$$;

comment on function public.withdraw_order(uuid, text) is
  'Снимает заказ из работы: статус CANCELLED, отклики стираются, назначение остаётся историей, событие в журнал.';


-- ── Отказ перевозчика от взятого рейса ─────────────────────────────

/*
 * Перевозчик отказывается от рейса, который уже за ним закреплён.
 *
 * Куда уходит заказ, решает не тот, кто отказался, а состояние груза.
 *
 * Ни одна точка не пройдена — прицеп не тронут, везти всё ещё нечего
 * особенного: заказ возвращается на стол, и его берёт кто-то другой.
 * Это лучший исход для заказчика, и ради него отказ вообще разрешён:
 * перевозчик, у которого сломалась машина, должен уметь сказать об этом
 * платформе в два часа ночи, а не держать рейс до утра.
 *
 * Хоть одна точка пройдена — прицеп в дороге, часть работы сделана и
 * записана. Отдать такой рейс другому нельзя: он приедет на выгрузку,
 * которая уже состоялась. Заказ снимается, и дальше это работа
 * диспетчера, а не платформы.
 *
 * Отметки пройденных точек в обоих случаях остаются нетронутыми: они
 * доказательная база, а не состояние заказа.
 */
create or replace function public.abandon_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_before public.orders;
  v_started boolean;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_before := v_order;

  /* NULL <> 'CARRIER' тоже NULL — см. комментарий в withdraw_order. */
  if coalesce(app.order_party(v_order), '') <> 'CARRIER' then
    raise exception 'Отказаться от рейса может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Отказ возможен только по взятому рейсу, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  select exists (
    select 1 from public.order_stops
    where order_id = p_order_id and completed_at is not null
  ) into v_started;

  delete from public.order_offers where order_id = p_order_id;

  /*
   * Назначение снимается только при возврате на стол: заказ снова ничей,
   * и держать за ним отказавшегося нельзя — он увидел бы чужой рейс.
   * У снятого назначение остаётся: перевозчик проехал часть маршрута, и
   * это его история, а не чужая.
   */
  update public.orders
  set status = case when v_started then 'CANCELLED' else 'OPEN' end,
      deadline_at = null,
      assigned_company_id = case when v_started then assigned_company_id else null end,
      assigned_vehicle_id = case when v_started then assigned_vehicle_id else null end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (
    p_order_id,
    case when v_started then 'ORDER_CANCELLED' else 'ORDER_RELEASED' end,
    jsonb_build_object(
      'status', jsonb_build_object('from', v_before.status::text, 'to', v_order.status::text),
      'by', jsonb_build_object('to', 'CARRIER'),
      'reason', jsonb_build_object('to', coalesce(v_reason, ''))
    ),
    (select auth.uid())
  );

  return v_order;
end;
$$;

comment on function public.abandon_order(uuid, text) is
  'Отказ перевозчика: нетронутый рейс возвращается на стол, начатый снимается. Событие в журнал.';


-- ── Пересчёт пробега и цены ────────────────────────────────────────

/*
 * Меняет пробег и ставку разом, потому что порознь они бессмысленны.
 *
 * Обе цифры приходят снаружи, а не считаются здесь: предложение готовит
 * приложение, показывает заказчику «было 836 км / 900 €, стало 937 км /
 * 1008 €», и в базу приезжает то, что человек увидел и принял. База
 * проверяет не арифметику, а границы: неположительная сумма и пробег вне
 * допустимого отвергаются ограничениями таблицы.
 *
 * distance_source становится MANUAL: действующее число принял человек,
 * даже если предложил его роутер. Пусть в журнале останется правда о
 * происхождении цифры — по ней разбирается, где расчёт систематически
 * врёт.
 *
 * Закрытый и снятый рейс не пересчитываются: по первому уже выставлен
 * счёт, второго не существует.
 */
create or replace function public.reprice_order(
  p_order_id uuid,
  p_distance_km integer,
  p_rate_cents integer
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_party text;
  v_before public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_party := app.order_party(v_order);

  if coalesce(v_party, '') not in ('SHIPPER', 'ADMIN') then
    raise exception 'Пробег и ставку меняет заказчик или оператор.' using errcode = '42501';
  end if;

  if v_order.status in ('DONE', 'CANCELLED') then
    raise exception 'Пересчёт недоступен, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if p_distance_km is null or p_rate_cents is null then
    raise exception 'Нужны и пробег, и ставка.' using errcode = '55000';
  end if;

  /* Нечего записывать — и нечего слать перевозчику как правку. */
  if v_order.distance_km = p_distance_km and v_order.rate_cents = p_rate_cents then
    return v_order;
  end if;

  v_before := v_order;

  update public.orders
  set distance_km = p_distance_km,
      rate_cents = p_rate_cents,
      distance_source = 'MANUAL'
  where id = p_order_id
  returning * into v_order;

  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (
    p_order_id,
    'ORDER_REPRICED',
    jsonb_build_object(
      'distance_km', jsonb_build_object('from', v_before.distance_km, 'to', p_distance_km),
      'rate_cents', jsonb_build_object('from', v_before.rate_cents, 'to', p_rate_cents)
    ),
    (select auth.uid())
  );

  return v_order;
end;
$$;

comment on function public.reprice_order(uuid, integer, integer) is
  'Меняет пробег и ставку заказа одним действием и пишет обе цифры в журнал.';


-- ── Удаление заказа ────────────────────────────────────────────────

/*
 * Настоящее удаление, а не пометка, — и только оператором.
 *
 * Нужно ровно для одного: пробных и ошибочных заказов, которые иначе
 * копятся в базе навсегда и попадаются на глаза при каждом разборе.
 * Снятый заказ остаётся снятым; удаление — это признание, что заказа не
 * было вовсе.
 *
 * Границы жёсткие и стоят здесь, а не в диалоге подтверждения. Внешние
 * ключи на orders стоят с on delete cascade: удаление унесёт точки,
 * отклики, журнал правок, документы рейса и оценку. Всё это —
 * доказательная база и бухгалтерия, которую по kirjanpitolaki держат
 * шесть лет.
 *
 * Поэтому удаляется только то, по чему ничего не произошло: черновик,
 * заказ со стола и снятый заказ, ни разу не выставленный в счёт и не
 * обросший документами.
 *
 * Для выполненного рейса пути к удалению нет вовсе, и это намеренный
 * тупик, а не забытая ветка: снять его тоже нельзя, значит он не станет
 * снятым и не пройдёт проверку статуса. Закрытый рейс не стирается
 * ничем — ни оператором, ни в два шага.
 */
create or replace function public.delete_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_documents integer;
begin
  if not (select app.is_admin()) then
    raise exception 'Удалять заказы может только оператор.' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_order.status not in ('DRAFT', 'OPEN', 'CANCELLED') then
    raise exception 'Удалить можно только черновик, заказ со стола или снятый. Текущий статус: %.',
      v_order.status using errcode = '55000';
  end if;

  if v_order.invoiced_at is not null or v_order.paid_at is not null then
    raise exception 'Заказ попал в счёт — удалять нельзя.' using errcode = '55000';
  end if;

  select count(*) into v_documents
  from public.order_documents where order_id = p_order_id;

  if v_documents > 0 then
    raise exception 'К заказу приложены документы — удалять нельзя.' using errcode = '55000';
  end if;

  delete from public.orders where id = p_order_id;

  return p_order_id;
end;
$$;

comment on function public.delete_order(uuid) is
  'Стирает пробный или ошибочный заказ. Только оператором и только пока по заказу ничего не произошло.';


-- ── Права ──────────────────────────────────────────────────────────

/*
 * Кто и что может, решают сами функции: они security definer, и без
 * проверки внутри любая из них обошла бы RLS. Здесь только запрет
 * анонимному вызову — до входа в кабинет с заказами делать нечего.
 */
revoke all on function public.withdraw_order(uuid, text) from public, anon;
revoke all on function public.abandon_order(uuid, text) from public, anon;
revoke all on function public.reprice_order(uuid, integer, integer) from public, anon;
revoke all on function public.delete_order(uuid) from public, anon;
revoke all on function app.order_party(public.orders) from public, anon, authenticated;

grant execute on function public.withdraw_order(uuid, text) to authenticated, service_role;
grant execute on function public.abandon_order(uuid, text) to authenticated, service_role;
grant execute on function public.reprice_order(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.delete_order(uuid) to authenticated, service_role;
