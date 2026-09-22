-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · перевозчик не видит, чей это заказ
--
-- 22.09.2026 пользователь: «перевозчику тоже не нужно показывать клиента
-- в кабинете, иначе уйдёт» — зная заказчика, перевозчик договорится с
-- ним напрямую, мимо платформы. Анонимность теперь в обе стороны: заказчик
-- не видит перевозчика (carrier_anonymity), перевозчик — заказчика.
--
-- Название заказчика убрано у перевозчика и водителя:
--   · стол и назначенные рейсы (desk_orders, my_assignments);
--   · задания водителя (driver_tasks);
--   · выполненные рейсы, отчёт за период, претензии и помощник
--     (completed_orders, period_report, period_claims, my_claims,
--     agent_claim) — теперь только оператору;
--   · раздел «Asiakkaat» (carrier_partners): вместо названия — код
--     «Asiakas 3F2A», стабильный для пары, число рейсов, последний рейс и
--     его маршрут — по ним перевозчик узнаёт, о ком речь, разрешая прямые
--     заказы.
--
-- Точки маршрута (место погрузки, адрес, контакт на месте) остаются: без
-- них груз не забрать. Если погрузка — склад самого заказчика, его
-- название видно в точке так же, как на воротах склада.
--
-- Тексты функций взяты из базы (pg_get_functiondef) и изменены точечно.
-- ═══════════════════════════════════════════════════════════════════

-- ── desk_orders ──

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
    case when (select app.is_admin()) then c.name end,
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
    o.route_geometry,
    o.route_bounds,
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'sequence', s.sequence,
          'role', s.role,
          'place_kind', s.place_kind,
          'place_name', s.place_name,
          'company_name', s.company_name,
          'address', s.address,
          'city', s.city,
          'scheduled_date', s.scheduled_date,
          'scheduled_time', s.scheduled_time,
          'external_ref', s.external_ref,
          'trailer_loaded', s.trailer_loaded,
          'note', s.note,
          'cargo_weight_kg', s.cargo_weight_kg,
          'seal_required', s.seal_required,
          'lat', s.lat,
          'lon', s.lon,
          'leg_distance_m', s.leg_distance_m,
          'completed_at', s.completed_at
        )
        order by s.sequence
      )
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
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

-- ── my_assignments ──

CREATE OR REPLACE FUNCTION public.my_assignments()
 RETURNS TABLE(id uuid, ref text, order_type order_type, haul_kind haul_kind, container_feet smallint, ldm numeric, status order_status, deadline_at timestamp with time zone, trailer text, trailer_plate text, distance_km integer, rate_cents integer, comment text, shipper_name text, vehicle_plate text, route_geometry text, route_bounds jsonb, stops jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_company_id uuid;
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Раздел доступен только перевозчику.' using errcode = '42501';
  end if;

  v_company_id := (select app.current_company_id());

  return query
  select
    o.id, o.ref, o.order_type, o.haul_kind, o.container_feet, o.ldm, o.status, o.deadline_at,
    o.trailer, o.trailer_plate, o.distance_km, o.rate_cents, o.comment,
    case when (select app.is_admin()) then c.name end, v.plate,
    o.route_geometry, o.route_bounds,
    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    )
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_company_id = v_company_id
    /* DONE ушёл: выполненный рейс живёт во вкладке выполненных. */
    and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
  order by o.deadline_at nulls last, o.published_at desc;
end;
$function$;

-- ── driver_tasks ──

