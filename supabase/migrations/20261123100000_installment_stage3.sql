-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники, этап 3 (23.11.2026)
--
--   · оплата первого счёта — отмечает продавец; без неё передачи нет;
--   · передача машины — подтверждают обе стороны (чек-лист договора 3.2,
--     пробег, замечания). После второго подтверждения: у покупателя в
--     парке появляется копия машины (черновик, проходит обычное
--     одобрение), запись продавца помечается «продана в рассрочку»,
--     снимается с работы (черновик, водитель и GPS отвязаны). Историю
--     заправок, обслуживания и рейсов каждая сторона хранит у себя;
--   · график взносов (installment_payments) — строит сервер калькулятором
--     src/lib/installments/calc.ts; ежедневное задание выставляет счёт
--     за 14 дней до срока и следит за просрочкой (пороги OskL 2 §);
--   · оплату взноса отмечает продавец; последний взнос — сделка
--     выплачена, объявление «продано», напоминание о Traficom;
--   · отмена до передачи после выставленного счёта — с кредит-нотой;
--   · продавцу — сводка по машине: пробег, дефекты, обслуживание,
--     осмотр, простой. Местоположения нет (договор 8.2 — только по
--     событиям; этого этапа здесь нет).
-- ═══════════════════════════════════════════════════════════════════

alter table public.installment_deals drop constraint installment_deals_status;
alter table public.installment_deals
  add constraint installment_deals_status check (status in ('NEGOTIATING', 'AGREED', 'ACTIVE', 'PAID_OFF', 'CANCELLED')),
  add column first_invoice_paid_at timestamptz,
  add column handover_seller_at timestamptz,
  add column handover_buyer_at timestamptz,
  add column handover_odometer_km integer constraint installment_deals_handover_km check (handover_odometer_km between 0 and 9999999),
  add column handover_notes text constraint installment_deals_handover_notes check (char_length(handover_notes) <= 2000),
  add column handed_over_at timestamptz,
  add column buyer_vehicle_id uuid references public.vehicles (id) on delete set null,
  add column paid_off_at timestamptz,
  add column credit_note_id uuid references public.carrier_invoices (id) on delete set null,
  /* Бронь кредит-ноты: двойной клик не выпустит две. */
  add column credit_note_started_at timestamptz;

/*
 * Машина в рассрочке: SOLD — запись продавца (снята с работы), HELD —
 * копия у покупателя, пока не выплачено, OWNED — выплачено.
 */
alter table public.vehicles
  add column installment_deal_id uuid references public.installment_deals (id) on delete set null,
  add column installment_role text constraint vehicles_installment_role check (installment_role in ('SOLD', 'HELD', 'OWNED'));

/* Проданную запись продавца нельзя снова отправить на одобрение: номер теперь у покупателя. */
create or replace function app.vehicles_sold_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.installment_role = 'SOLD' and new.access in ('PENDING', 'APPROVED') and new.access is distinct from old.access then
    raise exception 'Машина продана в рассрочку и работает у покупателя.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger vehicles_sold_guard
  before update of access on public.vehicles
  for each row execute function app.vehicles_sold_guard();

/* Машину в рассрочке не удалить: ни запись продавца, ни копию покупателя до выплаты (ревью 23.11.2026). */
create or replace function app.vehicles_installment_delete_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.installment_role in ('SOLD', 'HELD') then
    raise exception 'Машина в рассрочке — удалить нельзя.' using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger vehicles_installment_delete_guard
  before delete on public.vehicles
  for each row execute function app.vehicles_installment_delete_guard();

/* GPS-блок нельзя привязать к проданной записи: машина ездит у покупателя (договор 8.2, PRIVACY). */
create or replace function app.gps_units_sold_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vehicle_id is not null and exists (
    select 1 from public.vehicles v where v.id = new.vehicle_id and v.installment_role = 'SOLD'
  ) then
    raise exception 'Машина продана в рассрочку — GPS к ней не привязывается.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger gps_units_sold_guard
  before insert or update of vehicle_id on public.gps_units
  for each row execute function app.gps_units_sold_guard();

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.installment_deals (id) on delete cascade,
  n smallint not null constraint installment_payments_n check (n between 1 and 120),
  due_date date not null,
  principal_cents bigint not null constraint installment_payments_principal check (principal_cents > 0),
  interest_cents bigint not null default 0 constraint installment_payments_interest check (interest_cents >= 0),
  invoice_id uuid references public.carrier_invoices (id) on delete set null,
  /* Бронь выставления: параллельный запуск задания не выставит второй счёт. */
  invoicing_started_at timestamptz,
  paid_at timestamptz,
  /* Напоминания покупателю (1 и 7 дней просрочки) и сигнал продавцу о пороге закона. */
  reminded_1_at timestamptz,
  reminded_7_at timestamptz,
  threshold_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (deal_id, n)
);

