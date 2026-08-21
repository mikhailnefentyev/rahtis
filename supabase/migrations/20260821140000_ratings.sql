-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · Этап 7 · оценки перевозчиков (ТЗ §10)
--
-- После закрытого рейса заказчик ставит оценку 1–5. Она пишется на
-- компанию-перевозчика, показывается при выборе из откликов и по ней
-- отклики сортируются — то есть оценка это не украшение профиля, а то,
-- из чего складывается следующий заказ.
--
-- Оценка привязана к рейсу, а не к компании. Одна на рейс — первичный
-- ключ по order_id, — потому что оценивают работу, а не настроение: без
-- этого один недовольный заказчик мог бы поставить десять единиц по
-- одному рейсу. Средняя при этом нигде не хранится, а считается: пока
-- рейсов тысячи, это дешевле, чем кэш, который однажды разойдётся с
-- фактами и об этом никто не узнает.
--
-- Изменить свою оценку можно. Промах по звезде неизбежен, а оценка,
-- которую нельзя поправить, заставляет звонить оператору — тому самому,
-- от звонков которому платформа и избавляет.
--
-- Заказчик не знает, какую компанию он оценивает: его контрагент —
-- Aivomaa (ТЗ §1), а в откликах перевозчики обезличены. Он оценивает
-- рейс, а платформа знает, чей он. Поэтому компания в записи — снимок,
-- проставленный функцией, а не то, что прислал клиент.
-- ═══════════════════════════════════════════════════════════════════

create table public.order_ratings (
  /* Одна оценка на рейс: оценивают работу, а не сколько-то раз подряд. */
  order_id uuid primary key references public.orders (id) on delete cascade,

  /*
   * Кого оценили и кто оценил — снимком. Средняя считается группировкой
   * по перевозчику, и join к заказам ради одной колонки был бы лишним;
   * заодно запись читается сама по себе при разборе жалобы.
   */
  carrier_company_id uuid not null references public.companies (id) on delete cascade,
  shipper_company_id uuid not null references public.companies (id) on delete cascade,

  score smallint not null,
  comment text,

  rated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_ratings_score_range check (score between 1 and 5),

  constraint order_ratings_comment_length
    check (comment is null or length(btrim(comment)) between 3 and 2000)
);

comment on table public.order_ratings is
  'Оценка перевозчика за рейс, 1–5 (ТЗ §10). Средняя считается, а не хранится.';
comment on column public.order_ratings.carrier_company_id is
  'Кого оценили. Снимок: заказчик компанию-перевозчика не знает и прислать её не может.';

create index order_ratings_carrier_idx on public.order_ratings (carrier_company_id);

create trigger order_ratings_touch_updated_at
  before update on public.order_ratings
  for each row execute function app.touch_updated_at();


-- ── Права и RLS ────────────────────────────────────────────────────

alter table public.order_ratings enable row level security;
revoke all on public.order_ratings from anon, authenticated;
grant select on public.order_ratings to authenticated;

/*
 * Читают обе стороны рейса: заказчик — что поставил, перевозчик — что
 * получил и с каким комментарием. Записи через политику нет ни у кого:
 * оценку ставит функция, которая проверяет, что рейс закрыт и что он
 * заказчика.
 */
create policy order_ratings_select_party
  on public.order_ratings for select to authenticated
  using ((select app.party_to_order(order_id)));


-- ── Средняя оценка компании ────────────────────────────────────────

/*
 * Средняя и число оценок перевозчика.
 *
 * security definer обязателен: средняя считается по всем оценкам
 * компании, а заказчик по RLS видит только свои. Считать её из того, что
 * видно спрашивающему, значило бы показывать каждому свою среднюю — и
 * первый же разговор двух заказчиков об одном перевозчике кончился бы
 * вопросом, кто из них видит правду.
 *
 * Округление до одного знака: интерфейс показывает 4,7, и отдавать ему
 * 4,6666 значит оставить округление на усмотрение того, кто рисует.
 */
create or replace function app.company_rating(p_company_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(score)::numeric, 1)
  from public.order_ratings
  where carrier_company_id = p_company_id;
$$;

