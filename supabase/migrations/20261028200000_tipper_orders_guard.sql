-- ═══════════════════════════════════════════════════════════════════
-- RAHTIS · самосвальные заказы: защита объекта и итога (28.10.2026)
--
-- Проверка коммита cd668ee:
--   1. site_jobs.order_id мог записать сам перевозчик (политика
--      site_jobs_own пускает вставку и правку своей строки), и триггер
--      подхватывал чужой объект под чужой заказ. Теперь order_id ставит
--      только триггер заказа (флаг сеанса rahtis.tipper_job).
--   2. Смена перевозчика: прежний объект отвязывается от заказа и
--      закрывается, новому заводится свой. Итог считается только по
--      дням и рейсам назначенной компании.
--   3. Итог по часам: у объекта под заказ конец дня и запас правит
--      только водитель своими отметками (не кабинет), а день считается
--      не длиннее 16 часов.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. order_id — только из триггера заказа ───────────────────────

create or replace function app.site_job_order_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.order_id is distinct from (case when tg_op = 'UPDATE' then old.order_id end)
     and coalesce(current_setting('rahtis.tipper_job', true), '') <> 'on' then
    raise exception 'Объект под заказ заводит только платформа.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.site_job_order_guard() from public, anon, authenticated;

create trigger site_jobs_order_guard
  before insert or update of order_id on public.site_jobs
  for each row execute function app.site_job_order_guard();

-- ── 2. Смена перевозчика ──────────────────────────────────────────

create or replace function app.on_tipper_order_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pickup public.order_stops;
  v_shipper public.companies;
  v_job public.site_jobs;
begin
  if new.haul_kind <> 'TIPPER' then
    return new;
  end if;

  perform set_config('rahtis.tipper_job', 'on', true);

  select * into v_job from public.site_jobs where order_id = new.id;

  /* Заказ ушёл к другому перевозчику или с него: прежний объект отвязывается и закрывается. */
  if v_job.id is not null and (new.assigned_company_id is null or v_job.company_id <> new.assigned_company_id) then
    update public.site_jobs set order_id = null, status = 'CLOSED' where id = v_job.id;
    v_job := null;
  end if;

  if new.assigned_company_id is not null and new.status in ('AWAIT_DRIVER', 'IN_PROGRESS') then
    if v_job.id is not null then
      update public.site_jobs set status = 'ACTIVE' where id = v_job.id and status <> 'ACTIVE';
      perform set_config('rahtis.tipper_job', '', true);
      return new;
    end if;

    select * into v_pickup from public.order_stops
    where order_id = new.id and role = 'PICKUP' order by sequence limit 1;
    select * into v_shipper from public.companies where id = new.shipper_company_id;

    insert into public.site_jobs (
      company_id, order_id, name, address, lat, lon, country,
      customer_name, customer_business_id, customer_email, customer_country,
      pricing, rate_cents, material_code, invoice_schedule)
    values (
      new.assigned_company_id, new.id,
      left(new.ref || ' · ' || coalesce(v_pickup.place_name, v_pickup.company_name, v_pickup.city, ''), 120),
      nullif(concat_ws(', ', v_pickup.address, v_pickup.city), ''),
      v_pickup.lat, v_pickup.lon,
      coalesce(nullif(v_pickup.country, ''), 'FI'),
      coalesce(nullif(btrim(v_shipper.name), ''), new.ref),
      v_shipper.business_id, v_shipper.contact_email,
      coalesce(nullif(v_shipper.country, ''), 'FI'),
      new.site_pricing, new.site_rate_cents, coalesce(new.material_code, '170504'), 'MANUAL');
  elsif v_job.id is not null then
    update public.site_jobs set status = 'CLOSED' where id = v_job.id and status <> 'CLOSED';
  end if;

  perform set_config('rahtis.tipper_job', '', true);
  return new;
end;
$$;

-- ── 3. Итог: только назначенная компания, день не длиннее 16 часов ─

create or replace function app.tipper_order_totals(p_order_id uuid)
returns table (days integer, open_days integer, minutes integer, loads integer, net_kg integer)
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select assigned_company_id as company_id from public.orders where id = p_order_id
  ), j as (
    select sj.id from public.site_jobs sj, o where sj.order_id = p_order_id and sj.company_id = o.company_id
  ), d as (
    select sd.id, sd.arrived_at, sd.ended_at, sd.buffer_minutes,
           (select max(l.unloaded_at) from public.site_loads l where l.day_id = sd.id) as last_unload
    from public.site_days sd, o
    where sd.job_id in (select id from j) and sd.company_id = o.company_id
  ), e as (
    select d.*,
           case
             when d.ended_at is not null and d.last_unload is not null
               then greatest(d.ended_at, d.last_unload + make_interval(mins => d.buffer_minutes))
             when d.ended_at is not null then d.ended_at
             when d.last_unload is not null then d.last_unload + make_interval(mins => d.buffer_minutes)
           end as day_end
    from d
  )
  select
    count(*)::integer,
    count(*) filter (where e.day_end is null)::integer,
    coalesce(sum(least(16 * 60, greatest(0, round(extract(epoch from e.day_end - e.arrived_at) / 60)))) filter (where e.day_end is not null), 0)::integer,
    (select count(*)::integer from public.site_loads l, o where l.job_id in (select id from j) and l.company_id = o.company_id),
    (select coalesce(sum(l.net_kg), 0)::integer from public.site_loads l, o where l.job_id in (select id from j) and l.company_id = o.company_id)
  from e;
$$;

/*
 * Конец дня и запас у объекта под заказ правит только водитель своими
 * отметками (driver_site_action — security definer, от имени владельца
 * функции): правка из кабинета меняла бы итоговую цену заказа.
 */
create or replace function app.site_day_order_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.ended_at is distinct from old.ended_at or new.buffer_minutes is distinct from old.buffer_minutes)
     and current_user = 'authenticated'
     and exists (select 1 from public.site_jobs j where j.id = new.job_id and j.order_id is not null) then
    raise exception 'День под заказ платформы меняется только отметками водителя.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app.site_day_order_guard() from public, anon, authenticated;

create trigger site_days_order_guard
  before update of ended_at, buffer_minutes on public.site_days
  for each row execute function app.site_day_order_guard();
