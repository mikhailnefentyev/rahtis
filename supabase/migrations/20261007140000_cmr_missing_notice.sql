-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · накладная после последней точки
--
-- 7.10.2026: водитель снимает накладную сканером приложения (PDF), и
-- перевозчик закрывает рейс без повторной загрузки. Если последняя точка
-- отмечена, а накладной нет, рейс не закрыть — раньше перевозчик узнавал
-- об этом только у кнопки «закрыть». Теперь в тот же момент уведомление
-- водителю (в приложении скан доступен до закрытия рейса) и перевозчику.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.on_last_stop_without_cmr()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if new.completed_at is null or old.completed_at is not null then
    return new;
  end if;

  if exists (
    select 1 from public.order_stops s
    where s.order_id = new.order_id and s.id <> new.id and s.completed_at is null
  ) then
    return new;
  end if;

  if exists (select 1 from public.order_documents d where d.order_id = new.order_id and d.kind = 'CMR') then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  if v_order.status <> 'IN_PROGRESS' then
    return new;
  end if;

  perform app.notify_driver(
    v_order.assigned_driver_id, 'cmr.missing', jsonb_build_object('ref', v_order.ref), v_order.id);

  if v_order.assigned_company_id is not null then
    perform app.notify_event(
      v_order.assigned_company_id, 'ORDER', 'cmr.missing', jsonb_build_object('ref', v_order.ref), '/carrier/desk');
  end if;

  return new;
end;
$$;

revoke all on function app.on_last_stop_without_cmr() from public, anon, authenticated;

create trigger order_stops_last_without_cmr
  after update of completed_at on public.order_stops
  for each row execute function app.on_last_stop_without_cmr();
