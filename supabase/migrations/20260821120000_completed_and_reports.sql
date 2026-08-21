-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 7 · выполненные рейсы и недельные итоги (ТЗ §11)
--
-- Выполненный рейс сейчас теряется. У заказчика он лежит в общем списке
-- заказов, у перевозчика — в списке закреплённых, у оператора не виден
-- вовсе, а счёт выставлять именно по ним. Здесь появляется место, где
-- они собраны, и числа, по которым выставляют счета и платят.
--
-- Три роли смотрят на один и тот же рейс и должны видеть разное.
-- Заказчик платит оператору полную ставку и о комиссии не знает ничего:
-- его контрагент — Aivomaa, а не перевозчик (ТЗ §1). Перевозчик видит
-- ставку, комиссию и выплату — из чего складывается то, что ему придёт.
-- Оператор видит обе стороны сразу, потому что живёт на разнице.
--
-- Поэтому состав колонок решает роль, и решает в одном месте — внутри
-- функции, а не россыпью условий по интерфейсам. Колонка, которую роли
-- знать не положено, приходит пустой, а не отсутствует: тип ответа один
-- на всех, и разойтись трём похожим функциям негде.
--
-- Деньги считаются по ставке, зафиксированной в рейсе при закрытии
-- (commission_bps), а не по действующей. Иначе изменение комиссии
-- перепишет задним числом уже выставленные счета — ровно то, ради чего
-- эта колонка и появилась.
--
-- Округление — по рейсу, до цента, и суммируются уже округлённые числа.
-- Так строка отчёта равна строке счёта: сумма счёта обязана сходиться с
-- суммой его строк, а не отличаться на цент из-за того, что итог округлён
-- отдельно.
-- ═══════════════════════════════════════════════════════════════════

/*
 * Неделя рейса — понедельник по Хельсинки.
 *
 * Не по UTC: рейс, закрытый в понедельник в 01:00 местного времени, по
 * UTC приходится на воскресенье и попал бы в прошлый отчёт, уже
 * отправленный. Оператор живёт в Финляндии, и неделя у него финская.
 *
 * stable, а не immutable: правила часовых поясов меняются, и Postgres
 * вправе это учитывать.
 */
create or replace function app.report_week(p_moment timestamptz)
returns date
language sql
stable
as $$
  select (date_trunc('week', p_moment at time zone 'Europe/Helsinki'))::date;
$$;

comment on function app.report_week(timestamptz) is
  'Понедельник отчётной недели по Хельсинки. Неделя у оператора финская, а не UTC.';

/*
 * Момент, по которому рейс относится к неделе.
 *
 * У рейсов, закрытых до появления closed_at, его нет. Выкинуть их из
 * отчётов нельзя: выполненный рейс, не попавший в сводку, — это рейс, за
 * который не выставили счёт. Поэтому у таких берётся updated_at: он
 * заведомо не раньше закрытия, и это ближайшее к правде, что о них
 * известно.
 */
create or replace function app.closed_moment(p_order public.orders)
returns timestamptz
language sql
immutable
as $$
  select coalesce(p_order.closed_at, p_order.updated_at);
$$;

/*
 * Ставка комиссии рейса.
 *
 * У закрытых до появления колонки её нет. Подставляется действующая — и
 * это не то же самое, что переписать историю: ставка на платформе всегда
 * была одна, 3%, другой эти рейсы и не видели. Как только ставок станет
 * несколько, старые рейсы уже будут закрыты с записанной.
 */
create or replace function app.order_bps(p_order public.orders)
returns integer
language sql
stable
as $$
  select coalesce(p_order.commission_bps, app.current_commission_bps());
$$;

revoke all on function app.report_week(timestamptz) from public, anon, authenticated;
revoke all on function app.closed_moment(public.orders) from public, anon, authenticated;
revoke all on function app.order_bps(public.orders) from public, anon, authenticated;
grant execute on function app.report_week(timestamptz) to service_role;
grant execute on function app.closed_moment(public.orders) to service_role;
grant execute on function app.order_bps(public.orders) to service_role;


-- ── Выполненные рейсы ──────────────────────────────────────────────

/*
 * Выполненные рейсы того, кто спрашивает.
 *
 * Один список на три кабинета. Заказчику приходят его заказы без
 * компании-перевозчика, но с машиной: номер он видел ещё при выборе
 * отклика, и в накладной он тоже стоит. Перевозчику — его рейсы с
 * заказчиком и деньгами. Оператору — все и обе стороны.
 *
 * Точки и документы приезжают вложенным JSON, чтобы карточка
 * разворачивалась без второго запроса: список показывает главное, а
 * полное содержимое рейса нужно ровно тогда, когда его открыли, и лишний
 * поход в базу на каждое нажатие означал бы задержку там, где данные уже
 * посчитаны.
 */