create or replace function app.company_ratings_count(p_company_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.order_ratings
  where carrier_company_id = p_company_id;
$$;

revoke all on function app.company_rating(uuid) from public, anon, authenticated;
revoke all on function app.company_ratings_count(uuid) from public, anon, authenticated;
grant execute on function app.company_rating(uuid) to service_role;
grant execute on function app.company_ratings_count(uuid) to service_role;


-- ── Оценить рейс ───────────────────────────────────────────────────

/*
 * Оценку ставит заказчик закрытого рейса.
 *
 * Компанию-перевозчика подставляет сама функция из заказа: заказчик её
 * не знает и знать не должен. Повторный вызов заменяет свою же оценку —
 * промах по звезде исправляется на месте, а не звонком оператору.
 */
create or replace function public.rate_order(
  p_order_id uuid,
  p_score smallint,
  p_comment text default null
)
returns public.order_ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_rating public.order_ratings;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Заказ не найден.' using errcode = 'P0002';
  end if;

  if not (
    v_order.shipper_company_id = (select app.current_company_id())
    or (select app.is_admin())
  ) then
    raise exception 'Оценить рейс может только его заказчик.' using errcode = '42501';
  end if;

  if v_order.status <> 'DONE' then
    raise exception 'Оценка ставится после закрытия рейса, текущий статус: %.', v_order.status
      using errcode = '55000';
  end if;

  if v_order.assigned_company_id is null then
    raise exception 'У рейса нет перевозчика — оценивать некого.' using errcode = '55000';
  end if;

  if p_score is null or p_score not between 1 and 5 then
    raise exception 'Оценка ставится по шкале от 1 до 5.' using errcode = '22023';
  end if;

  insert into public.order_ratings (
    order_id, carrier_company_id, shipper_company_id, score, comment, rated_by
  )
  values (
    p_order_id,
    v_order.assigned_company_id,
    v_order.shipper_company_id,
    p_score,
    nullif(btrim(coalesce(p_comment, '')), ''),
    (select auth.uid())
  )
  on conflict (order_id) do update
    set score = excluded.score,
        comment = excluded.comment,
        rated_by = excluded.rated_by
  returning * into v_rating;

  return v_rating;
end;
$$;

comment on function public.rate_order(uuid, smallint, text) is
  'Оценка перевозчика за закрытый рейс, 1–5 (ТЗ §10). Повторный вызов заменяет свою оценку.';


-- ── Своя оценка перевозчику и оператору ────────────────────────────

/*
 * Средняя оценка компании для показа в кабинете.
 *
 * Перевозчик спрашивает про себя, оператор — про кого угодно. Заказчику
 * этот вход не нужен: он видит оценки в откликах, где перевозчики
 * обезличены, и возможность спросить «а какая средняя у компании X»
 * ломала бы обезличивание.
 */
create or replace function public.carrier_rating(p_company_id uuid default null)
returns table (score numeric, ratings_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company uuid;
begin
  v_company := coalesce(p_company_id, (select app.current_company_id()));

  if not (
    (v_company = (select app.current_company_id())
      and (select app.current_party_role()) = 'CARRIER')
    or (select app.is_admin())
  ) then
    raise exception 'Оценки компании видны ей самой и оператору.' using errcode = '42501';
  end if;

  return query
  select app.company_rating(v_company), app.company_ratings_count(v_company);
end;
$$;

comment on function public.carrier_rating(uuid) is
  'Средняя оценка компании и число оценок. Своя — перевозчику, любая — оператору.';


-- ── Отклики: оценка появляется и начинает сортировать ──────────────

/*
 * Рейтинг перестаёт быть заглушкой, и отклики выстраиваются по нему
 * (ТЗ §6, §10): заказчик выбирает из трёх обезличенных вариантов, и
 * единственное, что говорит ему о качестве работы, — это оценка.
 *
 * Номер варианта считается по-прежнему по времени отклика: «Вариант 2»
 * должен означать одну и ту же машину при любой сортировке, иначе
 * заказчик, вернувшийся на страницу, выберет не того, кого выбирал.
 */
create or replace function public.offers_for_shipper(p_order_ids uuid[])
returns table (
  order_id uuid,
  offer_id uuid,
  variant_no smallint,
  rating numeric,
  make text,
  axles smallint,
  euro_class public.euro_class,
  base_city text,
  languages text[],
  plate text,
  driver_name text,
  is_chosen boolean,
  is_assigned boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_is_admin boolean;
begin
  v_company_id := (select app.current_company_id());
  v_is_admin := (select app.is_admin());

  return query
  with claims as (
    select f.order_id, f.vehicle_id, f.id as offer_id, f.created_at, 0 as prio
    from public.order_offers f
    where f.order_id = any(p_order_ids)

    union all

    select o.id, o.assigned_vehicle_id, o.chosen_offer_id, o.updated_at, 1
    from public.orders o
    where o.id = any(p_order_ids)
      and o.assigned_vehicle_id is not null
  ),
  claim as (
    select distinct on (c.order_id, c.vehicle_id) c.*
    from claims c
    order by c.order_id, c.vehicle_id, c.prio
  ),
  numbered as (
    select
      claim.*,
      row_number() over (partition by claim.order_id order by claim.created_at)::smallint as pos
    from claim
  )
  select
    n.order_id,
    n.offer_id,
    n.pos,
    app.company_rating(v.company_id),
    v.make,
    v.axles,
    v.euro_class,
    v.base_city,
    v.languages,
    case when o.assigned_vehicle_id is not distinct from n.vehicle_id then v.plate end,
    case when o.assigned_vehicle_id is not distinct from n.vehicle_id then v.driver_name end,
    o.chosen_offer_id is not distinct from n.offer_id,
    o.assigned_vehicle_id is not distinct from n.vehicle_id,
    n.created_at
  from numbered n
  join public.orders o on o.id = n.order_id
  join public.vehicles v on v.id = n.vehicle_id
  where v_is_admin or o.shipper_company_id = v_company_id
  /* Без оценок — в конец: новичок не должен вытеснять проверенного. */
  order by n.order_id, app.company_rating(v.company_id) desc nulls last, n.created_at;
end;
$$;

comment on function public.offers_for_shipper(uuid[]) is
  'Отклики глазами заказчика: без компании-перевозчика, отсортированы по оценке (ТЗ §6, §10).';


-- ── Выполненные рейсы: своя оценка рядом с рейсом ──────────────────

/*
 * К списку выполненных добавляется оценка: заказчику — чтобы поставить
 * или поправить, перевозчику — чтобы увидеть, что о рейсе сказали.
 *
 * can_rate решает база, а не интерфейс. Тот же приём, что и с колонками
 * денег: право поставить оценку зависит от роли и от того, есть ли у
 * рейса перевозчик, и держать это условие в разметке значило бы завести
 * второе место, где оно решается.
 */
drop function if exists public.completed_orders(date, date);

create function public.completed_orders(
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
  rating_score smallint,
  rating_comment text,
  can_rate boolean,
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

    case when v_role <> 'SHIPPER' then app.order_bps(o) end,
    case when v_role <> 'SHIPPER'
      then app.commission_cents(o.rate_cents, app.order_bps(o)) end,
    case when v_role <> 'SHIPPER'
      then app.payout_cents(o.rate_cents, app.order_bps(o)) end,

    case when v_role <> 'SHIPPER' then shipper.name end,
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
$$;

comment on function public.completed_orders(date, date) is
  'Выполненные рейсы спрашивающего с оценкой. Состав колонок решает роль (ТЗ §1, §10, §11).';


-- ── Сводка оператора: оценка рядом с деньгами ──────────────────────

/*
 * Оператору оценка нужна там же, где выплаты: решение «кому давать
 * больше заказов» принимается по обоим числам сразу, а не по двум
 * экранам.
 */
drop function if exists public.partner_totals(date, date);

create function public.partner_totals(
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
  payout_cents bigint,
  rating numeric,
  ratings_count integer
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
    sum(d.payout)::bigint,
    /* Заказчиков не оценивают: обратная оценка — отдельный разговор. */
    null::numeric,
    null::integer
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
    sum(d.payout)::bigint,
    app.company_rating(c.id),
    app.company_ratings_count(c.id)
  from done d
  join public.companies c on c.id = d.assigned_company_id
  group by c.id, c.name, c.business_id

  order by 1, 7 desc;
end;
$$;

comment on function public.partner_totals(date, date) is
  'Сводка оператора: счета, выплаты и оценка перевозчика за период (ТЗ §10, §11).';

revoke all on function public.rate_order(uuid, smallint, text) from public, anon;
revoke all on function public.carrier_rating(uuid) from public, anon;
revoke all on function public.completed_orders(date, date) from public, anon;
revoke all on function public.partner_totals(date, date) from public, anon;
grant execute on function public.rate_order(uuid, smallint, text) to authenticated, service_role;
grant execute on function public.carrier_rating(uuid) to authenticated, service_role;
grant execute on function public.completed_orders(date, date) to authenticated, service_role;
grant execute on function public.partner_totals(date, date) to authenticated, service_role;