CREATE OR REPLACE FUNCTION public.driver_tasks()
 RETURNS TABLE(id uuid, ref text, status order_status, direct boolean, deadline_at timestamp with time zone, order_type order_type, haul_kind haul_kind, container_feet smallint, ldm numeric, trailer text, trailer_plate text, distance_km integer, comment text, shipper_name text, plate text, closed_at timestamp with time zone, stops jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    o.id,
    o.ref,
    o.status,
    o.status = 'AWAIT_DRIVER' and o.deadline_at is null,
    o.deadline_at,
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.ldm,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.comment,
    null::text,
    v.plate,
    o.closed_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'sequence', s.sequence,
        'role', s.role,
        'place_kind', s.place_kind,
        'place_name', s.place_name,
        'company_name', s.company_name,
        'address', s.address,
        'city', s.city,
        'country', s.country,
        'lat', s.lat,
        'lon', s.lon,
        'scheduled_date', s.scheduled_date,
        'scheduled_time', s.scheduled_time,
        'contact_name', s.contact_name,
        'contact_phone', s.contact_phone,
        'external_ref', s.external_ref,
        'trailer_loaded', s.trailer_loaded,
        'seal_required', s.seal_required,
        'cargo_weight_kg', s.cargo_weight_kg,
        'consignee', s.consignee,
        'note', s.note,
        'arrived_at', s.arrived_at,
        'completed_at', s.completed_at,
        'damage_note', s.damage_note
      ) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  join public.companies c on c.id = o.shipper_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.assigned_driver_id = (select app.current_driver_id())
    and (
      o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
      or (o.status = 'DONE' and o.closed_at > now() - interval '7 days')
    )
  order by
    case o.status when 'IN_PROGRESS' then 0 when 'AWAIT_DRIVER' then 1 else 2 end,
    o.closed_at desc nulls last,
    o.created_at;
$function$;

-- ── completed_orders ──

