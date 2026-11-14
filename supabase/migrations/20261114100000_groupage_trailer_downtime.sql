/*
 * Догруз (capacity_request_decide): прицеп берётся с рейса, на котором
 * место, и до сих пор не проверялся на «вне работы». Машину проверяют
 * vehicle_is_dispatchable и assert_vehicle_fits_order (через
 * vehicle_meets_requirements → asset_order_conflict, 20261113130000);
 * прицеп — тем же app.asset_order_conflict по дням заказа догруза.
 * Тело функции — из 20261106220000_groupage без других изменений.
 */

create or replace function public.capacity_request_decide(p_request_id uuid, p_accept boolean, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid := (select app.current_company_id());
  v_request public.capacity_requests;
  v_offer public.capacity_offers;
  v_order public.orders;
  v_trailer uuid;
  v_offer_row uuid;
  v_plate text;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Отвечает перевозчик.' using errcode = '42501';
  end if;

  select * into v_request from public.capacity_requests where id = p_request_id for update;
  if v_request.id is null or v_request.carrier_company_id is distinct from v_company then
    raise exception 'Запрос не найден.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Запрос уже решён.' using errcode = '55000';
  end if;

  if not p_accept then
    update public.capacity_requests
    set status = 'DECLINED', decided_at = now(), decided_by = auth.uid(),
        decline_reason = nullif(btrim(left(coalesce(p_reason, ''), 300)), '')
    where id = v_request.id;

    perform app.notify_event(
      v_request.shipper_company_id,
      'ORDER',
      'capacity.declined',
      jsonb_build_object('from', v_request.from_city, 'to', v_request.to_city),
      '/shipper/capacity'
    );
    return null;
  end if;

  select * into v_offer from public.capacity_offers where id = v_request.offer_id for update;
  if not app.capacity_offer_live(v_offer.id) then
    raise exception 'Место уже не опубликовано.' using errcode = '55000';
  end if;

  select * into v_order from public.orders where id = v_request.order_id for update;
  if v_order.id is null or not app.capacity_order_ready(v_order) then
    raise exception 'Заказ уже взят или изменён.' using errcode = '55000';
  end if;

  if (v_offer.free_ldm is not null and v_order.ldm > v_offer.free_ldm)
     or (v_offer.free_kg is not null and app.order_max_weight_kg(v_order.id) > v_offer.free_kg) then
    raise exception 'Груз не помещается в свободное место.' using errcode = '22023';
  end if;

  if not app.vehicle_is_dispatchable(v_offer.vehicle_id) then
    raise exception 'Машина сейчас не выходит на рейсы.' using errcode = '55004';
  end if;

  /* Своё изменение заказа при принятии не гасит этот же запрос (триггер ниже). */
  perform set_config('rahtis.capacity_deciding', '1', true);

  /* Заказчик ещё активен, а машина подходит под заказ таким, каков он сейчас. */
  if not exists (
    select 1 from public.companies c
    where c.id = v_order.shipper_company_id and c.status = 'ACTIVE' and c.frozen_at is null
  ) then
    raise exception 'Заказчик сейчас не может давать заказы.' using errcode = '55000';
  end if;
  perform app.assert_vehicle_fits_order(v_order, (select v from public.vehicles v where v.id = v_offer.vehicle_id));

  if v_order.currency is distinct from v_request.currency then
    raise exception 'Валюта заказа изменилась.' using errcode = '55000';
  end if;

  select o.assigned_trailer_id into v_trailer from public.orders o where o.id = v_offer.order_id;

  /* Прицеп рейса вне работы в дни этого заказа — догруз не принять (как carrier_set_trip_trailer). */
  if v_trailer is not null and app.asset_order_conflict(null, v_trailer, v_order) is not null then
    raise exception '%', app.asset_order_conflict(null, v_trailer, v_order) using errcode = '55003';
  end if;

  update public.orders
  set rate_cents = v_request.price_cents,
      pricing_mode = 'FIXED',
      rate_per_km_cents = null
  where id = v_order.id;

  insert into public.order_offers (order_id, carrier_company_id, vehicle_id, trailer_id, created_by, origin)
  values (v_order.id, v_company, v_offer.vehicle_id, v_trailer, (select auth.uid()), 'DIRECT')
  returning id into v_offer_row;

  insert into public.order_direct_requests (order_id, vehicle_id, carrier_company_id, sent_by)
  values (v_order.id, v_offer.vehicle_id, v_company, v_request.created_by);

  update public.orders
  set status = 'AWAIT_DRIVER',
      dispatch_mode = 'DIRECT',
      chosen_offer_id = v_offer_row,
      assigned_company_id = v_company,
      assigned_vehicle_id = v_offer.vehicle_id,
      assigned_trailer_id = v_trailer,
      deadline_at = null
  where id = v_order.id;

  update public.orders set status = 'IN_PROGRESS' where id = v_order.id;

  /*
   * «Новый прямой заказ» перевозчику лишний — он сам его только что
   * принял; «прямой заказ подтверждён» заказчику заменяет capacity.accepted
   * ниже (с маршрутом и номером машины).
   */
  delete from public.notifications
  where ((company_id = v_company and code = 'order.direct')
      or (company_id = v_request.shipper_company_id and code = 'direct.accepted'))
    and params->>'ref' = v_order.ref;

  update public.capacity_requests
  set status = 'ACCEPTED', decided_at = now(), decided_by = auth.uid(), created_order_id = v_order.id
  where id = v_request.id;

  /* Тот же заказ ждал и других машин — больше не ждёт. */
  update public.capacity_requests
  set status = 'EXPIRED', decided_at = now()
  where order_id = v_order.id and status = 'PENDING';

  update public.capacity_offers
  set free_ldm = case when free_ldm is null then null else greatest(free_ldm - coalesce(v_order.ldm, 0), 0) end,
      free_kg = case when free_kg is null then null else greatest(free_kg - app.order_max_weight_kg(v_order.id), 0) end,
      free_pallets = case when free_pallets is null then null else greatest(free_pallets - coalesce(v_request.pallets, 0), 0)::smallint end,
      /* Расчёт тоже: ночной пересчёт увидит этот груз и не вычтет его второй раз. */
      computed_ldm = case when computed_ldm is null then null else greatest(computed_ldm - coalesce(v_order.ldm, 0), 0) end,
      computed_kg = case when computed_kg is null then null else greatest(computed_kg - app.order_max_weight_kg(v_order.id), 0) end,
      trip_order_ids = trip_order_ids || v_order.id
  where id = v_offer.id;

  update public.capacity_offers
  set status = 'FILLED'
  where id = v_offer.id
    and ((free_ldm is not null and free_ldm < 1) or (free_kg is not null and free_kg < 500));

  select plate into v_plate from public.vehicles where id = v_offer.vehicle_id;
  perform app.notify_event(
    v_request.shipper_company_id,
    'ORDER',
    'capacity.accepted',
    jsonb_build_object('ref', v_order.ref, 'plate', coalesce(v_plate, ''), 'from', v_request.from_city, 'to', v_request.to_city),
    '/shipper/orders'
  );

  return v_order.id;
end;
$$;

comment on function public.capacity_request_decide(uuid, boolean, text) is
  'Догрузы: перевозчик принимает (заказ становится прямым и подтверждённым на этой машине) или отклоняет запрос.';

revoke all on function public.capacity_request_decide(uuid, boolean, text) from public, anon;
grant execute on function public.capacity_request_decide(uuid, boolean, text) to authenticated;
