-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · оценку рейса меняют 14 дней
--
-- rate_order заменял прежнюю оценку без срока: рейс, закрытый месяцы
-- назад, заказчик мог переоценить когда угодно, и каждая правка уходила
-- перевозчику уведомлением и пересчитывала его рейтинг (прогон
-- 13.10.2026).
--
-- Решение пользователя 13.10.2026: поставленную оценку можно менять 14
-- дней после закрытия рейса, потом она окончательна. Первую оценку можно
-- поставить и позже — срок касается только изменения. Свой код 55015.
-- Текст функции берётся из базы и меняется точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text := replace(pg_get_functiondef('public.rate_order(uuid, smallint, text)'::regprocedure), E'\r\n', E'\n');
  v_mark constant text := '  insert into public.order_ratings (';
  v_new text;
begin
  if (length(v_def) - length(replace(v_def, v_mark, ''))) / length(v_mark) <> 1 then
    raise exception 'rate_order: место правки не найдено или встретилось не один раз';
  end if;

  v_new := replace(
    v_def,
    v_mark,
    $r$  if v_order.closed_at < now() - interval '14 days'
     and exists (select 1 from public.order_ratings r where r.order_id = p_order_id) then
    raise exception 'Оценку можно менять 14 дней после закрытия рейса.' using errcode = '55015';
  end if;

$r$ || v_mark
  );

  execute v_new;
end;
$$;