CREATE OR REPLACE FUNCTION public.completed_orders(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, week date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_name text, carrier_name text, vehicle_plate text, route_geometry text, route_bounds jsonb, rating_score smallint, rating_comment text, can_rate boolean, stops jsonb, documents jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role public.party_role;
  v_company uuid;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    app.report_week(app.closed_moment(o)),
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,

    case when v_role <> 'SHIPPER' then app.order_bps(o) end,
    case when v_role <> 'SHIPPER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_role <> 'SHIPPER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,

    case when v_role = 'ADMIN' then shipper.name end,
    case when v_role = 'ADMIN' then carrier.name end,
    v.plate,

    o.route_geometry,
    o.route_bounds,

    r.score,
    r.comment,
    (v_role = 'SHIPPER' and o.assigned_company_id is not null),

    (
      select jsonb_agg(to_jsonb(s) order by s.sequence)
      from public.order_stops s
      where s.order_id = o.id
    ),
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'kind', d.kind,
          'file_name', d.file_name,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'size_bytes', d.size_bytes,
          'stop_id', d.stop_id,
          'created_at', d.created_at
        )
        order by d.created_at
      )
      from public.order_documents d
      where d.order_id = o.id
    )
  from public.orders o
  join public.companies shipper on shipper.id = o.shipper_company_id
  left join public.companies carrier on carrier.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  left join public.order_ratings r on r.order_id = o.id
  where o.status = 'DONE'
    and (
      (v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (v_role = 'CARRIER' and o.assigned_company_id = v_company)
      or v_role = 'ADMIN'
    )
    and (p_from is null or app.report_week(app.closed_moment(o)) >= p_from)
    and (p_to is null or app.report_week(app.closed_moment(o)) <= p_to)
  order by app.closed_moment(o) desc;
end;
$function$;

-- ── my_claims ──

CREATE OR REPLACE FUNCTION public.my_claims(p_status claim_status DEFAULT NULL::claim_status)
 RETURNS TABLE(id uuid, ref text, order_id uuid, order_ref text, kind claim_kind, status claim_status, filed_by_role party_role, mine boolean, amount_cents integer, route_from text, route_to text, vehicle_plate text, shipper_name text, carrier_name text, events_count integer, last_event_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
begin
  return query
  select
    c.id, c.ref, c.order_id, o.ref, c.kind, c.status, c.filed_by_role,
    (c.filed_by_company_id = v_company),
    c.amount_cents,
    (select coalesce(s.city, s.place_name) from public.order_stops s
      where s.order_id = o.id order by s.sequence limit 1),
    (select coalesce(s.city, s.place_name) from public.order_stops s
      where s.order_id = o.id order by s.sequence desc limit 1),
    v.plate,
    case when v_admin then sh.name end,
    case when v_admin then ca.name end,
    (select count(*)::integer from public.claim_events e where e.claim_id = c.id),
    (select max(e.created_at) from public.claim_events e where e.claim_id = c.id),
    c.created_at, c.updated_at
  from public.claims c
  join public.orders o on o.id = c.order_id
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where (v_admin or v_company in (c.filed_by_company_id, c.against_company_id))
    and (p_status is null or c.status = p_status)
  order by (c.status in ('OPEN', 'IN_REVIEW')) desc, c.updated_at desc
  limit 500;
end;
$function$;

-- ── period_claims ──

CREATE OR REPLACE FUNCTION public.period_claims(p_from date, p_to date, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, ref text, order_ref text, kind claim_kind, status claim_status, filed_by_role party_role, mine boolean, amount_cents integer, resolution text, created_at timestamp with time zone, resolved_at timestamp with time zone, shipper_name text, carrier_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Неверный период.' using errcode = '22023';
  end if;

  return query
  select
    c.id, c.ref, o.ref, c.kind, c.status, c.filed_by_role,
    (c.filed_by_company_id = v_company),
    c.amount_cents, c.resolution, c.created_at, c.resolved_at,
    case when v_admin then sh.name end,
    case when v_admin then ca.name end
  from public.claims c
  join public.orders o on o.id = c.order_id
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where (c.created_at at time zone 'Europe/Helsinki')::date between p_from and p_to
    and (
      (v_admin and (p_company is null or p_company in (c.filed_by_company_id, c.against_company_id)))
      or (not v_admin and v_company in (c.filed_by_company_id, c.against_company_id))
    )
  order by c.created_at;
end;
$function$;

-- ── period_report ──

CREATE OR REPLACE FUNCTION public.period_report(p_from date, p_to date, p_company uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, closed_on date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, vehicle_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_id uuid, shipper_name text, shipper_country text, carrier_id uuid, carrier_name text, carrier_country text, route text, stops_count integer, documents_count integer, cmr_count integer, photos_count integer, claims jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_admin boolean := (select app.is_admin());
  v_role public.party_role := (select app.current_party_role());
  v_company uuid := (select app.current_company_id());
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Неверный период.' using errcode = '22023';
  end if;

  if p_to - p_from > 366 then
    raise exception 'Период длиннее года.' using errcode = '22023';
  end if;

  if not v_admin and v_role not in ('SHIPPER', 'CARRIER') then
    raise exception 'Отчёт недоступен.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.ref,
    o.shipper_ref,
    o.closed_at,
    app.closed_day(o),
    o.order_type,
    o.haul_kind,
    o.container_feet,
    o.trailer,
    o.trailer_plate,
    v.plate,
    o.distance_km,
    o.rate_cents,

    case when v_admin or v_role = 'CARRIER' then app.order_bps(o) end,
    case when v_admin or v_role = 'CARRIER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_admin or v_role = 'CARRIER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,

    case when v_admin then sh.id end,
    case when v_admin then sh.name end,
    case when v_admin then sh.country::text end,
    case when v_admin then ca.id end,
    case when v_admin then ca.name end,
    case when v_admin then ca.country::text end,

    (
      select string_agg(coalesce(nullif(s.city, ''), s.place_name, '?'), ' - ' order by s.sequence)
      from public.order_stops s where s.order_id = o.id
    ),
    (select count(*)::integer from public.order_stops s where s.order_id = o.id),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id and d.kind = 'CMR'),
    (select count(*)::integer from public.order_documents d where d.order_id = o.id and d.kind <> 'CMR'),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'ref', c.ref,
          'kind', c.kind,
          'status', c.status,
          'filed_by_role', c.filed_by_role,
          'amount_cents', c.amount_cents
        )
        order by c.created_at
      )
      from public.claims c where c.order_id = o.id
    ), '[]'::jsonb)
  from public.orders o
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  left join public.vehicles v on v.id = o.assigned_vehicle_id
  where o.status = 'DONE'
    and app.closed_day(o) between p_from and p_to
    and (
      (v_admin and (p_company is null or p_company in (o.shipper_company_id, o.assigned_company_id)))
      or (not v_admin and v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (not v_admin and v_role = 'CARRIER' and o.assigned_company_id = v_company)
    )
  order by app.closed_moment(o), o.ref;
end;
$function$;

-- ── agent_claim ──

CREATE OR REPLACE FUNCTION public.agent_claim(p_conversation_id uuid, p_token uuid, p_ref text)
 RETURNS TABLE(ref text, order_ref text, kind claim_kind, status claim_status, filed_by text, filed_by_you boolean, amount_eur numeric, description text, resolution text, created_at timestamp with time zone, resolved_at timestamp with time zone, forwarded_to_counterparty_at timestamp with time zone, shipper_name text, carrier_name text, messages_count integer, last_operator_message text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ctx public.conversations;
  v_ref text := upper(btrim(coalesce(p_ref, '')));
  v_admin boolean;
begin
  v_ctx := app.agent_context(p_conversation_id, p_token);

  if v_ctx.audience = 'DRIVER' then
    raise exception 'Претензии водителю не показываются.' using errcode = '42501';
  end if;

  v_admin := v_ctx.audience = 'ADMIN';

  return query
  select
    c.ref,
    o.ref,
    c.kind,
    c.status,
    c.filed_by_role::text,
    (c.filed_by_company_id = v_ctx.company_id),
    round(c.amount_cents / 100.0, 2),
    c.description,
    c.resolution,
    c.created_at,
    c.resolved_at,
    c.mirrored_at,
    case when v_admin then sh.name end,
    case when v_admin then ca.name end,
    /* Переписка — оператору и подавшему; второй стороне её не видно. */
    case when v_admin or c.filed_by_company_id = v_ctx.company_id then
      (select count(*)::integer from public.claim_events e
        where e.claim_id = c.id and e.kind in ('COMMENT', 'ATTACHMENT'))
    end,
    case when v_admin or c.filed_by_company_id = v_ctx.company_id then
      (select e.body from public.claim_events e
        where e.claim_id = c.id and e.author_role = 'ADMIN' and e.body is not null
        order by e.created_at desc, e.id desc limit 1)
    end
  from public.claims c
  join public.orders o on o.id = c.order_id
  join public.companies sh on sh.id = o.shipper_company_id
  left join public.companies ca on ca.id = o.assigned_company_id
  where (upper(c.ref) = v_ref or upper(o.ref) = v_ref)
    and (v_admin or v_ctx.company_id in (c.filed_by_company_id, c.against_company_id))
  order by c.created_at;
end;
$function$;

-- ── Asiakkaat: код вместо названия ─────────────────────────────────

drop function if exists public.carrier_partners();

create or replace function public.carrier_partners()
returns table (
  shipper_id uuid,
  shipper_name text,
  trips integer,
  last_trip_at timestamptz,
  last_route text,
  status public.link_status,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.shipper_company_id,
    /* Код, а не название: стабилен для заказчика, ничего о нём не говорит. */
    'Asiakas ' || upper(substr(md5(l.shipper_company_id::text), 1, 4)),
    (select count(*)::integer from public.orders o
      where o.assigned_company_id = l.carrier_company_id
        and o.shipper_company_id = l.shipper_company_id
        and o.status = 'DONE'),
    last.closed_at,
    last.route,
    l.status,
    l.decided_at
  from public.carrier_shipper_links l
  left join lateral (
    select o.closed_at,
           concat_ws(' → ',
             (select s.city from public.order_stops s where s.order_id = o.id order by s.sequence limit 1),
             (select e.city from app.route_end(o.id) e)) as route
    from public.orders o
    where o.assigned_company_id = l.carrier_company_id
      and o.shipper_company_id = l.shipper_company_id
      and o.status = 'DONE'
    order by o.closed_at desc
    limit 1
  ) last on true
  where l.carrier_company_id = (select app.current_company_id())
  order by (l.status = 'OFFERED') desc, last.closed_at desc nulls last;
$$;

revoke all on function public.carrier_partners() from public, anon;
grant execute on function public.carrier_partners() to authenticated;
