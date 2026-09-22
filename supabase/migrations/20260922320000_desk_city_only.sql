-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · на столе заказов — только город
--
-- 22.09.2026 пользователь: на столе перевозчик видит только город и
-- время точек. По названию места, адресу, номеру брони, заметке и точной
-- линии маршрута легко узнать склад заказчика — а зная заказчика,
-- перевозчик договорится с ним мимо платформы.
--
-- На столе (заказ ещё не назначен):
--   · место точки — её город; компании, адреса, брони и заметки нет;
--   · координаты округлены до 0,1° (около 10 км): карта показывает район,
--     а не ворота; линии маршрута нет;
--   · расстояние, время, груз, пломба и состояние прицепа — как были:
--     по ним перевозчик считает цену.
-- Полные данные точек перевозчик получает, когда рейс назначен ему
-- (my_assignments) — без них груз не забрать.
--
-- Текст функции взят из базы (pg_get_functiondef) и изменён точечно.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.desk_orders(p_region text DEFAULT NULL::text, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, ref text, order_type order_type, haul_kind haul_kind, container_feet smallint, ldm numeric, trailer text, trailer_plate text, distance_km integer, rate_cents integer, comment text, shipper_name text, published_at timestamp with time zone, pickup_city text, pickup_date date, pickup_time time without time zone, finish_city text, offers_count integer, taken_by_me boolean, route_geometry text, route_bounds jsonb, stops jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Стол заказов доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  if not app.has_dispatchable_vehicle(v_company_id) then
    return;
  end if;

  return query
  select
    o.id,
    o.ref,
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.ldm,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,
    o.comment,
    null::text,
    o.published_at,
    pickup.city,
    pickup.scheduled_date,
    pickup.scheduled_time,
    (
      select s.city
      from public.order_stops s
      where s.order_id = o.id
      order by s.sequence desc
      limit 1
    ),
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then 0
      else (select count(*)::integer from public.order_offers f where f.order_id = o.id)
    end,
    case
      when app.order_deadline_passed(o.status, o.deadline_at) then false
      else exists (
        select 1 from public.order_offers f
        where f.order_id = o.id and f.carrier_company_id = v_company_id
      )
    end,
    null::text,
    null::jsonb,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'sequence', s.sequence,
          'role', s.role,
          'place_kind', s.place_kind,
          'place_name', s.city,
          'company_name', null,
          'address', null,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'external_ref', null,
          'trailer_loaded', s.trailer_loaded,
          'note', null,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'lat', round(s.lat::numeric, 1),
          'lon', round(s.lon::numeric, 1),
          'leg_distance_m', s.leg_distance_m,
          'completed_at', s.completed_at
        )
        order by s.sequence
      )
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.order_stops pickup
    on pickup.order_id = o.id and pickup.role = 'PICKUP'
  where (
      o.status = 'OPEN'
      or app.order_deadline_passed(o.status, o.deadline_at)
      or (
        o.status = 'REQUESTED'
        and exists (
          select 1 from public.order_offers f
          where f.order_id = o.id and f.carrier_company_id = v_company_id
        )
      )
    )
    /* Ветка, в которой перевозчику нечем работать, на витрину не идёт. */
    and app.has_vehicle_for_haul(v_company_id, o.haul_kind)
    and (p_region is null or pickup.city = p_region)
  order by o.published_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$function$;
