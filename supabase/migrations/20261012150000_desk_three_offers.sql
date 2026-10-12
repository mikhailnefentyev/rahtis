-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · стол: заказ с откликом виден остальным перевозчикам
--
-- На заказ принимается до трёх откликов (take_order), заказчику обещаны
-- «предложения до трёх перевозчиков», а стол после первого же отклика
-- прятал заказ от всех, кроме откликнувшегося: условие витрины
-- пропускало REQUESTED только «своим». Второй и третий отклик мог
-- прийти лишь от того, у кого страница осталась открытой с прошлой
-- минуты, — заказчик на деле выбирал из одного (прогон тремя
-- перевозчиками 12.10.2026).
--
-- Теперь заказ с откликами остаётся на столе у всех, кому он положен:
-- карточка показывает «уже N откликов», а при трёх — «мест нет»; оба
-- состояния в интерфейсе были, но до них никто не доходил. Счётчик по
-- городам считает те же заказы, что и список.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text;
  v_new text;
begin
  /* ── desk_orders ── */
  v_def := replace(pg_get_functiondef('public.desk_orders(text, integer)'::regprocedure), E'\r\n', E'\n');

  v_new := regexp_replace(
    v_def,
    $p$or \(\s+o\.status = 'REQUESTED'\s+and exists \(\s+select 1 from public\.order_offers f\s+where f\.order_id = o\.id and f\.carrier_company_id = v_company_id\s+\)\s+\)$p$,
    $r$/* Заказ с откликами остаётся на столе: откликов принимается до трёх. */
      or o.status = 'REQUESTED'$r$
  );

  if v_new = v_def then
    if position($s$or o.status = 'REQUESTED'$s$ in v_def) = 0 then
      raise exception 'desk_orders: место правки не найдено';
    end if;
  else
    execute v_new;
  end if;

  /* ── desk_regions ── */
  v_def := replace(pg_get_functiondef('public.desk_regions()'::regprocedure), E'\r\n', E'\n');

  v_new := replace(
    v_def,
    $s$where o.status = 'OPEN'$s$,
    $r$where o.status in ('OPEN', 'REQUESTED')$r$
  );

  if v_new = v_def then
    if position($s$o.status in ('OPEN', 'REQUESTED')$s$ in v_def) = 0 then
      raise exception 'desk_regions: место правки не найдено';
    end if;
  else
    execute v_new;
  end if;
end;
$$;
