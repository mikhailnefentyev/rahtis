-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · обратный груз и «Kuormavahti» (3.11.2026)
--
-- 1. backhaul_suggestions — где и когда машина перевозчика освободится
--    (последняя точка её закреплённого рейса + час, без рейса — свежая
--    точка GPS) и какие заказы стола рядом. Видимость стола не
--    повторяется: кандидаты берутся из самой desk_orders, а годность
--    машины — теми же app.vehicle_fits_haul / app.vehicle_meets_requirements,
--    что у take_order.
-- 2. lane_watches — подписки перевозчика на направления (до 20 на
--    компанию). При выходе заказа на стол подходящие подписки получают
--    уведомление в кабинет (код lane.match), по одному на заказ и
--    компанию (lane_watch_hits); почтовый дубль — из Next, по флажку
--    подписки.
-- 3. admin_lane_demand — направления с числом подписок и совпадений:
--    сигнал спроса для оператора.
-- Геокодера нет: точки подписки — города, которые уже есть в RAHTIS
-- (lane_places), координаты стола — те, что у точек заказов.
-- ═══════════════════════════════════════════════════════════════════

-- ── Километры по гаверсинусу ───────────────────────────────────────

create or replace function app.km_between(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select app.metres_between(p_lat1, p_lon1, p_lat2, p_lon2) / 1000.0;
$$;

revoke all on function app.km_between(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function app.km_between(double precision, double precision, double precision, double precision) to authenticated, service_role;


-- ── Обратный груз ──────────────────────────────────────────────────

/*
 * Машина освобождается в последней точке своего закреплённого рейса (если
 * их несколько — того, что кончается позже всех): по оценке прибытия, а
 * без неё — по плановому времени точки, плюс час на выгрузку. Без
 * закреплённого рейса — там, где её видел GPS за последние полчаса, и
 * сейчас. Время — местное (Хельсинки), как плановое время точек.
 *
 * Кандидаты — только из desk_orders: то, что перевозчику не открыто,
 * сюда попасть не может. Расстояние до забора — по точным координатам,
 * но округлено до 5 км, а координаты наружу не отдаются (стол их сам
 * округляет).
 *
 * «Kohti kotia» — доставка приближает машину к её базе (vehicles.base_*)
 * хотя бы на 25 км. Ранжирование: порожний пробег до забора минус
 * половина выигрыша к дому (не больше 100 км поблажки).
 */
create or replace function public.backhaul_suggestions(p_radius_km integer default 75)
returns table(
  vehicle_id uuid,
  plate text,
  free_source text,
  after_ref text,
  free_city text,
  free_date date,
  free_time time without time zone,
  total_count integer,
  order_id uuid,
  ref text,
  haul_kind public.haul_kind,
  pickup_city text,
  pickup_date date,
  pickup_time time without time zone,
  finish_city text,
  rate_cents integer,
  distance_km integer,
  deadhead_km integer,
  toward_home boolean,
  desk_contract public.contract_party
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_company uuid;
  v_radius integer := greatest(10, least(coalesce(p_radius_km, 75), 300));
  v_now timestamp := (now() at time zone 'Europe/Helsinki');
begin
  if (select app.current_party_role()) is distinct from 'CARRIER' then
    raise exception 'Paluukuorma on vain kuljetusliikkeelle.' using errcode = '42501';
  end if;

  v_company := (select app.current_company_id());

  return query
  with desk as (
    select d.id from public.desk_orders(null, 500) d where not d.taken_by_me
  ),
  busy as (
    select distinct on (o.assigned_vehicle_id)
      o.assigned_vehicle_id as vid,
      o.ref as oref,
      s.city,
      s.lat,
      s.lon,
      coalesce(
        s.eta_at at time zone 'Europe/Helsinki',
        s.scheduled_date + coalesce(s.scheduled_time, time '16:00')
      ) + interval '1 hour' as free_local
    from public.orders o
    join lateral (
      select x.* from public.order_stops x where x.order_id = o.id order by x.sequence desc limit 1
    ) s on true
    where o.assigned_company_id = v_company
      and o.assigned_vehicle_id is not null
      and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
      and s.lat is not null and s.lon is not null
    order by o.assigned_vehicle_id, free_local desc nulls last
  ),
  gps as (
    select distinct on (g.vehicle_id) g.vehicle_id as vid, g.lat, g.lon
    from public.gps_units g
    where g.company_id = v_company
      and g.vehicle_id is not null
      and g.lat is not null and g.lon is not null
      and g.position_at > now() - interval '30 minutes'
    order by g.vehicle_id, g.position_at desc
  ),
  freept as (
    select
      v.id as vid,
      v.plate as vplate,
      v.vehicle_class,
      v.base_lat,
      v.base_lon,
      case when b.vid is not null then 'ORDER' else 'GPS' end as src,
      b.oref,
      b.city as fcity,
      coalesce(b.lat, g.lat) as lat,
      coalesce(b.lon, g.lon) as lon,
      greatest(coalesce(b.free_local, v_now), v_now) as free_local
    from public.vehicles v
    left join busy b on b.vid = v.id
    left join gps g on g.vid = v.id
    where v.company_id = v_company
      and v.access = 'APPROVED'
      and (b.vid is not null or g.vid is not null)
  ),
  cand as (
    select
      f.vid,
      o.id as oid,
      o.ref as oref,
      o.haul_kind as okind,
      p.city as pcity,
      p.scheduled_date as pdate,
      p.scheduled_time as ptime,
      coalesce(e.city, p.city) as ecity,
      o.rate_cents as orate,
      o.distance_km as odist,
      o.desk_contract as ocontract,
      app.km_between(f.lat, f.lon, p.lat, p.lon) as dead,
      case
        when f.base_lat is not null and f.base_lon is not null and e.lat is not null and e.lon is not null then
          app.km_between(p.lat, p.lon, f.base_lat, f.base_lon) - app.km_between(e.lat, e.lon, f.base_lat, f.base_lon)
      end as home_gain
    from freept f
    cross join desk d
    join public.orders o on o.id = d.id and o.status = 'OPEN'
    join public.order_stops p on p.order_id = o.id and p.role = 'PICKUP'
    left join lateral app.route_end(o.id) e on true
    where p.lat is not null and p.lon is not null
      and app.km_between(f.lat, f.lon, p.lat, p.lon) <= v_radius
      and (p.scheduled_date is null
           or p.scheduled_date + coalesce(p.scheduled_time, time '23:59') >= f.free_local)
      and (p.scheduled_date is null or p.scheduled_date <= (f.free_local + interval '3 days')::date)
      /* Окно группы — только машинам группы. */
      and (o.group_until is null or o.group_until <= now() or f.vid = any (o.group_vehicle_ids))
      /* Годность машины — как у отклика (take_order). Тягач с требованиями к кузову отвечает сцепкой. */
      and app.vehicle_fits_haul(f.vid, o.haul_kind, o.container_feet, o.ldm,
            case when o.haul_kind = 'TIPPER' then array[o.tipper_config] else o.semi_features end)
      and (f.vehicle_class = 'TRACTOR' or app.vehicle_meets_requirements(f.vid, o) is null)
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        partition by c.vid
        order by c.dead - 0.5 * least(greatest(coalesce(c.home_gain, 0), 0), 200), c.pdate nulls last, c.oref
      ) as rn,
      count(*) over (partition by c.vid) as cnt
    from cand c
  )
  select
    f.vid,
    f.vplate,
    f.src,
    f.oref,
    f.fcity,
    f.free_local::date,
    date_trunc('minute', f.free_local)::time,
    coalesce(r.cnt, 0)::integer,
    r.oid,
    r.oref,
    r.okind,
    r.pcity,
    r.pdate,
    r.ptime,
    r.ecity,
    r.orate,
    r.odist,
    case when r.oid is not null then (round(r.dead / 5) * 5)::integer end,
    coalesce(r.home_gain >= 25, false),
    r.ocontract
  from freept f
  left join ranked r on r.vid = f.vid and r.rn <= 5
  order by f.free_local, f.vplate, r.rn;
end;
$$;

comment on function public.backhaul_suggestions(integer) is
  'Paluukuorma: где и когда освобождается каждая машина перевозчика и до пяти заказов стола рядом с этой точкой (только из desk_orders).';

revoke all on function public.backhaul_suggestions(integer) from public, anon;
grant execute on function public.backhaul_suggestions(integer) to authenticated;


-- ── Kuormavahti: подписки на направления ───────────────────────────

create table public.lane_watches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  from_city text not null check (length(btrim(from_city)) between 1 and 80),
  from_lat double precision not null,
  from_lon double precision not null,
  from_radius_km smallint not null default 75 check (from_radius_km in (25, 50, 75, 150)),
  to_city text check (to_city is null or length(btrim(to_city)) between 1 and 80),
  to_lat double precision,
  to_lon double precision,
  to_radius_km smallint check (to_radius_km is null or to_radius_km in (25, 50, 75, 150)),
  haul_kind public.haul_kind,
  date_from date,
  date_to date,
  notify_email boolean not null default true,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  constraint lane_watches_to_complete check (
    (to_city is null and to_lat is null and to_lon is null and to_radius_km is null)
    or (to_city is not null and to_lat is not null and to_lon is not null and to_radius_km is not null)
  ),
  constraint lane_watches_dates check (date_from is null or date_to is null or date_to >= date_from)
);

comment on table public.lane_watches is
  'Kuormavahti: направления, о новых заказах на которых перевозчик хочет знать. До 20 на компанию.';

create index lane_watches_company on public.lane_watches (company_id);
create index lane_watches_active on public.lane_watches (active) where active;

/* До двадцати на компанию. Строка компании блокируется, чтобы два запроса разом не обошли счёт. */
create or replace function app.lane_watch_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.companies where id = new.company_id for update;
  if (select count(*) from public.lane_watches where company_id = new.company_id) >= 20 then
    raise exception 'Kuormavahteja voi olla enintään 20.' using errcode = '54000';
  end if;
  return new;
end;
$$;

revoke all on function app.lane_watch_limit() from public, anon, authenticated;

create trigger lane_watches_limit
  before insert on public.lane_watches
  for each row execute function app.lane_watch_limit();

alter table public.lane_watches enable row level security;

create policy lane_watches_own
  on public.lane_watches for all to authenticated
  using (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER')
  with check (company_id = (select app.current_company_id()) and (select app.current_party_role()) = 'CARRIER');

create policy lane_watches_admin
  on public.lane_watches for select to authenticated using ((select app.is_admin()));

grant select, insert, update, delete on public.lane_watches to authenticated;


/* Совпадения: одно на заказ и компанию — это и защита от повторов, и счётчик для оператора. */
create table public.lane_watch_hits (
  order_id uuid not null references public.orders (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  watch_id uuid references public.lane_watches (id) on delete set null,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  primary key (order_id, company_id)
);

comment on table public.lane_watch_hits is
  'Заказ совпал с подпиской Kuormavahti компании: уведомление ушло один раз; emailed_at — почтовый дубль.';

create index lane_watch_hits_watch on public.lane_watch_hits (watch_id);
create index lane_watch_hits_created on public.lane_watch_hits (created_at);

alter table public.lane_watch_hits enable row level security;

create policy lane_watch_hits_own
  on public.lane_watch_hits for select to authenticated
  using (company_id = (select app.current_company_id()));

create policy lane_watch_hits_admin
  on public.lane_watch_hits for select to authenticated using ((select app.is_admin()));

grant select on public.lane_watch_hits to authenticated;


-- ── Города для подписки ────────────────────────────────────────────

/*
 * Только места, которые RAHTIS уже знает: города точек заказов (не меньше
 * двух разных заказов — единичная точка могла бы выдать чужой рейс) и
 * базы своих машин. Координата — среднее по городу, три знака.
 */
create or replace function public.lane_places()
returns table(city text, country text, lat double precision, lon double precision, uses integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if coalesce((select app.current_party_role()) in ('CARRIER', 'ADMIN'), false) is false then
    raise exception 'Ei oikeutta.' using errcode = '42501';
  end if;

  return query
  with pts as (
    select btrim(s.city) as c, s.country as cc, s.lat as la, s.lon as lo, s.order_id::text as k
    from public.order_stops s
    where s.lat is not null and s.lon is not null and btrim(coalesce(s.city, '')) <> ''
    union all
    select btrim(v.base_city), v.base_country, v.base_lat, v.base_lon, 'v' || v.id::text
    from public.vehicles v
    where v.company_id = (select app.current_company_id())
      and v.base_lat is not null and v.base_lon is not null and btrim(coalesce(v.base_city, '')) <> ''
  )
  select
    min(p.c),
    max(p.cc),
    round(avg(p.la)::numeric, 3)::double precision,
    round(avg(p.lo)::numeric, 3)::double precision,
    count(distinct p.k)::integer
  from pts p
  group by lower(p.c)
  having count(distinct p.k) >= 2 or bool_or(p.k like 'v%')
  order by count(distinct p.k) desc, min(p.c)
  limit 500;
end;
$$;

revoke all on function public.lane_places() from public, anon;
grant execute on function public.lane_places() to authenticated;


-- ── Совпадение заказа с подписками ─────────────────────────────────

/*
 * Кто получает: компания-перевозчик, которой заказ открыт на столе (те же
 * проверки, что в desk_orders: допущенная машина, ветка, «мир», окно
 * группы, стол «напрямую»), и у которой есть действующая подписка:
 * забор в радиусе «откуда», конец маршрута в радиусе «куда» (если задан),
 * вид перевозки и даты (если заданы). Точка без координаты сверяется по
 * названию города. Заказчик в уведомлении не называется.
 */
create or replace function app.notify_lane_watches(p_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with hits as (
    insert into public.lane_watch_hits (order_id, company_id, watch_id)
    select distinct on (w.company_id) o.id, w.company_id, w.id
    from public.orders o
    join public.order_stops p on p.order_id = o.id and p.role = 'PICKUP'
    left join lateral app.route_end(o.id) e on true
    join public.lane_watches w on w.active
    join public.companies c on c.id = w.company_id
    where o.id = p_order_id
      and o.status = 'OPEN'
      and c.kind = 'CARRIER'
      and c.status = 'ACTIVE'
      and c.frozen_at is null
      and c.client_of is null
      and c.id is distinct from o.shipper_company_id
      and app.has_dispatchable_vehicle(c.id)
      and app.has_vehicle_for_haul(c.id, o.haul_kind)
      and app.same_world(o.shipper_company_id, c.id)
      and app.group_sees(o.group_vehicle_ids, o.group_until, c.id)
      and app.desk_contract_allows(o.desk_contract, c.id)
      and (w.haul_kind is null or w.haul_kind = o.haul_kind)
      and (w.date_to is null or w.date_to >= current_date)
      and (w.date_from is null or p.scheduled_date is null or p.scheduled_date >= w.date_from)
      and (w.date_to is null or p.scheduled_date is null or p.scheduled_date <= w.date_to)
      and (
        (p.lat is not null and p.lon is not null
          and app.km_between(p.lat, p.lon, w.from_lat, w.from_lon) <= w.from_radius_km)
        or ((p.lat is null or p.lon is null) and lower(btrim(p.city)) = lower(btrim(w.from_city)))
      )
      and (
        w.to_lat is null
        or (e.lat is not null and e.lon is not null
          and app.km_between(e.lat, e.lon, w.to_lat, w.to_lon) <= w.to_radius_km)
        or ((e.lat is null or e.lon is null) and lower(btrim(coalesce(e.city, ''))) = lower(btrim(w.to_city)))
      )
    order by w.company_id, w.created_at
    on conflict (order_id, company_id) do nothing
    returning company_id, watch_id
  ), sent as (
    insert into public.notifications (company_id, kind, code, params, link)
    select
      h.company_id,
      'ORDER',
      'lane.match',
      jsonb_build_object(
        'lane', w.from_city || coalesce(' → ' || w.to_city, ''),
        'ref', o.ref,
        'from', coalesce(p.city, ''),
        'to', coalesce(e.city, p.city, '')
      ),
      '/carrier/desk'
    from hits h
    join public.lane_watches w on w.id = h.watch_id
    join public.orders o on o.id = p_order_id
    left join public.order_stops p on p.order_id = o.id and p.role = 'PICKUP'
    left join lateral app.route_end(o.id) e on true
    returning 1
  )
  select count(*) into v_count from sent;

  return v_count;
end;
$$;

revoke all on function app.notify_lane_watches(uuid) from public, anon, authenticated;

/*
 * Когда: заказ стал OPEN (первая публикация, откат прямого назначения,
 * возврат на стол) или закрылось окно группы. Повторов нет — их держит
 * первичный ключ lane_watch_hits. Вставка заказа сюда не входит: точек у
 * него в этот момент ещё нет, публикация — это смена статуса.
 */
create or replace function app.on_order_lane_watch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'OPEN'
     and (old.status is distinct from 'OPEN'
          or (new.group_released_at is not null and old.group_released_at is null)) then
    perform app.notify_lane_watches(new.id);
  end if;
  return new;
end;
$$;

revoke all on function app.on_order_lane_watch() from public, anon, authenticated;

create trigger orders_lane_watch
  after update of status, group_released_at on public.orders
  for each row execute function app.on_order_lane_watch();


-- ── Почтовый дубль ─────────────────────────────────────────────────

/*
 * Кому из совпавших ещё не писали и кто письма хочет. Отметка ставится в
 * том же запросе — второй вызов того же заказа писем не повторит.
 */
create or replace function public.lane_watch_take_recipients(p_order_id uuid)
returns table(company_id uuid, company_name text, contact_email text, language text, lane text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    update public.lane_watch_hits h
    set emailed_at = now()
    from public.lane_watches w
    where h.order_id = p_order_id
      and h.emailed_at is null
      and w.id = h.watch_id
      and w.notify_email
    returning h.company_id, w.from_city || coalesce(' → ' || w.to_city, '') as lane
  )
  select c.id, c.name, c.contact_email, c.language::text, d.lane
  from due d
  join public.companies c on c.id = d.company_id
  where coalesce(c.contact_email, '') <> '';
$$;

revoke all on function public.lane_watch_take_recipients(uuid) from public, anon, authenticated;
grant execute on function public.lane_watch_take_recipients(uuid) to service_role;


-- ── Спрос по направлениям (оператор) ───────────────────────────────

create or replace function public.admin_lane_demand()
returns table(
  from_city text,
  to_city text,
  haul_kind public.haul_kind,
  watches integer,
  companies integer,
  hits_30d integer,
  last_created timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not (select app.is_admin()) then
    raise exception 'Vain ylläpidolle.' using errcode = '42501';
  end if;

  return query
  with g as (
    select
      min(w.from_city) as fc,
      min(w.to_city) as tc,
      w.haul_kind as hk,
      count(*)::integer as n,
      count(distinct w.company_id)::integer as cn,
      max(w.created_at) as lc,
      array_agg(w.id) as ids
    from public.lane_watches w
    join public.companies c on c.id = w.company_id
    where w.active and not c.is_test
    group by lower(w.from_city), lower(coalesce(w.to_city, '')), w.haul_kind
  )
  select
    g.fc,
    g.tc,
    g.hk,
    g.n,
    g.cn,
    (
      select count(*)::integer
      from public.lane_watch_hits h
      where h.watch_id = any (g.ids)
        and h.created_at > now() - interval '30 days'
    ),
    g.lc
  from g
  order by g.cn desc, g.n desc, g.fc;
end;
$$;

revoke all on function public.admin_lane_demand() from public, anon;
grant execute on function public.admin_lane_demand() to authenticated;
