-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · API для заказчиков, этап 3: вебхуки
--
-- Заказчик указывает в кабинете адрес своего сервера и события. Событие
-- ставится в очередь той же транзакцией, что и изменение заказа: заказ
-- без записи в очереди быть не может, и наоборот. Отправляет очередь
-- маршрут /api/webhooks/dispatch раз в минуту (pg_cron → pg_net), с
-- подписью HMAC-SHA256 и повторами до суток.
--
-- События:
--   order.taken          — заказ взят перевозчиком (со стола в работу)
--   order.reopened       — перевозчик отказался, заказ снова на столе
--   order.stop_completed — точка маршрута пройдена
--   order.closed         — рейс закрыт (DONE)
--   order.cancelled      — заказ снят
--   document.added       — CMR или снимок рейса
--   ping                 — проверочное событие из кабинета
--
-- В событии — ссылка на заказ и что изменилось, не весь заказ: подробности
-- программа заказчика берёт через GET /api/v1/orders/{ref}, где правила
-- видимости уже применены.
--
-- Секрет подписи хранится открыто — иначе нечем подписывать, — но
-- заказчику в кабинете столбец не выдаётся: он видит секрет один раз при
-- создании. Очередь доставок хранится 30 дней.
-- ═══════════════════════════════════════════════════════════════════

create table public.api_webhooks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  url text not null,
  events text[] not null,
  secret text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  /* Подряд неудачных доставок; сбрасывается первой удачной. */
  failures integer not null default 0,

  constraint api_webhooks_url_shape check (url ~ '^https://[^\s/?#]+(/[^\s]*)?$' and length(url) <= 500),
  constraint api_webhooks_events_known check (
    events <@ array['order.taken', 'order.reopened', 'order.stop_completed', 'order.closed', 'order.cancelled', 'document.added']
    and cardinality(events) >= 1
  ),
  constraint api_webhooks_secret_shape check (secret ~ '^whsec_[0-9a-f]{48}$')
);

create index api_webhooks_company_idx on public.api_webhooks (company_id) where disabled_at is null;

alter table public.api_webhooks enable row level security;
revoke all on public.api_webhooks from anon, authenticated;
grant select (id, company_id, url, events, created_at, disabled_at, failures) on public.api_webhooks to authenticated;

create policy api_webhooks_select_own
  on public.api_webhooks for select to authenticated
  using (company_id = (select app.current_company_id()) or (select app.is_admin()));


create table public.api_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.api_webhooks (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status integer,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,

  constraint api_webhook_deliveries_status check (status in ('PENDING', 'SENT', 'FAILED'))
);

create index api_webhook_deliveries_due_idx
  on public.api_webhook_deliveries (next_attempt_at) where status = 'PENDING';
create index api_webhook_deliveries_hook_idx
  on public.api_webhook_deliveries (webhook_id, created_at desc);

alter table public.api_webhook_deliveries enable row level security;
revoke all on public.api_webhook_deliveries from anon, authenticated;
grant select (id, webhook_id, event, status, attempts, last_status, last_error, created_at, delivered_at)
  on public.api_webhook_deliveries to authenticated;

create policy api_webhook_deliveries_select_own
  on public.api_webhook_deliveries for select to authenticated
  using (
    (select app.is_admin())
    or exists (
      select 1 from public.api_webhooks w
      where w.id = api_webhook_deliveries.webhook_id and w.company_id = (select app.current_company_id())
    )
  );


-- ── Управление из кабинета ─────────────────────────────────────────

