-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · отказ от рейса падал на приведении типа
--
-- «Toimenpide ei mennyt läpi» вместо отказа от рейса. Причина не в
-- правах и не в статусе, а в одной строчке SQL:
--
--   set status = case when v_started then 'CANCELLED' else 'OPEN' end
--
-- Оба литерала бестиповые, и CASE выводит для себя text. Присвоить text
-- колонке перечислимого типа Postgres не даёт: «column "status" is of
-- type order_status but expression is of type text», код 42804. То же
-- самое во вставке в журнал, где CASE выбирает между двумя значениями
-- amendment_kind.
--
-- Ошибка не ловилась ни на создании функции, ни на разборе: тело
-- plpgsql разбирается при первом ВЫПОЛНЕНИИ, а выполнить его до сих пор
-- никто не пробовал — проверка прав отвергала все мои вызовы служебным
-- ключом раньше, чем дело доходило до обновления.
--
-- Соседние функции этого не имели: там статус присваивается голым
-- литералом, а unknown → enum приводится сам.
--
-- Лечится явным приведением. Заодно ветвление вынесено в переменные:
-- CASE, посчитанный один раз, читается лучше, чем тот же CASE, дважды
-- переписанный в разных выражениях.
-- ═══════════════════════════════════════════════════════════════════

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
  v_next public.order_status;
  v_kind public.amendment_kind;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into v_order from public.orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  v_before := v_order;

  /* NULL <> 'CARRIER' тоже NULL — посторонний прошёл бы проверку. */
  if coalesce(app.order_party(v_order), '') <> 'CARRIER' then
    raise exception 'Отказаться от рейса может только назначенный перевозчик.'
      using errcode = '42501';
  end if;

  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Отказ возможен только по взятому рейсу, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  /*
   * Куда уйдёт заказ, решает состояние груза, а не тот, кто отказался.
   *
   * Ни одна точка не пройдена — прицеп не тронут, заказ возвращается на
   * стол и его берёт кто-то другой. Ради этого отказ и разрешён:
   * перевозчик со сломанной машиной должен сказать об этом платформе в
   * два часа ночи, а не держать рейс до утра.
   *
   * Точка пройдена — прицеп в дороге, часть работы записана. Отдать
   * такой рейс другому нельзя: он приедет на выгрузку, которая уже
   * состоялась. Заказ снимается, дальше это работа диспетчера.
   */
  select exists (
    select 1 from public.order_stops
    where order_id = p_order_id and completed_at is not null
  ) into v_started;

  v_next := case when v_started then 'CANCELLED' else 'OPEN' end::public.order_status;
  v_kind := case when v_started then 'ORDER_CANCELLED' else 'ORDER_RELEASED' end::public.amendment_kind;

  delete from public.order_offers where order_id = p_order_id;

  /*
   * Назначение снимается только при возврате на стол: заказ снова ничей.
   * У снятого оно остаётся — перевозчик проехал часть маршрута, и это
   * его история, а не чужая.
   */
  update public.orders
  set status = v_next,
      deadline_at = null,
      assigned_company_id = case when v_started then assigned_company_id else null end,
      assigned_vehicle_id = case when v_started then assigned_vehicle_id else null end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (
    p_order_id,
    v_kind,
    jsonb_build_object(
      'status', jsonb_build_object('from', v_before.status::text, 'to', v_next::text),
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
