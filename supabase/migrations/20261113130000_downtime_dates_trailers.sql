-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · машина вне работы, доработка (13.11.2026)
--
-- Три пробела этапа 2 (20261113120000_vehicle_downtime):
--
-- 1. Даты. Сервис с датой окончания больше не снимает машину целиком:
--    он не даёт брать заказы, которые попадают на эти дни (пересечение
--    дат точек заказа с периодом). Пока машина два дня в мастерской, на
--    неё можно взять рейс на следующую неделю. Целиком блокируют только
--    бессрочные причины: дефект «ехать нельзя», просроченный katsastus,
--    сервис без даты окончания — их по-прежнему держит
--    app.vehicle_is_dispatchable.
--    Проверка по датам встроена в два общих помощника, через которые
--    уже идут все пути: app.vehicle_meets_requirements (отклик машиной,
--    прямой заказ, свои рейсы, группа, сборный груз, подбор на столе и
--    обратный груз) и app.combo_fit_reason (отклик сцепкой).
--
-- 2. Прицепы. Дефект «ехать нельзя» на прицепе и сервис прицепа ставят
--    его вне работы; сцепка с таким прицепом заказ не возьмёт.
--
-- 3. Уже назначенные рейсы. public.fleet_downtime_orders — рейсы машины
--    или прицепа, попадающие на период вне работы; кабинет и
--    уведомления показывают их перевозчику. Сами рейсы не снимаются —
--    решение за перевозчиком.
--
-- Текст отказа начинается с «Вне работы»: по нему сайт показывает
-- перевозчику понятную причину (src/lib/maintenance/conflict.ts).
-- ═══════════════════════════════════════════════════════════════════

-- ── Прицепы в таблице вне работы ──────────────────────────────────

alter table public.vehicle_downtime alter column vehicle_id drop not null;
alter table public.vehicle_downtime add column trailer_id uuid references public.trailers (id) on delete cascade;
alter table public.vehicle_downtime
  add constraint vehicle_downtime_asset check (num_nonnulls(vehicle_id, trailer_id) = 1);

create index vehicle_downtime_trailer_idx on public.vehicle_downtime (trailer_id) where ended_at is null and trailer_id is not null;

create or replace function app.vehicle_downtime_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.vehicle_id is not null
     and not exists (select 1 from public.vehicles where id = new.vehicle_id and company_id = new.company_id) then
    raise exception 'Машина другой компании.' using errcode = '42501';
  end if;
  if new.trailer_id is not null
     and not exists (select 1 from public.trailers where id = new.trailer_id and company_id = new.company_id) then
    raise exception 'Прицеп другой компании.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger vehicle_downtime_check on public.vehicle_downtime;
create trigger vehicle_downtime_check
  before insert or update of vehicle_id, trailer_id, company_id on public.vehicle_downtime
  for each row execute function app.vehicle_downtime_check();

grant insert (trailer_id) on public.vehicle_downtime to authenticated;

-- ── Целиком вне работы — только бессрочно ─────────────────────────

/* Бессрочная причина, действующая сегодня. Сервис по датам проверяется по датам заказа. */
create or replace function app.vehicle_in_service(p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicle_downtime d
    where d.vehicle_id = p_vehicle_id
      and d.ended_at is null
      and d.ends_on is null
      and d.starts_on <= (now() at time zone 'Europe/Helsinki')::date
  );
$$;

-- ── Пересечение с датами заказа ───────────────────────────────────

/*
 * Дни заказа: от первой до последней запланированной даты точек. Без
 * дат — сегодня и до срока заказа (deadline_at), если он есть.
 */
create or replace function app.order_day_range(p_order public.orders)
returns table (first_day date, last_day date)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select min(scheduled_date) as d1, max(scheduled_date) as d2
    from public.order_stops where order_id = p_order.id
  ), today as (
    select (now() at time zone 'Europe/Helsinki')::date as d
  )
  select
    coalesce(s.d1, today.d),
    coalesce(s.d2, greatest(coalesce(s.d1, today.d), coalesce((p_order.deadline_at at time zone 'Europe/Helsinki')::date, today.d)))
  from s, today;