create or replace function public.api_webhook_create(p_url text, p_events text[], p_secret text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'SHIPPER' then
    raise exception 'Вебхук настраивает заказчик.' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null or v_company.status <> 'ACTIVE' or v_company.frozen_at is not null then
    raise exception 'Вебхук настраивает активная компания.' using errcode = '55000';
  end if;

  if (select count(*) from public.api_webhooks where company_id = v_company.id and disabled_at is null) >= 5 then
    raise exception 'У компании уже пять вебхуков.' using errcode = '55001';
  end if;

  insert into public.api_webhooks (company_id, url, events, secret, created_by)
  values (v_company.id, btrim(p_url), p_events, p_secret, (select auth.uid()))
  returning id into v_id;

  perform app.audit('api_webhook.create', v_id::text, jsonb_build_object('company', v_company.id, 'events', p_events));
  return v_id;
end;
$$;

revoke all on function public.api_webhook_create(text, text[], text) from public, anon;
grant execute on function public.api_webhook_create(text, text[], text) to authenticated;


create or replace function public.api_webhook_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.api_webhooks set disabled_at = now()
  where id = p_id and disabled_at is null
    and (company_id = (select app.current_company_id()) or (select app.is_admin()));
  if not found then
    raise exception 'Вебхук не найден.' using errcode = 'P0002';
  end if;

  /* Недоставленное по выключенному адресу больше не ждёт. */
  update public.api_webhook_deliveries set status = 'FAILED', last_error = 'webhook disabled'
  where webhook_id = p_id and status = 'PENDING';

  perform app.audit('api_webhook.delete', p_id::text, '{}'::jsonb);
end;
$$;

revoke all on function public.api_webhook_delete(uuid) from public, anon;
grant execute on function public.api_webhook_delete(uuid) to authenticated;


/* Проверочное событие — только на выбранный адрес, без подписки на тип. */
create or replace function public.api_webhook_ping(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.api_webhook_deliveries (webhook_id, event, payload)
  select w.id, 'ping', jsonb_build_object('message', 'RAHTIS webhook test')
  from public.api_webhooks w
  where w.id = p_id and w.disabled_at is null
    and w.company_id = (select app.current_company_id());
  if not found then
    raise exception 'Вебхук не найден.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.api_webhook_ping(uuid) from public, anon;
grant execute on function public.api_webhook_ping(uuid) to authenticated;


-- ── Постановка событий в очередь ───────────────────────────────────

create or replace function app.enqueue_webhook(p_company_id uuid, p_event text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.api_webhook_deliveries (webhook_id, event, payload)
  select w.id, p_event, p_data
  from public.api_webhooks w
  where w.company_id = p_company_id
    and w.disabled_at is null
    and p_event = any (w.events);
$$;

revoke all on function app.enqueue_webhook(uuid, text, jsonb) from public, anon, authenticated;


create or replace function app.webhook_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  v_event := case
    when new.status in ('AWAIT_DRIVER', 'IN_PROGRESS') and old.status in ('OPEN', 'REQUESTED') then 'order.taken'
    when new.status = 'OPEN' and old.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS') then 'order.reopened'
    when new.status = 'DONE' then 'order.closed'
    when new.status = 'CANCELLED' then 'order.cancelled'
  end;

  if v_event is not null then
    perform app.enqueue_webhook(new.shipper_company_id, v_event, jsonb_build_object(
      'ref', new.ref, 'shipper_ref', new.shipper_ref,
      'status', new.status, 'previous_status', old.status));
  end if;
  return new;
end;
$$;

create trigger orders_webhooks
  after update of status on public.orders
  for each row execute function app.webhook_order_status();


create or replace function app.webhook_stop_completed()
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

  select * into v_order from public.orders where id = new.order_id;
  perform app.enqueue_webhook(v_order.shipper_company_id, 'order.stop_completed', jsonb_build_object(
    'ref', v_order.ref, 'shipper_ref', v_order.shipper_ref,
    'stop', jsonb_build_object('sequence', new.sequence, 'role', new.role, 'city', new.city,
                               'completed_at', new.completed_at)));
  return new;
end;
$$;

create trigger order_stops_webhooks
  after update of completed_at on public.order_stops
  for each row execute function app.webhook_stop_completed();


create or replace function app.webhook_document_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  perform app.enqueue_webhook(v_order.shipper_company_id, 'document.added', jsonb_build_object(
    'ref', v_order.ref, 'shipper_ref', v_order.shipper_ref,
    'document', jsonb_build_object('id', new.id, 'kind', new.kind, 'phase', new.phase, 'created_at', new.created_at)));
  return new;
end;
$$;

create trigger order_documents_webhooks
  after insert on public.order_documents
  for each row execute function app.webhook_document_added();


-- ── Отправка: очередь для маршрута ─────────────────────────────────

/*
 * Выдать очередную пачку и сразу отодвинуть её на две минуты: второй
 * запуск, пришедший раньше, чем первый отчитался, её не возьмёт.
 */
create or replace function public.api_webhook_claim(p_limit integer default 50)
returns table (id uuid, event text, payload jsonb, created_at timestamptz, attempts integer, url text, secret text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select d.id
    from public.api_webhook_deliveries d
    join public.api_webhooks w on w.id = d.webhook_id and w.disabled_at is null
    where d.status = 'PENDING' and d.next_attempt_at <= now()
    order by d.next_attempt_at
    limit greatest(1, least(p_limit, 200))
    for update of d skip locked
  )
  update public.api_webhook_deliveries d
  set next_attempt_at = now() + interval '2 minutes'
  from due, public.api_webhooks w
  where d.id = due.id and w.id = d.webhook_id
  returning d.id, d.event, d.payload, d.created_at, d.attempts, w.url, w.secret;
$$;

revoke all on function public.api_webhook_claim(integer) from public, anon, authenticated;
grant execute on function public.api_webhook_claim(integer) to service_role;


/*
 * Итог попытки. Удача — SENT и сброс счётчика адреса. Неудача — повтор
 * через 1, 5, 15, 60 минут, 3, 6, 12 и 24 часа; после восьмой — FAILED.
 * Адрес, у которого 100 неудач подряд, выключается.
 */
create or replace function public.api_webhook_report(p_id uuid, p_ok boolean, p_status integer, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery public.api_webhook_deliveries;
  v_backoff interval[] := array['1 minute', '5 minutes', '15 minutes', '1 hour', '3 hours', '6 hours', '12 hours', '24 hours']::interval[];
begin
  select * into v_delivery from public.api_webhook_deliveries where id = p_id;
  if v_delivery.id is null then
    return;
  end if;

  if p_ok then
    update public.api_webhook_deliveries
    set status = 'SENT', attempts = attempts + 1, last_status = p_status, last_error = null, delivered_at = now()
    where id = p_id;
    update public.api_webhooks set failures = 0 where id = v_delivery.webhook_id;
    return;
  end if;

  update public.api_webhook_deliveries
  set attempts = attempts + 1,
      last_status = p_status,
      last_error = left(p_error, 300),
      status = case when attempts + 1 >= array_length(v_backoff, 1) then 'FAILED' else 'PENDING' end,
      next_attempt_at = now() + v_backoff[least(attempts + 1, array_length(v_backoff, 1))]
  where id = p_id;

  update public.api_webhooks
  set failures = failures + 1,
      disabled_at = case when failures + 1 >= 100 then now() else disabled_at end
  where id = v_delivery.webhook_id;
end;
$$;

revoke all on function public.api_webhook_report(uuid, boolean, integer, text) from public, anon, authenticated;
grant execute on function public.api_webhook_report(uuid, boolean, integer, text) to service_role;


/* Будильник: раз в минуту, если есть что отправлять. */
insert into app.runtime_config (key, value, note)
select 'webhooks_url',
       regexp_replace(value, '/api/reports/weekly$', '/api/webhooks/dispatch'),
       'Маршрут отправки вебхуков заказчикам. Будит app.run_webhook_dispatch.'
from app.runtime_config
where key = 'reports_url' and value ~ '/api/reports/weekly$'
on conflict (key) do nothing;

create or replace function app.run_webhook_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  if not exists (
    select 1 from public.api_webhook_deliveries where status = 'PENDING' and next_attempt_at <= now()
  ) then
    return null;
  end if;

  select value into v_url from app.runtime_config where key = 'webhooks_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';
  if v_url is null or v_secret is null then
    raise notice 'Вебхуки не отправлены: в app.runtime_config нет webhooks_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job)
  values (v_request, 'webhook-dispatch')
  on conflict (request_id) do nothing;

  return v_request;
end;
$$;

revoke all on function app.run_webhook_dispatch() from public, anon, authenticated;

select cron.schedule('rahtis-webhook-dispatch', '* * * * *', $$ select app.run_webhook_dispatch(); $$);


/* Очистка: журнал API — 90 дней, повторы — сутки, доставки — 30 дней. */
create or replace function app.purge_api_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.api_requests where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  delete from public.api_idempotency where created_at < now() - interval '1 day';
  delete from public.api_webhook_deliveries where created_at < now() - interval '30 days';
  return v_count;
end;
$$;
