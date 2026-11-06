-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · «Где машина?» — ответ без звонка
--
-- Самый частый звонок диспетчеру — заказчик спрашивает, где машина.
-- В переписке рейса появляются вопросы-кнопки («Где машина?», «Когда
-- будет?», «Погружено?»), и сразу за вопросом — автоответ из данных
-- рейса: статус, последняя пройденная точка, следующая, оценка прибытия
-- и опоздание. Без ИИ: ответ собирается шаблоном (src/lib/chat/autoAnswer.ts).
--
--   · спрашивать могут заказчик и диспетчер перевозчика;
--   · автоответ — сообщение с ролью AUTO; факты лежат в auto, и каждый
--     читатель видит ответ на своём языке; body — текст на языке
--     спросившего;
--   · не чаще раза в 5 минут на рейс и спросившего: иначе — прежний ответ;
--   · вопрос и автоответ уведомлений не шлют: ответ уже есть. Только
--     когда данных нет (рейс не начат, оценки нет), диспетчеру перевозчика
--     уходит уведомление chat.ask — его пишет сайт вместе с ответом;
--   · автоответ пишет только сайт служебным ключом: подделать сообщение
--     «от RAHTIS» участник не может.
-- ═══════════════════════════════════════════════════════════════════

alter table public.order_messages drop constraint order_messages_role;
alter table public.order_messages
  add constraint order_messages_role check (author_role in ('SHIPPER', 'CARRIER', 'DRIVER', 'AUTO'));

alter table public.order_messages add column auto jsonb;

comment on column public.order_messages.auto is
  'Только у автоответа (author_role AUTO): факты рейса на момент ответа; author_user_id — кто спросил.';

create index order_messages_auto_idx on public.order_messages (order_id, author_user_id, created_at)
  where author_role = 'AUTO' or quick_code like 'ASK\_%';


/* Переписка отдаёт факты автоответа — текст собирается на языке читателя. */
do $$
declare
  v_def text;
  v_old text;
begin
  v_def := replace(pg_get_functiondef('public.order_chat(uuid)'::regprocedure), E'\r\n', E'\n');
  v_old := '''quick_code'', m.quick_code,';
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'order_chat: место правки не найдено или встретилось не один раз';
  end if;
  execute replace(v_def, v_old, '''quick_code'', m.quick_code, ''auto'', m.auto,');
end;
$$;


/* Уведомления о сообщении: вопрос-кнопка и автоответ — без них. */
create or replace function app.on_order_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_params jsonb;
begin
  if new.author_role = 'AUTO' or coalesce(new.quick_code, '') like 'ASK\_%' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  v_params := jsonb_build_object('ref', v_order.ref);

  if new.author_role <> 'SHIPPER' and not exists (
    select 1 from public.notifications n
    where n.company_id = v_order.shipper_company_id and n.code = 'chat.message'
      and n.params ->> 'ref' = v_order.ref and n.created_at > now() - interval '5 minutes'
  ) then
    perform app.notify_event(v_order.shipper_company_id, 'ORDER', 'chat.message', v_params, '/shipper/orders');
  end if;

  if new.author_role <> 'CARRIER' and v_order.assigned_company_id is not null and not exists (
    select 1 from public.notifications n
    where n.company_id = v_order.assigned_company_id and n.code = 'chat.message'
      and n.params ->> 'ref' = v_order.ref and n.created_at > now() - interval '5 minutes'
  ) then
    perform app.notify_event(v_order.assigned_company_id, 'ORDER', 'chat.message', v_params, '/carrier/desk');
  end if;

  if new.author_role <> 'DRIVER' and v_order.assigned_driver_id is not null and not exists (
    select 1 from public.driver_notifications n
    where n.driver_id = v_order.assigned_driver_id and n.code = 'chat.message'
      and n.order_id = v_order.id and n.created_at > now() - interval '5 minutes'
  ) then
    perform app.notify_driver(v_order.assigned_driver_id, 'chat.message', v_params, v_order.id);
  end if;

  return new;
end;
$$;