$$;

revoke all on function app.order_day_range(public.orders) from public, anon, authenticated;

/* Причина отказа, если машина или прицеп вне работы в дни заказа; иначе null. */
create or replace function app.asset_order_conflict(p_vehicle_id uuid, p_trailer_id uuid, p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when d.trailer_id is not null then 'Вне работы: прицеп не работает в дни заказа.'
    else 'Вне работы: машина не работает в дни заказа.'
  end
  from public.vehicle_downtime d, app.order_day_range(p_order) r
  where d.ended_at is null
    and ((p_vehicle_id is not null and d.vehicle_id = p_vehicle_id)
      or (p_trailer_id is not null and d.trailer_id = p_trailer_id))
    and d.starts_on <= r.last_day
    and coalesce(d.ends_on, 'infinity'::date) >= r.first_day
  order by d.trailer_id nulls first
  limit 1;
$$;

revoke all on function app.asset_order_conflict(uuid, uuid, public.orders) from public, anon, authenticated;

/*
 * Требования к машине (20261028230100_requirements_all_paths) плюс
 * «не вне работы в дни заказа» — первым, до раннего выхода без
 * требований к кузову.
 */
create or replace function app.vehicle_meets_requirements(p_vehicle_id uuid, p_order public.orders)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles;
  v_conflict text := app.asset_order_conflict(p_vehicle_id, null, p_order);
begin
  if v_conflict is not null then
    return v_conflict;
  end if;
  if p_order.required_body is null and coalesce(array_length(p_order.required_loading, 1), 0) = 0 then
    return null;
  end if;
  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if v_vehicle.vehicle_class = 'TRACTOR' then
    return 'У заказа требования к кузову полуприцепа — откликнитесь сцепкой с подходящим полуприцепом.';
  end if;
  if p_order.required_body is not null and v_vehicle.body_type::text is distinct from p_order.required_body then
    return 'Нужен другой кузов.';
  end if;
  if not (coalesce(v_vehicle.loading, '{}') @> coalesce(p_order.required_loading, '{}')) then
    return 'Нет нужного способа загрузки.';
  end if;
  return null;
end;
$$;

/* Сцепка (20261107010000_final_review) плюс машина и прицеп не вне работы в дни заказа. */
create or replace function app.combo_fit_reason(p_combo public.vehicle_combos, p_order public.orders)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app.asset_order_conflict(p_combo.vehicle_id, p_combo.trailer_id, p_order),
    (select f.reason from app.combo_fit(p_combo, p_order) f)
  );
$$;

-- ── Дефект «ехать нельзя» — и для прицепа ─────────────────────────

create or replace function app.defect_downtime_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'OPEN' and new.status <> 'OPEN' then
    update public.vehicle_downtime
    set ended_at = now(), end_kind = 'RESOLVED', ended_by = new.resolved_by
    where defect_id = new.id and ended_at is null;
    return new;
  end if;

  if new.status = 'OPEN' and new.severity = 'UNSAFE'
     and (tg_op = 'INSERT' or old.status <> 'OPEN' or old.severity <> 'UNSAFE') then
    insert into public.vehicle_downtime (company_id, vehicle_id, trailer_id, reason, defect_id, created_by)
    values (new.company_id, new.vehicle_id, new.trailer_id, 'DEFECT', new.id, new.reported_by)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

/* Уже открытые дефекты «ехать нельзя» на прицепах. */
insert into public.vehicle_downtime (company_id, trailer_id, reason, defect_id, created_by, starts_on)
select d.company_id, d.trailer_id, 'DEFECT', d.id, d.reported_by, (d.reported_at at time zone 'Europe/Helsinki')::date
from public.vehicle_defects d
where d.status = 'OPEN' and d.severity = 'UNSAFE' and d.trailer_id is not null
on conflict do nothing;

-- ── Уже назначенные рейсы на период вне работы ────────────────────

/*
 * Рейсы своей компании (ждут водителя или в пути), назначенные на
 * машину или прицеп, у которых дни попадают на незакрытый период вне
 * работы. Только показать перевозчику: сами рейсы не трогаются.
 */
