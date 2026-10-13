-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · водитель узнаёт о правке маршрута
--
-- Правка точек идущего рейса (добавили, изменили, убрали) уведомляла
-- только компанию перевозчика. Водитель, который в это время едет по
-- старому маршруту, не получал ничего — ни строки во входящих, ни push:
-- новую точку он видел, только если сам открывал задание (прогон
-- 13.10.2026).
--
-- Теперь правка точек назначенного рейса пишет водителю «маршрут
-- изменён» со ссылкой на задание; push уходит обычным путём. Смена цены
-- водителю не сообщается: денег в приложении нет. Снятие и возврат на
-- стол у него уже есть отдельными уведомлениями.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.on_amendment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;

  if v_order.id is null or v_order.assigned_company_id is null then
    return new;
  end if;

  perform app.notify_event(
    v_order.assigned_company_id,
    'ORDER',
    'order.amended',
    jsonb_build_object('ref', v_order.ref),
    '/carrier/desk'
  );

  if new.kind in ('STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED')
     and v_order.status in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    perform app.notify_driver(
      v_order.assigned_driver_id,
      'order.amended',
      jsonb_build_object('ref', v_order.ref),
      v_order.id
    );
  end if;

  return new;
end;
$$;