revoke all on function app.on_order_message() from public, anon, authenticated;


/*
 * Вопрос «где машина?» от заказчика или диспетчера перевозчика.
 * Проверяет права и частоту; p_body — текст вопроса на языке
 * спросившего (без него вопрос не пишется: подсказка под свободным
 * текстом, который уже отправлен). Был ответ этому же человеку за
 * 5 минут — возвращается он, и сайт ничего не пишет.
 */
create or replace function public.ask_order_status(p_order_id uuid, p_kind text, p_body text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_role text;
  v_uid uuid := (select auth.uid());
  v_prev bigint;
  v_body text := left(btrim(coalesce(p_body, '')), 1000);
begin
  if p_kind is null or p_kind not in ('WHERE', 'WHEN', 'LOADED') then
    raise exception 'Неизвестный вопрос.' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  v_role := app.order_chat_role(v_order);
  if v_order.id is null or v_role is null or v_role not in ('SHIPPER', 'CARRIER') then
    raise exception 'Спросить о рейсе могут заказчик и перевозчик.' using errcode = '42501';
  end if;
  if not app.order_chat_open(v_order) then
    raise exception 'Переписка рейса закрыта.' using errcode = '55000';
  end if;

  select m.id into v_prev
  from public.order_messages m
  where m.order_id = p_order_id and m.author_role = 'AUTO' and m.author_user_id = v_uid
    and m.created_at > now() - interval '5 minutes'
  order by m.id desc
  limit 1;
  if v_prev is not null then
    return jsonb_build_object('role', v_role, 'previous', v_prev);
  end if;

  /* Двойное нажатие: второй вопрос не пишется, ответ — один. */
  if v_body <> '' and not exists (
    select 1 from public.order_messages m
    where m.order_id = p_order_id and m.author_user_id = v_uid and m.quick_code like 'ASK\_%'
      and m.created_at > now() - interval '5 minutes'
  ) then
    insert into public.order_messages (order_id, carrier_company_id, author_role, author_user_id, body, quick_code)
    values (p_order_id, v_order.assigned_company_id, v_role, v_uid, v_body, 'ASK_' || p_kind);
  end if;

  return jsonb_build_object('role', v_role, 'previous', null);
end;
$$;

revoke all on function public.ask_order_status(uuid, text, text) from public, anon;
grant execute on function public.ask_order_status(uuid, text, text) to authenticated;


/*
 * Автоответ — только служебным ключом, после ask_order_status.
 * Частота проверяется ещё раз под блокировкой: два одновременных
 * вопроса дают один ответ. p_notify — данных нет, диспетчеру
 * перевозчика уходит уведомление (если спросил заказчик).
 */
create or replace function public.post_order_auto_answer(
  p_order_id uuid,
  p_user_id uuid,
  p_role text,
  p_body text,
  p_lang text,
  p_facts jsonb,
  p_notify boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('order-auto-answer:' || p_order_id::text || ':' || p_user_id::text));

  select m.id into v_id
  from public.order_messages m
  where m.order_id = p_order_id and m.author_role = 'AUTO' and m.author_user_id = p_user_id
    and m.created_at > now() - interval '5 minutes'
  order by m.id desc
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Рейс не найден.' using errcode = 'P0002';
  end if;

  insert into public.order_messages (order_id, carrier_company_id, author_role, author_user_id, body, source_lang, auto)
  values (
    p_order_id, v_order.assigned_company_id, 'AUTO', p_user_id,
    left(btrim(p_body), 1000),
    case when p_lang ~ '^[a-z]{2}$' then p_lang end,
    p_facts
  )
  returning id into v_id;

  if p_notify and p_role = 'SHIPPER' and v_order.assigned_company_id is not null then
    perform app.notify_event(
      v_order.assigned_company_id, 'ORDER', 'chat.ask', jsonb_build_object('ref', v_order.ref), '/carrier/desk'
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.post_order_auto_answer(uuid, uuid, text, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.post_order_auto_answer(uuid, uuid, text, text, text, jsonb, boolean) to service_role;