create or replace function public.completed_orders(
  p_from date default null,
  p_to date default null
)
returns table (
  id uuid,
  ref text,
  shipper_ref text,
  closed_at timestamptz,
  week date,
  order_type public.order_type,
  trailer text,
  trailer_plate text,
  distance_km integer,
  rate_cents integer,
  commission_bps integer,
  commission_cents integer,
  payout_cents integer,
  shipper_name text,
  carrier_name text,
  vehicle_plate text,
  route_geometry text,
  route_bounds jsonb,
  stops jsonb,
  documents jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
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
    o.trailer,
    o.trailer_plate,
    o.distance_km,
    o.rate_cents,

    /* Ставка комиссии — только тем, кого она касается. */
    case when v_role <> 'SHIPPER' then app.order_bps(o) end,
    case when v_role <> 'SHIPPER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_role <> 'SHIPPER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,

    /* Заказчику своё имя ни к чему, а имя перевозчика — не положено. */
    case when v_role <> 'SHIPPER' then shipper.name end,
    case when v_role = 'ADMIN' then carrier.name end,
    v.plate,

    /* Линия и границы — чтобы развёрнутая карточка показала карту. */
    o.route_geometry,
    o.route_bounds,

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
$$;

comment on function public.completed_orders(date, date) is
  'Выполненные рейсы спрашивающего. Состав колонок решает роль: комиссия не выходит к заказчику (ТЗ §1, §11).';


-- ── Итого за неделю ────────────────────────────────────────────────

/*
 * Недельные итоги того, кто спрашивает (ТЗ §11).
 *
 * Суммируются уже округлённые числа рейсов: строка отчёта обязана
 * равняться строке счёта. Округли итог отдельно — и сумма перестанет
 * сходиться с составом, а спорить об этом будут живые люди с выпиской в
 * руках.
 */
create or replace function public.weekly_totals(p_weeks integer default 8)
returns table (
  week date,
  orders_count integer,
  distance_km bigint,
  rate_cents bigint,
  commission_cents bigint,
  payout_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.party_role;
  v_company uuid;
begin
  v_role := (select app.current_party_role());
  v_company := (select app.current_company_id());

  return query
  select
    app.report_week(app.closed_moment(o)) as w,
    count(*)::integer,
    sum(coalesce(o.distance_km, 0))::bigint,
    sum(coalesce(o.rate_cents, 0))::bigint,
    case when v_role <> 'SHIPPER'
      then sum(app.commission_cents(o.rate_cents, app.order_bps(o)))::bigint end,
    case when v_role <> 'SHIPPER'
      then sum(app.payout_cents(o.rate_cents, app.order_bps(o)))::bigint end
  from public.orders o
  where o.status = 'DONE'
    and (
      (v_role = 'SHIPPER' and o.shipper_company_id = v_company)
      or (v_role = 'CARRIER' and o.assigned_company_id = v_company)
      or v_role = 'ADMIN'
    )
  group by w
  order by w desc
  limit greatest(1, least(coalesce(p_weeks, 8), 104));
end;
$$;

comment on function public.weekly_totals(integer) is
  'Итого по неделям для спрашивающего. Суммы — из округлённых по рейсу, чтобы отчёт сходился со счётом.';


-- ── Сводка по контрагентам ─────────────────────────────────────────

/*
 * Кому выставлять счёт и кому платить (ТЗ §11).
 *
 * Заказчики и перевозчики одной таблицей, а не двумя функциями: числа
 * считаются из одних и тех же рейсов, и разъехаться двум запросам проще,
 * чем кажется. Различает их колонка party — она же говорит, какое из
 * чисел кому предъявляют: заказчику ставку, перевозчику выплату.
 *
 * Только оператору: это его учёт, и ни одной из сторон видеть чужие
 * обороты незачем.
 */
create or replace function public.partner_totals(
  p_from date default null,
  p_to date default null
)
returns table (
  party public.party_role,
  company_id uuid,
  company_name text,
  business_id text,
  orders_count integer,
  distance_km bigint,
  rate_cents bigint,
  commission_cents bigint,
  payout_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select app.is_admin()) then
    raise exception 'Сводка по контрагентам доступна только оператору.' using errcode = '42501';
  end if;

  return query
  with done as (
    select
      o.*,
      app.commission_cents(o.rate_cents, app.order_bps(o)) as commission,
      app.payout_cents(o.rate_cents, app.order_bps(o)) as payout
    from public.orders o
    where o.status = 'DONE'
      and (p_from is null or app.report_week(app.closed_moment(o)) >= p_from)
      and (p_to is null or app.report_week(app.closed_moment(o)) <= p_to)
  )
  select
    'SHIPPER'::public.party_role,
    c.id, c.name, c.business_id,
    count(*)::integer,
    sum(coalesce(d.distance_km, 0))::bigint,
    sum(coalesce(d.rate_cents, 0))::bigint,
    sum(d.commission)::bigint,
    sum(d.payout)::bigint
  from done d
  join public.companies c on c.id = d.shipper_company_id
  group by c.id, c.name, c.business_id

  union all

  select
    'CARRIER'::public.party_role,
    c.id, c.name, c.business_id,
    count(*)::integer,
    sum(coalesce(d.distance_km, 0))::bigint,
    sum(coalesce(d.rate_cents, 0))::bigint,
    sum(d.commission)::bigint,
    sum(d.payout)::bigint
  from done d
  join public.companies c on c.id = d.assigned_company_id
  group by c.id, c.name, c.business_id

  order by 1, 7 desc;
end;
$$;

comment on function public.partner_totals(date, date) is
  'Сводка оператора: кому выставлять счёт и кому платить за период (ТЗ §11).';

revoke all on function public.completed_orders(date, date) from public, anon;
revoke all on function public.weekly_totals(integer) from public, anon;
revoke all on function public.partner_totals(date, date) from public, anon;
grant execute on function public.completed_orders(date, date) to authenticated, service_role;
grant execute on function public.weekly_totals(integer) to authenticated, service_role;
grant execute on function public.partner_totals(date, date) to authenticated, service_role;
