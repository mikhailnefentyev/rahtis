-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка техники: исправления по ревью (22.11.2026)
--
--   1. Продавец с истёкшей лицензией или страховкой не мог отметить
--      оплату: все действия шли через app.installment_party (действующий
--      финский перевозчик с документами). Сделка уже заключена — для
--      оплаты первого счёта, оплаты взноса, отмены с кредит-нотой и
--      передачи хватает того, что это главный в компании-стороне сделки
--      (app.installment_owner). Объявление, предложение и согласие —
--      по-прежнему с полной проверкой.
--   2. Отмена с кредит-нотой после выставленного первого счёта — только
--      продавец: покупатель мог отменить, пока продавец не отметил
--      оплату, и кредит-нота писала «ничего не оплачено».
--   3. Сводка по машине показывала закрытый простой как текущий.
--   4. Замечания покупателя при передаче — не длиннее 2000 знаков, как у
--      продавца.
--   5. Даты по Хельсинки, а не по UTC: carrier_invoices.paid_at и год в
--      номере договора.
--   6. Каталог — только финской компании (раздел только для Финляндии).
-- ═══════════════════════════════════════════════════════════════════

/*
 * Главный в своей компании — без проверки документов, страны и статуса.
 * Для действий по уже заключённой сделке; что компания — сторона сделки,
 * каждая функция проверяет сама по строке сделки.
 */
create or replace function app.installment_owner()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select app.current_company_id());
begin
  if v_me is null then
    raise exception 'Нет компании.' using errcode = '42501';
  end if;
  if not (select app.is_company_owner()) then
    raise exception 'Продажу и покупку техники оформляет главный в компании.' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

revoke all on function app.installment_owner() from public, anon, authenticated;

alter table public.installment_deals
  add constraint installment_deals_handover_buyer_notes check (char_length(handover_buyer_notes) <= 2000) not valid;

-- ── Оплата первого счёта ────────────────────────────────────────────

