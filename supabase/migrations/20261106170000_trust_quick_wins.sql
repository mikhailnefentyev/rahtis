-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · быстрые меры доверия (6.11.2026, после отказа от подряда)
--
-- Схема мошенничества в Европе: чужую компанию захватывают или выдают
-- себя за неё — меняют счёт и контакты, по телефону переадресуют груз.
-- Aivomaa денег за перевозку больше не касается, поэтому защищаемся
-- прозрачностью (docs/market/research-us-china-uae.md, пп. 1, 2, 7, 8):
--
--   1. Смена IBAN, почты компании или главного пользователя — запись в
--      журнал company_sensitive_changes (значения маскированы), письмо
--      остальным людям компании и на прежний адрес (шлёт сервер по
--      очереди notified_at), уведомление в кабинете. Контрагент 30 дней
--      видит отметку «реквизиты изменены N дней назад» — без значений.
--      Пишут триггеры на companies и profiles: любой путь правки.
--   2. Правки заказа открыты обеим сторонам на любой стадии до закрытия
--      и прозрачны: журнал знает автора (человек, компания, сторона) и
--      причину; машину и водителя меняет перевозчик; цена FIXED или
--      PER_KM (пересчёт за маршрутом); водитель сообщает о расхождении
--      и отмечает «видел» (order_change_requests, driver_seen_at).
--   3. Правила площадки — статичная страница, здесь ничего.
--   4. Бесплатные напоминания об оплате: счёт перевозчика по прямому
--      рейсу (freight_invoices), оплата счёта объекта (carrier_invoices),
--      пунктуальность оплаты счетов в сводке о заказчике, заготовка
--      отметки «не оплачен» на 14-й день просрочки.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. Журнал смены реквизитов и контактов ─────────────────────────

/* Маска счёта: последние четыре знака. Та же функция в src/lib/trust/changes.ts. */
create or replace function app.mask_iban(p_iban text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(coalesce(p_iban, '')), '') is null then null
    else '•••• ' || right(regexp_replace(p_iban, '\s', '', 'g'), 4)
  end;
$$;

/* Маска почты: первая буква и домен. */
create or replace function app.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(coalesce(p_email, '')), '') is null then null
    when position('@' in p_email) < 2 then '•••'
    else left(p_email, 1) || '•••' || substr(p_email, position('@' in p_email))
  end;
$$;

create table public.company_sensitive_changes (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete cascade,
  field text not null,
  /* Только маски: журнал читают люди компании, полный счёт им ни к чему. */
  old_value text,
  new_value text,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  /* Прежний адрес для предупреждения. Стирается, когда письмо ушло. */
  notify_old_email text,
  notified_at timestamptz,

  constraint company_sensitive_changes_field
    check (field in ('IBAN', 'CONTACT_EMAIL', 'BILLING_EMAIL', 'OWNER'))
);

comment on table public.company_sensitive_changes is
  'Смена счёта, почты или главного пользователя компании: маски значений, кто и когда. Письма — по notified_at.';

create index company_sensitive_changes_company_idx
  on public.company_sensitive_changes (company_id, changed_at desc);
create index company_sensitive_changes_pending_idx
  on public.company_sensitive_changes (changed_at)
  where notified_at is null;

alter table public.company_sensitive_changes enable row level security;
revoke all on public.company_sensitive_changes from anon, authenticated;

create policy company_sensitive_changes_own
  on public.company_sensitive_changes for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy company_sensitive_changes_admin
  on public.company_sensitive_changes for select to authenticated
  using ((select app.is_admin()));

/* Без notify_old_email: прежний адрес нужен только серверу. */
grant select (id, company_id, field, old_value, new_value, changed_by, changed_at, notified_at)
  on public.company_sensitive_changes to authenticated;
grant all on public.company_sensitive_changes to service_role;

/* Запись и уведомление в кабинете — одно событие. */
create or replace function app.record_sensitive_change(
  p_company_id uuid,
  p_field text,
  p_old text,
  p_new text,
  p_old_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.company_sensitive_changes (company_id, field, old_value, new_value, changed_by, notify_old_email)
  values (p_company_id, p_field, p_old, p_new, (select auth.uid()), p_old_email);

  perform app.notify_event(
    p_company_id,
    'MODERATION',
    'company.sensitive_changed',
    jsonb_build_object('field', p_field),
    '/account'
  );
end;
$$;

revoke all on function app.record_sensitive_change(uuid, text, text, text, text) from public, anon, authenticated;

/*
 * Первое заполнение (было пусто) — не смена: так заполняются реквизиты
 * при регистрации. Своих клиентов перевозчика (client_of) не считаем —
 * это записи справочника без входа.
 */
create or replace function app.companies_sensitive_watch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_of is not null then
    return new;
  end if;

  if old.iban is not null and new.iban is distinct from old.iban then
    perform app.record_sensitive_change(new.id, 'IBAN', app.mask_iban(old.iban), app.mask_iban(new.iban), null);
  end if;

  if old.contact_email is not null and new.contact_email is distinct from old.contact_email then
    perform app.record_sensitive_change(
      new.id, 'CONTACT_EMAIL', app.mask_email(old.contact_email), app.mask_email(new.contact_email), old.contact_email);
  end if;

  if old.billing_email is not null and new.billing_email is distinct from old.billing_email then
    perform app.record_sensitive_change(
      new.id, 'BILLING_EMAIL', app.mask_email(old.billing_email), app.mask_email(new.billing_email), old.billing_email);
  end if;

  return new;
end;
$$;

revoke all on function app.companies_sensitive_watch() from public, anon, authenticated;

create trigger companies_sensitive_watch
  after update of iban, contact_email, billing_email on public.companies
  for each row execute function app.companies_sensitive_watch();

/*
 * Новый главный пользователь. Первый человек компании — не смена:
 * так компания появляется.
 */
create or replace function app.profiles_owner_watch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if new.company_id is null or new.member_kind <> 'OWNER' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.member_kind = 'OWNER' and old.company_id is not distinct from new.company_id then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.company_id = new.company_id and p.id <> new.id) then
    return new;
  end if;

  select u.email::text into v_email from auth.users u where u.id = new.id;
  perform app.record_sensitive_change(new.company_id, 'OWNER', null, app.mask_email(v_email), null);
  return new;
end;
$$;

revoke all on function app.profiles_owner_watch() from public, anon, authenticated;

create trigger profiles_owner_watch
  after insert or update of member_kind, company_id on public.profiles
  for each row execute function app.profiles_owner_watch();

/*
 * Очередь писем: события за 7 дней без notified_at. Получатели — люди
 * компании, кроме того, кто менял, и прежний адрес. Только сервер.
 */
