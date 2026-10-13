-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · цену после назначения перевозчика заказчик только повышает
--
-- reprice_order принимал любую новую ставку в любом статусе, кроме
-- закрытого и отменённого. На прогоне 13.10.2026 заказчик сменил цену
-- идущего рейса с 200 € на 1 €, и рейс закрылся с ценой 1 €: перевозчик
-- получал лишь уведомление о правке, согласия у него не спрашивали.
--
-- Решение пользователя 13.10.2026: после назначения перевозчика
-- (AWAIT_DRIVER, IN_PROGRESS) заказчик ставку может только повышать —
-- доплата за добавленные километры остаётся, снижение закрыто. Оператор
-- и перевозчик в своём рейсе (carrier_create_own_order) правят как раньше.
--
-- Свой код 55011, а не общий 55000: кабинет и API отвечают на него
-- отдельной фразой. Текст функции берётся из базы и меняется точечно.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_def text := replace(pg_get_functiondef('public.reprice_order(uuid, integer, integer)'::regprocedure), E'\r\n', E'\n');
  v_new text;
begin
  v_new := replace(
    v_def,
    '  /* Нечего записывать',
    $r$  if v_order.assigned_company_id is not null
     and v_order.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
     and p_rate_cents < v_order.rate_cents
     and coalesce(v_party, '') <> 'ADMIN'
     and not app.is_own_order_of_caller(v_order.shipper_company_id) then
    raise exception 'Цену после назначения перевозчика можно только повышать.' using errcode = '55011';
  end if;

  /* Нечего записывать$r$
  );

  if v_new = v_def then
    raise exception 'reprice_order: место правки не найдено';
  end if;

  execute v_new;
end;
$$;
