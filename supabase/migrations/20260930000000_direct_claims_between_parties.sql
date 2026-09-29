-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · претензии по прямым рейсам — между сторонами
--
-- Решение пользователя 29.09.2026: если Aivomaa не сторона договора
-- (contract_party = CARRIER — прямой рейс перевозчика на подписке),
-- претензии стороны решают сами. file_claim такой рейс не принимает;
-- completed_orders отдаёт contract_party, чтобы кабинет показал вместо
-- кнопки «Reklamaatio» объяснение. Документы в TERMS 12.1 и договоре
-- перевозчика 15.2 — черновиками в той же поставке.
--
-- Тексты функций взяты из базы (pg_get_functiondef) и изменены точечно;
-- completed_orders пересоздаётся — меняется набор возвращаемых столбцов.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.file_claim(p_order_id uuid, p_kind claim_kind, p_description text, p_stop_id uuid DEFAULT NULL::uuid, p_amount_cents integer DEFAULT NULL::integer)
 RETURNS claims
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_order public.orders;
  v_role public.party_role;
  v_company uuid;
  v_against uuid;
  v_n integer;
  v_claim public.claims;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if v_role = 'SHIPPER' and v_order.shipper_company_id = v_company then
    v_against := v_order.assigned_company_id;
  elsif v_role = 'CARRIER' and v_order.assigned_company_id = v_company then
    v_against := v_order.shipper_company_id;
  else
    raise exception 'Подать claim может только сторона рейса.' using errcode = '42501';
  end if;

  /*
   * Спорить есть о чём с того момента, как у рейса есть вторая сторона
   * и работа началась. Отменённый и не начатый рейс спора не порождает.
   */
  /*
   * Прямой рейс перевозчика на подписке: договор перевозки — между
   * сторонами, Aivomaa не сторона и не посредник. Решение пользователя
   * 29.09.2026: такие споры стороны решают сами; документы и снимки рейса
   * у обеих сторон есть, имена и контакты друг друга они видят.
   */
  if v_order.contract_party = 'CARRIER' then
    raise exception 'По прямому рейсу перевозчика на подписке претензию решают стороны между собой.'
      using errcode = '55000';
  end if;

  if v_order.status not in ('IN_PROGRESS', 'DONE') or v_against is null then
    raise exception 'Claim подаётся по идущему или выполненному рейсу.' using errcode = '55000';
  end if;

  if p_stop_id is not null and not exists (
    select 1 from public.order_stops where id = p_stop_id and order_id = p_order_id
  ) then
    raise exception 'Точка не из этого рейса.' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_description, ''))) < 10 then
    raise exception 'Опишите, что произошло.' using errcode = '22023';
  end if;

  /* Номер по порядку внутри рейса; замок — чтобы два одновременных не взяли один. */
  perform pg_advisory_xact_lock(hashtext('claim:' || p_order_id::text));
  select count(*) + 1 into v_n from public.claims where order_id = p_order_id;

  insert into public.claims (
    ref, order_id, stop_id, kind, filed_by_role, filed_by_company_id,
    against_company_id, filed_by, description, amount_cents
  )
  values (
    'CL-' || v_order.ref || '-' || v_n,
    p_order_id, p_stop_id, p_kind, v_role, v_company,
    v_against, (select auth.uid()), btrim(p_description), p_amount_cents
  )
  returning * into v_claim;

  insert into public.claim_events (claim_id, kind, author_role, author_id, body, status_to)
  values (v_claim.id, 'CREATED', v_role, (select auth.uid()), null, 'OPEN');

  return v_claim;
end;
$function$;

drop function public.completed_orders(date, date);

CREATE FUNCTION public.completed_orders(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, ref text, shipper_ref text, closed_at timestamp with time zone, week date, order_type order_type, haul_kind haul_kind, container_feet smallint, trailer text, trailer_plate text, distance_km integer, rate_cents integer, commission_bps integer, commission_cents integer, payout_cents integer, shipper_name text, carrier_name text, vehicle_plate text, route_geometry text, route_bounds jsonb, rating_score smallint, rating_comment text, can_rate boolean, stops jsonb, documents jsonb, contract_party contract_party)
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

    case when v_role = 'ADMIN' or (v_role = 'CARRIER' and o.contract_party = 'CARRIER') then shipper.name end,
    case when v_role = 'ADMIN' or (v_role = 'SHIPPER' and o.contract_party = 'CARRIER') then carrier.name end,
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
    ),
    o.contract_party
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

revoke all on function public.completed_orders(date, date) from public, anon;
grant execute on function public.completed_orders(date, date) to authenticated;