create or replace function public.fleet_downtime_orders()
returns table (downtime_id uuid, order_id uuid, ref text, status public.order_status, first_day date)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, o.id, o.ref, o.status, r.first_day
  from public.vehicle_downtime d
  join public.orders o
    on o.assigned_company_id = d.company_id
   and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
   and ((d.vehicle_id is not null and o.assigned_vehicle_id = d.vehicle_id)
     or (d.trailer_id is not null and o.assigned_trailer_id = d.trailer_id))
  cross join lateral app.order_day_range(o) r
  where d.company_id = (select app.current_company_id())
    and d.ended_at is null
    and d.starts_on <= r.last_day
    and coalesce(d.ends_on, 'infinity'::date) >= r.first_day
  order by r.first_day;
$$;

revoke all on function public.fleet_downtime_orders() from public, anon;
grant execute on function public.fleet_downtime_orders() to authenticated;

/* То же для уведомлений сервера: рейсы одного периода вне работы. */
create or replace function public.downtime_orders_of(p_downtime_id uuid)
returns table (order_id uuid, ref text, first_day date)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.ref, r.first_day
  from public.vehicle_downtime d
  join public.orders o
    on o.assigned_company_id = d.company_id
   and o.status in ('AWAIT_DRIVER', 'IN_PROGRESS')
   and ((d.vehicle_id is not null and o.assigned_vehicle_id = d.vehicle_id)
     or (d.trailer_id is not null and o.assigned_trailer_id = d.trailer_id))
  cross join lateral app.order_day_range(o) r
  where d.id = p_downtime_id
    and d.starts_on <= r.last_day
    and coalesce(d.ends_on, 'infinity'::date) >= r.first_day
  order by r.first_day;
$$;

revoke all on function public.downtime_orders_of(uuid) from public, anon, authenticated;
grant execute on function public.downtime_orders_of(uuid) to service_role;

-- ── Прицеп своего рейса — не вне работы в дни рейса ───────────────

/* 20261028233000_trip_trailer плюс проверка прицепа вне работы (код 55003, текст «Вне работы…»). */
create or replace function public.carrier_set_trip_trailer(p_order_id uuid, p_trailer_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_vehicle public.vehicles;
  v_trailer public.trailers;
  v_company uuid := (select app.current_company_id());
  v_conflict text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.assigned_company_id is distinct from v_company then
    raise exception 'Рейс не найден.' using errcode = '42501';
  end if;
  if v_order.status not in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    raise exception 'Прицеп меняется только у назначенного рейса.' using errcode = '55000';
  end if;

  if p_trailer_id is not null then
    select * into v_vehicle from public.vehicles where id = v_order.assigned_vehicle_id;
    select * into v_trailer from public.trailers where id = p_trailer_id and company_id = v_company;
    if v_trailer.id is null then
      raise exception 'Прицеп не найден.' using errcode = '42501';
    end if;
    if (v_trailer.kind = 'SEMI' and v_vehicle.vehicle_class <> 'TRACTOR')
       or (v_trailer.kind <> 'SEMI' and v_vehicle.vehicle_class not in ('TRUCK', 'TIPPER')) then
      raise exception 'Этот прицеп к машине рейса не цепляется.' using errcode = '22023';
    end if;
    v_conflict := app.asset_order_conflict(null, p_trailer_id, v_order);
    if v_conflict is not null then
      raise exception '%', v_conflict using errcode = '55003';
    end if;
    if v_order.required_body is not null
       and v_trailer.body_type::text is distinct from v_order.required_body
       and v_vehicle.body_type::text is distinct from v_order.required_body then
      raise exception 'Нужен другой кузов.' using errcode = '55003';
    end if;
    if not ((coalesce(v_vehicle.loading, '{}') || coalesce(v_trailer.loading, '{}')) @> coalesce(v_order.required_loading, '{}')) then
      raise exception 'Нет нужного способа загрузки.' using errcode = '55003';
    end if;
  end if;

  update public.orders set assigned_trailer_id = p_trailer_id where id = p_order_id returning * into v_order;
  return v_order;
end;
$$;