create or replace function public.mark_installment_first_paid(p_deal_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
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
  /* paid_at у счёта — дата: день по Хельсинки, а не по UTC (22.11.2026). */
  update public.carrier_invoices set paid_at = coalesce(paid_at, app.helsinki_today()) where id = v_deal.first_invoice_id;
end;
$$;

-- ── Передача машины ─────────────────────────────────────────────────

create or replace function public.confirm_installment_handover(p_deal_id uuid, p_odometer_km integer, p_notes text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
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
  /* Замечания обеих сторон — не длиннее 2000 знаков (22.11.2026). */
  if char_length(btrim(coalesce(p_notes, ''))) > 2000 then
    raise exception 'Замечания.' using errcode = '22023';
  end if;

  /* Машина не должна быть в работе у продавца: открытые рейсы сначала закрыть или переназначить. */
  if exists (
    select 1 from public.orders o, public.equipment_listings l
    where l.id = v_deal.listing_id and o.assigned_vehicle_id = l.vehicle_id
      and o.status in ('REQUESTED', 'AWAIT_DRIVER', 'IN_PROGRESS')
  ) then
    raise exception 'У машины есть открытые рейсы продавца — закройте или переназначьте их.' using errcode = '55000';
  end if;

  /* Пробег продавца не перезаписывается покупателем. Замечания у каждой стороны свои: ни одна не стирает чужие. */
  update public.installment_deals
  set handover_seller_at = case when v_me = seller_company_id then coalesce(handover_seller_at, now()) else handover_seller_at end,
      handover_buyer_at = case when v_me = buyer_company_id then coalesce(handover_buyer_at, now()) else handover_buyer_at end,
      handover_odometer_km = case when v_me = seller_company_id then coalesce(p_odometer_km, handover_odometer_km)
                                  else coalesce(handover_odometer_km, p_odometer_km) end,
      handover_notes = case when v_me = seller_company_id then coalesce(nullif(btrim(p_notes), ''), handover_notes)
                            else handover_notes end,
      handover_buyer_notes = case when v_me = buyer_company_id then coalesce(nullif(btrim(p_notes), ''), handover_buyer_notes)
                                  else handover_buyer_notes end
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
  set access = 'DRAFT', installment_deal_id = v_deal.id, installment_role = 'SOLD',
      driver_name = null, whatsapp = null, updated_at = now()
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
  v_me uuid := app.installment_owner();
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
    /* paid_at у счёта — дата: день по Хельсинки, а не по UTC (22.11.2026). */
    update public.carrier_invoices set paid_at = coalesce(paid_at, app.helsinki_today()) where id = v_row.invoice_id;
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
 * до передачи и только продавцом. Кредит-ноту (hyvityslasku) выставляет
 * сервер от имени продавца и записывает в credit_note_id. Возвращает id
 * первого счёта.
 */
create or replace function public.cancel_installment_with_credit(p_deal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_owner();
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
  /*
   * Счёт выставлен — кредит-ноту от имени продавца запускает только он:
   * оплату отмечает продавец, и пока он её не отметил, покупатель мог
   * отменить сделку с кредит-нотой «ничего не оплачено» (22.11.2026).
   */
  if v_me <> v_deal.seller_company_id then
    raise exception 'Счёт выставлен — отмену с кредит-нотой оформляет продавец.' using errcode = '42501';
  end if;

  update public.installment_deals set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_me where id = p_deal_id;
  update public.equipment_listings set status = 'PUBLISHED', updated_at = now() where id = v_deal.listing_id and status = 'RESERVED';
  return v_deal.first_invoice_id;
end;
$$;

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
    /* Только незакрытый простой: снятый досрочно — уже не текущий (22.11.2026). */
    (select t.reason from public.vehicle_downtime t
     where t.vehicle_id = v_vehicle and t.ended_at is null
       and t.starts_on <= v_today and (t.ends_on is null or t.ends_on >= v_today)
     order by t.starts_on desc limit 1),
    (select v.access::text from public.vehicles v where v.id = v_vehicle);
end;
$$;

-- ── Каталог: только финской компании ────────────────────────────────

create or replace function public.equipment_catalog()
returns table (
  listing_id uuid,
  seller_name text,
  seller_city text,
  make text,
  vehicle_class text,
  plate text,
  euro_class text,
  axles smallint,
  odometer_km integer,
  price_cents bigint,
  currency text,
  vat_mode text,
  vat_bps integer,
  down_payment_cents bigint,
  months smallint,
  final_cents bigint,
  annual_rate_bps integer,
  description text,
  published_at timestamptz,
  my_deal_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  /* Раздел только для Финляндии: компании из другой страны каталог пуст (22.11.2026). */
  with me as (
    select c.id, c.is_test from public.companies c
    where c.id = (select app.current_company_id())
      and c.kind = 'CARRIER' and c.status = 'ACTIVE' and c.country::text = 'FI'
      and app.company_documents_ok(c.id)
  )
  select l.id, coalesce(s.legal_name, s.name), coalesce(s.legal_city, v.base_city),
         v.make, v.vehicle_class::text, v.plate, v.euro_class::text, v.axles::smallint, l.odometer_km,
         l.price_cents, l.currency, l.vat_mode, l.vat_bps, l.down_payment_cents, l.months, l.final_cents,
         l.annual_rate_bps, l.description, l.published_at,
         (select d.id from public.installment_deals d
          where d.listing_id = l.id and d.buyer_company_id = me.id and d.status <> 'CANCELLED'
          order by d.created_at desc limit 1)
  from me
  join public.equipment_listings l on l.status = 'PUBLISHED' and l.seller_company_id <> me.id
  join public.companies s on s.id = l.seller_company_id and s.is_test = me.is_test and s.status = 'ACTIVE'
  join public.vehicles v on v.id = l.vehicle_id
  order by l.published_at desc;
$$;

-- ── Согласие: год в номере договора — по Хельсинки ──────────────────

/*
 * Принять условия другой стороны. Принимается ровно увиденная версия
 * (p_version): если условия успели заменить — отказ (как у условий счёта).
 * После согласия: номер договора, объявление «зарезервировано», остальные
 * переговоры по нему закрыты.
 */
create or replace function public.accept_installment_terms(p_deal_id uuid, p_version integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.installment_party();
  v_deal public.installment_deals;
  v_number text;
  v_listing_id uuid;
begin
  /* Порядок блокировок: объявление, потом сделка — как у снятия объявления, без взаимной блокировки. */
  select listing_id into v_listing_id from public.installment_deals where id = p_deal_id;
  perform 1 from public.equipment_listings where id = v_listing_id for update;
  select * into v_deal from public.installment_deals where id = p_deal_id for update;
  if v_deal.id is null or v_me not in (v_deal.seller_company_id, v_deal.buyer_company_id) then
    raise exception 'Нет сделки.' using errcode = '42501';
  end if;
  if v_deal.status <> 'NEGOTIATING' then
    raise exception 'Сделка уже не в переговорах.' using errcode = '55000';
  end if;
  if v_deal.proposed_by = v_me then
    raise exception 'Своё предложение принимает другая сторона.' using errcode = '42501';
  end if;
  if p_version is null or v_deal.version is distinct from p_version then
    raise exception 'Условия изменились — посмотрите новые.' using errcode = '40001';
  end if;
  if v_deal.handover_date <= app.helsinki_today() then
    raise exception 'Дата передачи прошла — предложите новую.' using errcode = '22023';
  end if;
  /* Вторая сторона тоже должна быть в порядке на момент согласия. */
  if not app.installment_company_ok(v_deal.seller_company_id) or not app.installment_company_ok(v_deal.buyer_company_id)
     or (select is_test from public.companies where id = v_deal.seller_company_id)
        is distinct from (select is_test from public.companies where id = v_deal.buyer_company_id) then
    raise exception 'Сторона сделки сейчас не может её заключить.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.equipment_listings where id = v_deal.listing_id and status = 'PUBLISHED') then
    raise exception 'Объявление уже недоступно.' using errcode = '55000';
  end if;

  /* Год — по Хельсинки: договор, согласованный в новогоднюю ночь, получал прошлый год (22.11.2026). */
  v_number := 'OS-' || to_char(now() at time zone 'Europe/Helsinki', 'YYYY') || '-' || lpad(nextval('public.installment_contract_seq')::text, 5, '0');

  update public.installment_deals
  set status = 'AGREED', agreed_at = now(), contract_number = v_number,
      parties_snapshot = (
        select jsonb_object_agg(p.role, jsonb_build_object(
          'name', coalesce(c.legal_name, c.name),
          'business_id', c.business_id,
          'address', concat_ws(', ', c.legal_street, nullif(concat_ws(' ', c.legal_postal_code, c.legal_city), '')),
          'vat_registered', coalesce(c.vat_number, '') <> '',
          'email', coalesce(c.billing_email, c.contact_email)
        ))
        from (values ('seller', v_deal.seller_company_id), ('buyer', v_deal.buyer_company_id)) as p(role, id)
        join public.companies c on c.id = p.id
      )
  where id = p_deal_id;

  update public.equipment_listings set status = 'RESERVED', updated_at = now() where id = v_deal.listing_id;

  update public.installment_deals
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_deal.seller_company_id
  where listing_id = v_deal.listing_id and id <> p_deal_id and status = 'NEGOTIATING';

  return v_number;
end;
$$;

/* Права — как были: только вошедшим пользователям. */
revoke all on function public.mark_installment_first_paid(uuid) from public, anon;
revoke all on function public.confirm_installment_handover(uuid, integer, text) from public, anon;
revoke all on function public.mark_installment_paid(uuid, integer) from public, anon;
revoke all on function public.cancel_installment_with_credit(uuid) from public, anon;
revoke all on function public.installment_vehicle_status(uuid) from public, anon;
revoke all on function public.equipment_catalog() from public, anon;
revoke all on function public.accept_installment_terms(uuid, integer) from public, anon;
grant execute on function public.mark_installment_first_paid(uuid) to authenticated;
grant execute on function public.confirm_installment_handover(uuid, integer, text) to authenticated;
grant execute on function public.mark_installment_paid(uuid, integer) to authenticated;
grant execute on function public.cancel_installment_with_credit(uuid) to authenticated;
grant execute on function public.installment_vehicle_status(uuid) to authenticated;
grant execute on function public.equipment_catalog() to authenticated;
grant execute on function public.accept_installment_terms(uuid, integer) to authenticated;
