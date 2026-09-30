-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перевозчик приглашает своего заказчика
--
-- Реальных заказчиков на платформе нет, а у каждого перевозчика они есть.
-- Перевозчик на странице «Asiakkaat» вводит название, Y-tunnus и почту
-- своего клиента; тому уходит письмо со ссылкой на заявку, где всё уже
-- заполнено. Заявку одобряет оператор, как любую (открытой регистрации
-- нет). После одобрения:
--   · связь перевозчик — заказчик сразу ACTIVE с пометкой origin = INVITE
--     (разрешение на прямые заказы дал сам перевозчик, пригласив);
--   · одобренные машины перевозчика знакомы заказчику без истории рейсов
--     (shipper_knows_vehicle, known_vehicles_for_shipper);
--   · перевозчик видит клиента по имени (carrier_partners), как ввёл сам.
--
-- В shipper_invites хранится хэш ссылки, а не она сама.
-- Тексты функций взяты из базы (pg_get_functiondef) и изменены точечно.
-- ═══════════════════════════════════════════════════════════════════

alter table public.carrier_shipper_links
  add column origin text not null default 'TRIPS',
  add constraint carrier_shipper_links_origin check (origin in ('TRIPS', 'INVITE'));

create table public.shipper_invites (
  id uuid primary key default gen_random_uuid(),
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  token_hash text not null unique,
  company_name text not null,
  business_id text not null,
  email text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  applied_company_id uuid references public.companies (id) on delete set null,
  applied_at timestamptz,
  constraint shipper_invites_token_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint shipper_invites_email_shape check (length(email) <= 200 and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
);

create index shipper_invites_carrier_idx on public.shipper_invites (carrier_company_id, created_at desc);
create index shipper_invites_applied_idx on public.shipper_invites (applied_company_id) where applied_company_id is not null;

alter table public.shipper_invites enable row level security;
revoke all on public.shipper_invites from anon, authenticated;
grant select (id, carrier_company_id, company_name, business_id, email, created_at, applied_company_id, applied_at)
  on public.shipper_invites to authenticated;

create policy shipper_invites_own
  on public.shipper_invites for select to authenticated
  using (carrier_company_id = (select app.current_company_id()) or (select app.is_admin()));


/* Приглашение от перевозчика: только активная компания, не больше 20 в сутки. */
create or replace function public.carrier_invite_shipper(p_name text, p_business_id text, p_email text, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies;
  v_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Приглашает перевозчик.' using errcode = '42501';
  end if;
  select * into v_company from public.companies where id = (select app.current_company_id());
  if v_company.id is null or v_company.status <> 'ACTIVE' or v_company.frozen_at is not null then
    raise exception 'Приглашает активная компания.' using errcode = '55000';
  end if;
  if (select count(*) from public.shipper_invites
      where carrier_company_id = v_company.id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Не больше 20 приглашений в сутки.' using errcode = '55001';
  end if;

  insert into public.shipper_invites (carrier_company_id, token_hash, company_name, business_id, email, created_by)
  values (v_company.id, lower(p_token_hash), btrim(p_name), btrim(p_business_id), lower(btrim(p_email)), (select auth.uid()))
  returning id into v_id;

  perform app.audit('shipper_invite.create', v_id::text, jsonb_build_object('carrier', v_company.id));
  return v_id;
end;
$$;

revoke all on function public.carrier_invite_shipper(text, text, text, text) from public, anon;
grant execute on function public.carrier_invite_shipper(text, text, text, text) to authenticated;


/* Одобрение приглашённого заказчика — связь с пригласившим сразу активна. */
create or replace function app.on_invited_shipper_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
begin
  if new.kind <> 'SHIPPER' or new.status <> 'APPROVED' or old.status is not distinct from new.status then
    return new;
  end if;

  for v_invite in
    select distinct i.carrier_company_id
    from public.shipper_invites i
    where i.applied_company_id = new.id
  loop
    insert into public.carrier_shipper_links (carrier_company_id, shipper_company_id, status, origin, decided_at)
    values (v_invite.carrier_company_id, new.id, 'ACTIVE', 'INVITE', now())
    on conflict (carrier_company_id, shipper_company_id)
      do update set status = 'ACTIVE', origin = 'INVITE', decided_at = now();

    perform app.notify_event(
      v_invite.carrier_company_id, 'ORDER', 'invite.approved',
      jsonb_build_object('shipper', new.name), '/carrier/partners');
  end loop;

  return new;
end;
$$;

revoke all on function app.on_invited_shipper_approved() from public, anon, authenticated;

create trigger companies_invited_shipper_approved
  after update of status on public.companies
  for each row execute function app.on_invited_shipper_approved();

CREATE OR REPLACE FUNCTION app.shipper_knows_vehicle(p_shipper_id uuid, p_vehicle_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.vehicles v
    join public.carrier_shipper_links l
      on l.carrier_company_id = v.company_id
     and l.shipper_company_id = p_shipper_id
     and l.status = 'ACTIVE'
    where v.id = p_vehicle_id
      and (
        /* Пригласивший перевозчик: его одобренные машины знакомы без истории. */
        (l.origin = 'INVITE' and v.access = 'APPROVED')
        or exists (
          select 1 from public.orders o
          where o.shipper_company_id = p_shipper_id
            and o.assigned_vehicle_id = v.id
            and o.status = 'DONE'
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.known_vehicles_for_shipper()
 RETURNS TABLE(vehicle_id uuid, plate text, driver_name text, driver_phone text, driver_email text, vehicle_class vehicle_class, make text, axles smallint, euro_class euro_class, payload_kg integer, ldm numeric, container_feet smallint[], rating numeric, trips integer, last_trip_at timestamp with time zone, in_pool boolean, busy boolean, available boolean, carrier_name text, carrier_business_id text, carrier_iban text, carrier_bic text, direct_billing boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (select app.current_company_id() as id),
  history as (
    select o.assigned_vehicle_id as vehicle_id,
           count(*)::integer as trips,
           max(o.closed_at) as last_trip_at
    from public.orders o, me
    where o.shipper_company_id = me.id
      and o.status = 'DONE'
      and o.assigned_vehicle_id is not null
    group by o.assigned_vehicle_id
  ),
  /* Машины перевозчика, пригласившего заказчика: знакомы без истории рейсов. */
  known as (
    select h.vehicle_id, h.trips, h.last_trip_at from history h
    union all
    select v.id, 0, null::timestamptz
    from public.vehicles v
    join public.carrier_shipper_links l
      on l.carrier_company_id = v.company_id
     and l.shipper_company_id = (select id from me)
     and l.status = 'ACTIVE'
     and l.origin = 'INVITE'
    where v.access = 'APPROVED'
      and not exists (select 1 from history h where h.vehicle_id = v.id)
  )
  select
    v.id,
    v.plate,
    coalesce(d.full_name, v.driver_name),
    coalesce(d.phone, v.whatsapp),
    d.email,
    v.vehicle_class,
    v.make,
    v.axles,
    v.euro_class,
    v.payload_kg,
    v.ldm,
    v.container_feet,
    app.company_rating(v.company_id),
    h.trips,
    h.last_trip_at,
    exists (
      select 1 from public.shipper_vehicle_pool p, me
      where p.shipper_company_id = me.id and p.vehicle_id = v.id
    ),
    exists (
      select 1 from public.orders o
      where o.assigned_vehicle_id = v.id
        and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
    ),
    coalesce(app.vehicle_is_dispatchable(v.id), false),
    case when carrier.partnership = 'SUBSCRIBER' then carrier.name end,
    case when carrier.partnership = 'SUBSCRIBER' then carrier.business_id end,
    case when carrier.partnership = 'SUBSCRIBER' then carrier.iban end,
    case when carrier.partnership = 'SUBSCRIBER' then carrier.bic end,
    carrier.partnership = 'SUBSCRIBER'
  from known h
  join public.vehicles v on v.id = h.vehicle_id
  cross join me
  join public.companies carrier on carrier.id = v.company_id
  join public.carrier_shipper_links l
    on l.carrier_company_id = v.company_id
   and l.shipper_company_id = me.id
   and l.status = 'ACTIVE'
  left join public.drivers d on d.id = app.vehicle_driver_at(v.id, now())
  where (select app.current_party_role()) = 'SHIPPER'
  order by 16 desc, h.trips desc, v.plate;
$function$;

CREATE OR REPLACE FUNCTION public.carrier_partners()
 RETURNS TABLE(shipper_id uuid, shipper_name text, trips integer, last_trip_at timestamp with time zone, last_route text, status link_status, decided_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with me as (
    select c.id, c.partnership
    from public.companies c
    where c.id = (select app.current_company_id())
  )
  select
    l.shipper_company_id,
    case
      when me.partnership = 'SUBSCRIBER' and l.status = 'ACTIVE' then s.name
      /* Клиента, которого перевозчик пригласил сам, он знает по имени. */
      when l.origin = 'INVITE' then s.name
      else 'Asiakas ' || upper(substr(md5(l.shipper_company_id::text), 1, 4))
    end,
    (select count(*)::integer from public.orders o
      where o.assigned_company_id = l.carrier_company_id
        and o.shipper_company_id = l.shipper_company_id
        and o.status = 'DONE'),
    last.closed_at,
    last.route,
    l.status,
    l.decided_at
  from public.carrier_shipper_links l
  cross join me
  join public.companies s on s.id = l.shipper_company_id
  left join lateral (
    select o.closed_at,
           concat_ws(' → ',
             (select st.city from public.order_stops st where st.order_id = o.id order by st.sequence limit 1),
             (select e.city from app.route_end(o.id) e)) as route
    from public.orders o
    where o.assigned_company_id = l.carrier_company_id
      and o.shipper_company_id = l.shipper_company_id
      and o.status = 'DONE'
    order by o.closed_at desc
    limit 1
  ) last on true
  where l.carrier_company_id = me.id
  order by (l.status = 'OFFERED') desc, last.closed_at desc nulls last;
$function$;


/*
 * Срок хранения приглашений — 12 месяцев с отправки (PRIVACY 2.11, 8.4).
 * Связь перевозчик — заказчик от этого не зависит: она уже в
 * carrier_shipper_links с origin = INVITE.
 */
select cron.schedule(
  'rahtis-shipper-invites-retention',
  '35 3 * * *',
  $$ delete from public.shipper_invites where created_at < now() - interval '12 months'; $$
);