create index installment_payments_due on public.installment_payments (due_date) where paid_at is null;

alter table public.installment_payments enable row level security;

create policy installment_payments_parties on public.installment_payments
  for select to authenticated
  using (exists (
    select 1 from public.installment_deals d
    where d.id = deal_id
      and ((select app.current_company_id()) in (d.seller_company_id, d.buyer_company_id) or (select app.is_admin()))
  ));

grant select on public.installment_payments to authenticated;

-- ── Оплата первого счёта ────────────────────────────────────────────

create or replace function public.mark_installment_first_paid(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_deal.seller_company_id <> v_me then
    raise exception 'Оплату отмечает продавец.' using errcode = '42501';
  end if;
  if v_deal.status <> 'AGREED' or v_deal.first_invoice_id is null then
    raise exception 'Нет выставленного первого счёта.' using errcode = '55000';
  end if;
  update public.installment_deals set first_invoice_paid_at = coalesce(first_invoice_paid_at, now()) where id = p_deal_id;
  update public.carrier_invoices set paid_at = coalesce(paid_at, now()) where id = v_deal.first_invoice_id;
end;
$$;

-- ── Передача машины ─────────────────────────────────────────────────

/*
 * Подтверждение передачи своей стороной. Пробег и замечания — того, кто
 * подтверждает последним (обычно продавец вносит их при осмотре). Когда
 * подтвердили обе стороны — машина переходит к покупателю (см. шапку).
 * Возвращает статус сделки.
 */
create or replace function public.confirm_installment_handover(p_deal_id uuid, p_odometer_km integer, p_notes text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
  v_listing public.equipment_listings;
  v_new uuid := gen_random_uuid();
  v_buyer_kind public.party_role;
  v_buyer_city text;
  v_listing_id uuid;
begin
  /* Порядок блокировок как у согласия и отмены: объявление, потом сделка. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if v_deal.status <> 'AGREED' then
    raise exception 'Передача — только по согласованной сделке.' using errcode = '55000';
  end if;
  if v_deal.first_invoice_paid_at is null then
    raise exception 'Первый счёт ещё не оплачен.' using errcode = '55000';
  end if;
  if p_odometer_km is not null and p_odometer_km not between 0 and 9999999 then
    raise exception 'Пробег.' using errcode = '22023';
  end if;

  /* Машина не должна быть в работе у продавца: открытые рейсы сначала закрыть или переназначить. */
  if exists (
    select 1 from public.orders o, public.equipment_listings l
    where l.id = v_deal.listing_id and o.assigned_vehicle_id = l.vehicle_id
      and o.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
  ) then
    raise exception 'У машины есть открытые рейсы продавца — закройте или переназначьте их.' using errcode = '55000';
  end if;

  /* Пробег и замечания продавца не перезаписываются покупателем: покупатель дополняет пустое. */
  update public.installment_deals
  set handover_seller_at = case when v_me = seller_company_id then coalesce(handover_seller_at, now()) else handover_seller_at end,
      handover_buyer_at = case when v_me = buyer_company_id then coalesce(handover_buyer_at, now()) else handover_buyer_at end,
      handover_odometer_km = case when v_me = seller_company_id then coalesce(p_odometer_km, handover_odometer_km)
                                  else coalesce(handover_odometer_km, p_odometer_km) end,
      handover_notes = case when v_me = seller_company_id then coalesce(nullif(btrim(p_notes), ''), handover_notes)
                            else coalesce(handover_notes, nullif(btrim(p_notes), '')) end
  where id = p_deal_id
  returning * into v_deal;

  if v_deal.handover_seller_at is null or v_deal.handover_buyer_at is null then
    return v_deal.status;
  end if;

  select * into v_listing from public.equipment_listings where id = v_deal.listing_id;
  select c.kind, coalesce(c.legal_city, '') into v_buyer_kind, v_buyer_city from public.companies c where c.id = v_deal.buyer_company_id;

  /* Копия машины у покупателя: те же данные, своя компания, черновик — одобрение как у любой машины. */
  insert into public.vehicles
  select (jsonb_populate_record(
    null::public.vehicles,
    to_jsonb(v) || jsonb_build_object(
      'id', v_new,
      'company_id', v_deal.buyer_company_id,
      'company_kind', v_buyer_kind,
      'access', 'DRAFT',
      'approved_at', null,
      'submitted_at', null,
      'rejected_at', null,
      'rejection_reason', null,
      'driver_name', null,
      'whatsapp', null,
      'languages', '[]'::jsonb,
      'base_city', case when v_buyer_city <> '' then v_buyer_city else v.base_city end,
      'base_lat', null,
      'base_lon', null,
      'base_country', null,
      'installment_deal_id', v_deal.id,
      'installment_role', 'HELD',
      'created_at', now(),
      'updated_at', now()
    )
  )).*
  from public.vehicles v where v.id = v_listing.vehicle_id;

  /* Запись продавца: снята с работы, водитель и GPS отвязаны, номер свободен для копии покупателя. */
  update public.vehicles
  set access = 'DRAFT', installment_deal_id = v_deal.id, installment_role = 'SOLD', updated_at = now()
  where id = v_listing.vehicle_id;
  update public.vehicle_drivers set during = tstzrange(lower(during), now())
  where vehicle_id = v_listing.vehicle_id and upper_inf(during);
  update public.gps_units set vehicle_id = null where vehicle_id = v_listing.vehicle_id;
  /* Объявления свободного места машины продавца снимаются. */
  update public.capacity_offers set status = 'WITHDRAWN', updated_at = now()
  where vehicle_id = v_listing.vehicle_id and status in ('DRAFT', 'PUBLISHED');
  /* План обслуживания (сроки ТО, katsastus, тахограф) уходит с машиной: напоминания — покупателю. */
  update public.maintenance_items set vehicle_id = v_new, company_id = v_deal.buyer_company_id
  where vehicle_id = v_listing.vehicle_id;

  update public.installment_deals
  set status = 'ACTIVE', handed_over_at = now(), buyer_vehicle_id = v_new
  where id = p_deal_id;

  return 'ACTIVE';
end;
$$;

-- ── Взносы ──────────────────────────────────────────────────────────

/* Отметить взнос оплаченным (продавец). Последний — сделка выплачена. Возвращает статус сделки. */
create or replace function public.mark_installment_paid(p_deal_id uuid, p_n integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
  v_row public.installment_payments;
begin
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_deal.seller_company_id <> v_me then
    raise exception 'Оплату отмечает продавец.' using errcode = '42501';
  end if;
  if v_deal.status <> 'ACTIVE' then
    raise exception 'Сделка не в рассрочке.' using errcode = '55000';
  end if;
  update public.installment_payments set paid_at = coalesce(paid_at, now())
  where deal_id = p_deal_id and n = p_n
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Нет такого взноса.' using errcode = '22023';
  end if;
  if v_row.invoice_id is not null then
    update public.carrier_invoices set paid_at = coalesce(paid_at, now()) where id = v_row.invoice_id;
  end if;

  if not exists (select 1 from public.installment_payments where deal_id = p_deal_id and paid_at is null) then
    update public.installment_deals set status = 'PAID_OFF', paid_off_at = now() where id = p_deal_id;
    update public.equipment_listings set status = 'SOLD', updated_at = now() where id = v_deal.listing_id;
    update public.vehicles set installment_role = 'OWNED', updated_at = now() where id = v_deal.buyer_vehicle_id;
    return 'PAID_OFF';
  end if;
  return 'ACTIVE';
end;
$$;

-- ── Отмена после выставленного счёта (до передачи) ──────────────────

/*
 * Отмена согласованной сделки, когда первый счёт уже выставлен: только
 * до передачи. Кредит-ноту (hyvityslasku) выставляет сервер от имени
 * продавца и записывает в credit_note_id. Возвращает id первого счёта.
 */
create or replace function public.cancel_installment_with_credit(p_deal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
begin
  select listing_id into v_deal.listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_deal.listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if v_deal.status <> 'AGREED' or v_deal.first_invoice_id is null then
    raise exception 'Отмена с кредит-нотой — только согласованной сделки со счётом до передачи.' using errcode = '55000';
  end if;
  /* Передачу начала хоть одна сторона — отмена уже не односторонняя (security review 23.11.2026). */
  if v_deal.handover_seller_at is not null or v_deal.handover_buyer_at is not null then
    raise exception 'Передача уже подтверждается — отмена только по договорённости сторон.' using errcode = '55000';
  end if;
  /* Первый счёт оплачен — деньги возвращает продавец, и кредит-ноту от его имени запускает только он. */
  if v_deal.first_invoice_paid_at is not null and v_me <> v_deal.seller_company_id then
    raise exception 'Счёт оплачен — отмену с кредит-нотой оформляет продавец.' using errcode = '42501';
  end if;

  update public.installment_deals set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_me where id = p_deal_id;
  update public.equipment_listings set status = 'PUBLISHED', updated_at = now() where id = v_deal.listing_id and status = 'RESERVED';
  return v_deal.first_invoice_id;
end;
$$;

-- ── Объявление: не продавать машину, которая сама в рассрочке ───────

create or replace function app.vehicle_sellable(p_vehicle uuid, p_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle and v.company_id = p_company and v.access = 'APPROVED'
      and (v.installment_role is null or v.installment_role = 'OWNED')
  )
$$;

revoke all on function app.vehicle_sellable(uuid, uuid) from public, anon, authenticated;

create or replace function app.equipment_listing_vehicle_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not app.vehicle_sellable(new.vehicle_id, new.seller_company_id) then
    raise exception 'Машина не одобрена или ещё в рассрочке.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger equipment_listing_vehicle_guard
  before insert or update of vehicle_id on public.equipment_listings
  for each row execute function app.equipment_listing_vehicle_guard();

-- ── Сводка по машине для сторон ─────────────────────────────────────

create or replace function public.installment_vehicle_status(p_deal_id uuid)
returns table (
  odometer_km integer,
  open_defects integer,
  unsafe_defects integer,
  maintenance_overdue integer,
  maintenance_soon integer,
  last_inspection_at timestamptz,
  downtime_reason text,
  vehicle_access text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_deal public.installment_deals;
  v_vehicle uuid;
  v_today date := app.helsinki_today();
begin
  select * into v_deal from public.installment_deals where id = p_deal_id;
  if v_deal.id is null or not coalesce(
    (select app.current_company_id()) in (v_deal.seller_company_id, v_deal.buyer_company_id) or (select app.is_admin()),
    false
  ) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  v_vehicle := v_deal.buyer_vehicle_id;
  /* Только на время рассрочки (PRIVACY: «sopimuksen ajan»). */
  if v_vehicle is null or v_deal.status <> 'ACTIVE' then
    return;
  end if;

  return query
  select
    app.vehicle_odometer(v_vehicle),
    (select count(*)::integer from public.vehicle_defects d where d.vehicle_id = v_vehicle and d.status = 'OPEN'),
    (select count(*)::integer from public.vehicle_defects d where d.vehicle_id = v_vehicle and d.status = 'OPEN' and d.severity = 'UNSAFE'),
    (select count(*)::integer from public.maintenance_items m where m.vehicle_id = v_vehicle and m.next_due_on < v_today),
    (select count(*)::integer from public.maintenance_items m where m.vehicle_id = v_vehicle and m.next_due_on between v_today and v_today + 30),
    (select max(i.inspected_at) from public.vehicle_inspections i where i.vehicle_id = v_vehicle),
    (select t.reason from public.vehicle_downtime t
     where t.vehicle_id = v_vehicle and t.starts_on <= v_today and (t.ends_on is null or t.ends_on >= v_today)
     order by t.starts_on desc limit 1),
    (select v.access::text from public.vehicles v where v.id = v_vehicle);
end;
$$;

revoke all on function public.mark_installment_first_paid(uuid) from public, anon;
revoke all on function public.confirm_installment_handover(uuid, integer, text) from public, anon;
revoke all on function public.mark_installment_paid(uuid, integer) from public, anon;
revoke all on function public.cancel_installment_with_credit(uuid) from public, anon;
revoke all on function public.installment_vehicle_status(uuid) from public, anon;
grant execute on function public.mark_installment_first_paid(uuid) to authenticated;
grant execute on function public.confirm_installment_handover(uuid, integer, text) to authenticated;
grant execute on function public.mark_installment_paid(uuid, integer) to authenticated;
grant execute on function public.cancel_installment_with_credit(uuid) to authenticated;
grant execute on function public.installment_vehicle_status(uuid) to authenticated;

-- ── Ежедневное задание: счета взносов и просрочки ───────────────────

insert into app.runtime_config (key, value, note)
values (
  'installments_url',
  'https://www.rahtis.eu/api/installments/run',
  'Ежедневное задание рассрочки: счета взносов за 14 дней до срока, просрочки по OskL 2 § (23.11.2026).'
)
on conflict (key) do update set value = excluded.value, note = excluded.note, updated_at = now();

create or replace function app.run_installments()
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
  select value into v_url from app.runtime_config where key = 'installments_url';
  select value into v_secret from app.runtime_config where key = 'reports_secret';
  if v_url is null or v_secret is null then
    raise notice 'Рассрочка: нет installments_url или reports_secret.';
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) into v_request;

  insert into app.scheduler_calls (request_id, job) values (v_request, 'installments');
  return v_request;
end;
$$;

revoke all on function app.run_installments() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('rahtis-installments');
exception
  when others then
    null;
end;
$$;

select cron.schedule('rahtis-installments', '20 5 * * *', 'select app.run_installments()');
