-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · переписка рейса — отдельно с каждым перевозчиком
--
-- Сообщения хранились по заказу, без исполнителя. Когда перевозчик
-- отказывался и заказ брал другой, новый перевозчик читал всю прежнюю
-- переписку заказчика с предыдущим — коды ворот, телефоны,
-- договорённости, — а чужие сообщения показывались ему как свои (прогон
-- 13.10.2026).
--
-- Теперь у сообщения записан перевозчик, с которым шла переписка.
-- Перевозчик и его водитель видят только свою часть; заказчик и оператор
-- — всю историю заказа. Старые сообщения размечаются по автору, а
-- сообщения заказчика — по нынешнему исполнителю заказа.
-- Тексты функций берутся из базы и меняются точечно.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_messages
  add column carrier_company_id uuid references public.companies (id) on delete set null;

comment on column public.order_messages.carrier_company_id is
  'Перевозчик, с которым шла переписка в момент сообщения: новый исполнитель заказа чужую часть не видит.';

update public.order_messages m
set carrier_company_id = coalesce(
  case m.author_role
    when 'CARRIER' then (select p.company_id from public.profiles p where p.id = m.author_user_id)
    when 'DRIVER' then (select d.company_id from public.drivers d where d.id = m.author_driver_id)
  end,
  (select o.assigned_company_id from public.orders o where o.id = m.order_id)
);

create index order_messages_carrier_idx on public.order_messages (order_id, carrier_company_id, id);

do $$
declare
  v_def text;
  v_new text;
  procedure_note constant text := 'место правки не найдено или встретилось не один раз';
  v_old text;
begin
  -- запись: с каким перевозчиком идёт переписка
  v_def := replace(pg_get_functiondef('public.post_order_message(uuid, text, text)'::regprocedure), E'\r\n', E'\n');
  v_old := 'insert into public.order_messages (order_id, author_role,';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'post_order_message (колонки): %', procedure_note;
  end if;
  v_new := replace(v_def, v_old, 'insert into public.order_messages (order_id, carrier_company_id, author_role,');
  v_old := 'p_order_id, v_role, (select auth.uid()),';
  if (length(v_new) - length(replace(v_new, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'post_order_message (значения): %', procedure_note;
  end if;
  v_new := replace(v_new, v_old, 'p_order_id, v_order.assigned_company_id, v_role, (select auth.uid()),');
  execute v_new;

  -- чтение: перевозчик и водитель — только свою часть
  v_def := replace(pg_get_functiondef('public.order_chat(uuid)'::regprocedure), E'\r\n', E'\n');
  v_old := 'where m.order_id = p_order_id';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'order_chat: %', procedure_note;
  end if;
  v_new := replace(v_def, v_old, $r$where m.order_id = p_order_id
        and (v_role not in ('CARRIER', 'DRIVER') or m.carrier_company_id = v_order.assigned_company_id)$r$);
  execute v_new;
end;
$$;
