-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · API для заказчиков, этап 2: создание и снятие заказа
--
-- Обёртки ставят в транзакции личность выпустившего ключ и зовут те же
-- create_order и withdraw_order, что и кабинет. Проверки заказа,
-- реквизиты, принятие документов, контуры и рассылка — прежние; второй
-- копии правил нет.
--
-- Прямое назначение знакомой машине через API не делается: заказ всегда
-- идёт на стол (direct_vehicle_id пустой) — решение 29.09.2026.
--
-- Защита от повторов: программа заказчика шлёт Idempotency-Key, и
-- повтор того же запроса (обрыв связи, ретрай) возвращает тот же заказ,
-- а не второй. Ключ помнится сутки.
-- ═══════════════════════════════════════════════════════════════════

create table public.api_idempotency (
  key_id uuid not null references public.api_keys (id) on delete cascade,
  idem_key text not null,
  request_hash text not null,
  status text not null default 'PENDING',
  http_status integer,
  response jsonb,
  created_at timestamptz not null default now(),

  primary key (key_id, idem_key),
  constraint api_idempotency_key_length check (length(idem_key) between 1 and 100),
  constraint api_idempotency_status check (status in ('PENDING', 'DONE'))
);

comment on table public.api_idempotency is
  'Ответы на запросы API с Idempotency-Key: повтор возвращает тот же результат. Хранятся сутки.';

alter table public.api_idempotency enable row level security;
revoke all on public.api_idempotency from anon, authenticated;


/* Ключ с правом записи → его выпустивший; иначе исключение. */
create or replace function app.api_act_as(p_key_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select k.created_by into v_user
  from public.api_keys k
  where k.id = p_key_id and k.revoked_at is null and k.scope = 'WRITE';

  if v_user is null then
    raise exception 'Ключ не даёт права записи.' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  return v_user;
end;
$$;

revoke all on function app.api_act_as(uuid) from public, anon, authenticated;


create or replace function public.api_create_order(p_key_id uuid, p_order jsonb, p_stops jsonb)
returns table (id uuid, ref text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform app.api_act_as(p_key_id);

  v_order := public.create_order(p_order || jsonb_build_object('direct_vehicle_id', ''), p_stops, true);

  return query select v_order.id, v_order.ref::text;
end;
$$;

revoke all on function public.api_create_order(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.api_create_order(uuid, jsonb, jsonb) to service_role;


create or replace function public.api_withdraw_order(p_key_id uuid, p_ref text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  perform app.api_act_as(p_key_id);

  select o.id into v_order_id
  from public.orders o
  join public.api_keys k on k.id = p_key_id
  where o.ref = p_ref and o.shipper_company_id = k.company_id;

  if v_order_id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  perform public.withdraw_order(v_order_id, nullif(btrim(coalesce(p_reason, '')), ''));
end;
$$;

revoke all on function public.api_withdraw_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.api_withdraw_order(uuid, text, text) to service_role;


/* Очистка: журнал — 90 дней, ответы на повторы — сутки. */
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
  return v_count;
end;
$$;
