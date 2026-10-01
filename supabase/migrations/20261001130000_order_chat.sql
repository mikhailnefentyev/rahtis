-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · переписка по рейсу: заказчик, перевозчик, водитель
--
-- Раньше сказать «буду через 20 минут» или «ворота закрыты, где ждать?»
-- можно было только звонком, и в истории рейса это не оставалось. Теперь
-- у назначенного рейса есть переписка:
--
--   · участники: заказчик (кабинет), перевозчик (кабинет, диспетчер может
--     ответить за водителя), назначенный водитель (приложение);
--   · писать можно с назначения машины до трёх суток после закрытия;
--   · оператор Aivomaa читает переписку, только когда по рейсу есть
--     претензия (решение пользователя 1.10.2026);
--   · подписи — роль, у водителя ещё имя: в рейсах подряда стороны друг
--     друга не знают по названию (TERMS 6.7), и переписка этого не меняет;
--   · быстрые ответы хранятся кодом и показываются на языке читателя;
--     свободный текст переводит сайт (OpenAI) после записи и кладёт
--     переводы в translations — без перевода видно оригинал;
--   · уведомления: заказчику и перевозчику в кабинет, водителю во
--     входящие и push; не чаще раза в пять минут по рейсу на получателя;
--   · хранится 24 месяца (PRIVACY 2.13, 8.4).
--
-- Таблица закрыта: читают и пишут только функции ниже, переводы
-- записывает сайт служебным ключом.
-- ═══════════════════════════════════════════════════════════════════

create table public.order_messages (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  author_role text not null,
  author_user_id uuid references auth.users (id) on delete set null,
  author_driver_id uuid references public.drivers (id) on delete set null,
  /* Только у водителя: имя без фамилии — заказчик и так видит водителя рейса. */
  author_name text,
  body text not null,
  quick_code text,
  source_lang text,
  translations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint order_messages_role check (author_role in ('SHIPPER', 'CARRIER', 'DRIVER')),
  constraint order_messages_body check (length(btrim(body)) between 1 and 1000),
  constraint order_messages_quick check (quick_code is null or quick_code ~ '^[A-Z0-9_]{2,30}$')
);

create index order_messages_order_idx on public.order_messages (order_id, id);
create index order_messages_created_idx on public.order_messages (created_at);

alter table public.order_messages enable row level security;
revoke all on public.order_messages from anon, authenticated;

comment on table public.order_messages is
  'Переписка по рейсу. Только через order_chat и post_order_message; переводы пишет сайт служебным ключом.';


/* Кем вызывающий приходится рейсу в переписке. ADMIN — только при претензии. */
create or replace function app.order_chat_role(p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_order.assigned_driver_id is not null
         and p_order.assigned_driver_id = (select app.current_driver_id()) then 'DRIVER'
    when p_order.shipper_company_id = (select app.current_company_id()) then 'SHIPPER'
    when p_order.assigned_company_id = (select app.current_company_id())
         and (select app.current_party_role()) = 'CARRIER' then 'CARRIER'
    when (select app.is_admin())
         and exists (select 1 from public.claims c where c.order_id = p_order.id) then 'ADMIN'
  end
$$;

revoke all on function app.order_chat_role(public.orders) from public, anon, authenticated;


/* Открыта ли переписка для записи. */
create or replace function app.order_chat_open(p_order public.orders)
returns boolean
language sql
stable
as $$
  select p_order.assigned_company_id is not null
     and (
       p_order.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
       or (p_order.status = 'DONE' and p_order.closed_at > now() - interval '3 days')
     )
$$;


/* Переписка рейса для участника: роль читателя, можно ли писать, сообщения. */
create or replace function public.order_chat(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_role text;
begin
  select * into v_order from public.orders where id = p_order_id;
  v_role := app.order_chat_role(v_order);
  if v_order.id is null or v_role is null then
    raise exception 'Переписка рейса видна только его участникам.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'ref', v_order.ref,
    'role', v_role,
    'open', v_role <> 'ADMIN' and app.order_chat_open(v_order),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'author_role', m.author_role,
        'author_name', m.author_name,
        'body', m.body,
        'quick_code', m.quick_code,
        'source_lang', m.source_lang,
        'translations', m.translations,
        'created_at', m.created_at,
        'mine', m.author_role = v_role
      ) order by m.id)
      from public.order_messages m
      where m.order_id = p_order_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.order_chat(uuid) from public, anon;
grant execute on function public.order_chat(uuid) to authenticated;


/*
 * Сообщение в переписку. Возвращает id и языки, на которые сайту стоит
 * перевести текст: языки кабинета (fi, en), сторон и водителя.
 */
create or replace function public.post_order_message(p_order_id uuid, p_body text, p_quick text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_role text;
  v_driver public.drivers;
  v_id bigint;
  v_langs text[];
begin
  select * into v_order from public.orders where id = p_order_id;
  v_role := app.order_chat_role(v_order);
  if v_order.id is null or v_role is null or v_role = 'ADMIN' then
    raise exception 'Писать в переписку рейса могут только его участники.' using errcode = '42501';
  end if;
  if not app.order_chat_open(v_order) then
    raise exception 'Переписка рейса закрыта.' using errcode = '55000';
  end if;
  if (select count(*) from public.order_messages
      where order_id = p_order_id and author_role = v_role and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Слишком много сообщений за час.' using errcode = '55001';
  end if;

  if v_role = 'DRIVER' then
    select * into v_driver from public.drivers where id = v_order.assigned_driver_id;
  end if;

  insert into public.order_messages (order_id, author_role, author_user_id, author_driver_id, author_name, body, quick_code)
  values (
    p_order_id, v_role, (select auth.uid()),
    case when v_role = 'DRIVER' then v_driver.id end,
    case when v_role = 'DRIVER' then split_part(btrim(v_driver.full_name), ' ', 1) end,
    btrim(p_body),
    nullif(btrim(coalesce(p_quick, '')), '')
  )
  returning id into v_id;

  select array_agg(distinct l) into v_langs
  from unnest(array[
    'fi', 'en',
    (select c.language from public.companies c where c.id = v_order.shipper_company_id),
    (select c.language from public.companies c where c.id = v_order.assigned_company_id),
    (select d.app_language from public.drivers d where d.id = v_order.assigned_driver_id)
  ]) l
  where l is not null and l ~ '^[a-z]{2}$';

  return jsonb_build_object('id', v_id, 'langs', to_jsonb(v_langs));
end;
$$;

revoke all on function public.post_order_message(uuid, text, text) from public, anon;
grant execute on function public.post_order_message(uuid, text, text) to authenticated;


/* Уведомления о сообщении — не чаще раза в пять минут по рейсу на получателя. */
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

create trigger order_messages_notify
  after insert on public.order_messages
  for each row execute function app.on_order_message();


/* Срок хранения — 24 месяца. */
select cron.schedule(
  'rahtis-order-messages-retention',
  '40 3 * * *',
  $$ delete from public.order_messages where created_at < now() - interval '24 months'; $$
);
