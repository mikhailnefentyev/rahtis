-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · рассрочка: замечания покупателя при передаче (21.11.2026)
--
-- Найдено при сквозной проверке этапа 3:
--   1. Замечания покупателя при передаче затирались замечаниями
--      продавца, если продавец подтверждал позже. Теперь у покупателя
--      своё поле handover_buyer_notes — фиксация дефектов в его пользу.
--   2. На проданной записи продавца оставались имя и телефон водителя.
--      Теперь очищаются при передаче; уже переданные — чистятся здесь.
-- ═══════════════════════════════════════════════════════════════════

alter table public.installment_deals
  add column handover_buyer_notes text;

update public.vehicles set driver_name = null, whatsapp = null
where installment_role = 'SOLD' and (driver_name is not null or whatsapp is not null);

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