create or replace function public.sensitive_changes_pending(p_limit integer default 50)
returns table (
  id bigint,
  company_id uuid,
  company_name text,
  company_language text,
  contact_email text,
  field text,
  old_value text,
  new_value text,
  changed_at timestamptz,
  actor_name text,
  actor_is_operator boolean,
  notify_old_email text,
  member_emails text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.company_id,
    c.name,
    c.language,
    c.contact_email,
    e.field,
    e.old_value,
    e.new_value,
    e.changed_at,
    coalesce(nullif(btrim(p.full_name), ''), u.email::text),
    coalesce(p.role = 'ADMIN', false),
    e.notify_old_email,
    array(
      select distinct mu.email::text
      from public.profiles m
      join auth.users mu on mu.id = m.id
      where m.company_id = e.company_id
        and m.id is distinct from e.changed_by
        and mu.email is not null
    )
  from public.company_sensitive_changes e
  join public.companies c on c.id = e.company_id
  left join public.profiles p on p.id = e.changed_by
  left join auth.users u on u.id = e.changed_by
  where e.notified_at is null
    and e.changed_at > now() - interval '7 days'
  order by e.changed_at
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.sensitive_changes_pending(integer) from public, anon, authenticated;
grant execute on function public.sensitive_changes_pending(integer) to service_role;

/*
 * Отметка для контрагента: когда последний раз менялся счёт (за 30
 * дней). Только дата, без значений. Служебным ключом — страница сама
 * решает, кто кому контрагент.
 */
create or replace function public.bank_change_marks(p_company_ids uuid[])
returns table (company_id uuid, changed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.company_id, max(e.changed_at)
  from public.company_sensitive_changes e
  where e.company_id = any (p_company_ids)
    and e.field = 'IBAN'
    and e.changed_at > now() - interval '30 days'
  group by e.company_id;
$$;

revoke all on function public.bank_change_marks(uuid[]) from public, anon, authenticated;
grant execute on function public.bank_change_marks(uuid[]) to service_role;


-- ── 2. Правки заказа: открыто, с автором, у обеих сторон ───────────

/*
 * Решение пользователя 6.11.2026: правки не запрещаются, а делаются
 * прозрачными. Адреса точек (правка, новая точка, удаление) меняют
 * заказчик и назначенный перевозчик на любой стадии до закрытия; машину
 * и водителя — перевозчик; цену — по режиму (FIXED — пересчёт по
 * согласию, PER_KM — ставка × пробег пересчитывается с маршрутом).
 * Водитель сам не правит, а сообщает о расхождении (order_change_requests);
 * заказчик или перевозчик превращает сообщение в правку одной кнопкой.
 * Каждая правка — строка order_amendments: кто (человек, компания,
 * сторона), когда, что было → стало, причина.
 */

alter table public.order_amendments
  add column actor_side text,
  add column actor_name text,
  add column actor_company_id uuid references public.companies (id) on delete set null,
  add column reason text,
  add column driver_seen_at timestamptz,
  add column proposal_status text;

comment on column public.order_amendments.actor_side is
  'Кто правил: SHIPPER, CARRIER, OPERATOR, SYSTEM (API, расписание). Ставит триггер.';
comment on column public.order_amendments.actor_name is
  'Имя человека на момент правки (снимок).';
comment on column public.order_amendments.reason is
  'Причина или комментарий правки — видят обе стороны.';
comment on column public.order_amendments.proposal_status is
  'Предложение цены (PRICE_PROPOSED): PROPOSED → ACCEPTED / DECLINED другой стороной. Единственное, что меняется в строке журнала после записи.';
comment on column public.order_amendments.driver_seen_at is
  'Водитель отметил правку в приложении («видел»).';

create or replace function app.order_amendments_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_name text;
  v_company uuid;
begin
  new.reason := nullif(btrim(left(coalesce(new.reason, ''), 500)), '');
  if new.actor_id is null then
    new.actor_side := 'SYSTEM';
    new.actor_name := null;
    return new;
  end if;

  select p.role::text, nullif(btrim(coalesce(p.full_name, '')), ''), p.company_id
  into v_role, v_name, v_company
  from public.profiles p
  where p.id = new.actor_id;

  if v_role = 'ADMIN' then
    new.actor_side := 'OPERATOR';
  elsif v_role in ('SHIPPER', 'CARRIER') then
    new.actor_side := v_role;
  else
    new.actor_side := 'SYSTEM';
  end if;
  new.actor_name := v_name;
  new.actor_company_id := v_company;
  return new;
end;
$$;

revoke all on function app.order_amendments_actor() from public, anon, authenticated;

create trigger order_amendments_actor
  before insert on public.order_amendments
  for each row execute function app.order_amendments_actor();

/* Прежние строки: сторона и компания по профилю. */
update public.order_amendments a
set actor_side = case
      when p.role = 'ADMIN' then 'OPERATOR'
      when p.role::text in ('SHIPPER', 'CARRIER') then p.role::text
      else 'SYSTEM'
    end,
    actor_name = nullif(btrim(coalesce(p.full_name, '')), ''),
    actor_company_id = p.company_id
from public.profiles p
where p.id = a.actor_id and a.actor_side is null;

update public.order_amendments set actor_side = 'SYSTEM' where actor_side is null;

alter table public.order_amendments
  add constraint order_amendments_actor_side
    check (actor_side is null or actor_side in ('SHIPPER', 'CARRIER', 'OPERATOR', 'SYSTEM')),
  add constraint order_amendments_reason_length
    check (coalesce(length(reason), 0) <= 500),
  add constraint order_amendments_proposal_status
    check (proposal_status is null or proposal_status in ('PROPOSED', 'ACCEPTED', 'DECLINED'));

/* Причина к только что сделанной правке: автор, 10 минут. */
create or replace function public.annotate_amendment(p_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.order_amendments
  set reason = nullif(btrim(left(coalesce(p_reason, ''), 500)), '')
  where id = p_id
    and actor_id = (select auth.uid())
    and created_at > now() - interval '10 minutes';
end;
$$;

revoke all on function public.annotate_amendment(bigint, text) from public, anon;
grant execute on function public.annotate_amendment(bigint, text) to authenticated;


-- Кто правит точки и когда

/*
 * Заказчик (и перевозчик у своего рейса) — от публикации до закрытия;
 * назначенный перевозчик — пока рейс за ним (AWAIT_DRIVER, IN_PROGRESS).
 * Пройденную точку не трогает никто (доказательная база рейса).
 */
create or replace function app.assert_amendable(p_stop public.order_stops)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_me uuid := (select app.current_company_id());
  v_carrier boolean;
begin
  select * into v_order from public.orders where id = p_stop.order_id;

  v_carrier := coalesce(
    v_order.assigned_company_id = v_me and (select app.current_party_role()) = 'CARRIER',
    false
  );

  if not coalesce(
    v_order.shipper_company_id = v_me
    or app.is_own_order_of_caller(v_order.shipper_company_id)
    or v_carrier
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Править маршрут могут заказчик и назначенный перевозчик этого рейса.'
      using errcode = '42501';
  end if;

  if v_order.status not in ('OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Маршрут правится до закрытия рейса, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if p_stop.completed_at is not null then
    raise exception 'Точка уже пройдена — её маршрут не меняет.'
      using errcode = '55000';
  end if;

  return v_order;
end;
$$;

/*
 * Маршрут после правки пересчитывает тот, кто правил, — теперь и
 * назначенный перевозчик. Но километры (distance_auto_km) от клиента не
 * принимаются: от них при цене за км зависят деньги. Их пишет только
 * сервер (служебный ключ) — он сам считает маршрут у поставщика
 * (src/lib/orders/amend.ts → refreshRoute, API). С пользовательским
 * ключом функция обновляет только линию и плечи.
 */
create or replace function public.store_route(p_order_id uuid, p_route jsonb)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_leg jsonb;
  v_index integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_order.shipper_company_id = (select app.current_company_id())
    or app.is_own_order_of_caller(v_order.shipper_company_id)
    or (v_order.assigned_company_id = (select app.current_company_id())
        and (select app.current_party_role()) = 'CARRIER'
        and v_order.status in ('AWAIT_DRIVER', 'IN_PROGRESS'))
    or (select app.is_admin())
    or coalesce((select auth.role()), '') = 'service_role',
    false
  ) then
    raise exception 'Маршрут пересчитывает сторона этого рейса.' using errcode = '42501';
  end if;

  update public.orders
  set route_geometry = nullif(p_route->>'geometry', ''),
      route_bounds = p_route->'bounds',
      route_fingerprint = nullif(p_route->>'fingerprint', ''),
      route_computed_at = now(),
      distance_auto_km = case
        when coalesce((select auth.role()), '') = 'service_role' then nullif(p_route->>'km', '')::integer
        else distance_auto_km
      end
  where id = p_order_id
  returning * into v_order;

  if jsonb_typeof(p_route->'legs') = 'array' then
    for v_leg in select * from jsonb_array_elements(p_route->'legs') loop
      v_index := v_index + 1;

      update public.order_stops s
      set leg_distance_m = nullif(v_leg->>'distanceM', '')::integer,
          leg_duration_s = nullif(v_leg->>'durationS', '')::integer
      where s.id = (
        select t.id from public.order_stops t
        where t.order_id = p_order_id
        order by t.sequence
        offset v_index limit 1
      );
    end loop;
  end if;

  return v_order;
end;
$$;

/*
 * Уведомления о правке: другой стороне и водителю. Правку перевозчика
 * видит заказчик, правку заказчика или оператора — перевозчик; правку
 * точек — водитель рейса. Предложение цены — заказчику.
 */
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
  if v_order.id is null then
    return new;
  end if;

  if v_order.assigned_company_id is not null and new.actor_side is distinct from 'CARRIER' then
    perform app.notify_event(
      v_order.assigned_company_id,
      'ORDER',
      case when new.kind::text = 'PRICE_PROPOSED' then 'order.price_proposed' else 'order.amended' end,
      jsonb_build_object('ref', v_order.ref),
      '/carrier/desk'
    );
  end if;

  if new.actor_side = 'CARRIER' or new.actor_side = 'OPERATOR' then
    perform app.notify_event(
      v_order.shipper_company_id,
      'ORDER',
      case when new.kind::text = 'PRICE_PROPOSED' then 'order.price_proposed' else 'order.amended' end,
      jsonb_build_object('ref', v_order.ref),
      '/shipper/orders'
    );
  end if;

  if new.kind::text in ('STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED')
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

/*
 * «Принял к сведению»: каждая сторона отмечает правки другой —
 * перевозчик правки заказчика и оператора, заказчик правки перевозчика.
 */
create or replace function public.acknowledge_amendments(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_me uuid := (select app.current_company_id());
  v_count integer;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if coalesce(v_order.assigned_company_id = v_me and (select app.current_party_role()) = 'CARRIER', false) then
    update public.order_amendments
    set acknowledged_at = now(), acknowledged_by = (select auth.uid())
    where order_id = p_order_id and acknowledged_at is null and actor_side is distinct from 'CARRIER';
  elsif coalesce(v_order.shipper_company_id = v_me or (select app.is_admin()), false) then
    update public.order_amendments
    set acknowledged_at = now(), acknowledged_by = (select auth.uid())
    where order_id = p_order_id and acknowledged_at is null and actor_side = 'CARRIER';
  else
    raise exception 'Отметить изменения может сторона рейса.' using errcode = '42501';
  end if;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- Машина и водитель рейса

/*
 * Смена машины или водителя назначенного рейса — в журнал, кем бы ни
 * была сделана. Первое назначение (было пусто) и смена перевозчика —
 * не правка: это отклик, подтверждение, возврат на стол.
 */
create or replace function app.orders_assignment_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if new.status not in ('AWAIT_DRIVER', 'IN_PROGRESS')
     or old.assigned_company_id is distinct from new.assigned_company_id then
    return new;
  end if;

  if old.assigned_vehicle_id is not null and new.assigned_vehicle_id is distinct from old.assigned_vehicle_id then
    v_changes := v_changes || jsonb_build_object('vehicle', jsonb_build_object(
      'from', (select v.plate from public.vehicles v where v.id = old.assigned_vehicle_id),
      'to', (select v.plate from public.vehicles v where v.id = new.assigned_vehicle_id)));
  end if;

  if old.assigned_driver_id is not null and new.assigned_driver_id is distinct from old.assigned_driver_id then
    v_changes := v_changes || jsonb_build_object('driver', jsonb_build_object(
      'from', (select d.full_name from public.drivers d where d.id = old.assigned_driver_id),
      'to', (select d.full_name from public.drivers d where d.id = new.assigned_driver_id)));
  end if;

  if v_changes = '{}'::jsonb then
    return new;
  end if;

  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (new.id, 'ASSIGNMENT_CHANGED', v_changes, (select auth.uid()));
  return new;
end;
$$;

revoke all on function app.orders_assignment_log() from public, anon, authenticated;

create trigger orders_assignment_log
  after update of assigned_vehicle_id, assigned_driver_id on public.orders
  for each row execute function app.orders_assignment_log();

/*
 * Перевозчик меняет машину и/или водителя своего рейса. Машина — своя
 * и одобренная; водитель — свой и действующий; без водителя — тот, кто
 * сейчас за машиной.
 */
create or replace function public.change_trip_assignment(
  p_order_id uuid,
  p_vehicle_id uuid default null,
  p_driver_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_me uuid := (select app.current_company_id());
  v_driver uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null
     or not coalesce(v_order.assigned_company_id = v_me and (select app.current_party_role()) = 'CARRIER', false) then
    raise exception 'Машину рейса меняет назначенный перевозчик.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Рейс уже не идёт.' using errcode = '55000';
  end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles v where v.id = p_vehicle_id and v.company_id = v_me and v.approved_at is not null
  ) then
    raise exception 'Машина не найдена или не одобрена.' using errcode = '22023';
  end if;
  if p_driver_id is not null and not exists (
    select 1 from public.drivers d where d.id = p_driver_id and d.company_id = v_me and d.status = 'ACTIVE'
  ) then
    raise exception 'Водитель не найден.' using errcode = '22023';
  end if;

  v_driver := coalesce(
    p_driver_id,
    case when p_vehicle_id is not null then app.vehicle_driver_at(p_vehicle_id, now()) end,
    v_order.assigned_driver_id
  );

  update public.orders
  set assigned_vehicle_id = coalesce(p_vehicle_id, assigned_vehicle_id),
      assigned_driver_id = v_driver
  where id = p_order_id;

  if nullif(btrim(coalesce(p_reason, '')), '') is not null then
    update public.order_amendments
    set reason = btrim(left(p_reason, 500))
    where id = (
      select a.id from public.order_amendments a
      where a.order_id = p_order_id and a.actor_id = (select auth.uid())
      order by a.id desc limit 1
    )
      and created_at > now() - interval '1 minute';
  end if;
end;
$$;

revoke all on function public.change_trip_assignment(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.change_trip_assignment(uuid, uuid, uuid, text) to authenticated;


-- Цена: фиксированная или за километр

alter table public.orders
  add column pricing_mode text not null default 'FIXED',
  add column rate_per_km_cents integer;

alter table public.orders
  add constraint orders_pricing_mode
    check (pricing_mode in ('FIXED', 'PER_KM')),
  add constraint orders_rate_per_km
    check (
      (pricing_mode = 'PER_KM') = (rate_per_km_cents is not null)
      and (rate_per_km_cents is null or rate_per_km_cents between 1 and 100000)
    );

comment on column public.orders.pricing_mode is
  'FIXED — rate_cents согласованная сумма; PER_KM — rate_cents = rate_per_km_cents × distance_km, пересчитывается при правке маршрута.';

grant select (pricing_mode, rate_per_km_cents) on public.orders to authenticated;

/*
 * Режим цены задаётся сразу после создания заказа (create_order его не
 * знает): заказчик, перевозчик у своего рейса или оператор, 15 минут.
 */
create or replace function public.set_order_pricing(p_order_id uuid, p_mode text, p_per_km_cents integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null or not coalesce(
    v_order.shipper_company_id = (select app.current_company_id())
    or app.is_own_order_of_caller(v_order.shipper_company_id)
    or (select app.is_admin()),
    false
  ) then
    raise exception 'Нет доступа к заказу.' using errcode = '42501';
  end if;
  /*
   * Режим цены — только пока заказ не взят: черновик или на столе без
   * назначения и без откликов. Дальше цена меняется через предложение
   * (propose_price / respond_price_proposal) и пишется в историю.
   */
  if v_order.status not in ('DRAFT', 'OPEN')
     or v_order.assigned_company_id is not null
     or exists (select 1 from public.order_offers f where f.order_id = p_order_id) then
    raise exception 'Режим цены меняется только до назначения перевозчика.' using errcode = '55000';
  end if;

  if p_mode = 'PER_KM' and (v_order.distance_km is null or v_order.distance_km <= 0) then
    raise exception 'Для цены за км нужен пробег маршрута.' using errcode = '22023';
  end if;

  if p_mode = 'PER_KM' then
    update public.orders
    set pricing_mode = 'PER_KM',
        rate_per_km_cents = p_per_km_cents,
        rate_cents = greatest(1, round(p_per_km_cents::numeric * distance_km))::integer
    where id = p_order_id;
  else
    update public.orders set pricing_mode = 'FIXED', rate_per_km_cents = null where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.set_order_pricing(uuid, text, integer) from public, anon;
grant execute on function public.set_order_pricing(uuid, text, integer) to authenticated;

/*
 * Предложение новой цены (FIXED после смены маршрута): любая сторона
 * рейса; принимает или отклоняет другая. Пока висит одно предложение,
 * второе не подаётся.
 */
create or replace function app.order_side_of_caller(p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select app.is_admin()) then 'OPERATOR'
    when p_order.assigned_company_id = (select app.current_company_id())
         and (select app.current_party_role()) = 'CARRIER' then 'CARRIER'
    when p_order.shipper_company_id = (select app.current_company_id())
         or app.is_own_order_of_caller(p_order.shipper_company_id) then 'SHIPPER'
  end;
$$;

revoke all on function app.order_side_of_caller(public.orders) from public, anon, authenticated;

/*
 * Граница правдоподобия пересчёта: не больше 3× прежнего пробега и не
 * больше +1500 км. Дальше — только оператор вручную (reprice_order).
 * То же правило — src/lib/orders/routePricing.ts (тесты).
 */
create or replace function app.route_distance_plausible(p_prev integer, p_next integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_next is not null and p_next > 0
     and (coalesce(p_prev, 0) <= 0 or (p_next <= p_prev * 3 and p_next <= p_prev + 1500));
$$;

/*
 * После правки точек и пересчёта маршрута сервером (distance_auto_km
 * пишет только служебный ключ): у PER_KM пробег и цена следуют за
 * маршрутом — правка заказчика (он платит) или оператора применяется
 * сразу, правка перевозчика становится предложением цены, которое
 * заказчик принимает или отклоняет. FIXED не меняется: стороны видят
 * разницу и договариваются предложением. Неправдоподобный пробег не
 * применяется. В журнал — км и цена «было → стало». Ответ: NONE,
 * APPLIED, PROPOSED, OUT_OF_BOUNDS.
 */
create or replace function public.apply_route_distance(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_side text;
  v_rate integer;
  v_changes jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  v_side := app.order_side_of_caller(v_order);
  if v_order.id is null or v_side is null then
    raise exception 'Нет доступа к заказу.' using errcode = '42501';
  end if;

  if v_order.pricing_mode <> 'PER_KM'
     or v_order.status not in ('OPEN', 'REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
     or v_order.distance_auto_km is null
     or v_order.distance_auto_km = v_order.distance_km then
    return 'NONE';
  end if;

  if v_side <> 'OPERATOR' and not app.route_distance_plausible(v_order.distance_km, v_order.distance_auto_km) then
    return 'OUT_OF_BOUNDS';
  end if;

  v_rate := greatest(1, round(v_order.rate_per_km_cents::numeric * v_order.distance_auto_km))::integer;
  v_changes := jsonb_build_object(
    'distance_km', jsonb_build_object('from', v_order.distance_km, 'to', v_order.distance_auto_km),
    'rate_cents', jsonb_build_object('from', v_order.rate_cents, 'to', v_rate)
  );

  if v_side = 'CARRIER' then
    if exists (
      select 1 from public.order_amendments a
      where a.order_id = p_order_id and a.kind::text = 'PRICE_PROPOSED' and a.proposal_status = 'PROPOSED'
    ) then
      return 'NONE';
    end if;
    insert into public.order_amendments (order_id, kind, changes, actor_id, proposal_status)
    values (p_order_id, 'PRICE_PROPOSED', v_changes, (select auth.uid()), 'PROPOSED');
    return 'PROPOSED';
  end if;

  update public.orders
  set distance_km = v_order.distance_auto_km,
      rate_cents = v_rate,
      distance_source = 'AUTO'
  where id = p_order_id;

  insert into public.order_amendments (order_id, kind, changes, actor_id)
  values (p_order_id, 'ORDER_REPRICED', v_changes, (select auth.uid()));
  return 'APPLIED';
end;
$$;

revoke all on function public.apply_route_distance(uuid) from public, anon;
grant execute on function public.apply_route_distance(uuid) to authenticated;


create or replace function public.propose_price(p_order_id uuid, p_rate_cents integer, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_side text;
begin
  select * into v_order from public.orders where id = p_order_id;
  v_side := app.order_side_of_caller(v_order);
  if v_order.id is null or v_side is null then
    raise exception 'Цену предлагает сторона рейса.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') or p_rate_cents is null or p_rate_cents < 1 then
    raise exception 'Предложение цены сейчас невозможно.' using errcode = '55000';
  end if;
  if exists (
    select 1 from public.order_amendments a
    where a.order_id = p_order_id and a.kind::text = 'PRICE_PROPOSED' and a.proposal_status = 'PROPOSED'
  ) then
    raise exception 'Предыдущее предложение ещё ждёт ответа.' using errcode = '55000';
  end if;

  insert into public.order_amendments (order_id, kind, changes, actor_id, reason, proposal_status)
  values (
    p_order_id,
    'PRICE_PROPOSED',
    jsonb_build_object(
      'rate_cents', jsonb_build_object('from', v_order.rate_cents, 'to', p_rate_cents),
      'distance_km', jsonb_build_object('from', v_order.distance_km, 'to', coalesce(v_order.distance_auto_km, v_order.distance_km))
    ),
    (select auth.uid()),
    p_reason,
    'PROPOSED'
  );
end;
$$;

revoke all on function public.propose_price(uuid, integer, text) from public, anon;
grant execute on function public.propose_price(uuid, integer, text) to authenticated;

/*
 * Ответ другой стороны. Принято — цена и пробег из предложения
 * становятся ценой рейса, отдельной строкой ORDER_REPRICED.
 */
create or replace function public.respond_price_proposal(p_amendment_id bigint, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.order_amendments;
  v_order public.orders;
  v_side text;
  v_rate integer;
  v_km integer;
begin
  select * into v_row from public.order_amendments where id = p_amendment_id;
  if v_row.id is null or v_row.kind::text <> 'PRICE_PROPOSED' or v_row.proposal_status is distinct from 'PROPOSED' then
    raise exception 'Предложение не найдено или уже решено.' using errcode = '55000';
  end if;

  select * into v_order from public.orders where id = v_row.order_id;
  v_side := app.order_side_of_caller(v_order);
  if v_side is null or (v_side <> 'OPERATOR' and v_side = v_row.actor_side) then
    raise exception 'Отвечает другая сторона рейса.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Рейс уже закрыт.' using errcode = '55000';
  end if;

  update public.order_amendments
  set proposal_status = case when p_accept then 'ACCEPTED' else 'DECLINED' end
  where id = p_amendment_id;

  if not p_accept then
    return;
  end if;

  v_rate := (v_row.changes -> 'rate_cents' ->> 'to')::integer;
  v_km := coalesce((v_row.changes -> 'distance_km' ->> 'to')::integer, v_order.distance_km);

  update public.orders
  set rate_cents = v_rate,
      distance_km = v_km
  where id = v_order.id;

  insert into public.order_amendments (order_id, kind, changes, actor_id, reason)
  values (
    v_order.id,
    'ORDER_REPRICED',
    jsonb_build_object(
      'distance_km', jsonb_build_object('from', v_order.distance_km, 'to', v_km),
      'rate_cents', jsonb_build_object('from', v_order.rate_cents, 'to', v_rate)
    ),
    (select auth.uid()),
    v_row.reason
  );
end;
$$;

revoke all on function public.respond_price_proposal(bigint, boolean) from public, anon;
grant execute on function public.respond_price_proposal(bigint, boolean) to authenticated;

/* Цена и пробег для сторон рейса: режим, ставка за км, пробег по маршруту. */
create or replace function public.order_pricing_info(p_order_ids uuid[])
returns table (
  order_id uuid,
  pricing_mode text,
  rate_per_km_cents integer,
  distance_km integer,
  distance_auto_km integer,
  rate_cents integer,
  currency text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.pricing_mode, o.rate_per_km_cents, o.distance_km, o.distance_auto_km, o.rate_cents, o.currency::text
  from public.orders o
  where o.id = any (p_order_ids)
    and (
      o.shipper_company_id = (select app.current_company_id())
      or o.assigned_company_id = (select app.current_company_id())
      or (select app.is_admin())
    );
$$;

revoke all on function public.order_pricing_info(uuid[]) from public, anon;
grant execute on function public.order_pricing_info(uuid[]) to authenticated, service_role;


-- Водитель: сообщение о расхождении и «видел»

create table public.order_change_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  stop_id uuid references public.order_stops (id) on delete set null,
  driver_id uuid references public.drivers (id) on delete set null,
  message text not null,
  address text,
  lat double precision,
  lon double precision,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution text,
  amendment_id bigint references public.order_amendments (id) on delete set null,

  constraint order_change_requests_message check (length(btrim(message)) between 1 and 500),
  constraint order_change_requests_address check (coalesce(length(address), 0) <= 300),
  constraint order_change_requests_point check ((lat is null) = (lon is null)),
  constraint order_change_requests_resolution check (
    (resolved_at is null) = (resolution is null) and (resolution is null or resolution in ('APPLIED', 'DISMISSED'))
  )
);

comment on table public.order_change_requests is
  'Водитель сообщает о расхождении (адрес, получатель). Правкой его делает заказчик или перевозчик.';

create index order_change_requests_order_idx on public.order_change_requests (order_id, created_at);

alter table public.order_change_requests enable row level security;
revoke all on public.order_change_requests from anon, authenticated;

create policy order_change_requests_party
  on public.order_change_requests for select to authenticated
  using ((select app.party_to_order(order_id)));

create policy order_change_requests_driver
  on public.order_change_requests for select to authenticated
  using (driver_id is not null and driver_id = (select app.current_driver_id()));

grant select on public.order_change_requests to authenticated;
grant all on public.order_change_requests to service_role;

create or replace function public.driver_request_change(
  p_order_id uuid,
  p_stop_id uuid,
  p_message text,
  p_address text default null,
  p_lat double precision default null,
  p_lon double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
  v_order public.orders;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_driver is null or v_order.id is null or v_order.assigned_driver_id is distinct from v_driver then
    raise exception 'Сообщить может водитель рейса.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Рейс уже не идёт.' using errcode = '55000';
  end if;
  if p_stop_id is not null and not exists (
    select 1 from public.order_stops s where s.id = p_stop_id and s.order_id = p_order_id
  ) then
    raise exception 'Точка не из этого рейса.' using errcode = '22023';
  end if;

  insert into public.order_change_requests (order_id, stop_id, driver_id, message, address, lat, lon)
  values (
    p_order_id, p_stop_id, v_driver, btrim(left(coalesce(p_message, ''), 500)),
    nullif(btrim(left(coalesce(p_address, ''), 300)), ''),
    case when p_lat between -90 and 90 and p_lon between -180 and 180 then p_lat end,
    case when p_lat between -90 and 90 and p_lon between -180 and 180 then p_lon end
  )
  returning id into v_id;

  if v_order.assigned_company_id is not null then
    perform app.notify_event(v_order.assigned_company_id, 'ORDER', 'order.change_requested',
      jsonb_build_object('ref', v_order.ref), '/carrier/desk');
  end if;
  perform app.notify_event(v_order.shipper_company_id, 'ORDER', 'order.change_requested',
    jsonb_build_object('ref', v_order.ref), '/shipper/orders');
  return v_id;
end;
$$;

revoke all on function public.driver_request_change(uuid, uuid, text, text, double precision, double precision) from public, anon;
grant execute on function public.driver_request_change(uuid, uuid, text, text, double precision, double precision) to authenticated;

/* Заказчик или перевозчик закрывает сообщение: применено правкой или отклонено. */
create or replace function public.resolve_change_request(p_id uuid, p_resolution text, p_amendment_id bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  select r.order_id into v_order_id from public.order_change_requests r where r.id = p_id;
  if v_order_id is null or not (select app.party_to_order(v_order_id)) then
    raise exception 'Нет доступа.' using errcode = '42501';
  end if;
  if p_resolution not in ('APPLIED', 'DISMISSED') then
    raise exception 'Неизвестное решение.' using errcode = '22023';
  end if;

  update public.order_change_requests
  set resolved_at = now(),
      resolved_by = (select auth.uid()),
      resolution = p_resolution,
      amendment_id = case
        when p_amendment_id is not null
          and exists (select 1 from public.order_amendments a where a.id = p_amendment_id and a.order_id = v_order_id)
        then p_amendment_id
      end
  where id = p_id and resolved_at is null;
end;
$$;

revoke all on function public.resolve_change_request(uuid, text, bigint) from public, anon;
grant execute on function public.resolve_change_request(uuid, text, bigint) to authenticated;

/* Правки, которых водитель ещё не отметил: только своему водителю, только на рейсе. */
create or replace function public.driver_route_changes(p_order_id uuid)
returns table (
  id bigint,
  kind public.amendment_kind,
  stop_role public.stop_role,
  stop_label text,
  changes jsonb,
  created_at timestamptz,
  actor_side text,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.kind, a.stop_role, a.stop_label, a.changes, a.created_at, a.actor_side, a.reason
  from public.order_amendments a
  join public.orders o on o.id = a.order_id
  where a.order_id = p_order_id
    and (select app.current_driver_id()) is not null
    and o.assigned_driver_id = (select app.current_driver_id())
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    and a.kind in ('STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED')
    and a.driver_seen_at is null
  order by a.created_at;
$$;

revoke all on function public.driver_route_changes(uuid) from public, anon;
grant execute on function public.driver_route_changes(uuid) to authenticated;

create or replace function public.driver_ack_route_changes(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_driver uuid := (select app.current_driver_id());
  v_count integer;
begin
  if v_driver is null or not exists (
    select 1 from public.orders o where o.id = p_order_id and o.assigned_driver_id = v_driver
  ) then
    raise exception 'Отметить может только водитель рейса.' using errcode = '42501';
  end if;

  update public.order_amendments
  set driver_seen_at = now()
  where order_id = p_order_id
    and driver_seen_at is null
    and kind in ('STOP_ADDED', 'STOP_CHANGED', 'STOP_REMOVED');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.driver_ack_route_changes(uuid) from public, anon;
grant execute on function public.driver_ack_route_changes(uuid) to authenticated;


-- ── 4. Счета перевозчика по прямым рейсам ──────────────────────────

create table public.freight_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  shipper_company_id uuid not null references public.companies (id) on delete cascade,
  number text not null,
  amount_cents bigint not null,
  currency public.currency_code not null,
  issued_on date not null,
  due_on date not null,
  /* Куда шлём напоминание: почта заказчика для счетов. */
  send_to text not null,
  /* Дата оплаты (не момент): отмечает перевозчик или заказчик. */
  paid_at date,
  paid_marked_by uuid references auth.users (id) on delete set null,
  paid_marked_side text,
  /* Отметку заказчика перевозчик подтвердил (свою — сразу). */
  paid_confirmed_at timestamptz,
  reminder_1_at timestamptz,
  reminder_2_at timestamptz,
  collection_hint_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint freight_invoices_number check (length(btrim(number)) between 1 and 40),
  constraint freight_invoices_amount check (amount_cents > 0 and amount_cents < 100000000000),
  constraint freight_invoices_dates check (due_on >= issued_on and due_on <= issued_on + 365),
  constraint freight_invoices_send_to check (send_to = lower(send_to) and position('@' in send_to) > 1 and length(send_to) <= 254),
  constraint freight_invoices_paid_side check (
    (paid_at is null) = (paid_marked_side is null)
    and (paid_marked_side is null or paid_marked_side in ('CARRIER', 'SHIPPER', 'OPERATOR'))
  )
);

comment on table public.freight_invoices is
  'Счёт перевозчика заказчику по прямому рейсу: напоминания об оплате от имени перевозчика и пунктуальность заказчика в сводке. Aivomaa не кредитор.';

create index freight_invoices_shipper_idx on public.freight_invoices (shipper_company_id, issued_on desc);
create index freight_invoices_carrier_idx on public.freight_invoices (carrier_company_id, issued_on desc);
create index freight_invoices_open_idx on public.freight_invoices (due_on) where paid_at is null;

alter table public.freight_invoices enable row level security;
revoke all on public.freight_invoices from anon, authenticated;

create policy freight_invoices_carrier
  on public.freight_invoices for select to authenticated
  using (carrier_company_id = (select app.current_company_id()));

create policy freight_invoices_shipper
  on public.freight_invoices for select to authenticated
  using (shipper_company_id = (select app.current_company_id()));

create policy freight_invoices_admin
  on public.freight_invoices for select to authenticated
  using ((select app.is_admin()));

/* Запись — только функциями ниже. */
grant select on public.freight_invoices to authenticated;
grant all on public.freight_invoices to service_role;

/*
 * Перевозчик рейса отмечает «счёт отправлен» (или правит, пока не
 * оплачен). Право — то же, что у отметки об оплате: выполненный рейс по
 * прямому договору, заказчик не свой клиент, 180 дней после закрытия.
 * Новый срок оплаты начинает напоминания заново.
 */
create or replace function public.save_freight_invoice(
  p_order_id uuid,
  p_number text,
  p_amount_cents bigint,
  p_currency text,
  p_issued_on date,
  p_due_on date,
  p_send_to text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipper uuid;
  v_id uuid;
  v_send_to text := lower(btrim(coalesce(p_send_to, '')));
begin
  if not app.can_report_payment(p_order_id) then
    raise exception 'Счёт отмечает перевозчик рейса по прямому договору в течение 180 дней после закрытия.'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.freight_invoices f where f.order_id = p_order_id and f.paid_at is not null) then
    raise exception 'Счёт уже оплачен.' using errcode = '55000';
  end if;

  select o.shipper_company_id into v_shipper from public.orders o where o.id = p_order_id;

  /*
   * Напоминания уходят от RAHTIS — адрес только заказчика: его почта для
   * счетов, общая почта или почта его пользователей. Иначе через сервис
   * можно было бы слать письма кому угодно.
   */
  if v_send_to = '' then
    select lower(coalesce(nullif(btrim(c.billing_email), ''), c.contact_email)) into v_send_to
    from public.companies c where c.id = v_shipper;
  elsif not exists (
    select 1 from public.companies c
    where c.id = v_shipper and v_send_to in (lower(btrim(coalesce(c.billing_email, ''))), lower(btrim(coalesce(c.contact_email, ''))))
  ) and not exists (
    select 1 from public.profiles pr join auth.users u on u.id = pr.id
    where pr.company_id = v_shipper and lower(u.email) = v_send_to
  ) then
    raise exception 'Напоминания отправляются только на адрес заказчика (почта для счетов, общая почта или почта его пользователей).'
      using errcode = '22023';
  end if;

  insert into public.freight_invoices (
    order_id, carrier_company_id, shipper_company_id, number, amount_cents, currency,
    issued_on, due_on, send_to, created_by
  )
  values (
    p_order_id, (select app.current_company_id()), v_shipper, btrim(coalesce(p_number, '')), p_amount_cents,
    upper(btrim(coalesce(p_currency, 'EUR'))), p_issued_on, p_due_on, v_send_to, (select auth.uid())
  )
  on conflict (order_id) do update set
    number = excluded.number,
    amount_cents = excluded.amount_cents,
    currency = excluded.currency,
    issued_on = excluded.issued_on,
    send_to = excluded.send_to,
    reminder_1_at = case when freight_invoices.due_on = excluded.due_on then freight_invoices.reminder_1_at end,
    reminder_2_at = case when freight_invoices.due_on = excluded.due_on then freight_invoices.reminder_2_at end,
    collection_hint_at = case when freight_invoices.due_on = excluded.due_on then freight_invoices.collection_hint_at end,
    due_on = excluded.due_on,
    updated_at = now()
  where freight_invoices.carrier_company_id = (select app.current_company_id())
  returning id into v_id;

  if v_id is null then
    raise exception 'Счёт не найден.' using errcode = '42501';
  end if;
  return v_id;
end;
$$;

revoke all on function public.save_freight_invoice(uuid, text, bigint, text, date, date, text) from public, anon;
grant execute on function public.save_freight_invoice(uuid, text, bigint, text, date, date, text) to authenticated;

/* Перевозчик убирает ошибочную запись, пока счёт не оплачен. */
create or replace function public.delete_freight_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.freight_invoices f
  where f.id = p_invoice_id
    and f.paid_at is null
    and f.carrier_company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER';
  if not found then
    raise exception 'Счёт нельзя убрать.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.delete_freight_invoice(uuid) from public, anon;
grant execute on function public.delete_freight_invoice(uuid) to authenticated;

/*
 * «Оплачен» с датой. Отмечают перевозчик (сразу подтверждено), заказчик
 * (перевозчик подтверждает или снимает) и оператор. NULL — снять отметку:
 * только перевозчик или оператор («деньги не пришли»).
 */
create or replace function public.mark_freight_invoice_paid(p_invoice_id uuid, p_paid_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.freight_invoices;
  v_me uuid := (select app.current_company_id());
  v_side text;
  v_ref text;
  v_today date := (now() at time zone 'Europe/Helsinki')::date;
begin
  select * into v_inv from public.freight_invoices where id = p_invoice_id;
  if v_inv.id is null then
    raise exception 'Счёт не найден.' using errcode = 'P0002';
  end if;

  if (select app.is_admin()) then
    v_side := 'OPERATOR';
  elsif v_inv.carrier_company_id = v_me and (select app.current_party_role()) = 'CARRIER' then
    v_side := 'CARRIER';
  elsif v_inv.shipper_company_id = v_me and (select app.current_party_role()) = 'SHIPPER' then
    v_side := 'SHIPPER';
  else
    raise exception 'Нет доступа к этому счёту.' using errcode = '42501';
  end if;

  if p_paid_on is null then
    if v_side = 'SHIPPER' then
      raise exception 'Отметку снимает перевозчик.' using errcode = '42501';
    end if;
    update public.freight_invoices
    set paid_at = null, paid_marked_by = null, paid_marked_side = null, paid_confirmed_at = null, updated_at = now()
    where id = p_invoice_id;
    return;
  end if;

  if p_paid_on > v_today or p_paid_on < v_inv.issued_on - 60 then
    raise exception 'Дата оплаты вне допустимого окна.' using errcode = '22023';
  end if;

  if v_side = 'SHIPPER' and v_inv.paid_at is not null then
    return;
  end if;

  update public.freight_invoices
  set paid_at = p_paid_on,
      paid_marked_by = (select auth.uid()),
      paid_marked_side = v_side,
      paid_confirmed_at = case when v_side = 'SHIPPER' then null else now() end,
      updated_at = now()
  where id = p_invoice_id;

  if v_side = 'SHIPPER' then
    select o.ref into v_ref from public.orders o where o.id = v_inv.order_id;
    perform app.notify_event(
      v_inv.carrier_company_id,
      'BILLING',
      'invoice.paid_marked',
      jsonb_build_object('number', v_inv.number, 'ref', coalesce(v_ref, '')),
      '/carrier/done'
    );
  end if;
end;
$$;

revoke all on function public.mark_freight_invoice_paid(uuid, date) from public, anon;
grant execute on function public.mark_freight_invoice_paid(uuid, date) to authenticated;

/* Перевозчик подтверждает отметку заказчика. */
create or replace function public.confirm_freight_invoice_paid(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.freight_invoices
  set paid_confirmed_at = now(), updated_at = now()
  where id = p_invoice_id
    and paid_at is not null
    and carrier_company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER';
  if not found then
    raise exception 'Нечего подтверждать.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.confirm_freight_invoice_paid(uuid) from public, anon;
grant execute on function public.confirm_freight_invoice_paid(uuid) to authenticated;

alter table public.direct_payment_reports
  add column prefilled boolean not null default false;

comment on column public.direct_payment_reports.prefilled is
  'Заготовлена системой на 14-й день просрочки счёта (freight_invoices); перевозчик правит — флаг снимается.';

/*
 * Для списка выполненных у перевозчика: рейсы, где можно отметить счёт
 * (условия — как у отметки об оплате), с подстановками по умолчанию —
 * ставка, валюта, почта заказчика для счетов (перевозчику по прямому
 * договору она и так положена, TERMS) — и записанный счёт.
 */
create or replace function public.freight_invoice_targets()
returns table (
  order_id uuid,
  editable boolean,
  default_amount_cents bigint,
  default_currency text,
  default_send_to text,
  invoice_id uuid,
  number text,
  amount_cents bigint,
  currency text,
  issued_on date,
  due_on date,
  send_to text,
  paid_at date,
  paid_marked_side text,
  paid_confirmed_at timestamptz,
  reminder_1_at timestamptz,
  reminder_2_at timestamptz,
  report_prefilled boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    app.closed_moment(o) > now() - interval '180 days',
    o.rate_cents::bigint,
    o.currency::text,
    coalesce(sh.billing_email, sh.contact_email),
    f.id,
    f.number,
    f.amount_cents,
    f.currency::text,
    f.issued_on,
    f.due_on,
    f.send_to,
    f.paid_at,
    f.paid_marked_side,
    f.paid_confirmed_at,
    f.reminder_1_at,
    f.reminder_2_at,
    coalesce(r.prefilled and r.removed_at is null, false)
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.freight_invoices f on f.order_id = o.id
  left join public.direct_payment_reports r on r.order_id = o.id
  where o.assigned_company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'CARRIER'
    and o.status = 'DONE'
    and o.contract_party = 'CARRIER'
    and sh.client_of is null
    and (app.closed_moment(o) > now() - interval '180 days' or f.id is not null);
$$;

revoke all on function public.freight_invoice_targets() from public, anon;
grant execute on function public.freight_invoice_targets() to authenticated;

/* Заказчику: счета перевозчиков (открытые и оплаченные за 90 дней) с названием перевозчика. */
create or replace function public.shipper_freight_invoices()
returns table (
  id uuid,
  order_id uuid,
  order_ref text,
  carrier_name text,
  number text,
  amount_cents bigint,
  currency text,
  issued_on date,
  due_on date,
  paid_at date,
  paid_marked_side text,
  paid_confirmed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.order_id, o.ref, coalesce(ca.legal_name, ca.name), f.number, f.amount_cents, f.currency::text,
         f.issued_on, f.due_on, f.paid_at, f.paid_marked_side, f.paid_confirmed_at
  from public.freight_invoices f
  join public.orders o on o.id = f.order_id
  join public.companies ca on ca.id = f.carrier_company_id
  where f.shipper_company_id = (select app.current_company_id())
    and (select app.current_party_role()) = 'SHIPPER'
    and (f.paid_at is null or f.paid_at > (now() at time zone 'Europe/Helsinki')::date - 90)
  order by f.paid_at is not null, f.due_on;
$$;

revoke all on function public.shipper_freight_invoices() from public, anon;
grant execute on function public.shipper_freight_invoices() to authenticated;


-- ── Счета объектов: оплата и напоминания ───────────────────────────

alter table public.carrier_invoices
  add column paid_at date,
  add column paid_marked_by uuid references auth.users (id) on delete set null,
  add column reminder_1_at timestamptz,
  add column reminder_2_at timestamptz,
  add column collection_hint_at timestamptz;

comment on column public.carrier_invoices.paid_at is
  'Дата оплаты, отметил перевозчик. Пусто — напоминания клиенту идут после срока.';

create index carrier_invoices_open_idx on public.carrier_invoices (due_on)
  where paid_at is null and sent_at is not null;

/* Перевозчик отмечает оплату своего счёта объекта; NULL — снять. */
create or replace function public.mark_site_invoice_paid(p_invoice_id uuid, p_paid_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_paid_on is not null and p_paid_on > (now() at time zone 'Europe/Helsinki')::date then
    raise exception 'Дата оплаты в будущем.' using errcode = '22023';
  end if;

  update public.carrier_invoices
  set paid_at = p_paid_on,
      paid_marked_by = case when p_paid_on is null then null else (select auth.uid()) end
  where id = p_invoice_id
    and (
      (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
      or (select app.is_admin())
    );
  if not found then
    raise exception 'Счёт не найден.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.mark_site_invoice_paid(uuid, date) from public, anon;
grant execute on function public.mark_site_invoice_paid(uuid, date) to authenticated;


-- ── Отметка «не оплачен» по заготовке ──────────────────────────────

/* Колонка prefilled добавлена выше, до freight_invoice_targets (функции на SQL проверяют колонки при создании). */

/*
 * Тело из 20261106140000_shipper_trust: + prefilled. Пользователь его не
 * ставит; правка перевозчиком делает отметку его собственной.
 */
create or replace function app.direct_payment_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shipper uuid;
begin
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  if new.status <> 'LATE' then
    new.days_late := null;
  end if;

  if tg_op = 'INSERT' then
    select o.shipper_company_id into v_shipper from public.orders o where o.id = new.order_id;
    new.shipper_company_id := v_shipper;
    new.reported_at := now();
    new.updated_at := now();
    new.removed_at := null;
    new.removed_by := null;
    new.removed_note := null;
    if (select auth.uid()) is not null then
      if not app.can_report_payment(new.order_id) then
        raise exception 'Оплату отмечает перевозчик рейса по прямому договору в течение 180 дней после закрытия.'
          using errcode = '42501';
      end if;
      new.carrier_company_id := (select app.current_company_id());
      new.reported_by := (select auth.uid());
      new.prefilled := false;
    end if;
    return new;
  end if;

  /* UPDATE: рейс, стороны и время отметки не меняются. */
  new.order_id := old.order_id;
  new.carrier_company_id := old.carrier_company_id;
  new.shipper_company_id := old.shipper_company_id;
  new.reported_at := old.reported_at;

  if (select auth.uid()) is not null and not app.is_admin() then
    if old.removed_at is not null or not app.can_report_payment(old.order_id) then
      raise exception 'Отметку уже нельзя изменить.' using errcode = '42501';
    end if;
    new.removed_at := old.removed_at;
    new.removed_by := old.removed_by;
    new.removed_note := old.removed_note;
    new.reported_by := (select auth.uid());
    new.prefilled := false;
  end if;

  if (new.status, new.days_late, new.note) is distinct from (old.status, old.days_late, old.note) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;


-- ── Сводка о заказчике: + счета перевозчиков и смена счёта ─────────

/*
 * Новые колонки в конце (тип строки меняется — пересоздаём все три, как
 * в 20261106150100). Счета Aivomaa (invoiced_count…) остаются историей;
 * дальше пунктуальность считается по freight_invoices: за 12 месяцев по
 * дате счёта — сколько, вовремя, позже (средние дни), просрочено сейчас.
 */
drop function if exists public.shipper_trust(uuid[]);
drop function if exists public.company_trust(uuid);
drop function if exists app.shipper_trust_of(uuid);

create function app.shipper_trust_of(p_company_id uuid)
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date,
  register_extract_approved boolean,
  register_extract_issued_on date,
  register_extract_valid_until date,
  tax_debt_approved boolean,
  tax_debt_issued_on date,
  tax_debt_valid_until date,
  vat_certificate_approved boolean,
  vat_certificate_issued_on date,
  vat_certificate_valid_until date,
  signatory_approved boolean,
  signatory_issued_on date,
  signatory_valid_until date,
  freight_invoices_count integer,
  freight_paid_on_time integer,
  freight_paid_late integer,
  freight_avg_days_late integer,
  freight_overdue integer,
  bank_changed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select co.*, coalesce(co.registry_check, '{}'::jsonb) as rc
    from public.companies co
    where co.id = p_company_id
  ),
  inv as (
    select
      o.billing,
      (o.paid_at at time zone 'Europe/Helsinki')::date as paid_on,
      app.invoice_due(app.payout_period_start(app.closed_moment(o))) as due
    from public.orders o
    where o.shipper_company_id = p_company_id
      and o.status = 'DONE'
      and o.contract_party = 'RAHTIS'
      and app.closed_moment(o) > now() - interval '12 months'
      and (o.invoiced_at is not null or o.billing <> 'PENDING')
  ),
  pay as (
    select
      count(*)::integer as invoiced,
      /* Оплачен без даты оплаты (старые отметки) — нарушения не видно, считается вовремя. */
      count(*) filter (where paid_on <= due or (paid_on is null and billing in ('PAID', 'SETTLED')))::integer as on_time,
      count(*) filter (where paid_on > due)::integer as late,
      round(avg(paid_on - due) filter (where paid_on > due))::integer as avg_late,
      count(*) filter (
        where paid_on is null and billing = 'INVOICED'
          and (now() at time zone 'Europe/Helsinki')::date > due
      )::integer as overdue
    from inv
  ),
  fi as (
    select
      count(*)::integer as total,
      count(*) filter (where f.paid_at is not null and f.paid_at <= f.due_on)::integer as on_time,
      count(*) filter (where f.paid_at > f.due_on)::integer as late,
      round(avg(f.paid_at - f.due_on) filter (where f.paid_at > f.due_on))::integer as avg_late,
      count(*) filter (
        where f.paid_at is null and (now() at time zone 'Europe/Helsinki')::date > f.due_on
      )::integer as overdue
    from public.freight_invoices f
    where f.shipper_company_id = p_company_id
      and f.issued_on > ((now() at time zone 'Europe/Helsinki') - interval '12 months')::date
  ),
  rep as (
    select
      count(*) filter (where r.status = 'ON_TIME')::integer as on_time,
      count(*) filter (where r.status = 'LATE')::integer as late,
      count(*) filter (where r.status = 'UNPAID')::integer as unpaid
    from public.direct_payment_reports r
    where r.shipper_company_id = p_company_id
      and r.removed_at is null
      and r.reported_at > now() - interval '12 months'
  ),
  vol as (
    select
      count(*) filter (where app.closed_moment(o) > now() - interval '12 months')::integer as done_12m,
      (min(app.closed_moment(o)) at time zone 'Europe/Helsinki')::date as first_done
    from public.orders o
    where o.shipper_company_id = p_company_id and o.status = 'DONE'
  ),
  bank as (
    select max(e.changed_at) as changed_at
    from public.company_sensitive_changes e
    where e.company_id = p_company_id
      and e.field = 'IBAN'
      and e.changed_at > now() - interval '30 days'
  )
  select
    c.id,
    c.country::text,
    app.jsonb_date(c.rc -> 'registeredOn'),
    (coalesce(c.approved_at, c.created_at) at time zone 'Europe/Helsinki')::date,
    c.rc ->> 'verdict',
    case when jsonb_typeof(c.rc -> 'situations') = 'array'
      then array(select jsonb_array_elements_text(c.rc -> 'situations'))
      else '{}'::text[]
    end,
    app.jsonb_bool(c.rc -> 'vat'),
    app.jsonb_bool(c.rc -> 'prepayment'),
    app.jsonb_date(c.rc -> 'checkedAt'),
    pay.invoiced,
    pay.on_time,
    pay.late,
    pay.avg_late,
    pay.overdue,
    rep.on_time,
    rep.late,
    rep.unpaid,
    vol.done_12m,
    vol.first_done,
    coalesce(ex.approved, false),
    ex.issued_on,
    ex.valid_until,
    coalesce(tx.approved, false),
    tx.issued_on,
    tx.valid_until,
    coalesce(vt.approved, false),
    vt.issued_on,
    vt.valid_until,
    coalesce(sg.approved, false),
    sg.issued_on,
    sg.valid_until,
    fi.total,
    fi.on_time,
    fi.late,
    fi.avg_late,
    fi.overdue,
    bank.changed_at
  from c
  cross join pay
  cross join fi
  cross join rep
  cross join vol
  cross join bank
  left join lateral app.shipper_document_of(c.id, 'REGISTER_EXTRACT') ex on true
  left join lateral app.shipper_document_of(c.id, 'TAX_DEBT_CERTIFICATE') tx on true
  left join lateral app.shipper_document_of(c.id, 'VAT_CERTIFICATE') vt on true
  left join lateral app.shipper_document_of(c.id, 'SIGNATORY_AUTHORITY') sg on true;
$$;

revoke all on function app.shipper_trust_of(uuid) from public, anon, authenticated;
grant execute on function app.shipper_trust_of(uuid) to service_role;

create function public.shipper_trust(p_company_ids uuid[])
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date,
  register_extract_approved boolean,
  register_extract_issued_on date,
  register_extract_valid_until date,
  tax_debt_approved boolean,
  tax_debt_issued_on date,
  tax_debt_valid_until date,
  vat_certificate_approved boolean,
  vat_certificate_issued_on date,
  vat_certificate_valid_until date,
  signatory_approved boolean,
  signatory_issued_on date,
  signatory_valid_until date,
  freight_invoices_count integer,
  freight_paid_on_time integer,
  freight_paid_late integer,
  freight_avg_days_late integer,
  freight_overdue integer,
  bank_changed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.*
  from public.companies c
  cross join lateral app.shipper_trust_of(c.id) t
  where c.id = any (p_company_ids) and c.kind = 'SHIPPER' and c.client_of is null;
$$;

revoke all on function public.shipper_trust(uuid[]) from public, anon, authenticated;
grant execute on function public.shipper_trust(uuid[]) to service_role;

create function public.company_trust(p_company_id uuid default null)
returns table (
  company_id uuid,
  country text,
  registered_on date,
  on_platform_since date,
  registry_verdict text,
  registry_situations text[],
  registry_vat boolean,
  registry_prepayment boolean,
  registry_checked_at date,
  invoiced_count integer,
  paid_on_time integer,
  paid_late integer,
  avg_days_late integer,
  overdue_count integer,
  reports_on_time integer,
  reports_late integer,
  reports_unpaid integer,
  done_12m integer,
  first_done_at date,
  register_extract_approved boolean,
  register_extract_issued_on date,
  register_extract_valid_until date,
  tax_debt_approved boolean,
  tax_debt_issued_on date,
  tax_debt_valid_until date,
  vat_certificate_approved boolean,
  vat_certificate_issued_on date,
  vat_certificate_valid_until date,
  signatory_approved boolean,
  signatory_issued_on date,
  signatory_valid_until date,
  freight_invoices_count integer,
  freight_paid_on_time integer,
  freight_paid_late integer,
  freight_avg_days_late integer,
  freight_overdue integer,
  bank_changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid := coalesce(p_company_id, (select app.current_company_id()));
begin
  if v_company is null then
    return;
  end if;
  if v_company is distinct from (select app.current_company_id()) and not app.is_admin() then
    raise exception 'Нет доступа к этой компании.' using errcode = '42501';
  end if;

  return query
  select t.*
  from public.companies c
  cross join lateral app.shipper_trust_of(c.id) t
  where c.id = v_company and c.kind = 'SHIPPER';
end;
$$;

revoke all on function public.company_trust(uuid) from public, anon;
grant execute on function public.company_trust(uuid) to authenticated, service_role;


-- ── Режим цены — в момент создания заказа ──────────────────────────

/*
 * Цена «за км» задаётся при создании (как валюта — через настройку
 * транзакции из обёрток create_order / carrier_create_own_order), а не
 * отдельным вызовом после: свой рейс и прямой заказ к тому моменту уже
 * назначены, и менять режим цены после назначения нельзя.
 */
create or replace function app.order_pricing_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_mode text := nullif(current_setting('rahtis.order_pricing', true), '');
  v_per_km integer := nullif(current_setting('rahtis.order_per_km', true), '')::integer;
begin
  if v_mode = 'PER_KM' and v_per_km between 1 and 100000 and coalesce(new.distance_km, 0) > 0 then
    new.pricing_mode := 'PER_KM';
    new.rate_per_km_cents := v_per_km;
    new.rate_cents := greatest(1, round(v_per_km::numeric * new.distance_km))::integer;
  end if;
  return new;
end;
$fn$;

revoke all on function app.order_pricing_fill() from public, anon, authenticated;

create trigger orders_pricing_fill
  before insert on public.orders
  for each row execute function app.order_pricing_fill();

create or replace function public.create_order(p_order jsonb, p_stops jsonb, p_publish boolean default true)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
begin
  select * into v_company
  from public.companies
  where id = (select app.current_company_id());

  if v_company.id is null or v_company.kind <> 'SHIPPER' then
    raise exception 'Публиковать заказы может только заказчик.' using errcode = '42501';
  end if;

  if v_company.status <> 'ACTIVE' then
    raise exception 'Заполните реквизиты компании — без них заказ не опубликовать.'
      using errcode = '55000';
  end if;

  perform set_config('rahtis.order_currency', coalesce(nullif(upper(p_order ->> 'currency'), ''), ''), true);
  perform set_config('rahtis.order_pricing', coalesce(nullif(upper(p_order ->> 'pricing_mode'), ''), ''), true);
  perform set_config('rahtis.order_per_km', coalesce(nullif(p_order ->> 'rate_per_km_cents', ''), ''), true);
  return app.create_order_for(v_company.id, p_order, p_stops, p_publish, null);
end;
$$;

create or replace function public.carrier_create_own_order(
  p_client jsonb, p_order jsonb, p_stops jsonb, p_vehicle_id uuid
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carrier public.companies;
  v_client uuid;
  v_name text := app.clean_client_name(p_client->>'name');
  v_bid text := upper(btrim(coalesce(p_client->>'business_id', '')));
  v_email text := lower(btrim(coalesce(p_client->>'email', '')));
  v_country text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Свой рейс заводит перевозчик.' using errcode = '42501';
  end if;

  select * into v_carrier from public.companies where id = (select app.current_company_id());

  if v_carrier.id is null or v_carrier.status <> 'ACTIVE' or v_carrier.frozen_at is not null then
    raise exception 'Свои рейсы — у активной компании.' using errcode = '55000';
  end if;

  perform app.assert_legal_current(v_carrier.id);

  if not app.own_orders_allowed(v_carrier.id) then
    raise exception 'Свои рейсы — по подписке.' using errcode = '55010';
  end if;

  if p_vehicle_id is null then
    raise exception 'Выберите машину.' using errcode = '22023';
  end if;

  if not app.client_email_ok(v_email) then
    raise exception 'Почта клиента указана неверно.' using errcode = '22023';
  end if;

  v_country := upper(btrim(coalesce(nullif(p_client->>'country', ''), v_carrier.country)));
  if v_country !~ '^[A-Z]{2}$' or not app.business_id_ok(v_country, v_bid) then
    raise exception 'Номер клиента указан неверно.' using errcode = '22023';
  end if;

  if nullif(p_client->>'id', '') is not null then
    select id into v_client from public.companies
    where id = (p_client->>'id')::uuid and client_of = v_carrier.id;
    if v_client is null then
      raise exception 'Клиент не найден.' using errcode = 'P0002';
    end if;
  else
    if length(v_name) < 2 or length(v_name) > 200 then
      raise exception 'Укажите имя клиента.' using errcode = '22023';
    end if;

    select id into v_client from public.companies
    where client_of = v_carrier.id
      and ((v_bid <> '' and country = v_country and business_id = v_bid)
        or (v_bid = '' and lower(app.clean_client_name(name)) = lower(v_name)))
    order by created_at
    limit 1;

    if v_client is null then
      /* Клиент тестового перевозчика — тестовый: контуры не смешиваются. */
      insert into public.companies (kind, status, name, country, business_id, contact_email, language, client_of, is_test)
      values ('SHIPPER', 'APPROVED', v_name, v_country, v_bid, v_email, v_carrier.language, v_carrier.id, v_carrier.is_test)
      returning id into v_client;
    end if;
  end if;

  /* Новая почта клиента заменяет старую: ссылку отправляют на неё. */
  if v_email <> '' then
    update public.companies set contact_email = v_email where id = v_client and contact_email <> v_email;
  end if;

  perform set_config('rahtis.order_currency', coalesce(nullif(upper(p_order ->> 'currency'), ''), v_carrier.currency), true);
  perform set_config('rahtis.order_pricing', coalesce(nullif(upper(p_order ->> 'pricing_mode'), ''), ''), true);
  perform set_config('rahtis.order_per_km', coalesce(nullif(p_order ->> 'rate_per_km_cents', ''), ''), true);

  return app.create_order_for(
    v_client,
    p_order - 'direct_vehicle_id' - 'group_vehicle_ids' - 'group_minutes' - 'desk_contract',
    p_stops, true, p_vehicle_id);
end;
$$;
