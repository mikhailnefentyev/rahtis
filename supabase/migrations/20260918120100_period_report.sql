-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · отчёт за произвольный период
--
-- Недельный отчёт и документы расчётного периода выпускаются по
-- расписанию и отвечают на вопрос «что за эту неделю / половину
-- месяца». Бухгалтерии нужен другой вопрос: «что было с 1 июля по
-- 30 сентября» — квартал для ALV-декларации, месяц для сверки, отрезок
-- для спора о счёте. Такого отрезка расписание не знает.
--
-- Отчёт строится по запросу из кабинета, под сессией спрашивающего, и
-- роль решает состав колонок — тем же правилом, что в completed_orders:
-- заказчик комиссии не видит, имени перевозчика не видит никто, кроме
-- оператора.
--
-- День рейса — дата закрытия по Хельсинки, а не по UTC: рейс, закрытый
-- 1 октября в 01:30 местного времени, относится к октябрю, хотя по UTC
-- это ещё 30 сентября. Квартал, собранный по UTC, разошёлся бы с
-- декларацией ровно на такие рейсы.
--
-- Деньги — по комиссии, замороженной в рейсе (app.order_bps), и
-- округлены по рейсу: итог отчёта равен сумме его строк.
-- ═══════════════════════════════════════════════════════════════════

create or replace function app.closed_day(p_order public.orders)
returns date
language sql
stable
as $$
  select (app.closed_moment(p_order) at time zone 'Europe/Helsinki')::date;
$$;

comment on function app.closed_day(public.orders) is
  'День закрытия рейса по Хельсинки: по нему рейс попадает в период.';


/*
 * Рейсы периода.
 *
 * p_company — только для оператора: отчёт по одной компании, с какой бы
 * стороны рейса она ни стояла. У сторон параметр игнорируется — их
 * компанию решает сессия, а не аргумент.
 *
 * Год — предел. Отчёт за пять лет одним ответом — это не отчёт, а
 * выгрузка базы, и строить её из кабинета незачем.
 */
create or replace function public.period_report(
  p_from date,
  p_to date,
  p_company uuid default null
)
returns table (
  id uuid,
  ref text,
  shipper_ref text,
  closed_at timestamptz,
  closed_on date,
  order_type public.order_type,
  haul_kind public.haul_kind,
  container_feet smallint,
  trailer text,
  trailer_plate text,
  vehicle_plate text,
  distance_km integer,
  rate_cents integer,
  commission_bps integer,
  commission_cents integer,
  payout_cents integer,
  shipper_id uuid,
  shipper_name text,
  shipper_country text,
  carrier_id uuid,
  carrier_name text,
  carrier_country text,
  route text,
  stops_count integer,
  documents_count integer,
  cmr_count integer,
  photos_count integer,
  claims jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    case when v_admin or v_role = 'CARRIER' then sh.name end,
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
$$;

comment on function public.period_report(date, date, uuid) is
  'Выполненные рейсы за период (по дню закрытия в Хельсинки). Колонки решает роль.';

revoke all on function public.period_report(date, date, uuid) from public, anon;
grant execute on function public.period_report(date, date, uuid) to authenticated, service_role;


/*
 * Claims периода — поданные в эти дни, по любому рейсу компании.
 *
 * Отдельно от рейсов, а не только колонкой при них: спор о рейсе
 * прошлого квартала подаётся в этом, и в отчёт этого квартала он
 * обязан попасть, хотя сам рейс в нём не стоит.
 */
create or replace function public.period_claims(
  p_from date,
  p_to date,
  p_company uuid default null
)
returns table (
  id uuid,
  ref text,
  order_ref text,
  kind public.claim_kind,
  status public.claim_status,
  filed_by_role public.party_role,
  mine boolean,
  amount_cents integer,
  resolution text,
  created_at timestamptz,
  resolved_at timestamptz,
  shipper_name text,
  carrier_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    case when v_admin or v_role = 'CARRIER' then sh.name end,
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
$$;

revoke all on function public.period_claims(date, date, uuid) from public, anon;
grant execute on function public.period_claims(date, date, uuid) to authenticated, service_role;
