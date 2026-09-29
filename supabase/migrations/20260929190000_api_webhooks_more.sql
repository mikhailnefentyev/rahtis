-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · API заказчиков, полный цикл — этап 3: новые события вебхуков
--
-- К шести событиям этапа вебхуков добавляются:
--   offer.received     — перевозчик откликнулся (или машина назначена напрямую)
--   order.started      — водитель подтвердил, рейс в пути
--   order.stop_arrived — водитель отметил прибытие на точку
--   order.eta_changed  — оценка прибытия на точку сдвинулась на 5 минут и больше
--   order.amended      — маршрут или ставка поправлены (кроме снятия — это order.cancelled)
--   claim.updated      — претензия подана, в ней новое сообщение, файл или статус
--
-- Как и раньше, в событии — ссылка и что изменилось; подробности — через
-- GET. Место водителя в события не кладётся: оно отдаётся только по
-- запросу к заказу, где его видно вместе с адресом точки.
--
-- ETA пересчитывается часто и по мелочи; меньше пяти минут — не повод
-- будить чужой сервер.
-- ═══════════════════════════════════════════════════════════════════

alter table public.api_webhooks drop constraint api_webhooks_events_known;
alter table public.api_webhooks add constraint api_webhooks_events_known check (
  events <@ array[
    'order.taken', 'order.reopened', 'order.started', 'order.stop_arrived', 'order.stop_completed',
    'order.eta_changed', 'order.amended', 'order.closed', 'order.cancelled',
    'offer.received', 'document.added', 'claim.updated'
  ]
  and cardinality(events) >= 1
);


/* Статусы: к прежним переходам — старт рейса. */
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
    when new.status = 'IN_PROGRESS' and old.status = 'AWAIT_DRIVER' then 'order.started'
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


/* Прибытие на точку и сдвиг ETA — одним триггером на точку. */
create or replace function app.webhook_stop_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_stop jsonb;
begin
  select * into v_order from public.orders where id = new.order_id;
  v_stop := jsonb_build_object('sequence', new.sequence, 'role', new.role, 'city', new.city);

  if new.arrived_at is not null and old.arrived_at is null then
    perform app.enqueue_webhook(v_order.shipper_company_id, 'order.stop_arrived', jsonb_build_object(
      'ref', v_order.ref, 'shipper_ref', v_order.shipper_ref,
      'stop', v_stop || jsonb_build_object('arrived_at', new.arrived_at)));
  end if;

  if new.eta_at is not null and new.completed_at is null
     and (old.eta_at is null or abs(extract(epoch from new.eta_at - old.eta_at)) >= 300) then
    perform app.enqueue_webhook(v_order.shipper_company_id, 'order.eta_changed', jsonb_build_object(
      'ref', v_order.ref, 'shipper_ref', v_order.shipper_ref,
      'stop', v_stop || jsonb_build_object('eta_at', new.eta_at, 'previous_eta_at', old.eta_at, 'source', new.eta_source)));
  end if;

  return new;
end;
$$;

create trigger order_stops_progress_webhooks
  after update of arrived_at, eta_at on public.order_stops
  for each row execute function app.webhook_stop_progress();


create or replace function app.webhook_offer_received()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  perform app.enqueue_webhook(v_order.shipper_company_id, 'offer.received', jsonb_build_object(
    'ref', v_order.ref, 'shipper_ref', v_order.shipper_ref,
    'offer', jsonb_build_object('id', new.id, 'origin', new.origin, 'created_at', new.created_at)));
  return new;
end;
$$;

create trigger order_offers_webhooks
  after insert on public.order_offers
  for each row execute function app.webhook_offer_received();


create or replace function app.webhook_order_amended()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if new.kind = 'ORDER_CANCELLED' then
    return new;
  end if;

  select * into v_order from public.orders where id = new.order_id;
  perform app.enqueue_webhook(v_order.shipper_company_id, 'order.amended', jsonb_build_object(
    'ref', v_order.ref, 'shipper_ref', v_order.shipper_ref,
    'amendment', jsonb_build_object(
      'id', new.id, 'kind', new.kind,
      'stop_sequence', (select s.sequence from public.order_stops s where s.id = new.stop_id),
      'created_at', new.created_at)));
  return new;
end;
$$;

create trigger order_amendments_webhooks
  after insert on public.order_amendments
  for each row execute function app.webhook_order_amended();


/*
 * Претензия — обеим сторонам, у кого есть подписка: и подавшей, и той,
 * против кого подана. Текст сообщения в событие не кладётся — его видно
 * в GET /claims/{ref}.
 */
create or replace function app.webhook_claim_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.claims;
  v_data jsonb;
  v_company uuid;
begin
  select * into v_claim from public.claims where id = new.claim_id;
  v_data := jsonb_build_object(
    'claim_ref', v_claim.ref,
    'order_ref', (select o.ref from public.orders o where o.id = v_claim.order_id),
    'change', new.kind,
    'status', v_claim.status,
    'at', new.created_at);

  foreach v_company in array array[v_claim.filed_by_company_id, v_claim.against_company_id] loop
    if v_company is not null then
      perform app.enqueue_webhook(v_company, 'claim.updated', v_data);
    end if;
  end loop;
  return new;
end;
$$;

create trigger claim_events_webhooks
  after insert on public.claim_events
  for each row execute function app.webhook_claim_updated();
