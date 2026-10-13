-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · итоги оператора без тестовых рейсов
--
-- Счета и очередь расчётов тестовые компании исключают с 22.09.2026, а
-- три блока на той же странице — нет: график «Kehitys» (weekly_totals),
-- сводка по контрагентам (partner_totals) и список закрытых рейсов
-- (completed_orders). На прогоне 13.10.2026 они показывали 19 029 €
-- оборота и 37,02 € «нашей доли» при нуле боевых рейсов. С первым боевым
-- рейсом тестовые суммы смешались бы с настоящими.
--
-- Решение пользователя 13.10.2026: убрать. Правка только ветки оператора:
-- сами тестовые компании свои рейсы и итоги видят как раньше.
--
-- Тексты функций берутся из базы (pg_get_functiondef) и меняются точечно.
-- ═══════════════════════════════════════════════════════════════════

/* Рейс тестовый, если тестовая хотя бы одна из сторон — то же правило, что у счетов. */
create or replace function app.order_is_test(p_shipper_id uuid, p_carrier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_test from public.companies where id = p_shipper_id), false)
      or coalesce((select is_test from public.companies where id = p_carrier_id), false);
$$;

revoke all on function app.order_is_test(uuid, uuid) from public, anon, authenticated;


do $$
declare
  v_def text;
  v_new text;
begin
  -- weekly_totals: ветка оператора
  v_def := pg_get_functiondef('public.weekly_totals(integer)'::regprocedure);
  v_new := replace(v_def, 'or v_role = ''ADMIN''',
    'or (v_role = ''ADMIN'' and not app.order_is_test(o.shipper_company_id, o.assigned_company_id))');
  if v_new = v_def then
    raise exception 'weekly_totals: место правки не найдено';
  end if;
  execute v_new;

  -- completed_orders: ветка оператора в условии отбора (в столбцах имён роль не трогаем)
  v_def := pg_get_functiondef('public.completed_orders(date, date)'::regprocedure);
  v_new := replace(v_def, 'or v_role = ''ADMIN''',
    'or (v_role = ''ADMIN'' and not app.order_is_test(o.shipper_company_id, o.assigned_company_id))');
  if v_new = v_def then
    raise exception 'completed_orders: место правки не найдено';
  end if;
  execute v_new;

  -- partner_totals: функция только для оператора
  v_def := pg_get_functiondef('public.partner_totals(date, date)'::regprocedure);
  v_new := replace(v_def, 'where o.status = ''DONE''',
    'where o.status = ''DONE''
      and not app.order_is_test(o.shipper_company_id, o.assigned_company_id)');
  if v_new = v_def then
    raise exception 'partner_totals: место правки не найдено';
  end if;
  execute v_new;
end;
$$;
