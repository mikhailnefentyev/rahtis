-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · уведомления о событиях заказа
--
-- Канал был построен, но ключевые события в него не писали: отклик,
-- выбор перевозчика с пятнадцатиминутным сроком, возврат заказа на стол,
-- правка маршрута, закрытие рейса, решение по машине. То есть ровно то,
-- ради чего второй канал и заводился.
--
-- Триггерами, а не правкой шести функций. Функцию можно переписать и
-- забыть про уведомление — триггер видит саму строку и срабатывает на
-- любой путь, включая планировщик, который снимает просроченную бронь
-- без участия приложения.
--
-- Текст в базе не хранится. Строка несёт код события и подстановки, а
-- слово подбирает интерфейс на языке читающего: иначе английский кабинет
-- показывал бы финские уведомления. Свободные сообщения оператора
-- по-прежнему лежат текстом — у них кода нет и быть не может.
-- ═══════════════════════════════════════════════════════════════════

alter table public.notifications
  add column code text,
  add column params jsonb not null default '{}'::jsonb;

comment on column public.notifications.code is
  'Код события для перевода в интерфейсе. NULL у свободных сообщений оператора.';

alter table public.notifications
  alter column title drop not null;

alter table public.notifications
  add constraint notifications_code_or_title
    check (code is not null or title is not null),
  add constraint notifications_params_object
    check (jsonb_typeof(params) = 'object');


/* Код и подстановки вместо готового текста. */
create or replace function app.notify_event(
  p_company_id uuid,
  p_kind public.notification_kind,
  p_code text,
  p_params jsonb default '{}'::jsonb,
  p_link text default null
)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (company_id, kind, code, params, link)
  values (p_company_id, p_kind, p_code, coalesce(p_params, '{}'::jsonb), p_link)
  returning id;
$$;

/* Как и app.notify: definer без проверки прав наружу не отдаётся. */
revoke all on function app.notify_event(uuid, public.notification_kind, text, jsonb, text)
  from public, anon, authenticated;


-- ── Отклик пришёл заказчику ────────────────────────────────────────

create or replace function app.on_offer_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  if v_order.id is null then return new; end if;

  perform app.notify_event(
    v_order.shipper_company_id,
    'ORDER',
    'offer.received',
    jsonb_build_object('ref', v_order.ref),
    '/shipper/orders'
  );

  return new;
end;
$$;

create trigger order_offers_notify
  after insert on public.order_offers
  for each row execute function app.on_offer_created();


-- ── Смена статуса заказа ───────────────────────────────────────────

create or replace function app.on_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  /*
   * Выбрали перевозчика. Срок в подстановке, а не в тексте: пятнадцать
   * минут — настройка матчинга, и менять её в двух местах нельзя.
   */
  if new.status = 'AWAIT_DRIVER' and new.assigned_company_id is not null then
    perform app.notify_event(
      new.assigned_company_id,
      'ORDER',
      'offer.chosen',
      jsonb_build_object('ref', new.ref, 'minutes', 15),
      '/carrier/desk'
    );

  /*
   * Заказ вернулся на стол. Причина не различается намеренно: срок
   * вышел, водитель отказался или заказчик откатил — для обеих сторон
   * это один факт, заказ снова свободен. Перевозчик берётся из OLD:
   * в этой же строке назначение уже снято.
   */
  elsif new.status = 'OPEN' and old.status in ('REQUESTED', 'AWAIT_DRIVER') then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.released',
      jsonb_build_object('ref', new.ref),
      '/shipper/orders'
    );

    if old.assigned_company_id is not null then
      perform app.notify_event(
        old.assigned_company_id,
        'ORDER',
        'order.released',
        jsonb_build_object('ref', new.ref),
        '/carrier/desk'
      );
    end if;

  /* Рейс закрыт: документы у заказчика. */
  elsif new.status = 'DONE' then
    perform app.notify_event(
      new.shipper_company_id,
      'ORDER',
      'order.closed',
      jsonb_build_object('ref', new.ref),
      '/shipper/done'
    );
  end if;

  return new;
end;
$$;

create trigger orders_notify_status
  after update of status on public.orders
  for each row execute function app.on_order_status();


-- ── Заказчик поправил маршрут ──────────────────────────────────────

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

  return new;
end;
$$;

create trigger order_amendments_notify
  after insert on public.order_amendments
  for each row execute function app.on_amendment();


-- ── Решение по машине ──────────────────────────────────────────────

create or replace function app.on_vehicle_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.access is not distinct from old.access then
    return new;
  end if;

  if new.access = 'APPROVED' then
    perform app.notify_event(
      new.company_id, 'MODERATION', 'vehicle.approved',
      jsonb_build_object('plate', new.plate), '/carrier/fleet'
    );
  elsif new.access = 'REJECTED' then
    perform app.notify_event(
      new.company_id, 'MODERATION', 'vehicle.rejected',
      jsonb_build_object('plate', new.plate, 'reason', coalesce(new.rejection_reason, '')),
      '/carrier/fleet'
    );
  end if;

  return new;
end;
$$;

create trigger vehicles_notify_access
  after update of access on public.vehicles
  for each row execute function app.on_vehicle_access();
