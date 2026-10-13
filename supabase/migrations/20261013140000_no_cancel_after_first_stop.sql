-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · после первой пройденной точки рейс не отменяется
--
-- Отказ перевозчика (abandon_order) и снятие заказчиком (withdraw_order)
-- принимались и в идущем рейсе после забора: рейс становился «отменён» с
-- грузом в дороге, и претензию по нему подать было нельзя — они
-- принимаются только по идущим и выполненным рейсам (прогон 13.10.2026).
--
-- Решение пользователя 13.10.2026: пока ни одна точка не пройдена, всё
-- как было — перевозчик возвращает заказ на стол, заказчик снимает.
-- После первой пройденной точки отмены нет ни у кого из сторон: дальше
-- это работа оператора и претензии. Оператору право снять оставлено.
--
-- Свой код 55012: кабинет и API отвечают на него отдельной фразой.
-- Тексты функций берутся из базы и меняются точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text;
  v_new text;
begin
  -- Перевозчик: отказ только пока прицеп не тронут
  v_def := replace(pg_get_functiondef('public.abandon_order(uuid, text)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(
    v_def,
    '  v_next := case when v_started',
    $r$  if v_started then
    raise exception 'Рейс уже начат: отменить его нельзя, обратитесь к оператору.' using errcode = '55012';
  end if;

  v_next := case when v_started$r$
  );
  if v_new = v_def then
    raise exception 'abandon_order: место правки не найдено';
  end if;
  execute v_new;

  -- Заказчик: снятие только пока ни одна точка не пройдена; оператор — всегда
  v_def := replace(pg_get_functiondef('public.withdraw_order(uuid, text)'::regprocedure), E'\r\n', E'\n');
  v_new := replace(
    v_def,
    '  delete from public.order_offers where order_id = p_order_id;',
    $r$  if coalesce(v_party, '') <> 'ADMIN' and exists (
    select 1 from public.order_stops
    where order_id = p_order_id and completed_at is not null
  ) then
    raise exception 'Рейс уже начат: отменить его нельзя, обратитесь к оператору.' using errcode = '55012';
  end if;

  delete from public.order_offers where order_id = p_order_id;$r$
  );
  if v_new = v_def then
    raise exception 'withdraw_order: место правки не найдено';
  end if;
  execute v_new;
end;
$$;
